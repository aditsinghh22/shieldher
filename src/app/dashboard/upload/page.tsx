'use client';

import { useState } from 'react';
import { ArrowLeft, Sparkles, Loader, Info, AlertTriangle, Lightbulb, Scale, ShieldCheck, MessageCircle, Activity, AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import UploadZone from '@/components/UploadZone';
import { createClient } from '@/lib/supabase/client';
import { encryptFile, retrieveKey, uint8ArrayToBase64 } from '@/lib/crypto';
import styles from './page.module.css';
import { type AnalysisResult } from '@/lib/types';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('English');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

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

      const key = await retrieveKey();
      if (!key) {
        throw new Error('Vault is locked. Please go to the History page and unlock your vault to enable secure uploads.');
      }

      const fileUrls: string[] = [];
      const fileIVs: string[] = [];
      const fileTypes: string[] = [];

      // ═══ STEP 2: Encrypt and Upload ═══
      for (const file of files) {
        setAnalyzing(false);
        setUploading(true);
        setEncrypting(true);

        // Encrypt the file locally
        const { iv, encryptedBlob } = await encryptFile(key, file);
        setEncrypting(false);

        const fileName = `${user.id}/${Date.now()}-${file.name}.enc`;
        const { error: storageError } = await supabase.storage
          .from('screenshots')
          .upload(fileName, encryptedBlob, {
            contentType: 'application/octet-stream',
          });

        if (storageError) {
          console.error("Storage Error:", storageError);
          throw new Error(`File upload failed: ${storageError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('screenshots')
          .getPublicUrl(fileName);

        fileUrls.push(publicUrl);
        fileIVs.push(iv);
        fileTypes.push(file.type);
      }

      const combinedFileName = files.length === 1 ? files[0].name : `${files.length} items uploaded together`;

      // Create a SINGLE upload record containing all URLs and IVs
      const { data: upload, error: dbError } = await supabase
        .from('uploads')
        .insert({
          user_id: user.id,
          file_url: fileUrls.join(','),
          file_name: combinedFileName,
          file_iv: fileIVs.join(','),
          original_type: fileTypes.join(','),
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploading(false);
      setAnalyzing(true);

      // Export the key to send to the analysis API for ephemeral decryption
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      const keyBase64 = uint8ArrayToBase64(new Uint8Array(exportedKey));

      // Trigger analysis for the single combined DB record
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uploadId: upload.id, 
          language,
          masterKey: keyBase64 // Sent for ephemeral server-side decryption
        }),
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
      setEncrypting(false);
    }
  };
  const potentialViolations =
    analysisResult?.details?.legal_analysis?.potential_violations
      ?.map((item) => item.trim())
      .filter((item) => item.length > 0) ?? [];

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>
        <ArrowLeft size={16} />
        Back to Dashboard
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
              <UploadZone onFilesSelected={handleFilesSelected} isUploading={uploading} variant="dashboard" />
              
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
                  {analysisResult.details?.tone_analysis && (
                    <div className={styles.resultSection}>
                      <div className={styles.resultSectionTitle}>
                        <MessageCircle size={18} /> Tone Analysis
                      </div>
                      <p className={styles.legalSummary}>{analysisResult.details.tone_analysis}</p>
                    </div>
                  )}

                  {analysisResult.details?.manipulation_indicators && analysisResult.details.manipulation_indicators.length > 0 && (
                    <div className={styles.resultSection}>
                      <div className={styles.resultSectionTitle}>
                        <Activity size={18} /> Manipulation Tactics
                      </div>
                      <ul className={styles.recList}>
                        {analysisResult.details.manipulation_indicators.map((indicator, idx) => (
                          <li key={idx}>{indicator}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.details?.threat_indicators && analysisResult.details.threat_indicators.length > 0 && (
                    <div className={styles.resultSection}>
                      <div className={styles.resultSectionTitle}>
                        <AlertOctagon size={18} /> Threat Indicators
                      </div>
                      <ul className={styles.recList}>
                        {analysisResult.details.threat_indicators.map((threat, idx) => (
                          <li key={idx}>{threat}</li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                      <div className={styles.legalSummary} style={{ whiteSpace: 'pre-wrap' }}>
                        {analysisResult.details.legal_analysis.summary.replace(/#/g, '')}
                      </div>

                      {!analysisResult.details.legal_analysis.powered_by_kanoon && potentialViolations.length > 0 && (
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
                      
                      {!analysisResult.details.legal_analysis.powered_by_kanoon && (
                        <p className={styles.disclaimer}>{analysisResult.details.legal_analysis.disclaimer}</p>
                      )}
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

          <div className={styles.tipsHeader} style={{ marginTop: '1.2rem' }}>
            <div className={styles.tipsIcon}>
              <ShieldCheck size={20} />
            </div>
            <h3>End-to-End Encrypted</h3>
          </div>
          <ul className={styles.tipsList}>
            <li>Your images are encrypted before leaving your browser</li>
            <li>AI analysis runs through a secure ephemeral proxy</li>
            <li>Only you can decrypt and view your data</li>
            <li>Even platform admins cannot access your content</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
