import { NextResponse } from 'next/server';
import {
  createAdminClient,
  getAuthenticatedUser,
} from '@/lib/communication/server';
import type { ConversationRow, MessageRow } from '@/lib/communication/types';

type ConversationListItem = {
  id: string;
  counterpart_id: string;
  counterpart_name: string;
  unread_count: number;
  last_message: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

function clipMessage(value: string, max = 120): string {
  if (value.length <= max) return value;
  const safeMax = Math.max(3, max);
  return `${value.slice(0, safeMax - 3)}...`;
}

export async function GET() {
  try {
    const requester = await getAuthenticatedUser();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const roleColumn = requester.role === 'lawyer' ? 'lawyer_id' : 'user_id';

    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('communication_threads')
      .select('id, user_id, lawyer_id, user_name, lawyer_name, initiated_by_user_at, created_at, updated_at')
      .eq(roleColumn, requester.id)
      .order('updated_at', { ascending: false });

    if (threadError) {
      throw threadError;
    }

    const threads = (threadData as ConversationRow[] | null) ?? [];
    if (threads.length === 0) {
      return NextResponse.json({
        role: requester.role,
        total_unread: 0,
        conversations: [] as ConversationListItem[],
      });
    }

    const threadIds = threads.map((thread) => thread.id);
    const unreadByThread = new Map<string, number>();
    const latestMessageByThread = new Map<string, MessageRow>();

    const { data: unreadData, error: unreadError } = await supabaseAdmin
      .from('communication_messages')
      .select('thread_id')
      .in('thread_id', threadIds)
      .neq('sender_id', requester.id)
      .is('read_at', null);

    if (unreadError) {
      throw unreadError;
    }

    for (const row of unreadData ?? []) {
      const threadId = String((row as { thread_id?: unknown }).thread_id ?? '');
      if (!threadId) continue;
      unreadByThread.set(threadId, (unreadByThread.get(threadId) ?? 0) + 1);
    }

    await Promise.all(
      threadIds.map(async (threadId) => {
        const { data, error } = await supabaseAdmin
          .from('communication_messages')
          .select('id, thread_id, sender_id, sender_role, body, read_at, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          latestMessageByThread.set(threadId, data as MessageRow);
        }
      })
    );

    const conversations: ConversationListItem[] = threads.map((thread) => {
      const counterpartId = requester.role === 'lawyer' ? thread.user_id : thread.lawyer_id;
      const counterpartName = requester.role === 'lawyer' ? thread.user_name : thread.lawyer_name;
      const unreadCount = unreadByThread.get(thread.id) ?? 0;
      const latestMessage = latestMessageByThread.get(thread.id);
      const lastMessageAt = latestMessage?.created_at || thread.updated_at || thread.created_at;
      const lastMessage = latestMessage
        ? clipMessage(
            latestMessage.sender_id === requester.id
              ? `You: ${latestMessage.body}`
              : latestMessage.body
          )
        : 'Conversation started';

      return {
        id: thread.id,
        counterpart_id: counterpartId,
        counterpart_name: counterpartName || 'ShieldHer User',
        unread_count: unreadCount,
        last_message: lastMessage,
        last_message_at: lastMessageAt,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
      };
    });

    const totalUnread = conversations.reduce((sum, item) => sum + item.unread_count, 0);

    return NextResponse.json({
      role: requester.role,
      total_unread: totalUnread,
      conversations,
    });
  } catch (error: unknown) {
    console.error('Communications list error:', error);
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
  }
}
