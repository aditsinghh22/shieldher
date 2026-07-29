import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

type LawyerProfile = {
  id: string;
  full_name: string;
  short_bio: string;
  specialization: string;
  office_city: string;
  years_of_experience: string;
  bar_council_id: string;
  contact_number: string;
  joined_at: string;
  public_key?: string;
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

function getLawyerIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const segments = pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '').trim();
}

export async function GET(request: Request) {
  try {
    const requesterClient = await createSupabaseServerClient();
    const {
      data: { user: requester },
    } = await requesterClient.auth.getUser();

    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lawyerId = getLawyerIdFromUrl(request.url);
    if (!lawyerId) {
      return NextResponse.json({ error: 'Lawyer ID is required' }, { status: 400 });
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

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(lawyerId);
    if (error || !data.user) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    const metadata = asObject(data.user.user_metadata);
    if (toText(metadata.role) !== 'lawyer') {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    const lawyerProfile = asObject(metadata.lawyer_profile);
    const lawyer: LawyerProfile = {
      id: data.user.id,
      full_name: toText(metadata.full_name) || data.user.email?.split('@')[0] || 'Lawyer',
      short_bio: toText(lawyerProfile.short_bio),
      specialization: toText(lawyerProfile.specialization) || 'Not specified',
      office_city: toText(lawyerProfile.office_city) || 'Not specified',
      years_of_experience: toText(lawyerProfile.years_of_experience) || 'Not specified',
      bar_council_id: toText(lawyerProfile.bar_council_id) || 'Not specified',
       contact_number: toText(lawyerProfile.contact_number) || toText(metadata.phone) || 'Not provided',
      joined_at: data.user.created_at ?? '',
      public_key: toText(metadata.public_key),
    };

    return NextResponse.json({ lawyer });
  } catch (error: unknown) {
    console.error('Lawyer profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch lawyer profile' }, { status: 500 });
  }
}
