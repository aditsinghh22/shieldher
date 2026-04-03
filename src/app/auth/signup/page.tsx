import AuthForm from '@/components/AuthForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - ShieldHer',
  description: 'Create your ShieldHer account to start analyzing conversations.',
};

export default function AuthSignupPage() {
  return <AuthForm initialMode="signup" />;
}
