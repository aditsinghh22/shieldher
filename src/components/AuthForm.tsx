'use client';

import { useState } from 'react';
import { Shield, Mail, Lock, User, ArrowRight, Loader, Globe, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { EMAIL_REGEX, E164_REGEX, getPhoneAliasEmail, toE164Phone } from '@/lib/auth/phoneAuth';
import styles from './AuthForm.module.css';

type AuthMethod = 'email' | 'phone';

type CountryOption = {
  name: string;
  dialCode: string;
};

type UserRole = 'user' | 'lawyer';

type AuthFormProps = {
  initialMode?: 'login' | 'signup';
};

const COUNTRY_OPTIONS: CountryOption[] = [
  { name: 'United States', dialCode: '+1' },
  { name: 'India', dialCode: '+91' },
  { name: 'United Kingdom', dialCode: '+44' },
  { name: 'Canada', dialCode: '+1' },
  { name: 'Australia', dialCode: '+61' },
  { name: 'Philippines', dialCode: '+63' },
  { name: 'Nigeria', dialCode: '+234' },
  { name: 'South Africa', dialCode: '+27' },
];

function getRoleLabel(role: UserRole | null) {
  if (role === 'lawyer') return 'Lawyer';
  if (role === 'user') return 'User';
  return null;
}

function parseRole(value: string | null): UserRole | null {
  if (value === 'lawyer' || value === 'user') return value;
  return null;
}

export default function AuthForm({ initialMode = 'login' }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('United States');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCountry = COUNTRY_OPTIONS.find((option) => option.name === country) ?? COUNTRY_OPTIONS[0];
  const countryDialCode = selectedCountry.dialCode;
  const role = parseRole(searchParams.get('role'));
  const roleLabel = getRoleLabel(role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const normalizedIdentifier = identifier.trim();
    let emailForAuth = '';
    let phoneForMetadata = '';

    if (authMethod === 'email') {
      if (!EMAIL_REGEX.test(normalizedIdentifier)) {
        setError('Please enter a valid email address');
        return;
      }
      emailForAuth = normalizedIdentifier.toLowerCase();
    } else {
      const formattedPhone = toE164Phone(normalizedIdentifier, countryDialCode);
      if (!E164_REGEX.test(formattedPhone)) {
        setError('Please enter a valid phone number');
        return;
      }
      phoneForMetadata = formattedPhone;
      emailForAuth = getPhoneAliasEmail(formattedPhone);
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailForAuth,
            phone: phoneForMetadata || undefined,
            password,
            fullName,
            country,
            role: role || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to sign up');
      }


      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password,
      });

      if (signInError) throw signInError;

      const { data: { user } } = await supabase.auth.getUser();
      const metadataRole = parseRole(
        typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null
      );
      const resolvedRole = metadataRole ?? role;
      const lawyerProfileCompleted = Boolean(user?.user_metadata?.lawyer_profile_completed);
      const redirectPath =
        resolvedRole === 'lawyer'
          ? lawyerProfileCompleted
            ? '/lawyer/dashboard'
            : '/lawyer/onboarding'
          : '/dashboard';

      router.push(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Shield size={24} />
          </div>
          <h1 className={styles.title}>
            {mode === 'login'
              ? roleLabel
                ? `${roleLabel} Login`
                : 'Welcome Back'
              : roleLabel
                ? `Create ${roleLabel} Account`
                : 'Create Account'}
          </h1>
          <p className={styles.subtitle}>
            {mode === 'login'
              ? roleLabel
                ? `Sign in as a ${roleLabel.toLowerCase()}`
                : 'Sign in to access your dashboard'
              : 'Start protecting yourself today'}
          </p>
          {roleLabel && (
            <p className={styles.roleHint}>
              Account type: <strong>{roleLabel}</strong>{' '}
              <Link href="/auth" className={styles.changeRoleLink}>
                Change
              </Link>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className="label">Email Address or Phone Number</label>
            <div className={styles.methodToggle}>
              <button
                type="button"
                className={`${styles.methodBtn} ${authMethod === 'email' ? styles.methodBtnActive : ''}`}
                onClick={() => {
                  setAuthMethod('email');
                  setIdentifier('');
                  setError('');
                }}
              >
                Email Address
              </button>
              <button
                type="button"
                className={`${styles.methodBtn} ${authMethod === 'phone' ? styles.methodBtnActive : ''}`}
                onClick={() => {
                  setAuthMethod('phone');
                  setIdentifier('');
                  setError('');
                }}
              >
                Phone Number
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className={styles.field}>
              <label className="label" htmlFor="fullName">
                Full Name
              </label>
              <div className={styles.inputWrap}>
                <User size={16} className={styles.inputIcon} />
                <input
                  id="fullName"
                  type="text"
                  className={`input ${styles.inputWithIcon}`}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {(mode === 'signup' || authMethod === 'phone') && (
            <div className={styles.field}>
              <label className="label" htmlFor="country">
                Country
              </label>
              <div className={styles.inputWrap}>
                <Globe size={16} className={styles.inputIcon} />
                <select
                  id="country"
                  className={`input ${styles.inputWithIcon}`}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{ appearance: 'none', cursor: 'pointer' }}
                  required
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className="label" htmlFor="identifier">
              {authMethod === 'email' ? 'Email Address' : 'Phone Number'}
            </label>
            <div className={`${styles.inputWrap} ${authMethod === 'phone' ? styles.phoneInputWrap : ''}`}>
              {authMethod === 'email' ? (
                <Mail size={16} className={styles.inputIcon} />
              ) : (
                <Phone size={16} className={styles.inputIcon} />
              )}
              {authMethod === 'phone' && <span className={styles.dialCode}>{countryDialCode}</span>}
              <input
                id="identifier"
                type={authMethod === 'email' ? 'email' : 'tel'}
                inputMode={authMethod === 'email' ? 'email' : 'numeric'}
                className={`input ${styles.inputWithIcon} ${
                  authMethod === 'phone' ? styles.inputWithDialCode : ''
                }`}
                placeholder={authMethod === 'email' ? 'you@example.com' : 'Enter phone number'}
                value={identifier}
                onChange={(e) =>
                  setIdentifier(
                    authMethod === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value
                  )
                }
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className={styles.inputWrap}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                className={`input ${styles.inputWithIcon}`}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {message && <div className={styles.success}>{message}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <Loader size={18} className="animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            className={styles.switchBtn}
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setIdentifier('');
              setError('');
              setMessage('');
            }}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
