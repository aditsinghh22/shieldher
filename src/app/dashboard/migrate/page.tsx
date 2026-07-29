'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader, Shield, LockOpen } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { deriveKey, decryptText, EncryptedPayload } from '@/lib/crypto';
import styles from './page.module.css';

export default function MigratePage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to migrate data.');

      // 1. Fetch user's salt
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('encryption_salt')
        .eq('id', user.id)
        .single();
        
      if (profileErr || !profile?.encryption_salt) {
        throw new Error('No encryption profile found. Were you using the E2EE system safely? ' + (profileErr?.message || ''));
      }

      // 2. Derive Key
      const key = await deriveKey(password, profile.encryption_salt);

      // 3. Fetch Old Records
      const { data: results, error: fetchErr } = await supabase
        .from('analysis_results')
        .select('*')
        .not('encrypted_summary', 'is', null);

      if (fetchErr) throw new Error('Failed to fetch legacy records.');
      if (!results || results.length === 0) {
        setSuccess('No encrypted records found! Your history is already normal.');
        setLoading(false);
        return;
      }

      // 4. Decrypt and Update
      let migratedCount = 0;
      for (const record of results) {
        try {
          let summaryStr = record.summary;
          let flagsObj = record.flags;
          let detailsObj = record.details;

          if (record.encrypted_summary && record.encrypted_summary !== 'null') {
            const summPayload: EncryptedPayload = JSON.parse(record.encrypted_summary);
            summaryStr = await decryptText(key, summPayload);
          }
          if (record.encrypted_flags && record.encrypted_flags !== 'null') {
            const flagsPayload: EncryptedPayload = JSON.parse(record.encrypted_flags);
            const rawFlags = await decryptText(key, flagsPayload);
            flagsObj = JSON.parse(rawFlags);
          }
          if (record.encrypted_details && record.encrypted_details !== 'null') {
            const detailsPayload: EncryptedPayload = JSON.parse(record.encrypted_details);
            const rawDetails = await decryptText(key, detailsPayload);
            detailsObj = JSON.parse(rawDetails);
          }

          const { error: updateErr } = await supabase
            .from('analysis_results')
            .update({
              summary: summaryStr,
              flags: flagsObj,
              details: detailsObj,
              encrypted_summary: null,
              encrypted_flags: null,
              encrypted_details: null,
            })
            .eq('id', record.id);
            
          if (updateErr) console.error("Update failed for record", record.id, updateErr);
          else migratedCount++;
        } catch (decErr) {
          console.error("Failed to decrypt record", record.id, decErr);
          throw new Error('Incorrect password or corrupted record block.');
        }
      }

      setSuccess(`Successfully restored ${migratedCount} history records!`);
      setTimeout(() => {
        router.push('/dashboard/history');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Restore Legacy History</h1>
        <p className={styles.subtitle}>
          Enter the password you originally used to encrypt your history. We will permanently un-encrypt your data so it behaves normally across all sessions.
        </p>
      </div>

      <div className={styles.card}>
        <form onSubmit={handleMigrate}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">
              Account Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <button
            type="submit"
            className={styles.button}
            disabled={loading || !password}
            style={{ marginTop: '1rem' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Unlocking & Migrating...
              </>
            ) : (
              <>
                <LockOpen size={18} />
                Restore History
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
