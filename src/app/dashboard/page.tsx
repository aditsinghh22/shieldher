'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Upload,
  LineChart,
  ShieldCheck,
  Flag,
  Plus,
  Search,
  Bell,
  CircleHelp,
  ChevronRight,
  AlertTriangle,
  Info,
  Lightbulb,
  Scale,
  Clock3,
} from 'lucide-react';
import { type AnalysisResult, type RiskLevel, type Upload as UploadType } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

type UserRole = 'user' | 'lawyer';

type MonthPoint = {
  key: string;
  label: string;
  uploads: number;
  safe: number;
  reviewed: number;
};

type StatusMeta = {
  label: string;
  toneClass: string;
};

type CommunicationThread = {
  id: string;
  lawyer_id: string;
  lawyer_name: string;
  created_at: string;
  updated_at: string;
};

type AcceptedCase = {
  upload_id: string;
  lawyer_id: string;
  lawyer_name: string;
  thread_id: string;
  case_file: string;
  status: 'accepted';
  accepted_at: string;
};

type CaseNotification = {
  id: string;
  threadId?: string;
  lawyerName: string;
  caseFile: string;
  reference: string;
  status: 'accepted' | 'pending';
  timestamp: string;
};

function parseRole(value: unknown): UserRole | null {
  if (value === 'lawyer' || value === 'user') return value;
  return null;
}

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

function parseAcceptedCases(metadata: Record<string, unknown>): AcceptedCase[] {
  const acceptedCasesValue = metadata.accepted_cases;
  if (!Array.isArray(acceptedCasesValue)) return [];

  const acceptedCases: AcceptedCase[] = [];
  for (const item of acceptedCasesValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const uploadId = toText(entry.upload_id).trim();
    const lawyerId = toText(entry.lawyer_id).trim();
    const status = toText(entry.status).trim().toLowerCase();
    if (!uploadId || !lawyerId || status !== 'accepted') continue;

    acceptedCases.push({
      upload_id: uploadId,
      lawyer_id: lawyerId,
      lawyer_name: toText(entry.lawyer_name).trim(),
      thread_id: toText(entry.thread_id).trim(),
      case_file: toText(entry.case_file).trim(),
      status: 'accepted',
      accepted_at: toText(entry.accepted_at).trim(),
    });
  }

  return acceptedCases;
}

function shortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function shortDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeUpdated(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const deltaMins = Math.max(1, Math.round((now - then) / 60000));
  if (deltaMins < 60) return `${deltaMins} min ago`;
  const deltaHours = Math.round(deltaMins / 60);
  if (deltaHours < 24) return `${deltaHours} hr ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;
}

function deltaPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '±';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function statusMeta(risk: RiskLevel): StatusMeta {
  if (risk === 'safe' || risk === 'low') {
    return { label: 'Cleared', toneClass: styles.statusSafe };
  }

  if (risk === 'medium') {
    return { label: 'Review', toneClass: styles.statusWarn };
  }

  return { label: 'Urgent Review', toneClass: styles.statusDanger };
}

export default function DashboardPage() {
  const router = useRouter();

  const [userName, setUserName] = useState('');
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [caseNotifications, setCaseNotifications] = useState<CaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const role = parseRole(user.user_metadata?.role);
      if (role === 'lawyer') {
        router.replace('/lawyer/dashboard');
        setLoading(false);
        return;
      }

      const userMetadata = asObject(user.user_metadata);
      const acceptedCases = parseAcceptedCases(userMetadata);

      setUserName(toText(userMetadata.full_name) || user.email?.split('@')[0] || 'User');

      const [{ data: uploadsData }, { data: analysesData }, { data: threadsData, error: threadsError }] = await Promise.all([
        supabase
          .from('uploads')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('analysis_results')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('communication_threads')
          .select('id, lawyer_id, lawyer_name, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(24),
      ]);

      if (uploadsData) setUploads(uploadsData);
      if (analysesData) setAnalyses(analysesData);

      const threads = (threadsData as CommunicationThread[] | null) ?? [];
      const uploadsForRefs = (uploadsData ?? []).slice() as UploadType[];
      const uploadsById = new Map(uploadsForRefs.map((upload) => [upload.id, upload]));
      const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
      const threadsByLawyerId = new Map(threads.map((thread) => [thread.lawyer_id, thread]));
      const nextNotifications: CaseNotification[] = [];

      if (threadsError) {
        console.error('Could not load communication threads for case notifications:', threadsError.message);
      }

      const acceptedLawyerIds = new Set<string>();

      acceptedCases.forEach((acceptedCase) => {
        const uploadRef = uploadsById.get(acceptedCase.upload_id);
        const linkedThread =
          (acceptedCase.thread_id ? threadsById.get(acceptedCase.thread_id) : undefined) ??
          threadsByLawyerId.get(acceptedCase.lawyer_id);
        const timestamp =
          acceptedCase.accepted_at || linkedThread?.updated_at || uploadRef?.created_at || new Date().toISOString();

        nextNotifications.push({
          id: `accepted-${acceptedCase.upload_id}-${acceptedCase.lawyer_id}`,
          threadId: acceptedCase.thread_id || linkedThread?.id,
          lawyerName: acceptedCase.lawyer_name || linkedThread?.lawyer_name || 'your lawyer',
          caseFile: acceptedCase.case_file || uploadRef?.file_name || 'Case file',
          reference: acceptedCase.upload_id.slice(0, 8).toUpperCase(),
          status: 'accepted',
          timestamp,
        });

        acceptedLawyerIds.add(acceptedCase.lawyer_id);
      });

      threads.forEach((thread, index) => {
        if (acceptedLawyerIds.has(thread.lawyer_id)) return;
        const uploadRef = uploadsForRefs[index] ?? uploadsForRefs[0];
        const fallbackFile = uploadRef?.file_name?.trim() || 'Case file';
        const fallbackReference = (uploadRef?.id || thread.id).slice(0, 8).toUpperCase();

        nextNotifications.push({
          id: `pending-${thread.id}`,
          threadId: thread.id,
          lawyerName: thread.lawyer_name || 'your lawyer',
          caseFile: fallbackFile,
          reference: fallbackReference,
          status: 'pending',
          timestamp: thread.updated_at || thread.created_at,
        });
      });

      if (threads.length === 0 && uploadsForRefs.length > 0 && acceptedCases.length === 0) {
        const firstUpload = uploadsForRefs[0];
        nextNotifications.push({
          id: `pending-${firstUpload.id}`,
          lawyerName: 'your selected lawyer',
          caseFile: firstUpload.file_name || 'Case file',
          reference: firstUpload.id.slice(0, 8).toUpperCase(),
          status: 'pending',
          timestamp: firstUpload.created_at,
        });
      }

      nextNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setCaseNotifications(nextNotifications.slice(0, 5));

      setLoading(false);
    }

    void fetchData();
  }, [router]);

  const totalUploads = uploads.length;
  const analyzedCount = uploads.filter((u) => u.status === 'completed' || u.status === 'flagged').length;
  const analyzedPercent = totalUploads > 0 ? (analyzedCount / totalUploads) * 100 : 0;
  const flaggedCount = uploads.filter((u) => u.status === 'flagged').length;
  const safeCount = analyses.filter((a) => a.risk_level === 'safe' || a.risk_level === 'low').length;
  const riskyCount = analyses.filter((a) => a.risk_level !== 'safe' && a.risk_level !== 'low').length;
  const totalAnalyzedResults = analyses.length;
  const safeRatio = totalAnalyzedResults > 0 ? (safeCount / totalAnalyzedResults) * 100 : 0;
  const riskyRatio = totalAnalyzedResults > 0 ? (riskyCount / totalAnalyzedResults) * 100 : 0;
  const analyzedCoverage = totalUploads > 0 ? (analyzedCount / totalUploads) * 100 : 0;

  const monthSeries = useMemo<MonthPoint[]>(() => {
    const months: MonthPoint[] = [];
    const now = new Date();
    now.setDate(1);

    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setMonth(now.getMonth() - i);

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        uploads: 0,
        safe: 0,
        reviewed: 0,
      });
    }

    const monthMap = new Map(months.map((point) => [point.key, point]));

    uploads.forEach((upload) => {
      const date = new Date(upload.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const point = monthMap.get(key);
      if (point) point.uploads += 1;
    });

    analyses.forEach((analysis) => {
      const date = new Date(analysis.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const point = monthMap.get(key);
      if (!point) return;

      if (analysis.risk_level === 'safe' || analysis.risk_level === 'low') {
        point.safe += 1;
      } else {
        point.reviewed += 1;
      }
    });

    return months;
  }, [uploads, analyses]);

  const maxBarValue = useMemo(() => {
    const highest = Math.max(
      1,
      ...monthSeries.map((point) => Math.max(point.uploads, point.safe + point.reviewed, point.safe))
    );
    return highest;
  }, [monthSeries]);

  const monthNow = monthSeries[monthSeries.length - 1] ?? { uploads: 0, safe: 0, reviewed: 0 };
  const monthPrev = monthSeries[monthSeries.length - 2] ?? { uploads: 0, safe: 0, reviewed: 0 };

  const uploadsDelta = deltaPercent(monthNow.uploads, monthPrev.uploads);
  const analyzedDelta = deltaPercent(monthNow.safe + monthNow.reviewed, monthPrev.safe + monthPrev.reviewed);
  const safeDelta = deltaPercent(monthNow.safe, monthPrev.safe);
  const flaggedDelta = deltaPercent(monthNow.reviewed, monthPrev.reviewed);

  const gaugeOuterRadius = 88;
  const gaugeMiddleRadius = 72;
  const gaugeInnerRadius = 56;
  const gaugeOuterCircumference = 2 * Math.PI * gaugeOuterRadius;
  const gaugeMiddleCircumference = 2 * Math.PI * gaugeMiddleRadius;
  const gaugeInnerCircumference = 2 * Math.PI * gaugeInnerRadius;
  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
  const gaugeOuterOffset = gaugeOuterCircumference * (1 - clampPercent(analyzedCoverage) / 100);
  const gaugeMiddleOffset = gaugeMiddleCircumference * (1 - clampPercent(safeRatio) / 100);
  const gaugeInnerOffset = gaugeInnerCircumference * (1 - clampPercent(riskyRatio) / 100);
  const safeScore = totalAnalyzedResults > 0 ? Math.round(safeRatio) : 0;

  const visibleAnalyses = analyses.slice(0, 5);
  const expandedAnalysis = analyses.find((analysis) => analysis.id === expandedId) ?? null;

  const toggleRow = (id: string) => {
    setExpandedId((curr) => (curr === id ? null : id));
  };

  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search safety reports..."
            aria-label="Search dashboard reports"
          />
        </div>

        <div className={styles.navActions}>
          <button className={styles.iconButton} aria-label="Notifications">
            <Bell size={18} />
            <span className={styles.notificationDot} />
          </button>
          <button className={styles.iconButton} aria-label="Help">
            <CircleHelp size={18} />
          </button>

          <div className={styles.profileChip}>
            <div className={styles.profileMeta}>
              <p className={styles.profileName}>{loading ? '...' : userName}</p>
              <p className={styles.profileRole}>Safety Lead</p>
            </div>
            <div className={styles.profileAvatar}>{userInitial}</div>
          </div>
        </div>
      </header>

      <section className={styles.headingRow}>
        <div className={styles.pageTitleBlock}>
          <h1 className={styles.pageTitle}>Safety Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Monitoring and analyzing visual content patterns to protect your evidence quality,
            detect risk, and keep your safety workflow compliant.
          </p>
        </div>

        <Link href="/dashboard/upload" className={styles.newAnalysisBtn}>
          <Plus size={16} />
          <span>New Analysis</span>
        </Link>
      </section>

      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div className={styles.metricIconWrap}>
              <Upload size={18} />
            </div>
            <span className={`${styles.metricTrend} ${uploadsDelta >= 0 ? styles.trendUp : styles.trendDown}`}>
              {formatDelta(uploadsDelta)}
            </span>
          </div>
          <p className={styles.metricLabel}>Total Uploads</p>
          <p className={styles.metricValue}>{totalUploads.toLocaleString()}</p>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div className={styles.metricIconWrap}>
              <LineChart size={18} />
            </div>
            <span className={`${styles.metricTrend} ${analyzedDelta >= 0 ? styles.trendUp : styles.trendDown}`}>
              {formatDelta(analyzedDelta)}
            </span>
          </div>
          <p className={styles.metricLabel}>Analyzed Rate</p>
          <p className={styles.metricValue}>{analyzedPercent.toFixed(1)}%</p>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div className={styles.metricIconWrap}>
              <ShieldCheck size={18} />
            </div>
            <span className={`${styles.metricTrend} ${safeDelta >= 0 ? styles.trendUp : styles.trendDown}`}>
              {formatDelta(safeDelta)}
            </span>
          </div>
          <p className={styles.metricLabel}>Safe Results</p>
          <p className={styles.metricValue}>{safeCount.toLocaleString()}</p>
        </article>

        <article className={styles.metricCard}>
          <div className={styles.metricTop}>
            <div className={styles.metricIconWrap}>
              <Flag size={18} />
            </div>
            <span className={`${styles.metricTrend} ${flaggedDelta <= 0 ? styles.trendUp : styles.trendDown}`}>
              {formatDelta(flaggedDelta)}
            </span>
          </div>
          <p className={styles.metricLabel}>Flagged Assets</p>
          <p className={styles.metricValue}>{flaggedCount.toLocaleString()}</p>
        </article>
      </section>

      <section className={styles.casePanel}>
        <div className={styles.caseHeader}>
          <div>
            <h2 className={styles.caseTitle}>Case Notifications</h2>
            <p className={styles.caseHint}>Live updates when lawyers respond to your case requests.</p>
          </div>

          <Link href="/dashboard/communication" className={styles.caseHeaderAction}>
            Open Inbox
          </Link>
        </div>

        {caseNotifications.length > 0 ? (
          <div className={styles.caseList}>
            {caseNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`${styles.caseRow} ${
                  notification.status === 'accepted' ? styles.caseRowAccepted : styles.caseRowPending
                }`}
              >
                <div
                  className={`${styles.caseStatusIcon} ${
                    notification.status === 'accepted' ? styles.caseStatusAccepted : styles.caseStatusPending
                  }`}
                >
                  {notification.status === 'accepted' ? <ShieldCheck size={15} /> : <Clock3 size={15} />}
                </div>

                <div className={styles.caseRowBody}>
                  <p className={styles.caseRowTitle}>
                    {notification.status === 'accepted'
                      ? `Your case has been accepted by ${notification.lawyerName}`
                      : `Case request sent to ${notification.lawyerName}`}
                  </p>
                  <p className={styles.caseRowMeta}>
                    {notification.caseFile} • Ref {notification.reference} • {shortDateTime(notification.timestamp)}
                  </p>
                </div>

                <Link
                  href={
                    notification.threadId
                      ? `/dashboard/communication?thread=${notification.threadId}`
                      : '/dashboard/communication'
                  }
                  className={styles.caseActionBtn}
                >
                  {notification.status === 'accepted' ? 'View Case' : 'Open Chat'}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.caseEmpty}>
            No case updates yet. Select a lawyer to start receiving live case notifications.
          </div>
        )}
      </section>

      <section className={styles.analyticsGrid}>
        <article className={styles.barPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Safety Insights</h2>
              <p className={styles.panelHint}>Activity over the last 12 months</p>
            </div>
            <div className={styles.rangeSwitch}>
              <button className={styles.rangeActive}>Monthly</button>
              <button>Yearly</button>
            </div>
          </div>

          <div className={styles.barChart}>
            {monthSeries.map((point) => {
              const mutedHeight = Math.max(8, (point.uploads / maxBarValue) * 100);
              const primaryHeight = Math.max(8, (point.safe / maxBarValue) * 100);

              return (
                <div key={point.key} className={styles.barGroup}>
                  <div className={styles.barPair}>
                    <div className={styles.barMuted} style={{ height: `${mutedHeight}%` }} />
                    <div className={styles.barPrimary} style={{ height: `${primaryHeight}%` }} />
                  </div>
                  <span className={styles.monthLabel}>{point.label}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className={styles.gaugePanel}>
          <h2 className={styles.gaugeTitle}>Safety Index</h2>

          <div className={styles.gaugeWrap}>
            <svg className={styles.gaugeSvg} viewBox="0 0 220 220" aria-hidden="true">
              <circle className={styles.gaugeTrackOuter} cx="110" cy="110" r={gaugeOuterRadius} />
              <circle
                className={`${styles.gaugeRing} ${styles.gaugeRingOuter}`}
                cx="110"
                cy="110"
                r={gaugeOuterRadius}
                style={{
                  strokeDasharray: gaugeOuterCircumference,
                  strokeDashoffset: gaugeOuterOffset,
                }}
              />

              <circle className={styles.gaugeTrackMiddle} cx="110" cy="110" r={gaugeMiddleRadius} />
              <circle
                className={`${styles.gaugeRing} ${styles.gaugeRingSafe}`}
                cx="110"
                cy="110"
                r={gaugeMiddleRadius}
                style={{
                  strokeDasharray: gaugeMiddleCircumference,
                  strokeDashoffset: gaugeMiddleOffset,
                }}
              />

              <circle className={styles.gaugeTrackInner} cx="110" cy="110" r={gaugeInnerRadius} />
              <circle
                className={`${styles.gaugeRing} ${styles.gaugeRingRisk}`}
                cx="110"
                cy="110"
                r={gaugeInnerRadius}
                style={{
                  strokeDasharray: gaugeInnerCircumference,
                  strokeDashoffset: gaugeInnerOffset,
                }}
              />
            </svg>

            <div className={styles.gaugeCenter}>
              <div className={styles.gaugeCenterGlass}>
                <p className={styles.gaugeValue}>{safeScore}%</p>
                <p className={styles.gaugeMeta}>Safe Results</p>
              </div>
            </div>
          </div>

          <p className={styles.gaugeSummary}>
            Based on <strong>{totalAnalyzedResults.toLocaleString()} analyzed results</strong>
          </p>

          <div className={styles.safetyOverviewList}>
            <div className={styles.safetyOverviewItem}>
              <div className={styles.safetyOverviewTop}>
                <p className={styles.safetyOverviewName}>Safe Results</p>
                <p className={styles.safetyOverviewValue}>{safeCount.toLocaleString()}</p>
              </div>
              <p className={styles.safetyOverviewSub}>All clear</p>
              <div className={styles.safetyOverviewTrack}>
                <div
                  className={`${styles.safetyOverviewFill} ${styles.safetyFillSafe}`}
                  style={{ width: `${safeRatio}%` }}
                />
              </div>
            </div>

            <div className={styles.safetyOverviewItem}>
              <div className={styles.safetyOverviewTop}>
                <p className={styles.safetyOverviewName}>Flagged</p>
                <p className={styles.safetyOverviewValue}>{riskyCount.toLocaleString()}</p>
              </div>
              <p className={styles.safetyOverviewSub}>Needs review</p>
              <div className={styles.safetyOverviewTrack}>
                <div
                  className={`${styles.safetyOverviewFill} ${styles.safetyFillDanger}`}
                  style={{ width: `${riskyRatio}%` }}
                />
              </div>
            </div>

            <div className={styles.safetyOverviewItem}>
              <div className={styles.safetyOverviewTop}>
                <p className={styles.safetyOverviewName}>Total Analyzed</p>
                <p className={styles.safetyOverviewValue}>{analyzedCount.toLocaleString()}</p>
              </div>
              <p className={styles.safetyOverviewSub}>{totalUploads.toLocaleString()} uploads</p>
              <div className={styles.safetyOverviewTrack}>
                <div
                  className={`${styles.safetyOverviewFill} ${styles.safetyFillTotal}`}
                  style={{ width: `${analyzedCoverage}%` }}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.tableTitle}>Recent Analyses</h2>
            <p className={styles.tableMeta}>
              Last updated {visibleAnalyses[0] ? relativeUpdated(visibleAnalyses[0].created_at) : 'just now'}
            </p>
          </div>

          <Link href="/dashboard/history" className={styles.tableAction}>
            View Archive
          </Link>
        </div>

        {visibleAnalyses.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.analysesTable}>
              <thead>
                <tr>
                  <th>Analysis ID</th>
                  <th>Date</th>
                  <th>Pattern Found</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className={styles.rightAlign}>Confidence</th>
                  <th className={styles.rightAlign}>Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleAnalyses.map((analysis) => {
                  const firstFlag = analysis.flags?.[0];
                  const status = statusMeta(analysis.risk_level);
                  const confidence = analysis.details?.confidence_score ?? 0;

                  return (
                    <tr key={analysis.id} onClick={() => toggleRow(analysis.id)}>
                      <td className={styles.analysisId}>#ANL-{analysis.upload_id.slice(0, 4).toUpperCase()}</td>
                      <td>{shortDate(analysis.created_at)}</td>
                      <td>{firstFlag?.description || analysis.summary}</td>
                      <td>
                        <span className={styles.categoryTag}>{firstFlag?.category || 'General Scan'}</span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${status.toneClass}`}>
                          <span className={styles.statusDot} />
                          {status.label}
                        </span>
                      </td>
                      <td className={`${styles.rightAlign} ${styles.confidence}`}>
                        {confidence > 0 ? `${confidence}%` : '—'}
                      </td>
                      <td className={styles.rightAlign}>
                        <button
                          className={styles.rowToggle}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(analysis.id);
                          }}
                          aria-label="Toggle analysis details"
                        >
                          <ChevronRight
                            size={16}
                            className={`${styles.rowToggleIcon} ${expandedId === analysis.id ? styles.rowToggleOpen : ''}`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Upload size={34} />
            <h3>No analyses yet</h3>
            <p>Upload your first screenshot to start generating safety insights.</p>
            <Link href="/dashboard/upload" className={styles.newAnalysisBtn}>
              <Plus size={16} />
              <span>Upload Screenshot</span>
            </Link>
          </div>
        )}
      </section>

      {expandedAnalysis ? (
        <section className={styles.detailsDrawer}>
          <h3 className={styles.detailsHeading}>
            Analysis Details: #ANL-{expandedAnalysis.upload_id.slice(0, 4).toUpperCase()}
          </h3>

          <div className={styles.detailsGrid}>
            {expandedAnalysis.flags?.length ? (
              <article className={styles.detailsCard}>
                <h4 className={styles.detailsCardTitle}>
                  <AlertTriangle size={14} />
                  Detected Flags
                </h4>
                <ul className={styles.detailsList}>
                  {expandedAnalysis.flags.map((flag, index) => (
                    <li key={`${flag.category}-${index}`}>
                      <strong>{flag.category}:</strong> {flag.description}
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {expandedAnalysis.details?.recommendations?.length ? (
              <article className={styles.detailsCard}>
                <h4 className={styles.detailsCardTitle}>
                  <Lightbulb size={14} />
                  Recommendations
                </h4>
                <ul className={styles.detailsList}>
                  {expandedAnalysis.details.recommendations.map((rec, index) => (
                    <li key={`${rec}-${index}`}>{rec}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {expandedAnalysis.details?.legal_analysis ? (
              <article className={styles.detailsCard}>
                <h4 className={styles.detailsCardTitle}>
                  <Scale size={14} />
                  Legal Perspective
                </h4>
                <p className={styles.detailsText}>{expandedAnalysis.details.legal_analysis.summary}</p>
              </article>
            ) : null}

            {!expandedAnalysis.flags?.length &&
            !expandedAnalysis.details?.recommendations?.length &&
            !expandedAnalysis.details?.legal_analysis ? (
              <article className={styles.detailsCard}>
                <h4 className={styles.detailsCardTitle}>
                  <Info size={14} />
                  Summary
                </h4>
                <p className={styles.detailsText}>{expandedAnalysis.summary}</p>
              </article>
            ) : null}
          </div>

          <Link href={`/dashboard/analysis/${expandedAnalysis.upload_id}`} className={styles.reportLink}>
            Generate PDF Report
            <ChevronRight size={14} />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
