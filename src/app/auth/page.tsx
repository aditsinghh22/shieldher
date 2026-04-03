import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Scale, Shield, UserRound } from 'lucide-react';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Choose Login Type - ShieldHer',
  description: 'Choose whether you want to continue as a user or lawyer.',
};

export default function AuthPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Shield size={24} />
          </div>
          <h1 className={styles.title}>Choose Login Type</h1>
          <p className={styles.subtitle}>
            Select how you want to continue to the signup page.
          </p>
        </div>

        <div className={styles.options}>
          <Link href="/auth/signup?role=user" className={styles.optionCard}>
            <div className={styles.optionIcon}>
              <UserRound size={20} />
            </div>
            <div className={styles.optionText}>
              <h2>User Login</h2>
              <p>Continue as an individual user</p>
            </div>
            <ArrowRight size={18} className={styles.optionArrow} />
          </Link>

          <Link href="/auth/signup?role=lawyer" className={styles.optionCard}>
            <div className={styles.optionIcon}>
              <Scale size={20} />
            </div>
            <div className={styles.optionText}>
              <h2>Lawyer Login</h2>
              <p>Continue as a legal professional</p>
            </div>
            <ArrowRight size={18} className={styles.optionArrow} />
          </Link>
        </div>
      </div>
    </div>
  );
}
