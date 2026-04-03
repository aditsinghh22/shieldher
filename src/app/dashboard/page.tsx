'use client';

import { useEffect, useState } from 'react';
import {
  Upload,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  AlertOctagon,
  Info,
  Plus,
  MapPin,
  FileSearch,
  MessageSquare,
  Scale,
  Lightbulb,
} from 'lucide-react';
import { type AnalysisResult, type Upload as UploadType } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './page.module.css';

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedId(expandedId === id ? null : id);
  };

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');

        // Fetch uploads
        const { data: uploadsData } = await supabase
          .from('uploads')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (uploadsData) setUploads(uploadsData);

        // Fetch recent analyses
        const { data: analysesData } = await supabase
          .from('analysis_results')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (analysesData) setAnalyses(analysesData);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalUploads = uploads.length;
  const analyzed = uploads.filter((u) => u.status === 'completed').length;
  const analyzePercent = totalUploads > 0 ? ((analyzed / totalUploads) * 100).toFixed(1) : '0';
  const flagged = uploads.filter((u) => u.status === 'flagged').length;
  const safeCount = analyses.filter((a) => a.risk_level === 'safe' || a.risk_level === 'low').length;

  const getRiskStyle = (level: string) => {
    switch (level) {
      case 'safe':
      case 'low':
        return {
          accent: styles.accentBarSafe,
          icon: styles.analysisIconSafe,
          badge: styles.badgeSafe,
          confidence: styles.confidenceSafe,
          label: level === 'safe' ? 'Safe' : 'Low Risk',
          IconComponent: CheckCircle,
        };
      case 'medium':
        return {
          accent: styles.accentBarMedium,
          icon: styles.analysisIconMedium,
          badge: styles.badgeMedium,
          confidence: styles.confidenceMedium,
          label: 'Medium Risk',
          IconComponent: AlertTriangle,
        };
      case 'high':
        return {
          accent: styles.accentBarHigh,
          icon: styles.analysisIconHigh,
          badge: styles.badgeHigh,
          confidence: styles.confidenceHigh,
          label: 'High Risk',
          IconComponent: AlertOctagon,
        };
      case 'critical':
        return {
          accent: styles.accentBarCritical,
          icon: styles.analysisIconCritical,
          badge: styles.badgeCritical,
          confidence: styles.confidenceCritical,
          label: 'Critical',
          IconComponent: AlertOctagon,
        };
      default:
        return {
          accent: styles.accentBarSafe,
          icon: styles.analysisIconSafe,
          badge: styles.badgeSafe,
          confidence: styles.confidenceSafe,
          label: 'Safe',
          IconComponent: CheckCircle,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' • ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.page}>
      {/* ═══ Hero Header ═══ */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>Guardian Dashboard</p>
          <h2 className={styles.heroTitle}>
            Welcome back, {loading ? '...' : userName}
          </h2>
          <p className={styles.heroSubtitle}>
            Your safety intelligence suite is updated with the latest analysis data.
          </p>
        </div>
        <Link href="/dashboard/upload" className={styles.heroButton}>
          <Plus size={18} />
          <span>New Upload</span>
        </Link>
      </section>

      {/* ═══ Stats Grid ═══ */}
      <section className={styles.statsGrid}>
        {/* Total Uploads */}
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconDefault}`}>
              <Upload size={20} />
            </div>
            <span className={styles.statTrend}>+12%</span>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Total Uploads</p>
            <h3 className={styles.statValue}>{totalUploads}</h3>
          </div>
        </div>

        {/* Analyzed */}
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconNeutral}`}>
              <BarChart3 size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Analyzed</p>
            <h3 className={styles.statValue}>{analyzePercent}%</h3>
          </div>
        </div>

        {/* Safe Results */}
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconSafe}`}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Safe Results</p>
            <h3 className={`${styles.statValue} ${styles.statValueSafe}`}>{safeCount}</h3>
          </div>
        </div>

        {/* Flagged */}
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <div className={`${styles.statIconWrap} ${styles.statIconDanger}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Flagged</p>
            <h3 className={`${styles.statValue} ${styles.statValueDanger}`}>{flagged}</h3>
          </div>
        </div>
      </section>

      {/* ═══ Recent Analyses ═══ */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Recent Analyses</h3>
          <Link href="/dashboard/history" className={styles.viewAll}>
            View Archive
          </Link>
        </div>

        {analyses.length > 0 ? (
          <div className={styles.analysisList}>
            {analyses.map((analysis) => {
              const risk = getRiskStyle(analysis.risk_level);
              const RiskIcon = risk.IconComponent;
              const confidence = analysis.details?.confidence_score
                ? `${analysis.details.confidence_score}%`
                : '—';
              const hasFlags = analysis.flags && analysis.flags.length > 0;
              const isWarning = analysis.risk_level === 'medium' || analysis.risk_level === 'high' || analysis.risk_level === 'critical';

              return (
                <div key={analysis.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div 
                    className={styles.analysisCard}
                    onClick={(e) => toggleExpand(analysis.id, e)}
                    style={{ cursor: 'pointer', zIndex: 2 }}
                  >
                  {/* Accent bar */}
                  <div className={`${styles.accentBar} ${risk.accent}`} />

                  {/* Icon */}
                  <div className={`${styles.analysisIcon} ${risk.icon}`}>
                    <RiskIcon size={28} />
                  </div>

                  {/* Content */}
                  <div className={styles.analysisContent}>
                    <div className={styles.analysisMeta}>
                      <span className={`${styles.analysisBadge} ${risk.badge}`}>
                        {risk.label}
                      </span>
                      <span className={styles.analysisDate}>
                        {formatDate(analysis.created_at)}
                      </span>
                    </div>
                    <h4 className={styles.analysisTitle}>
                      Upload Analysis #{analysis.upload_id.slice(0, 8)}
                    </h4>

                    {isWarning && hasFlags ? (
                      <div className={`${styles.analysisWarningBox} ${
                        analysis.risk_level === 'medium' ? styles.analysisWarningBoxMedium :
                        styles.analysisWarningBoxHigh
                      }`}>
                        <p className={`${styles.warningText} ${
                          analysis.risk_level !== 'medium' ? styles.warningTextBold : ''
                        }`}>
                          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                          {analysis.flags[0]?.description || analysis.summary}
                        </p>
                      </div>
                    ) : (
                      <p className={styles.analysisSummary}>{analysis.summary}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className={styles.analysisRight}>
                    <div className={styles.confidenceBlock}>
                      <p className={styles.confidenceLabel}>Confidence</p>
                      <p className={`${styles.confidenceValue} ${risk.confidence}`}>
                        {confidence}
                      </p>
                    </div>
                    <button
                      onClick={(e) => toggleExpand(analysis.id, e)}
                      className={`${styles.arrowBtn} ${
                        (analysis.risk_level === 'high' || analysis.risk_level === 'critical')
                          ? styles.arrowBtnDanger : ''
                      }`}
                    >
                      <ArrowRight size={18} style={{ 
                        transform: expandedId === analysis.id ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s ease'
                      }} />
                    </button>
                  </div>
                </div>

                {/* INLINE EXPANSION */}
                {expandedId === analysis.id && (
                  <div className={styles.inlineAnalysisDetails}>
                    {hasFlags && (
                      <div className={styles.detailsSection}>
                        <div className={styles.detailsSectionTitle}>
                          <AlertTriangle size={14} /> Detected Flags
                        </div>
                        <div className={styles.flagsList}>
                          {analysis.flags.map((flag, idx) => (
                            <div key={idx} className={styles.flagItem}>
                              <span className={styles.flagCat}>{flag.category}</span>
                              <span className={styles.flagDesc}>{flag.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {analysis.details?.recommendations && analysis.details.recommendations.length > 0 && (
                      <div className={styles.detailsSection}>
                        <div className={styles.detailsSectionTitle}>
                          <Lightbulb size={14} /> Recommendations
                        </div>
                        <div className={styles.listItems}>
                          {analysis.details.recommendations.map((rec, idx) => (
                            <div key={idx} style={{ marginBottom: '4px' }}>• {rec}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.details?.legal_analysis && (
                      <div className={styles.detailsSection}>
                        <div className={styles.detailsSectionTitle}>
                          <Scale size={14} /> Legal Perspective
                        </div>
                        <p className={styles.detailsText}>{analysis.details.legal_analysis.summary}</p>
                      </div>
                    )}
                    
                    <div style={{ marginTop: '4px', textAlign: 'right' }}>
                      <Link href={`/dashboard/analysis/${analysis.upload_id}`} style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 'bold', textDecoration: 'none' }}>
                        Generate PDF Report &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <FileSearch size={48} />
            <h3>No analyses yet</h3>
            <p>Upload your first chat screenshot to get started</p>
            <Link href="/dashboard/upload" className="btn btn-primary">
              <Upload size={16} />
              Upload Screenshot
            </Link>
          </div>
        )}
      </section>

      {/* ═══ Insight Section ═══ */}
      <section className={styles.insightGrid}>
        {/* Intelligence Report Card */}
        <div className={styles.insightCard}>
          <div className={styles.insightContent}>
            <h4 className={styles.insightTitle}>ShieldHer Intelligence Report</h4>
            <p className={styles.insightText}>
              Based on your recent uploads, we&apos;ve analyzed your conversation patterns.
              Stay vigilant and keep uploading suspicious conversations for continuous monitoring.
            </p>
          </div>
          <div className={styles.insightActions}>
            <Link href="/dashboard/history" className={styles.insightBtnPrimary}>
              Review Analyses
            </Link>
            <button className={styles.insightBtnSecondary}>Dismiss</button>
          </div>
          {/* Background blobs */}
          <div className={styles.insightBlob1} />
          <div className={styles.insightBlob2} />
        </div>

        {/* Regional Safety Pulse */}
        <div className={styles.pulseCard}>
          <h4 className={styles.pulseTitle}>Safety Overview</h4>
          <div className={styles.pulseList}>
            <div className={styles.pulseItem}>
              <div className={styles.pulseItemLeft}>
                <div className={styles.pulseItemIcon}>
                  <MapPin size={20} />
                </div>
                <div className={styles.pulseItemInfo}>
                  <p className={styles.pulseItemName}>Safe Results</p>
                  <p className={styles.pulseItemSub}>All clear</p>
                </div>
              </div>
              <div className={styles.pulseBar}>
                <div
                  className={`${styles.pulseBarFill} ${styles.pulseBarSafe}`}
                  style={{ width: safeCount > 0 ? '80%' : '0%' }}
                />
              </div>
            </div>

            <div className={styles.pulseItem}>
              <div className={styles.pulseItemLeft}>
                <div className={styles.pulseItemIcon}>
                  <AlertTriangle size={20} />
                </div>
                <div className={styles.pulseItemInfo}>
                  <p className={styles.pulseItemName}>Flagged</p>
                  <p className={styles.pulseItemSub}>Needs review</p>
                </div>
              </div>
              <div className={styles.pulseBar}>
                <div
                  className={`${styles.pulseBarFill} ${styles.pulseBarMedium}`}
                  style={{ width: flagged > 0 ? '50%' : '0%' }}
                />
              </div>
            </div>

            <div className={styles.pulseItem}>
              <div className={styles.pulseItemLeft}>
                <div className={styles.pulseItemIcon}>
                  <ShieldCheck size={20} />
                </div>
                <div className={styles.pulseItemInfo}>
                  <p className={styles.pulseItemName}>Total Analyzed</p>
                  <p className={styles.pulseItemSub}>{analyzed} uploads</p>
                </div>
              </div>
              <div className={styles.pulseBar}>
                <div
                  className={`${styles.pulseBarFill} ${styles.pulseBarSafe}`}
                  style={{ width: analyzed > 0 ? '100%' : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
