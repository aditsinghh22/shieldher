import { NextResponse } from 'next/server';
import {
  createAdminClient,
  getAuthenticatedUser,
  toText,
} from '@/lib/communication/server';
import type { ConversationRow } from '@/lib/communication/types';

function getThreadIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const segments = pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments[segments.length - 2] ?? '').trim();
}

export async function POST(request: Request) {
  try {
    const requester = await getAuthenticatedUser();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = toText(getThreadIdFromUrl(request.url));
    if (!threadId) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('communication_threads')
      .select('id, user_id, lawyer_id')
      .eq('id', threadId)
      .maybeSingle();

    if (threadError) {
      throw threadError;
    }

    const thread = (threadData as Pick<ConversationRow, 'id' | 'user_id' | 'lawyer_id'> | null) ?? null;
    if (!thread) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const isAllowed =
      (requester.role === 'user' && thread.user_id === requester.id) ||
      (requester.role === 'lawyer' && thread.lawyer_id === requester.id);

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('communication_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .neq('sender_id', requester.id)
      .is('read_at', null);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Conversation read mark error:', error);
    return NextResponse.json({ error: 'Failed to update read status' }, { status: 500 });
  }
}
