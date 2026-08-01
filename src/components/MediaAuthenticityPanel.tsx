'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  FileSearch,
  Gauge,
  ListChecks,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info
} from 'lucide-react';
import {
  getAuthenticityToneClass,
  getFriendlyAuthenticityMessage,
} from '@/lib/mediaAuthenticity';
import { type MediaAuthenticityResult } from '@/lib/types';
import RiskBadge from './RiskBadge';
import styles from './MediaAuthenticityPanel.module.css';

interface MediaAuthenticityPanelProps {
  authenticity?: MediaAuthenticityResult;
  compact?: boolean;
}

function formatScore(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'N/A';
}

function EvidenceSupportBadge({ support }: { support?: 'AI' | 'Authentic' | 'Neutral' }) {
  if (!support || support === 'Neutral') return null;
  const isAi = support === 'AI';
  return (
    <span className={`${styles.supportBadge} ${isAi ? styles.supportAi : styles.supportAuthentic}`}>
      {isAi ? 'Supports AI' : 'Supports Authentic'}
    </span>
  );
}

function EvidenceStrengthIndicator({ strength }: { strength?: 'Weak' | 'Moderate' | 'Strong' }) {
  if (!strength) return null;
  const bars = strength === 'Strong' ? 3 : strength === 'Moderate' ? 2 : 1;
  return (
    <div className={styles.strengthIndicator} title={`Evidence Strength: ${strength}`}>
      {[1, 2, 3].map(i => (
        <div key={i} className={`${styles.strengthBar} ${i <= bars ? styles[`strength${strength}`] : ''}`} />
      ))}
      <span className={styles.strengthText}>{strength}</span>
    </div>
  );
}

export default function MediaAuthenticityPanel({
  authenticity,
  compact = false,
}: MediaAuthenticityPanelProps) {
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  if (!authenticity) return null;

  const tone = getAuthenticityToneClass(authenticity.status);
  
  // Flatten evidence across all items, rank strong ones first
  const topEvidence = authenticity.items
    .flatMap((item) => item.evidence || [])
    .sort((a, b) => {
      const rank = { Strong: 3, Moderate: 2, Weak: 1, undefined: 0 };
      return (rank[b.evidence_strength as keyof typeof rank] || 0) - (rank[a.evidence_strength as keyof typeof rank] || 0);
    })
    .slice(0, compact ? 3 : 8);

  const detectors = authenticity.detectors_used?.length
    ? authenticity.detectors_used
    : Array.from(
        new Set(
          authenticity.items.flatMap((item) =>
            (item.model_results || []).map((result) => result.detector_name),
          ),
        ),
      );

  const toggleReasoning = (fileName: string) => {
    setExpandedReasoning(prev => ({ ...prev, [fileName]: !prev[fileName] }));
  };

  return (
    <section className={`${styles.panel} ${styles[tone]} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <FileSearch size={18} />
          <div>
            <h3>AI Media Authenticity</h3>
            <p>{authenticity.provider}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          {authenticity.risk_level && (
            <RiskBadge level={authenticity.risk_level.toLowerCase() as any} size="sm" />
          )}
          <span className={styles.badge}>{authenticity.label}</span>
        </div>
      </div>

      <div className={styles.scoreGrid}>
        <div className={styles.score}>
          <Gauge size={15} />
          <span>Authenticity</span>
          <strong>{formatScore(authenticity.authenticity_score)}</strong>
        </div>
        <div className={styles.score}>
          <Bot size={15} />
          <span>AI Probability</span>
          <strong>{formatScore(authenticity.ai_generation_probability ?? authenticity.ai_probability)}</strong>
        </div>
        <div className={styles.score}>
          <AlertTriangle size={15} />
          <span>Manipulation</span>
          <strong>{formatScore(authenticity.manipulation_probability)}</strong>
        </div>
        <div className={styles.score}>
          <ShieldCheck size={15} />
          <span>Confidence</span>
          <strong>{formatScore(authenticity.confidence_score ?? authenticity.confidence)}</strong>
        </div>
      </div>

      <p className={styles.summary}>
        {authenticity.human_explanation || authenticity.summary || getFriendlyAuthenticityMessage(authenticity.status)}
      </p>

      {/* Possible Models Section */}
      {!compact && authenticity.possible_models && authenticity.possible_models.length > 0 && (
        <div className={styles.modelsContainer}>
          <Cpu size={14} />
          <span>Suspected Generator Models:</span>
          <div className={styles.modelTags}>
            {authenticity.possible_models.map(model => (
              <span key={model} className={styles.modelTag}>{model}</span>
            ))}
          </div>
        </div>
      )}

      {!compact && authenticity.items.length > 0 && (
        <div className={styles.items}>
          {authenticity.items.map((item, index) => {
            const isExpanded = expandedReasoning[item.file_name];
            return (
              <div key={`${item.file_name}-${index}`} className={styles.item}>
                <div className={styles.itemTop}>
                  <div className={styles.itemTitleGroup}>
                    <span>{item.file_name}</span>
                    {item.dual_pass_agreement === false && (
                      <span className={styles.dualPassWarning} title="Independent analysis passes disagreed. Confidence reduced.">
                        <AlertTriangle size={12} /> Disagreement
                      </span>
                    )}
                  </div>
                  <strong>{item.label}</strong>
                </div>
                
                {item.limitations && item.limitations.length > 0 && (
                  <div className={styles.limitationsBox}>
                    <Info size={12} />
                    <span><strong>Limitations:</strong> {item.limitations.join(' ')}</span>
                  </div>
                )}

                <p>{item.human_explanation || item.summary}</p>
                
                {item.final_reasoning && (
                  <div className={styles.reasoningSection}>
                    <button onClick={() => toggleReasoning(item.file_name)} className={styles.reasoningToggle}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Hide' : 'View'} Detailed Forensic Reasoning
                    </button>
                    {isExpanded && (
                      <div className={styles.reasoningContent}>
                        {item.final_reasoning.split('\\n').map((paragraph, i) => (
                          <p key={i}>{paragraph}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {topEvidence.length > 0 && (
        <div className={styles.evidence}>
          <div className={styles.blockTitle}>Forensic Evidence Markers</div>
          {topEvidence.map((evidence, index) => (
            <div key={`${evidence.label}-${index}`} className={styles.evidenceItem}>
              <div className={styles.evidenceIconWrap}>
                <span>{evidence.kind.replace('_', ' ')}</span>
              </div>
              <div className={styles.evidenceContent}>
                <div className={styles.evidenceTopRow}>
                  <strong>{evidence.label}</strong>
                  <div className={styles.evidenceBadges}>
                    <EvidenceSupportBadge support={evidence.evidence_supports} />
                    <EvidenceStrengthIndicator strength={evidence.evidence_strength} />
                  </div>
                </div>
                <p>
                  {evidence.description}
                  {evidence.value ? <span className={styles.evidenceValue}> ({evidence.value})</span> : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!compact && detectors.length > 0 && (
        <div className={styles.techBlock}>
          <div className={styles.blockTitle}>
            <ListChecks size={14} />
            Detectors Used
          </div>
          <div className={styles.detectorList}>
            {detectors.map((detector) => (
              <span key={detector}>{detector}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
