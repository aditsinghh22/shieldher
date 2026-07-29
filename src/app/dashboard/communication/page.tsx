'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CommunicationHub from '@/components/communication/CommunicationHub';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

type UserRole = 'user' | 'lawyer';

function parseRole(value: unknown): UserRole | null {
  if (value === 'user' || value === 'lawyer') return value;
  return null;
}

export default function DashboardCommunicationPage() {
  const router = useRouter();

  useEffect(() => {
    async function guardRoute() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const role = parseRole(user.user_metadata?.role);
      if (role === 'lawyer') {
        router.replace('/lawyer/communication');
      }
    }

    void guardRoute();
  }, [router]);

  return (
    <div className={styles.page}>
      <Suspense fallback={<div>Loading communication hub...</div>}>
        <CommunicationHub />
      </Suspense>
    </div>
  );
}
