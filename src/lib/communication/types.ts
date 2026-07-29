export type ConversationRow = {
  id: string;
  user_id: string;
  lawyer_id: string;
  user_name: string;
  lawyer_name: string;
  initiated_by_user_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: 'user' | 'lawyer';
  body: string;
  read_at: string | null;
  created_at: string;
};
