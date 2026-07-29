import { NextResponse } from 'next/server';
import {
  asObject,
  createAdminClient,
  getAuthenticatedUser,
  parseRole,
  toText,
} from '@/lib/communication/server';

const DEFAULT_INTRO_MESSAGE = 'Hello, I would like to connect with you regarding legal support.';

export async function POST(request: Request) {
  try {
    const requester = await getAuthenticatedUser();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (requester.role !== 'user') {
      return NextResponse.json({ error: 'Only users can initiate this action' }, { status: 403 });
    }

    const payload = (await request.json()) as { lawyerId?: unknown; lawyer_id?: unknown };
    const lawyerId = toText(payload?.lawyerId ?? payload?.lawyer_id).trim();
    if (!lawyerId) {
      return NextResponse.json({ error: 'Lawyer ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: lawyerLookup, error: lawyerLookupError } =
      await supabaseAdmin.auth.admin.getUserById(lawyerId);

    if (lawyerLookupError || !lawyerLookup.user) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    const lawyerMetadata = asObject(lawyerLookup.user.user_metadata);
    const lawyerRole = parseRole(lawyerMetadata.role);
    if (lawyerRole !== 'lawyer') {
      return NextResponse.json({ error: 'Invalid lawyer account' }, { status: 400 });
    }

    const lawyerName = toText(lawyerMetadata.full_name) || lawyerLookup.user.email?.split('@')[0] || 'Lawyer';

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('communication_threads')
      .select('id')
      .eq('user_id', requester.id)
      .eq('lawyer_id', lawyerId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    let threadId = toText(existing?.id);
    let created = false;

    if (!threadId) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('communication_threads')
        .insert({
          user_id: requester.id,
          lawyer_id: lawyerId,
          user_name: requester.fullName,
          lawyer_name: lawyerName,
          initiated_by_user_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      threadId = toText(inserted?.id);
      created = true;
    }

    if (created) {
      const { error: firstMessageError } = await supabaseAdmin.from('communication_messages').insert({
        thread_id: threadId,
        sender_id: requester.id,
        sender_role: 'user',
        body: DEFAULT_INTRO_MESSAGE,
      });

      if (firstMessageError) {
        throw firstMessageError;
      }
    }

    return NextResponse.json({ threadId, created });
  } catch (error: unknown) {
    console.error('Start communication error:', error);
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : '';

    if (message.toLowerCase().includes('communication_threads')) {
      return NextResponse.json(
        { error: 'Communication setup is incomplete. Please run the latest Supabase schema migration.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Could not start communication thread' },
      { status: 500 }
    );
  }
}
