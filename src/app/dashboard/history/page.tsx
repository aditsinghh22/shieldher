"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Upload, type AnalysisResult } from "@/lib/types";
import { deriveKey, storeKey, retrieveKey, uint8ArrayToBase64, generateSalt } from "@/lib/crypto";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  FileSearch,
  ArrowLeft,
  Filter,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ImageIcon,
  Lock,
  Clock,
  FileAudio,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import styles from "./page.module.css";

interface UploadWithAnalysis extends Upload {
  analysis_results: AnalysisResult[];
  decrypted_url?: string;
}

const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i;

function getPrimaryAsset(fileUrl: string) {
  return fileUrl
    .split(",")
    .map((url) => url.trim())
    .find((url) => url.length > 0);
}

function isImageAsset(url: string) {
  if (url.startsWith('data:image/')) return true;
  return IMAGE_EXT_REGEX.test(url);
}

const AUDIO_EXT_REGEX = /\.(mp3|wav|m4a|aac|ogg|enc)(\?.*)?$/i;
function isAudioAsset(url: string, originalType?: string) {
  if (url.startsWith('data:audio/')) return true;
  if (originalType?.startsWith('audio/')) return true;
  return AUDIO_EXT_REGEX.test(url);
}

function formatConfidence(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return "--";
  const normalized = score <= 1 ? score * 100 : score;
  return `${Math.round(normalized * 10) / 10}%`;
}

export default function HistoryPage() {
  const [uploads, setUploads] = useState<UploadWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flagged" | "safe">("all");
  
  // Deletion state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Lock screen state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("uploads")
        .select("*, analysis_results(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setUploads(data as UploadWithAnalysis[]);
        
        // Automatic unlock if the key is already in memory
        const key = await retrieveKey();
        if (key) {
          setIsUnlocked(true);
          performProxyDecryption(key, data as UploadWithAnalysis[]);
        }
      }
      setLoading(false);
    }
    fetchHistory();
  }, []);

  const performProxyDecryption = async (key: CryptoKey, items: UploadWithAnalysis[]) => {
      try {
        const rawKeyBuffer = await window.crypto.subtle.exportKey('raw', key);
        const masterKeyBase64 = uint8ArrayToBase64(new Uint8Array(rawKeyBuffer));

        const decryptedUploads: UploadWithAnalysis[] = [];
        for (const upload of items) {
          // Only proxy decrypt items that have encrypted fields or IVs
          if (!upload.file_iv && !upload.analysis_results?.some(a => a.encrypted_summary)) {
            decryptedUploads.push(upload); 
            continue;
          }

          try {
            const res = await fetch('/api/decrypt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uploadId: upload.id, masterKey: masterKeyBase64 })
            });
            
            if (res.ok) {
              const data = await res.json();
              decryptedUploads.push({ 
                ...upload, 
                analysis_results: data.analysis ? [data.analysis] : (upload.analysis_results || []), 
                decrypted_url: data.decryptedMedia 
              });
            } else {
              decryptedUploads.push(upload);
            }
          } catch (e) {
            console.error(`Proxy decryption failed for ${upload.id}:`, e);
            decryptedUploads.push(upload);
          }
        }
        setUploads(decryptedUploads);
      } catch (err) {
        console.error("Proxy decryption master loop failed", err);
      }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not logged in");

      // 1. Verify password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordPrompt,
      });

      if (error) throw new Error("Incorrect password");

      // 2. Derive key browser-side
      const { data: profile } = await supabase
        .from("profiles")
        .select("encryption_salt")
        .eq("id", user.id)
        .single();

      let salt = profile?.encryption_salt;

      if (!salt) {
        // First-time vault initialization
        const newSalt = generateSalt();
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ encryption_salt: newSalt })
          .eq("id", user.id);

        if (updateErr) {
          // If update failed (e.g. profile doesn't exist), try to insert it
          const { error: insertErr } = await supabase
            .from("profiles")
            .upsert({ id: user.id, encryption_salt: newSalt });
          
          if (insertErr) throw new Error("Failed to initialize secure vault: " + insertErr.message);
        }
        salt = newSalt;
      }

      const key = await deriveKey(passwordPrompt, salt);
      await storeKey(key, salt); // Cache in memory
      
      // 3. Trigger proxy decryption
      setIsUnlocked(true);
      performProxyDecryption(key, uploads);

    } catch (err: any) {
      setUnlockError(err.message || "Failed to unlock history.");
    } finally {
      setUnlocking(false);
      setPasswordPrompt("");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/delete-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: deleteId }),
      });

      if (!res.ok) throw new Error("Failed to delete forensic data");

      setUploads((prev) => prev.filter((u) => u.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("Failed to delete forensic data. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = uploads.filter((u) => {
    if (filter === "all") return true;
    if (filter === "flagged") return u.status === "flagged";
    return (
      u.status === "completed" &&
      u.analysis_results?.some(
        (a) => a.risk_level === "safe" || a.risk_level === "low",
      )
    );
  });

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <LoadingSpinner text="Loading history..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Analysis History</h1>
        <p className={styles.subtitle}>
          Browse your past screenshot uploads and review detailed AI analysis
          reports. Our forensic proxy ensures zero-admin access to your sensitive data.
        </p>
      </div>

      {!isUnlocked && (
        <div className={styles.unlockBanner}>
          <div className={styles.bannerIcon}>
            <Lock size={20} />
          </div>
          <div className={styles.bannerContent}>
            <h3 className={styles.bannerTitle}>History is Encrypted</h3>
            <p className={styles.bannerText}>Enter your password to unlock the private forensics proxy and reveal your data.</p>
          </div>
          <form onSubmit={handleUnlock} className={styles.bannerForm}>
            <input
              type="password"
              placeholder="Your password..."
              className={styles.bannerInput}
              value={passwordPrompt}
              onChange={(e) => setPasswordPrompt(e.target.value)}
              disabled={unlocking}
            />
            <button type="submit" className={styles.bannerBtn} disabled={unlocking || !passwordPrompt}>
              {unlocking ? "Decrypting..." : "Unlock Vault"}
            </button>
          </form>
          {unlockError && <div className={styles.bannerError}>{unlockError}</div>}
        </div>
      )}

      <div className={styles.filtersWrapper}>
        <div className={styles.filterIconWrap}>
          <Filter size={16} />
        </div>
        <div className={styles.filters}>
          {(["all", "flagged", "safe"] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
              onClick={() => setFilter(f)}
            >
              <span className={styles.filterDot} data-type={f} />
              {f === "all"
                ? "All Uploads"
                : f === "flagged"
                  ? "Flagged Issues"
                  : "Safe Results"}
            </button>
          ))}
        </div>
        <div className={styles.dateRangeChip}>
          <Calendar size={14} />
          Date Range
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className={styles.list}>
          {filtered.map((upload) => {
            const analyses = upload.analysis_results ?? [];
            const primaryAsset = getPrimaryAsset(upload.file_url);
            const statusTone =
              upload.status === "flagged"
                ? "flagged"
                : upload.status === "completed"
                  ? "safe"
                  : "processing";
            const statusLabel =
              upload.status === "flagged"
                ? "Flagged"
                : upload.status === "completed"
                  ? "Safe"
                  : "Processing";

            return (
              <article key={upload.id} className={styles.uploadCard}>
                <div className={styles.mediaPane}>
                  <span className={`${styles.mediaStatus} ${styles[statusTone]}`}>
                    {statusLabel}
                  </span>
                  {isUnlocked && (upload.decrypted_url || primaryAsset) ? (
                    isImageAsset(upload.decrypted_url || primaryAsset || "") ? (
                      <img
                        src={upload.decrypted_url || primaryAsset}
                        alt={upload.file_name}
                        className={styles.mediaImage}
                      />
                    ) : (
                      <div className={styles.audioItemPreview}>
                         <FileAudio size={40} className={styles.audioIcon} />
                         <audio src={upload.decrypted_url || primaryAsset} controls className={styles.cardAudio} />
                      </div>
                    )
                  ) : (
                    <div className={styles.mediaPlaceholder}>
                      {isUnlocked ? <ImageIcon size={34} /> : <Lock size={30} />}
                      <span>{isUnlocked ? "No preview available" : "Encrypted Content"}</span>
                    </div>
                  )}
                </div>

                <div className={styles.contentPane}>
                  <div className={styles.cardTitleWrap}>
                    <h3 className={styles.fileName}>{upload.file_name}</h3>
                    <div className={styles.cardHeaderActions}>
                      <span className={styles.uploadDate}>
                        {new Date(upload.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => setDeleteId(upload.id)}
                        disabled={isDeleting}
                        title="Permanently Delete Analysis"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {!isUnlocked ? (
                    <div className={styles.lockedAnalysis}>
                      <Lock size={16} />
                      <span>Private Forensic Data. Unlock proxy to view AI results.</span>
                    </div>
                  ) : analyses.length > 0 ? (
                    <div className={styles.analysisStack}>
                      {analyses.map((analysis) => {
                        const firstFlag = analysis.flags?.[0];

                        return (
                          <section key={analysis.id} className={styles.analysisBlock}>
                            <p className={styles.summary}>{analysis.summary}</p>

                            {firstFlag && (
                              <div className={styles.alertBox}>
                                <div className={styles.alertTitle}>
                                  <AlertTriangle size={15} />
                                  Flag Detected: {firstFlag.category}
                                </div>
                                <p className={styles.alertDescription}>
                                  {firstFlag.description}
                                </p>
                              </div>
                            )}

                            <div className={styles.analysisMeta}>
                              <div className={styles.metaInfo}>
                                <span>
                                  AI Confidence: {formatConfidence(analysis.details?.confidence_score)}
                                </span>
                                <span>Report #{analysis.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                              <Link
                                href={`/dashboard/analysis/${analysis.upload_id}`}
                                className={styles.analysisLink}
                              >
                                View Full Analysis
                                <ArrowRight size={15} />
                              </Link>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.noAnalysis}>
                      Analysis is still processing for this upload.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIconWrap}>
            <FileSearch size={30} />
          </div>
          <h3>No results found</h3>
          <p>
            {filter !== "all"
              ? "Try changing your filter to see more results."
              : "Upload some screenshots to get started."}
          </p>
          <Link href="/dashboard/upload" className={styles.emptyButton}>
            New Upload
          </Link>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Delete Forensic Evidence?"
        message="This action is permanent. All encrypted files and AI analysis reports associated with this upload will be wiped from the system."
        confirmText="Permanently Delete"
        type="danger"
      />
    </div>
  );
}
