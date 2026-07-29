import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get the upload record to find storage file paths
    const { data: upload, error: fetchError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: 'Upload not found or access denied' }, { status: 404 });
    }

    // 3. Clean up files from storage (screenshots bucket)
    const fileUrls = (upload.file_url || '').split(',').filter(Boolean);
    const filesToRemove: string[] = [];

    for (const url of fileUrls) {
      // Extract path: looks like ".../screenshots/[path]"
      const parts = url.split('/screenshots/');
      if (parts.length > 1) {
        filesToRemove.push(decodeURIComponent(parts[1]));
      }
    }

    if (filesToRemove.length > 0) {
      console.log(`[DeleteProxy] Removing ${filesToRemove.length} files from storage...`);
      const { error: storageError } = await supabase.storage
        .from('screenshots')
        .remove(filesToRemove);
      
      if (storageError) {
        console.error('[DeleteProxy] Storage cleanup error:', storageError);
        // We continue anyway to ensure the DB record is removed even if storage cleanup has issues
      }
    }

    // 4. Delete the upload record (Cascade delete should handle analysis_results)
    const { error: deleteError } = await supabase
      .from('uploads')
      .delete()
      .eq('id', uploadId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DeleteProxy] Critical error:', error);
    return NextResponse.json(
      { error: 'Failed to permanently delete forensic data' },
      { status: 500 }
    );
  }
}
