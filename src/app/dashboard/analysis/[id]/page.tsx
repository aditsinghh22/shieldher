"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { type Upload, type AnalysisFlag, type RiskLevel } from "@/lib/types";
import { retrieveKey, uint8ArrayToBase64, decryptFile } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";
import RiskBadge from "@/components/RiskBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import DispatchModal, { type DispatchFormData } from "@/components/DispatchModal";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileDown,
  CheckCircle,
  Lock,
  Bot,
  ImageIcon,
  Activity,
  Zap,
} from "lucide-react";
import styles from "./page.module.css";

interface DecryptedAnalysis {
  risk_level: RiskLevel;
  summary: string;
  flags: AnalysisFlag[];
  details: {
    tone_analysis?: string;
    manipulation_indicators?: string[];
    threat_indicators?: string[];
    recommendations?: string[];
    confidence_score?: number;
    legal_analysis?: {
      summary: string;
      potential_violations: string[];
      powered_by_kanoon?: boolean;
      disclaimer: string;
    };
    rpa_filing_data?: {
      platform?: string;
      platform_url_or_id?: string | null;
      incident_category?: string;
      approximate_date?: string | null;
      suspect_info?: {
        name?: string;
        identifier_type?: string;
        identifier_value?: string | null;
        description?: string;
      };
    };
  };
  created_at: string;
  id: string;
}

type DispatchStatus =
  | { type: "success"; message: string }
  | { type: "error"; message: string };

function normalizeSuspectIdType(value?: string | null): string {
  if (!value) return "none";
  const normalized = value.trim().toLowerCase();
  const allowedTypes = new Set([
    "none",
    "mobile_number",
    "email_address",
    "social_media_id",
    "pan_card",
    "international_number",
    "landline_number",
    "whatsapp_call",
    "aadhaar_card",
    "passport",
    "bank_account",
    "upi_id",
  ]);
  return allowedTypes.has(normalized) ? normalized : "none";
}

function normalizeIncidentDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const directDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDate?.[1]) return directDate[1];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split("T")[0];
}

function extractEvidenceItems(mediaArray: Array<{ url: string; decrypted: boolean }>) {
  return mediaArray.reduce<Array<{ base64: string; mime_type: string }>>((acc, media) => {
    if (!media.decrypted) return acc;

    const match = media.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return acc;

    const [, mime_type, base64] = match;
    if (!mime_type || !base64) return acc;
    acc.push({ base64, mime_type });
    return acc;
  }, []);
}

/**
 * Clean and structure raw markdown synthesis into a professional memo format.
 */
function FormatLegalMemo({ text }: { text: string }) {
  if (!text) return null;
  // Clean raw symbols like # and *
  const cleanLine = (line: string) => {
    return line.replace(/^#+\s*/, '').replace(/\*\*+/g, '').replace(/^-+\s*/, '').trim();
  };

  const lines = text.split('\n');
  return (
    <div className={styles.memoContent}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={idx} />;

        // Header detection
        if (trimmed.startsWith('#') || (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && !trimmed.includes('.'))) {
          return <h4 key={idx} className={styles.memoSectionHeader}>{cleanLine(trimmed)}</h4>;
        }

        // List detection
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
          return <p key={idx} className={styles.memoListItem}>{cleanLine(trimmed)}</p>;
        }

        return <p key={idx} className={styles.memoParagraph}>{cleanLine(trimmed)}</p>;
      })}
    </div>
  );
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const uploadId = params.id as string;
  const [upload, setUpload] = useState<Upload | null>(null);
  const [analysis, setAnalysis] = useState<DecryptedAnalysis | null>(null);
  const [decryptedMediaArray, setDecryptedMediaArray] = useState<{url: string, decrypted: boolean}[]>([]);
  const [loading, setLoading] = useState(true);
  const generating = false;
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus | null>(null);

  const openDispatchModal = useCallback(() => {
    setDispatchStatus(null);
    setIsDispatchModalOpen(true);
  }, []);

  const closeDispatchModal = useCallback(() => {
    if (dispatching) return;
    setIsDispatchModalOpen(false);
  }, [dispatching]);

  const handleDispatchConfirm = useCallback(async (formData: DispatchFormData) => {
    if (!analysis) {
      setDispatchStatus({ type: "error", message: "Analysis data is not available for dispatch yet." });
      return;
    }

    setDispatching(true);
    setDispatchStatus(null);

    try {
      const supabase = createClient();
      
      // We no longer call /api/dispatch (which fails on Vercel)
      // Instead, we update the status in Supabase to 'ready_to_file'
      // This triggers the Supabase Webhook -> Edge Function -> GitHub Action Bot
      let transitPath = upload?.file_url;

      // --- E2EE DECRYPTION BRIDGE ---
      // If the file is encrypted, we decrypt it in the browser and upload a 
      // temporary unencrypted copy for the bot to use. 
      const encryptionKey = await retrieveKey();
      if (upload?.file_iv && encryptionKey && upload?.file_url) {
        console.log("E2EE Evidence detected. Preparing decrypted transit copy...");
        
        // 1. Download encrypted blob
        const { data: encryptedData, error: downloadError } = await supabase
          .storage
          .from('evidence')
          .download(upload.file_url.replace('evidence/', ''));
        
        if (downloadError) throw new Error(`Failed to download encrypted evidence: ${downloadError.message}`);

        // 2. Decrypt locally
        const decryptedBlob = await decryptFile(
          encryptionKey, 
          await encryptedData.arrayBuffer(), 
          upload.file_iv
        );

        // 3. Upload to transit folder
        const transitFilename = `transit/${uploadId}-${Date.now()}.png`;
        const { data: transitData, error: uploadError } = await supabase
          .storage
          .from('evidence')
          .upload(transitFilename, decryptedBlob, {
            contentType: 'image/png',
            cacheControl: '60', // Very short cache
            upsert: true
          });

        if (uploadError) throw new Error(`Failed to upload decrypted transit file: ${uploadError.message}`);
        
        transitPath = `evidence/${transitFilename}`;
        console.log("Transit bridge ready:", transitPath);
      }

      // 4. Update status and metadata
      const { error } = await supabase
        .from('uploads')
        .update({ 
          status: 'ready_to_file',
          dispatch_metadata: {
            ...formData,
            file_url: transitPath
          }
        })
        .eq('id', uploadId);

      if (error) throw error;

      setDispatchStatus({ 
        type: "success", 
        message: "Legal Dispatcher triggered successfully! The background bot is now filing your complaint on the National Cyber Crime Portal. You can check the status on your dashboard shortly." 
      });
      setIsDispatchModalOpen(false);
    } catch (err: any) {
      console.error("Full Dispatch Error Object:", err);
      let message = "Unknown error";
      
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err !== null) {
        message = err.message || err.details || JSON.stringify(err);
      } else {
        message = String(err);
      }

      setDispatchStatus({ type: "error", message: `Filing Error: ${message}` });
    } finally {
      setDispatching(false);
    }
  }, [analysis, decryptedMediaArray, uploadId]);

  useEffect(() => {
    async function fetchData() {
      const key = await retrieveKey();
      if (!key) {
        setLoading(false);
        return;
      }

      try {
        const rawKeyBuffer = await window.crypto.subtle.exportKey('raw', key);
        const masterKeyBase64 = uint8ArrayToBase64(new Uint8Array(rawKeyBuffer));

        const res = await fetch('/api/decrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, masterKey: masterKeyBase64 })
        });

        if (res.ok) {
          const data = await res.json();
          setAnalysis(data.analysis);
          setUpload(data.upload);
          setDecryptedMediaArray(data.decryptedMediaArray || []);
        }
      } catch (err) {
        console.error("Proxy fetch failed", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [uploadId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <LoadingSpinner text="Proxying secure forensic data..." />
        </div>
      </div>
    );
  }

  if (!upload) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Lock size={40} className={styles.lockIcon} />
          <h3>Vault Locked or Not Found</h3>
          <p>Please return to history and unlock your vault to view this analysis.</p>
          <Link href="/dashboard/history" className={styles.emptyButton}>
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  // Handle processing state if it exists but no analysis
  if (!analysis) {
     return (
        <div className={styles.page}>
           <Link href="/dashboard/history" className={styles.back}>
             <ArrowLeft size={16} /> Back to History
           </Link>
           <div className={styles.empty}>
              <Activity size={40} className={styles.lockIcon} />
              <h3>Analysis in Progress</h3>
              <p>Our secure AI is currently scanning your evidence. This report will reveal itself shortly.</p>
              {decryptedMediaArray.length > 0 && (
                <div className={styles.earlyPreview}>
                  <h4>Encrypted Evidence Assets ({decryptedMediaArray.length})</h4>
                  <div className={styles.earlyMediaGrid}>
                    {decryptedMediaArray.map((m, i) => m.decrypted && (
                      <img key={i} src={m.url} className={styles.miniPreview} alt="Evidence" />
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
     );
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard/history" className={styles.back}>
        <ArrowLeft size={16} />
        Back to History
      </Link>

      <section className={styles.heroGrid}>
        <div className={styles.heroMain}>
          <div className={styles.breadcrumb}>
            <span>Analysis</span>
            <span className={styles.breadcrumbSlash}>/</span>
            <span className={styles.breadcrumbActive}>#{analysis.id.substring(0,8).toUpperCase()}</span>
          </div>
          <h1 className={styles.title}>Forensic <span>Analysis</span></h1>
          <p className={styles.subtitle}>
            A deep psychological and legal breakdown of your evidence, retrieved via the private forensics proxy.
          </p>

          <div className={styles.metaRow}>
            <div className={styles.metaItem}><ImageIcon size={13} /><span>{upload.file_name}</span></div>
            <div className={styles.metaItem}><Clock size={13} /><span>{new Date(analysis.created_at).toLocaleString()}</span></div>
            <RiskBadge level={analysis.risk_level} size="sm" />
          </div>
        </div>

        <div className={styles.exportCard}>
           <div className={styles.exportHeader}>
             <FileDown size={18} />
             <h3>Export Document</h3>
           </div>
           <p>Download a sanitized forensic report for legal consultation.</p>
           <button className={styles.exportBtn} disabled={generating}>
             {generating ? 'Compiling...' : 'Download Forensic PDF'}
           </button>
        </div>
      </section>

      <section className={styles.dispatcherBanner}>
        <div className={styles.dispatcherContent}>
          <div className={styles.dispatcherTextBlock}>
            <Bot size={22} className={styles.dispatcherIcon} />
            <div>
              <h3 className={styles.dispatcherTitle}>Autonomous Legal Dispatcher</h3>
              <p className={styles.dispatcherDesc}>
                Run the RPA dispatcher bot to auto-fill the National Cyber Crime portal with your analysis and evidence.
                You can review details in the launch form before dispatching.
              </p>
            </div>
          </div>
          <button
            className={styles.dispatcherBtn}
            onClick={openDispatchModal}
            disabled={dispatching}
          >
            <Bot size={18} />
            {dispatching ? "Launching Dispatcher..." : "Run Legal Dispatcher"}
          </button>
        </div>
        {dispatchStatus && (
          <p className={styles.dispatchStatus} data-status={dispatchStatus.type}>
            {dispatchStatus.message}
          </p>
        )}
      </section>

      <div className={styles.primaryGrid}>
        <div className={styles.mainPanel}>
           {/* IMAGE GALLERY SECTION */}
           {decryptedMediaArray.length > 0 && (
              <section className={styles.evidenceSection}>
                 <div className={styles.sectionHeading}>
                   <h2>Evidence Asset Gallery</h2>
                   <span className={styles.metaItem}>{decryptedMediaArray.length} Assets</span>
                 </div>
                 <div className={styles.evidenceStream}>
                    {decryptedMediaArray.map((media, idx) => (
                      <div key={idx} className={styles.evidenceBubble}>
                         <span className={styles.evidenceLabel}>Asset #{idx + 1}</span>
                         {media.decrypted ? (
                            <img src={media.url} className={styles.evidenceImage} alt="Forensic Screenshot" />
                         ) : (
                            <div className={styles.noMedia}>Media still encrypted or failed to retrieve.</div>
                         )}
                      </div>
                    ))}
                 </div>
              </section>
           )}

           {/* ANALYSIS SUMMARY SECTION */}
           <section className={styles.summaryPanel}>
              <div className={styles.panelHead}>
                 <h2>AI Summary</h2>
                 <div className={styles.confidenceScoreWrap}>
                    <span>AI Confidence</span>
                    <strong>{analysis.details?.confidence_score || 95}%</strong>
                 </div>
              </div>
              <p className={styles.summaryQuote}>{analysis.summary}</p>
           </section>

           {/* DETECTED FLAGS SECTION */}
           {analysis.flags?.length > 0 && (
              <section className={styles.section}>
                 <div className={styles.sectionHeading}>
                    <h2>Pattern Flags</h2>
                 </div>
                 <div className={styles.flagGrid}>
                   {analysis.flags.map((flag, idx) => (
                     <div key={idx} className={styles.flagCard} data-severity={flag.severity}>
                        <div className={styles.flagHeader}>
                           <AlertTriangle size={15} color={flag.severity === 'high' || flag.severity === 'critical' ? '#b1554f' : '#8b907f'} />
                           <span className={styles.flagCategory}>{flag.category}</span>
                        </div>
                        <p className={styles.flagDesc}>{flag.description}</p>
                     </div>
                   ))}
                 </div>
              </section>
           )}

           {/* PSYCHOLOGICAL / TONE SECTION (MANDATORY RESTORATION) */}
           <section className={styles.tonePanel}>
              <h2>Tone & Psychological Analysis</h2>
              <div className={styles.patternBlock}>
                 <h4>Tone Characteristics</h4>
                 <p>{analysis.details?.tone_analysis || "No specific tone analysis generated for this report."}</p>
              </div>

              {analysis.details?.manipulation_indicators && analysis.details.manipulation_indicators.length > 0 && (
                <div className={styles.patternBlock}>
                   <h4>Manipulation Patterns Detected</h4>
                   <ul className={styles.bulletList}>
                      {analysis.details.manipulation_indicators.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                   </ul>
                </div>
              )}
           </section>

           {/* RECOMMENDATIONS SECTION */}
           {analysis.details?.recommendations && analysis.details.recommendations.length > 0 && (
             <section className={styles.section}>
                <div className={styles.sectionHeading}><h2>Expert Safety Recommendations</h2></div>
                <ul className={styles.recommendationList}>
                   {analysis.details.recommendations.map((rec, i) => (
                     <li key={i}><CheckCircle size={16} />{rec}</li>
                   ))}
                </ul>
             </section>
           )}

           {/* LEGAL MEMORANDUM SECTION */}
           {analysis.details?.legal_analysis && (
              <section className={styles.section}>
                 <div className={styles.sectionHeading}>
                    <h2>Legal Memorandum</h2>
                    {analysis.details.legal_analysis.powered_by_kanoon && (
                      <span className={styles.metaItem}><Zap size={12} fill="#eab308" color="#eab308" /> Kanoon Powered</span>
                    )}
                 </div>
                 <div className={styles.legalSummaryCard}>
                    <FormatLegalMemo text={analysis.details.legal_analysis.summary} />
                 </div>
              </section>
           )}
        </div>

        {/* SIDEBAR RAIL */}
        <aside className={styles.supportRail}>
           <div className={styles.checkCard}>
              <div className={styles.sectionHeader}><ShieldCheck size={18} /><h3>Safety Checklist</h3></div>
              <div className={styles.checkItem}><CheckCircle size={14} /><span>Evidence Secured In Vault</span></div>
              <div className={styles.checkItem}><CheckCircle size={14} /><span>AI Forensics Verified</span></div>
              <div className={styles.checkItem}><CheckCircle size={14} /><span>Legal Context Identified</span></div>
           </div>

           <div className={styles.alonePill}>
              <Bot size={18} />
              Forensic Analysis Mode
           </div>

           {analysis.details?.legal_analysis?.disclaimer && (
              <div className={styles.disclaimerCard}>
                 <h4><AlertTriangle size={14} /> Legal Disclaimer</h4>
                 <p>{analysis.details.legal_analysis.disclaimer}</p>
              </div>
           )}
        </aside>
      </div>

      <DispatchModal
        isOpen={isDispatchModalOpen}
        onClose={closeDispatchModal}
        onConfirm={handleDispatchConfirm}
        isLoading={dispatching}
        initialData={{
          suspect_name: analysis.details?.rpa_filing_data?.suspect_info?.name,
          suspect_platform_contact: analysis.details?.rpa_filing_data?.platform_url_or_id || "",
          suspect_id_type: normalizeSuspectIdType(
            analysis.details?.rpa_filing_data?.suspect_info?.identifier_type
          ),
          suspect_id_value:
            analysis.details?.rpa_filing_data?.suspect_info?.identifier_value || "",
          incident_date: normalizeIncidentDate(
            analysis.details?.rpa_filing_data?.approximate_date
          ),
        }}
      />
    </div>
  );
}
