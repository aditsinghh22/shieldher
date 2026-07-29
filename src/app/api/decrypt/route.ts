import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptBuffer, decryptText } from '@/lib/crypto-server';
import { asObject, createAdminClient, toText } from '@/lib/communication/server';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, masterKey } = await request.json();

    if (!uploadId || !masterKey) {
      return NextResponse.json({ error: 'Upload ID and Master Key are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user: requester } } = await supabase.auth.getUser();

    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch upload record using ADMIN client to bypass RLS (authorization check follows)
    const { data: upload, error: uploadError } = await supabaseAdmin
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const requesterMetadata = asObject(requester.user_metadata);
    const isOwner = upload.user_id === requester.id;
    let isAuthorizedLawyer = false;

    if (!isOwner && toText(requesterMetadata.role) === 'lawyer') {
      try {
        const { data: clientLookup } = await supabaseAdmin.auth.admin.getUserById(upload.user_id);
        const clientMetadata = asObject(clientLookup?.user?.user_metadata);
        const acceptedCases = clientMetadata.accepted_cases;
        
        if (Array.isArray(acceptedCases)) {
          isAuthorizedLawyer = acceptedCases.some((c: any) => 
            toText(c.upload_id) === uploadId && 
            toText(c.lawyer_id) === requester.id && 
            toText(c.status) === 'accepted'
          );
        }
      } catch (e) {
        console.error('[DecryptProxy] Lawyer auth verification failed:', e);
      }
    }

    if (!isOwner && !isAuthorizedLawyer) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 2. Fetch analysis results using ADMIN client
    const { data: analysis } = await supabaseAdmin
      .from('analysis_results')
      .select('*')
      .eq('upload_id', uploadId)
      .maybeSingle();

    // 3. Decrypt analysis fields
    let decryptedAnalysis = null;
    if (analysis) {
      let summary = analysis.summary;
      let flags = analysis.flags;
      let details = analysis.details;

      if (analysis.encrypted_summary) {
        try {
          const iv = analysis.encryption_iv;
          summary = decryptText(analysis.encrypted_summary, masterKey, iv);
          const flagsJson = decryptText(analysis.encrypted_flags, masterKey, iv);
          const detailsJson = decryptText(analysis.encrypted_details, masterKey, iv);
          
          flags = flagsJson ? JSON.parse(flagsJson) : (analysis.flags || []);
          details = detailsJson ? JSON.parse(detailsJson) : (analysis.details || {});
        } catch (e) {
          console.error('[DecryptProxy] Text decryption failed:', e);
        }
      }

      decryptedAnalysis = {
        ...analysis,
        summary,
        flags,
        details,
      };
    }

    // 4. Decrypt Media (Support multiple files via commas)
    const fileUrls = (upload.file_url || '').split(',').filter(Boolean);
    const fileIVs = (upload.file_iv || '').split(',').filter(Boolean);
    const fileTypes = (upload.original_type || '').split(',').filter(Boolean);
    
    const decryptedMediaArray = await Promise.all(fileUrls.map(async (url: string, idx: number) => {
      try {
        const iv = fileIVs[idx];
        if (!iv) return { url, decrypted: false }; // Already public or no IV

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch from storage');
        
        const encryptedBuffer = Buffer.from(await res.arrayBuffer());
        const decryptedBuffer = decryptBuffer(encryptedBuffer, masterKey, iv);
        
        const mimeType = fileTypes[idx] || 'image/png';
        return {
          url: `data:${mimeType};base64,${decryptedBuffer.toString('base64')}`,
          decrypted: true
        };
      } catch (e) {
        console.error(`[DecryptProxy] Media decryption failed for asset ${idx}:`, e);
        return { url, decrypted: false };
      }
    }));

    // 5. If this is the OWNER decrypting, persist the masterKey for lawyer access
    if (isOwner) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(requester.id, {
          user_metadata: {
            ...requesterMetadata,
            evidence_access_key: masterKey,
          }
        });
      } catch (e) {
        console.error('[DecryptProxy] Failed to persist evidence access key:', e);
      }
    }

    return NextResponse.json({
      success: true,
      analysis: decryptedAnalysis,
      upload: upload,
      decryptedMedia: decryptedMediaArray[0]?.url || null, // Primary for legacy UI
      decryptedMediaArray, // All media for modern UI
    });

  } catch (error: any) {
    console.error('[DecryptProxy] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
