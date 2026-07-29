import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { decryptBuffer, decryptText } from '@/lib/crypto-server';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function getSelectedLawyerId(metadata: Record<string, unknown>): string {
  const directId = toText(metadata.selected_lawyer_id);
  if (directId) return directId;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.id);
}

function getSelectedLawyerName(metadata: Record<string, unknown>): string {
  const directName = toText(metadata.selected_lawyer_name);
  if (directName) return directName;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.name);
}

export async function GET(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    const uploadId = decodeURIComponent(pathSegments[pathSegments.length - 1] ?? '').trim();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterMetadata = asObject(user.user_metadata);
    if (toText(requesterMetadata.role) !== 'lawyer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // 1. Fetch upload record (with ALL fields including file_iv, original_type)
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle();

    if (uploadError) throw uploadError;
    if (!uploadData) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const upload = uploadData;

    // 2. Verify lawyer-client relationship
    const { data: clientUserResult, error: clientUserError } =
      await supabaseAdmin.auth.admin.getUserById(upload.user_id);

    if (clientUserError) throw clientUserError;
    const clientUser = clientUserResult?.user;
    if (!clientUser) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientMetadata = asObject(clientUser.user_metadata);
    const requesterLawyerId = normalize(user.id);
    const requesterLawyerName = normalize(toText(requesterMetadata.full_name));
    const selectedLawyerId = normalize(getSelectedLawyerId(clientMetadata));
    const selectedLawyerName = normalize(getSelectedLawyerName(clientMetadata));

    const selectedById = Boolean(selectedLawyerId) && selectedLawyerId === requesterLawyerId;
    const selectedByName =
      Boolean(selectedLawyerName) &&
      Boolean(requesterLawyerName) &&
      selectedLawyerName === requesterLawyerName;

    if (!selectedById && !selectedByName) {
      return NextResponse.json({ error: 'Access denied for this client evidence' }, { status: 403 });
    }

    // 3. Fetch analysis results (ALL fields including encrypted ones)
    const { data: analysisRows, error: analysisError } = await supabaseAdmin
      .from('analysis_results')
      .select('*')
      .eq('upload_id', uploadId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (analysisError) throw analysisError;
    const analysis = analysisRows?.[0];

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // 4. Get the client's evidence_access_key for server-side decryption
    const masterKey = toText(clientMetadata.evidence_access_key);

    let decryptedAnalysis = { ...analysis };
    let decryptedMediaArray: { url: string; decrypted: boolean }[] = [];

    if (masterKey) {
      // 5. Decrypt analysis text fields
      if (analysis.encrypted_summary) {
        try {
          const iv = analysis.encryption_iv;
          const summary = decryptText(analysis.encrypted_summary, masterKey, iv);
          const flagsJson = decryptText(analysis.encrypted_flags, masterKey, iv);
          const detailsJson = decryptText(analysis.encrypted_details, masterKey, iv);

          decryptedAnalysis.summary = summary;
          decryptedAnalysis.flags = flagsJson ? JSON.parse(flagsJson) : (analysis.flags || []);
          decryptedAnalysis.details = detailsJson ? JSON.parse(detailsJson) : (analysis.details || {});
        } catch (e) {
          console.error('[LawyerAnalysis] Text decryption failed:', e);
        }
      }

      // 6. Decrypt media files
      const fileUrls = (upload.file_url || '').split(',').filter(Boolean);
      const fileIVs = (upload.file_iv || '').split(',').filter(Boolean);
      const fileTypes = (upload.original_type || '').split(',').filter(Boolean);

      decryptedMediaArray = await Promise.all(fileUrls.map(async (url: string, idx: number) => {
        try {
          const iv = fileIVs[idx];
          if (!iv) return { url, decrypted: false };

          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch from storage');

          const encryptedBuffer = Buffer.from(await res.arrayBuffer());
          const decryptedBuffer = decryptBuffer(encryptedBuffer, masterKey, iv);

          const mimeType = fileTypes[idx] || 'image/png';
          return {
            url: `data:${mimeType};base64,${decryptedBuffer.toString('base64')}`,
            decrypted: true,
          };
        } catch (e) {
          console.error(`[LawyerAnalysis] Media decryption failed for asset ${idx}:`, e);
          return { url, decrypted: false };
        }
      }));
    }

    return NextResponse.json({
      upload,
      analysis: decryptedAnalysis,
      decryptedMediaArray,
      client: {
        id: clientUser.id,
        name: toText(clientMetadata.full_name) || clientUser.email?.split('@')[0] || 'ShieldHer User',
        location: toText(clientMetadata.country) || 'Location unavailable',
      },
    });
  } catch (error: unknown) {
    console.error('Lawyer analysis details error:', error);
    return NextResponse.json({ error: 'Failed to load client analysis details' }, { status: 500 });
  }
}
