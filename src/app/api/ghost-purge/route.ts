import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is designed to be called by a cron job (e.g., Supabase Edge Functions, Vercel Cron)
// It purges uploads, analyses, reports, and storage files older than 24 hours
// for users who have Ghost Mode enabled.
//
// ZERO ADMIN ACCESS: This route only DELETES records and storage blobs.
// It never reads or decrypts user content — all stored data is encrypted
// with user-specific keys that only the user's browser can decrypt.

export async function GET(request: Request) {
  // Verify the request has a valid authorization key
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // Find all users with ghost_mode enabled
    const { data: ghostUsers, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('ghost_mode', true);

    if (profileError) {
      throw profileError;
    }

    if (!ghostUsers || ghostUsers.length === 0) {
      return NextResponse.json({ message: 'No ghost mode users found', purged: 0 });
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let totalPurged = 0;

    for (const user of ghostUsers) {
      // 1. Find old uploads for this user
      const { data: oldUploads } = await supabaseAdmin
        .from('uploads')
        .select('id, file_url')
        .eq('user_id', user.id)
        .lt('created_at', cutoff);

      if (oldUploads && oldUploads.length > 0) {
        const uploadIds = oldUploads.map((u) => u.id);

        // 2. Find and delete associated reports
        const { data: oldReports } = await supabaseAdmin
          .from('reports')
          .select('id, file_url')
          .in('upload_id', uploadIds);

        if (oldReports && oldReports.length > 0) {
          // Delete report files from storage
          const reportPaths = oldReports
            .map((r) => {
              const parts = r.file_url.split('/reports/');
              return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
            })
            .filter(Boolean) as string[];

          if (reportPaths.length > 0) {
            await supabaseAdmin.storage.from('reports').remove(reportPaths);
          }

          // Delete report records
          await supabaseAdmin
            .from('reports')
            .delete()
            .in('id', oldReports.map((r) => r.id));
        }

        // 3. Delete analysis results (cascaded from uploads, but explicit for clarity)
        await supabaseAdmin
          .from('analysis_results')
          .delete()
          .in('upload_id', uploadIds);

        // 4. Delete screenshot files from storage
        const screenshotPaths = oldUploads
          .map((u) => {
            const parts = u.file_url.split('/screenshots/');
            return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
          })
          .filter(Boolean) as string[];

        if (screenshotPaths.length > 0) {
          await supabaseAdmin.storage.from('screenshots').remove(screenshotPaths);
        }

        // 5. Delete upload records
        await supabaseAdmin
          .from('uploads')
          .delete()
          .in('id', uploadIds);

        totalPurged += oldUploads.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Purged ${totalPurged} uploads across ${ghostUsers.length} ghost mode users`,
      purged: totalPurged,
    });
  } catch (error: unknown) {
    console.error('Ghost Purge Error:', error);
    return NextResponse.json(
      { error: 'Failed to run ghost purge' },
      { status: 500 }
    );
  }
}
