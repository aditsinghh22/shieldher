import { NextResponse } from 'next/server';
import {
  asObject,
  createAdminClient,
  getAuthenticatedUser,
  toText,
} from '@/lib/communication/server';

type UploadRow = {
  id: string;
  user_id: string;
  file_name: string;
  created_at: string;
};

type AcceptedCaseEntry = {
  upload_id: string;
  lawyer_id: string;
  lawyer_name: string;
  thread_id: string;
  case_file: string;
  status: 'accepted';
  accepted_at: string;
  wrapped_key?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function getSelectedLawyerId(metadata: Record<string, unknown>): string {
  const directId = toText(metadata.selected_lawyer_id).trim();
  if (directId) return directId;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.id).trim();
}

function getSelectedLawyerName(metadata: Record<string, unknown>): string {
  const directName = toText(metadata.selected_lawyer_name).trim();
  if (directName) return directName;
  const selectedLawyer = asObject(metadata.selected_lawyer);
  return toText(selectedLawyer.name).trim();
}

function listAcceptedCases(metadata: Record<string, unknown>): AcceptedCaseEntry[] {
  const value = metadata.accepted_cases;
  if (!Array.isArray(value)) return [];

  const entries: AcceptedCaseEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const entry = item as Record<string, unknown>;
    const uploadId = toText(entry.upload_id).trim();
    const lawyerId = toText(entry.lawyer_id).trim();
    const lawyerName = toText(entry.lawyer_name).trim();
    const threadId = toText(entry.thread_id).trim();
    const caseFile = toText(entry.case_file).trim();
    const status = toText(entry.status).trim().toLowerCase();
    const acceptedAt = toText(entry.accepted_at).trim();

    if (!uploadId || !lawyerId || status !== 'accepted') continue;

    entries.push({
      upload_id: uploadId,
      lawyer_id: lawyerId,
      lawyer_name: lawyerName,
      thread_id: threadId,
      case_file: caseFile,
      status: 'accepted',
      accepted_at: acceptedAt,
      wrapped_key: toText(entry.wrapped_key).trim(),
    });
  }

  return entries;
}

export async function POST(request: Request) {
  try {
    const requester = await getAuthenticatedUser();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (requester.role !== 'lawyer') {
      return NextResponse.json({ error: 'Only lawyers can accept cases' }, { status: 403 });
    }

    const payload = (await request.json()) as { uploadId?: unknown; upload_id?: unknown };
    const uploadId = toText(payload.uploadId ?? payload.upload_id).trim();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .from('uploads')
      .select('id, user_id, file_name, created_at')
      .eq('id', uploadId)
      .maybeSingle();

    if (uploadError) throw uploadError;
    if (!uploadData) {
      return NextResponse.json({ error: 'Case request not found' }, { status: 404 });
    }

    const upload = uploadData as UploadRow;

    const { data: clientLookup, error: clientLookupError } =
      await supabaseAdmin.auth.admin.getUserById(upload.user_id);

    if (clientLookupError || !clientLookup.user) {
      return NextResponse.json({ error: 'Client account not found' }, { status: 404 });
    }

    const clientUser = clientLookup.user;
    const clientMetadata = asObject(clientUser.user_metadata);
    const selectedLawyerId = normalize(getSelectedLawyerId(clientMetadata));
    const selectedLawyerName = normalize(getSelectedLawyerName(clientMetadata));
    const requesterLawyerId = normalize(requester.id);
    const requesterLawyerName = normalize(requester.fullName);

    const selectedById = Boolean(selectedLawyerId) && selectedLawyerId === requesterLawyerId;
    const selectedByName =
      Boolean(selectedLawyerName) &&
      Boolean(requesterLawyerName) &&
      selectedLawyerName === requesterLawyerName;

    if (!selectedById && !selectedByName) {
      return NextResponse.json({ error: 'You are not the selected lawyer for this client' }, { status: 403 });
    }

    const userName =
      toText(clientMetadata.full_name).trim() || clientUser.email?.split('@')[0] || 'ShieldHer User';

    const { data: existingThread, error: existingThreadError } = await supabaseAdmin
      .from('communication_threads')
      .select('id')
      .eq('user_id', upload.user_id)
      .eq('lawyer_id', requester.id)
      .maybeSingle();

    if (existingThreadError) {
      throw existingThreadError;
    }

    let threadId = toText(existingThread?.id).trim();
    if (!threadId) {
      const { data: insertedThread, error: insertedThreadError } = await supabaseAdmin
        .from('communication_threads')
        .insert({
          user_id: upload.user_id,
          lawyer_id: requester.id,
          user_name: userName,
          lawyer_name: requester.fullName,
          initiated_by_user_at: null,
        })
        .select('id')
        .single();

      if (insertedThreadError) {
        const { data: retryThread, error: retryThreadError } = await supabaseAdmin
          .from('communication_threads')
          .select('id')
          .eq('user_id', upload.user_id)
          .eq('lawyer_id', requester.id)
          .maybeSingle();

        if (retryThreadError || !retryThread?.id) {
          throw insertedThreadError;
        }

        threadId = toText(retryThread.id).trim();
      } else {
        threadId = toText(insertedThread?.id).trim();
      }
    }

    const nowIso = new Date().toISOString();
    const acceptedCases = listAcceptedCases(clientMetadata);

    const remainingCases = acceptedCases.filter(
      (entry) => !(entry.upload_id === upload.id && entry.lawyer_id === requester.id)
    );

    const pendingShares = asObject(clientMetadata.pending_lawyer_access);
    const wrappedKeyForLawyer = toText(pendingShares[requester.id]).trim();

    const acceptedEntry: AcceptedCaseEntry = {
      upload_id: upload.id,
      lawyer_id: requester.id,
      lawyer_name: requester.fullName,
      thread_id: threadId,
      case_file: upload.file_name || `Case ${upload.id.slice(0, 8)}`,
      status: 'accepted',
      accepted_at: nowIso,
      wrapped_key: wrappedKeyForLawyer,
    };

    const nextMetadata = {
      ...clientMetadata,
      accepted_cases: [acceptedEntry, ...remainingCases],
    };

    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(clientUser.id, {
      user_metadata: nextMetadata,
    });

    if (updateUserError) {
      throw updateUserError;
    }

    return NextResponse.json({
      accepted: true,
      upload_id: upload.id,
      thread_id: threadId,
      accepted_at: nowIso,
    });
  } catch (error: unknown) {
    console.error('Case accept error:', error);
    return NextResponse.json({ error: 'Could not accept this case right now' }, { status: 500 });
  }
}
