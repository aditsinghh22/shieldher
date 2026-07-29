'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LawyerShell from '@/components/lawyer/LawyerShell';
import RiskBadge from '@/components/RiskBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { type Upload, type AnalysisResult } from '@/lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Clock,
  Lightbulb,
  MessageSquare,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';
import styles from './page.module.css';

type LawyerAnalysisResponse = {
  upload: Upload;
  analysis: AnalysisResult;
  client: {
    id: string;
    name: string;
    location: string;
  };
  decryptedMediaArray?: { url: string; decrypted: boolean }[];
};

export default function LawyerAnalysisDetailsPage() {
  const params = useParams();
  const uploadId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upload, setUpload] = useState<Upload | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [clientName, setClientName] = useState('Client');
  const [clientLocation, setClientLocation] = useState('Location unavailable');
  const [decryptedMediaArray, setDecryptedMediaArray] = useState<{ url: string; decrypted: boolean }[]>([]);

  useEffect(() => {
    async function loadDetails() {
      if (!uploadId) {
        setError('Invalid upload ID.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/lawyer/analysis/${uploadId}`, { cache: 'no-store' });
        const payload = (await res.json()) as Partial<LawyerAnalysisResponse> & { error?: string };

        if (!res.ok || !payload.upload || !payload.analysis) {
          throw new Error(payload.error || 'Could not load client analysis details.');
        }

        setUpload(payload.upload);
        setAnalysis(payload.analysis);
        setClientName(payload.client?.name || 'ShieldHer User');
        setClientLocation(payload.client?.location || 'Location unavailable');
        setDecryptedMediaArray(payload.decryptedMediaArray || []);
      } catch (loadError: unknown) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Could not load client analysis details.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [uploadId]);

  const getFileKind = (url: string) => {
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      // Fall back to raw string when URL parsing fails.
    }

    const lower = pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/i.test(lower)) return 'image';
    if (/\.(mp3|wav|m4a|ogg)$/i.test(lower)) return 'audio';
    return 'other';
  };

  const details = analysis?.details || {};
  const fileUrls = (upload?.file_url || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const mediaItems = fileUrls.map((url, index) => {
    const kind = getFileKind(url);
    const label =
      kind === 'image'
        ? `Screenshot ${index + 1}`
        : kind === 'audio'
          ? `Audio Recording ${index + 1}`
          : `File ${index + 1}`;
    
    // Check if we have a decrypted version
    const decryptedUrl = decryptedMediaArray[index]?.decrypted ? decryptedMediaArray[index].url : url;
    
    return { url: decryptedUrl, kind, label, decrypted: decryptedMediaArray[index]?.decrypted || false };
  });

  return (
    <LawyerShell
      title="Client Analysis Details"
      subtitle="Review uploaded evidence and full AI findings for this selected client."
    >
      <div className={styles.page}>
        <Link href="/lawyer/clients" className={styles.back}>
          <ArrowLeft size={16} />
          Back to Clients
        </Link>

        {loading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner text="Loading analysis..." />
          </div>
        ) : error || !upload || !analysis ? (
          <div className={styles.empty}>
            <h3>Analysis not available</h3>
            <p>{error || 'The selected analysis could not be loaded.'}</p>
            <Link href="/lawyer/clients" className={styles.retryLink}>
              Return to Clients
            </Link>
          </div>
        ) : (
          <>
            <section className={styles.header}>
              <div className={styles.headerTop}>
                <div>
                  <h2 className={styles.title}>Evidence Analysis Report</h2>
                  <div className={styles.meta}>
                    <span>{upload.file_name}</span>
                    <span className={styles.dot}>|</span>
                    <span>{clientName}</span>
                    <span className={styles.dot}>|</span>
                    <span>{clientLocation}</span>
                    <span className={styles.dot}>|</span>
                    <Clock size={13} />
                    <span>
                      {new Date(analysis.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <RiskBadge level={analysis.risk_level} size="lg" />
              </div>
            </section>



            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Target size={18} />
                Uploaded Evidence
              </h3>
              {mediaItems.length === 0 ? (
                <div className={styles.detailCard}>No evidence files found for this upload.</div>
              ) : (
                <div className={styles.mediaGrid}>
                  {mediaItems.map((item) => (
                    <div key={item.url} className={styles.mediaCard}>
                      <div className={styles.mediaLabel}>{item.label}</div>
                      {item.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.label} className={styles.mediaImage} loading="lazy" />
                      ) : item.kind === 'audio' ? (
                        <audio controls className={styles.audioPlayer}>
                          <source src={item.url} />
                          Your browser does not support the audio element.
                        </audio>
                      ) : (
                        <a href={item.url} target="_blank" rel="noreferrer" className={styles.mediaLink}>
                          Open uploaded file
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Brain size={18} />
                Analysis Summary
              </h3>
              <div className={styles.detailCard}>
                <p>{analysis.summary}</p>
                {details.confidence_score !== undefined && (
                  <div className={styles.confidence}>
                    <span>Confidence:</span>
                    <div className={styles.confidenceBar}>
                      <div
                        className={styles.confidenceFill}
                        style={{ width: `${details.confidence_score}%` }}
                      />
                    </div>
                    <span>{details.confidence_score}%</span>
                  </div>
                )}
              </div>
            </section>

            {analysis.flags && analysis.flags.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <AlertTriangle size={18} />
                  Detected Flags ({analysis.flags.length})
                </h3>
                <div className={styles.flagGrid}>
                  {analysis.flags.map((flag, index) => (
                    <div key={`${flag.category}-${index}`} className={styles.flagCard}>
                      <div className={styles.flagHeader}>
                        <RiskBadge level={flag.severity} size="sm" />
                        <span className={styles.flagCategory}>{flag.category}</span>
                      </div>
                      <p className={styles.flagDesc}>{flag.description}</p>
                      {flag.evidence && (
                        <div className={styles.evidence}>
                          <MessageSquare size={13} />
                          <span>&ldquo;{flag.evidence}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {details.tone_analysis && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <MessageSquare size={18} />
                  Tone Analysis
                </h3>
                <div className={styles.detailCard}>
                  <p>{details.tone_analysis}</p>
                </div>
              </section>
            )}

            {details.manipulation_indicators && details.manipulation_indicators.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <AlertTriangle size={18} />
                  Manipulation Indicators
                </h3>
                <ul className={styles.list}>
                  {details.manipulation_indicators.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {details.recommendations && details.recommendations.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Lightbulb size={18} />
                  Recommendations
                </h3>
                <ul className={styles.recList}>
                  {details.recommendations.map((item, index) => (
                    <li key={`${item}-${index}`}>
                      <ShieldCheck size={14} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {details.legal_analysis && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Scale size={18} />
                  Preliminary Legal Analysis
                </h3>
                <div className={styles.detailCard}>
                  <p>{details.legal_analysis.summary}</p>

                  {details.legal_analysis.potential_violations &&
                    details.legal_analysis.potential_violations.length > 0 && (
                      <>
                        <p className={styles.subheading}>Potential Violations</p>
                        <ul className={styles.list}>
                          {details.legal_analysis.potential_violations.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  <div className={styles.disclaimer}>
                    <AlertTriangle size={16} />
                    <p>
                      <strong>Disclaimer:</strong> {details.legal_analysis.disclaimer}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </LawyerShell>
  );
}
