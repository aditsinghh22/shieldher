'use client';

import LawyerShell from '@/components/lawyer/LawyerShell';
import { useWorkspaceData } from '@/lib/lawyer/useWorkspaceData';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Scale,
  Users,
} from 'lucide-react';
import styles from './page.module.css';

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) +
    ' - ' +
    date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
}

function getSeverityStyle(severity: 'critical' | 'high' | 'medium') {
  if (severity === 'critical') {
    return {
      accent: styles.accentBarCritical,
      icon: styles.analysisIconCritical,
      badge: styles.badgeCritical,
      label: 'Critical Alert',
      Icon: AlertOctagon,
    };
  }

  if (severity === 'high') {
    return {
      accent: styles.accentBarHigh,
      icon: styles.analysisIconHigh,
      badge: styles.badgeHigh,
      label: 'High Alert',
      Icon: AlertTriangle,
    };
  }

  return {
    accent: styles.accentBarMedium,
    icon: styles.analysisIconMedium,
    badge: styles.badgeMedium,
    label: 'Medium Alert',
    Icon: AlertTriangle,
  };
}

export default function LawyerDashboardPage() {
  const { data, loading, error } = useWorkspaceData();
  const activeCases = data?.dashboard.active_cases ?? 0;
  const emergencyCount = data?.dashboard.emergency_alerts ?? 0;
  const upcomingHearingsCount = data?.dashboard.upcoming_hearings ?? 0;
  const clientCount = data?.clients.length ?? 0;
  const hearings = data?.hearings ?? [];
  const alerts = data?.emergency_alerts ?? [];

  return (
    <LawyerShell
      title="Welcome, {lawyerName}"
      subtitle="Your legal workload at a glance."
    >
      {error ? <div className={styles.lawyersError}>{error}</div> : null}

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconDefault}`}>
              <BriefcaseBusiness size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Active Cases</p>
            <h3 className={styles.statValue}>{loading ? '...' : activeCases}</h3>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconDanger}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Emergency Alerts</p>
            <h3 className={`${styles.statValue} ${styles.statValueDanger}`}>
              {loading ? '...' : emergencyCount}
            </h3>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconNeutral}`}>
              <CalendarDays size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Upcoming Hearings</p>
            <h3 className={styles.statValue}>{loading ? '...' : upcomingHearingsCount}</h3>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconSafe}`}>
              <Users size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Active Clients</p>
            <h3 className={`${styles.statValue} ${styles.statValueSafe}`}>
              {loading ? '...' : clientCount}
            </h3>
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Upcoming Hearings</h3>
          <Link href="/lawyer/calendar" className={styles.viewAll}>
            Open Calendar
          </Link>
        </div>

        {hearings.length === 0 ? (
          <div className={styles.empty}>
            <CalendarDays size={44} />
            <h3>No upcoming hearings</h3>
            <p>Add hearing entries to see them in your timeline and calendar.</p>
          </div>
        ) : (
          <div className={styles.analysisList}>
            {hearings.map((hearing) => (
              <article key={hearing.id} className={styles.analysisCard}>
                <div className={`${styles.accentBar} ${styles.accentBarLow}`} />
                <div className={`${styles.analysisIcon} ${styles.analysisIconLow}`}>
                  <Scale size={26} />
                </div>
                <div className={styles.analysisContent}>
                  <div className={styles.analysisMeta}>
                    <span className={`${styles.analysisBadge} ${styles.badgeLow}`}>Hearing</span>
                    <span className={styles.analysisDate}>{formatDateTime(hearing.hearing_time)}</span>
                  </div>
                  <h4 className={styles.analysisTitle}>{hearing.case_title}</h4>
                  <p className={styles.analysisSummary}>{hearing.venue || 'Venue not specified'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Urgent Alerts</h3>
          <Link href="/lawyer/clients" className={styles.viewAll}>
            View Clients
          </Link>
        </div>

        {alerts.length === 0 ? (
          <div className={styles.empty}>
            <AlertTriangle size={44} />
            <h3>No alerts right now</h3>
            <p>Critical and high-risk client alerts will appear here.</p>
          </div>
        ) : (
          <div className={styles.analysisList}>
            {alerts.slice(0, 5).map((alert) => {
              const severity = getSeverityStyle(alert.severity);
              const SeverityIcon = severity.Icon;
              return (
                <article key={alert.id} className={styles.analysisCard}>
                  <div className={`${styles.accentBar} ${severity.accent}`} />
                  <div className={`${styles.analysisIcon} ${severity.icon}`}>
                    <SeverityIcon size={26} />
                  </div>
                  <div className={styles.analysisContent}>
                    <div className={styles.analysisMeta}>
                      <span className={`${styles.analysisBadge} ${severity.badge}`}>
                        {severity.label}
                      </span>
                      <span className={styles.analysisDate}>{formatDateTime(alert.time)}</span>
                    </div>
                    <h4 className={styles.analysisTitle}>{alert.client_name}</h4>
                    <p className={styles.analysisSummary}>{alert.location}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </LawyerShell>
  );
}
