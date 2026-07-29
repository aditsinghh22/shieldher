import { NextResponse } from 'next/server';
import {
  createAdminClient,
  getAuthenticatedUser,
} from '@/lib/communication/server';

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
      .select('id')
      .eq(roleColumn, requester.id);

    if (threadError) {
      throw threadError;
    }

    const threadIds = ((threadData as { id: string }[] | null) ?? []).map((item) => item.id);
    if (threadIds.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const { count, error: unreadError } = await supabaseAdmin
      .from('communication_messages')
      .select('id', { head: true, count: 'exact' })
      .in('thread_id', threadIds)
      .neq('sender_id', requester.id)
      .is('read_at', null);

    if (unreadError) {
      throw unreadError;
    }

    return NextResponse.json({ unreadCount: count ?? 0 });
  } catch (error: unknown) {
    console.error('Unread communication count error:', error);
    return NextResponse.json({ error: 'Failed to load unread count' }, { status: 500 });
  }
}
