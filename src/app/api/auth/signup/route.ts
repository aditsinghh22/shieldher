import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_REGEX, E164_REGEX, getPhoneAliasEmail } from '@/lib/auth/phoneAuth';

// Use service role key to auto-confirm users on signup
export async function POST(request: NextRequest) {
  try {
    const { email, phone, password, fullName, country, role } = await request.json();

    if ((!email && !phone) || !password) {
      return NextResponse.json(
        { error: 'Email or phone number with password is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    const isValidEmail = !normalizedEmail || EMAIL_REGEX.test(normalizedEmail);
    const isValidPhone = !normalizedPhone || E164_REGEX.test(normalizedPhone);

    if (!isValidEmail || !isValidPhone) {
      return NextResponse.json({ error: 'Invalid email or phone number format' }, { status: 400 });
    }

    const normalizedRole = role === 'lawyer' ? 'lawyer' : 'user';

    const authEmail = normalizedPhone ? getPhoneAliasEmail(normalizedPhone) : normalizedEmail;

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const createUserPayload: {
      email?: string;
      password: string;
      email_confirm?: boolean;
      user_metadata: { full_name: string; country: string; role: 'user' | 'lawyer'; phone?: string };
    } = {
      password,
      user_metadata: {
        full_name: fullName || '',
        country: country || 'United States',
        role: normalizedRole,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      },
    };

    if (authEmail) {
      createUserPayload.email = authEmail;
      createUserPayload.email_confirm = true;
    }

    // Create user with auto-confirm via admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: { id: data.user.id, email: data.user.email, phone: data.user.phone },
    });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
