import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

type LawyerDirectoryItem = {
  id: string;
  full_name: string;
  short_bio: string;
  specialization: string;
  office_city: string;
  years_of_experience: string;
  bar_council_id: string;
  contact_number: string;
  joined_at: string;
};

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const lawyers: LawyerDirectoryItem[] = [];
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) throw error;

      for (const authUser of data.users) {
        const metadata = asObject(authUser.user_metadata);
        if (metadata.role !== 'lawyer') continue;

        const lawyerProfile = asObject(metadata.lawyer_profile);
        const fullName = toText(metadata.full_name) || authUser.email?.split('@')[0] || 'Lawyer';

        lawyers.push({
          id: authUser.id,
          full_name: fullName,
          short_bio: toText(lawyerProfile.short_bio),
          specialization: toText(lawyerProfile.specialization) || 'Not specified',
          office_city: toText(lawyerProfile.office_city) || 'Not specified',
          years_of_experience: toText(lawyerProfile.years_of_experience) || 'Not specified',
          bar_council_id: toText(lawyerProfile.bar_council_id) || 'Not specified',
          contact_number:
            toText(lawyerProfile.contact_number) || toText(metadata.phone) || 'Not provided',
          joined_at: authUser.created_at ?? '',
        });
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    lawyers.sort((a, b) => {
      const aTime = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const bTime = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ lawyers });
  } catch (error: unknown) {
    console.error('Lawyers directory error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lawyers directory' },
      { status: 500 }
    );
  }
}
