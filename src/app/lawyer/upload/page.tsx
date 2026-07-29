'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Loader, Info, AlertTriangle, Lightbulb, Scale } from 'lucide-react';
import Link from 'next/link';
import UploadZone from '@/components/UploadZone';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';
import { type AnalysisResult } from '@/lib/types';
import { useRouter } from 'next/navigation';

type UserRole = 'user' | 'lawyer';

function parseRole(value: unknown): UserRole | null {
  if (value === 'lawyer' || value === 'user') return value;
  return null;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('English');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  useEffect(() => {
    async function ensureLawyerAccess() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const role = parseRole(user.user_metadata?.role);
      if (role !== 'lawyer') {
        router.replace('/dashboard/upload');
      }
    }

    ensureLawyerAccess();
  }, [router]);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setError('');
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to upload');

      const fileUrls: string[] = [];

      for (const file of files) {
        // Upload file to Supabase Storage
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, file);

        if (storageError) throw storageError;

        const { data: { publicUrl } } = supabase.storage
          .from('screenshots')
          .getPublicUrl(fileName);

        fileUrls.push(publicUrl);
      }

      const combinedFileName = files.length === 1 ? files[0].name : `${files.length} items uploaded together`;

      // Create a SINGLE upload record containing all URLs
      const { data: upload, error: dbError } = await supabase
        .from('uploads')
        .insert({
          user_id: user.id,
          file_url: fileUrls.join(','),
          file_name: combinedFileName,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploading(false);
      setAnalyzing(true);

      // Trigger analysis for the single combined DB record
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: upload.id, language }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Analysis failed');
      }

      const data = await res.json();
      setAnalyzing(false);
      setAnalysisResult(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setUploading(false);
      setAnalyzing(false);
    }
  };
  const potentialViolations =
    analysisResult?.details?.legal_analysis?.potential_violations
      ?.map((item) => item.trim())
      .filter((item) => item.length > 0) ?? [];

  return (
    <div className={styles.page}>
      <Link href="/lawyer/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Back to Lawyer Dashboard
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Upload Evidence</h1>
        <p className={styles.subtitle}>
          Upload chat screenshots or voice recordings for AI-powered analysis. We&apos;ll detect harmful
          patterns, manipulation, and potential threats.
        </p>
      </div>

      <div className={styles.bentoContainer}>
        <div className={styles.uploadCard}>
          {!analysisResult ? (
            <>
              <UploadZone onFilesSelected={handleFilesSelected} isUploading={uploading} />
              
              {error && (
                <div className={styles.error}>{error}</div>
              )}

              {files.length > 0 && (
                <div className={styles.languageSelector}>
                  <label htmlFor="language">Translation Language:</label>
                  <select 
                    id="language" 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className={styles.languageDropdown}
                    disabled={uploading || analyzing}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Russian">Russian</option>
                    <option value="Urdu">Urdu</option>
                    <option value="Indonesian">Indonesian</option>
                    <option value="German">German</option>
                  </select>
                </div>
              )}

              <div className={styles.actions}>
                <button
                  className={styles.analyzeButton}
                  onClick={handleAnalyze}
                  disabled={files.length === 0 || uploading || analyzing}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : analyzing ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Analyze {files.length > 0 ? `(${files.length})` : ''}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.resultContainer}>
              <div className={styles.resultHeader}>
                <div className={`${styles.riskBadge} ${styles[analysisResult.risk_level] || styles.safe}`}>
                  {analysisResult.risk_level.toUpperCase()} RISK
                </div>
                <h2>Analysis Complete</h2>
              </div>
              
              <p className={styles.summary}>{analysisResult.summary}</p>

              {analysisResult.flags && analysisResult.flags.length > 0 && (
                <div className={styles.resultSection}>
                  <div className={styles.resultSectionTitle}>
                    <AlertTriangle size={18} /> Detected Flags {!showFullAnalysis && '(Top points)'}
                  </div>
                  <div className={styles.flagsList}>
                    {(showFullAnalysis ? analysisResult.flags : analysisResult.flags.slice(0, 2)).map((flag, idx) => (
                      <div key={idx} className={styles.flagItem}>
                        <span className={styles.flagCat}>{flag.category}</span>
                        <span className={styles.flagDesc}>{flag.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showFullAnalysis && (
                <>
                  {analysisResult.details?.recommendations && analysisResult.details.recommendations.length > 0 && (
                    <div className={styles.resultSection}>
                      <div className={styles.resultSectionTitle}>
                        <Lightbulb size={18} /> Recommendations
                      </div>
                      <ul className={styles.recList}>
                        {analysisResult.details.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.details?.legal_analysis && (
                    <div className={styles.resultSection}>
                      <div className={styles.resultSectionTitle}>
                        <Scale size={18} /> Legal Perspective
                      </div>
                      <p className={styles.legalSummary}>{analysisResult.details.legal_analysis.summary}</p>
                      {potentialViolations.length > 0 && (
                          <div className={styles.legalSectionsBlock}>
                            <h4 className={styles.legalSectionsTitle}>
                              Possible Applicable Sections / Articles
                            </h4>
                            <ul className={styles.legalSectionsList}>
                              {potentialViolations.map((violation, idx) => (
                                <li key={`${violation}-${idx}`}>{violation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      <p className={styles.disclaimer}>{analysisResult.details.legal_analysis.disclaimer}</p>
                    </div>
                  )}
                </>
              )}

              <div className={styles.actions} style={{ marginTop: '20px', gap: '12px' }}>
                {!showFullAnalysis ? (
                  <button
                    className={styles.analyzeButton}
                    style={{ minWidth: 'auto', padding: '12px 24px' }}
                    onClick={() => setShowFullAnalysis(true)}
                  >
                    View Full Analysis
                  </button>
                ) : (
                  <button
                    className={styles.resetButton}
                    onClick={() => setShowFullAnalysis(false)}
                  >
                    Show Less
                  </button>
                )}
                <button
                  className={styles.resetButton}
                  onClick={() => {
                    setAnalysisResult(null);
                    setFiles([]);
                    setShowFullAnalysis(false);
                  }}
                >
                  Analyze Another File
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.tipsCard}>
          <div className={styles.tipsHeader}>
            <div className={styles.tipsIcon}>
              <Info size={20} />
            </div>
            <h3>Tips for best results</h3>
          </div>
          <ul className={styles.tipsList}>
            <li>Take clear, full-screen screenshots or provide clear audio recordings</li>
            <li>Include the full conversation thread when possible</li>
            <li>Make sure text is readable and not blurry</li>
            <li>You can upload multiple files at once</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
