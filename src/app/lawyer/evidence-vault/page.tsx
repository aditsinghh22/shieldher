'use client';

import LawyerShell from '@/components/lawyer/LawyerShell';
import { useWorkspaceData } from '@/lib/lawyer/useWorkspaceData';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import styles from '../workspace.module.css';

type VaultFilter = 'all' | 'accepted' | 'pending';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EvidenceVaultPage() {
  const { data, loading, error } = useWorkspaceData();
  const [filter, setFilter] = useState<VaultFilter>('all');

  const vaultItems = useMemo(() => {
    const alerts = data?.emergency_alerts ?? [];

    return alerts
      .filter((alert) => {
        if (filter === 'all') return true;
        return alert.acceptance_status === filter;
      })
      .map((alert) => ({
        id: alert.id,
        uploadId: alert.upload_id,
        title: `${alert.client_name} evidence record`,
        detail: `${alert.location || 'Location unavailable'} - ${alert.severity.toUpperCase()} risk`,
        status: alert.acceptance_status,
        timestamp: alert.accepted_at || alert.time,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data, filter]);

  const acceptedCount = data?.emergency_alerts.filter((alert) => alert.acceptance_status === 'accepted').length ?? 0;
  const pendingCount = data?.emergency_alerts.filter((alert) => alert.acceptance_status === 'pending').length ?? 0;

  return (
    <LawyerShell
      title="Evidence Vault"
      subtitle="Securely store screenshots, reports, and case-linked legal evidence."
    >
      <section className={styles.grid3}>
        <article className={styles.card}>
          <p className={styles.metricLabel}>Indexed Records</p>
          <h3 className={styles.metricValue}>{loading ? '...' : vaultItems.length}</h3>
        </article>
        <article className={styles.card}>
          <p className={styles.metricLabel}>Accepted Cases</p>
          <h3 className={styles.metricValue}>{loading ? '...' : acceptedCount}</h3>
        </article>
        <article className={styles.card}>
          <p className={styles.metricLabel}>Pending Review</p>
          <h3 className={styles.metricValue}>{loading ? '...' : pendingCount}</h3>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.calendarToolbar}>
          <div>
            <h3 className={styles.panelTitle}>Evidence Vault</h3>
            <p className={styles.calendarMeta}>Client-linked uploads ready for review and case handling.</p>
          </div>
          <div className={styles.calendarActions}>
            {(['all', 'accepted', 'pending'] as VaultFilter[]).map((nextFilter) => (
              <button
                key={nextFilter}
                type="button"
                className={styles.calendarButton}
                aria-pressed={filter === nextFilter}
                onClick={() => setFilter(nextFilter)}
              >
                {nextFilter === 'all' ? 'All' : nextFilter}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className={styles.placeholder}>{error}</div>
        ) : loading ? (
          <div className={styles.placeholder}>Loading evidence vault...</div>
        ) : vaultItems.length === 0 ? (
          <div className={styles.placeholder}>
            No evidence records found for this filter.
          </div>
        ) : (
          <div className={styles.list}>
            {vaultItems.map((item) => (
              <article key={item.id} className={styles.listItem}>
                <div className={styles.listItemHead}>
                  <p className={styles.primary}>{item.title}</p>
                  <p className={styles.secondary}>{item.detail}</p>
                  <p className={styles.secondary}>Updated {formatDate(item.timestamp)}</p>
                </div>
                <span className={`${styles.badge} ${item.status === 'accepted' ? styles.badgeClosed : styles.badgeMedium}`}>
                  {item.status}
                </span>
                <div className={styles.actions}>
                  <Link href={`/lawyer/analysis/${item.uploadId}`} className={styles.btnSecondary}>
                    Open Evidence
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LawyerShell>
  );
}
