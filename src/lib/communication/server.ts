import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export type AppRole = 'user' | 'lawyer';

export type AuthenticatedUser = {
  id: string;
  role: AppRole;
  fullName: string;
  metadata: Record<string, unknown>;
};

export function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function toText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

export function parseRole(value: unknown): AppRole | null {
  if (value === 'user' || value === 'lawyer') return value;
  return null;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const metadata = asObject(user.user_metadata);
  // Backward-compatible fallback:
  // if role metadata is missing/invalid, treat as a standard user.
  const role = parseRole(metadata.role) ?? 'user';

  const fullName = toText(metadata.full_name) || user.email?.split('@')[0] || 'ShieldHer User';

  return {
    id: user.id,
    role,
    fullName,
    metadata,
  };
}

export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server configuration missing');
  }

  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
