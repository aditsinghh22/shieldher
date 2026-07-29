'use client';

import { useState } from 'react';
import LawyerShell from '@/components/lawyer/LawyerShell';
import Link from 'next/link';
import { useWorkspaceData } from '@/lib/lawyer/useWorkspaceData';
import styles from '../workspace.module.css';

function severityClass(severity: 'critical' | 'high' | 'medium') {
  if (severity === 'critical') return `${styles.badge} ${styles.badgeCritical}`;
  if (severity === 'high') return `${styles.badge} ${styles.badgeHigh}`;
  return `${styles.badge} ${styles.badgeMedium}`;
}

export default function ClientsPage() {
  const { data, loading, error, reload } = useWorkspaceData();
  const selectedClients = data?.clients ?? [];
  const emergencyAlerts = data?.emergency_alerts ?? [];
  const [acceptingUploadId, setAcceptingUploadId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const acceptCase = async (uploadId: string) => {
    if (!uploadId) return;

    try {
      setAcceptingUploadId(uploadId);
      setActionError('');
      setActionMessage('');

      const res = await fetch('/api/lawyer/cases/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
      const payload: unknown = await res.json();

      if (!res.ok) {
        const errorMessage =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error?: unknown }).error || '')
            : '';
        throw new Error(errorMessage || 'Unable to accept this case');
      }

      setActionMessage('Case accepted successfully. Client has been notified.');
      await reload();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : '';
      setActionError(message || 'Could not accept this case right now.');
    } finally {
      setAcceptingUploadId('');
    }
  };

  return (
    <LawyerShell
      title="Clients"
      subtitle="Client alerts feed from ShieldHer records."
    >
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Clients</h3>
        {actionError ? <div className={styles.placeholder}>{actionError}</div> : null}
        {actionMessage ? <div className={styles.placeholder}>{actionMessage}</div> : null}
        {error ? (
          <div className={styles.placeholder}>{error}</div>
        ) : loading ? (
          <div className={styles.placeholder}>Loading client alerts...</div>
        ) : selectedClients.length === 0 ? (
          <div className={styles.placeholder}>
            No users have selected you as their lawyer yet.
          </div>
        ) : emergencyAlerts.length === 0 ? (
          <div className={styles.placeholder}>
            Your selected clients currently have no active alerts.
          </div>
        ) : (
          <div className={styles.list}>
            {emergencyAlerts.slice(0, 30).map((alert) => (
              <article key={alert.id} className={styles.listItem}>
                <div className={styles.listItemHead}>
                  <p className={styles.primary}>
                    {alert.client_name} - {alert.location}
                  </p>
                  <p className={styles.secondary}>{new Date(alert.time).toLocaleString('en-US')}</p>
                  {alert.acceptance_status === 'accepted' && alert.accepted_at ? (
                    <p className={styles.secondary}>
                      Accepted on {new Date(alert.accepted_at).toLocaleString('en-US')}
                    </p>
                  ) : null}
                </div>
                <span className={severityClass(alert.severity)}>{alert.severity}</span>
                <div className={styles.actions}>
                  {alert.acceptance_status === 'accepted' ? (
                    <button
                      type="button"
                      className={`${styles.btnSecondary} ${styles.btnDisabled}`}
                      disabled
                    >
                      Case Accepted
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => acceptCase(alert.upload_id)}
                      disabled={acceptingUploadId === alert.upload_id}
                    >
                      {acceptingUploadId === alert.upload_id ? 'Accepting...' : 'Accept Case'}
                    </button>
                  )}
                  {alert.upload_id ? (
                    <Link href={`/lawyer/analysis/${alert.upload_id}`} className={styles.btnSecondary}>
                      View Details
                    </Link>
                  ) : (
                    <button type="button" className={`${styles.btnSecondary} ${styles.btnDisabled}`} disabled>
                      View Details
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LawyerShell>
  );
}
