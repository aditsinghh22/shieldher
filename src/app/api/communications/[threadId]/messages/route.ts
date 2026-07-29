import { NextResponse } from 'next/server';
import {
  createAdminClient,
  getAuthenticatedUser,
  toText,
} from '@/lib/communication/server';
import type { ConversationRow, MessageRow } from '@/lib/communication/types';

async function getAuthorizedThread(threadId: string, requesterId: string, requesterRole: 'user' | 'lawyer') {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('communication_threads')
    .select('id, user_id, lawyer_id, user_name, lawyer_name, initiated_by_user_at, created_at, updated_at')
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  const thread = (data as ConversationRow | null) ?? null;
  if (!thread) return { supabaseAdmin, thread: null, allowed: false };

  const allowed =
    (requesterRole === 'user' && thread.user_id === requesterId) ||
    (requesterRole === 'lawyer' && thread.lawyer_id === requesterId);

  return { supabaseAdmin, thread, allowed };
}

function getThreadIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const segments = pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments[segments.length - 2] ?? '').trim();
}

export async function GET(request: Request) {
  try {
    const requester = await getAuthenticatedUser();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const threadId = toText(getThreadIdFromUrl(request.url));
    if (!threadId) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const { supabaseAdmin, thread, allowed } = await getAuthorizedThread(
      threadId,
      requester.id,
      requester.role
    );

    if (!thread) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('communication_messages')
      .select('id, thread_id, sender_id, sender_role, body, read_at, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(300);

    if (messagesError) {
      throw messagesError;
    }

    return NextResponse.json({
      thread: {
        id: thread.id,
        user_id: thread.user_id,
        lawyer_id: thread.lawyer_id,
        user_name: thread.user_name,
        lawyer_name: thread.lawyer_name,
      },
      messages: (messagesData as MessageRow[] | null) ?? [],
    });
  } catch (error: unknown) {
    console.error('Conversation messages fetch error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
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

    const { supabaseAdmin, thread, allowed } = await getAuthorizedThread(
      threadId,
      requester.id,
      requester.role
    );

    if (!thread) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = (await request.json()) as { text?: unknown };
    const messageText = toText(payload?.text).trim();
    if (!messageText) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    if (messageText.length > 2000) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('communication_messages')
      .insert({
        thread_id: threadId,
        sender_id: requester.id,
        sender_role: requester.role,
        body: messageText,
      })
      .select('id, thread_id, sender_id, sender_role, body, read_at, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ message: inserted as MessageRow });
  } catch (error: unknown) {
    console.error('Conversation message send error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
