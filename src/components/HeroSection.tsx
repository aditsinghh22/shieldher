"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, ShieldCheck, Zap, Lock } from "lucide-react";
import styles from "./HeroSection.module.css";

const scanStatuses = [
  { label: "Manipulation cues", value: "Detected", level: "warn" },
  { label: "Coercive language", value: "Elevated", level: "danger" },
  { label: "Threat signals", value: "Low", level: "safe" },
];

const riskRotation = [
  { level: "Moderate", color: "#f5a623", percent: 40 },
  { level: "Low", color: "#00d4aa", percent: 20 },
  { level: "High", color: "#ff4757", percent: 75 },
];

const trustBadges = [
  { icon: ShieldCheck, text: "End-to-end encrypted" },
  { icon: Zap, text: "Real-time analysis" },
  { icon: Lock, text: "Ghost mode ready" },
];

export default function HeroSection() {
  const [riskIndex, setRiskIndex] = useState(0);
  const [scanVisible, setScanVisible] = useState(false);
  const [activeItem, setActiveItem] = useState(-1);

  // Cycle through risk levels
  useEffect(() => {
    const interval = setInterval(() => {
      setRiskIndex((prev) => (prev + 1) % riskRotation.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Staggered scan items reveal
  useEffect(() => {
    setScanVisible(true);
    const interval = setInterval(() => {
      setActiveItem((prev) => {
        if (prev >= scanStatuses.length - 1) return 0;
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const currentRisk = riskRotation[riskIndex];

  return (
    <section className={styles.hero}>
      <div className={styles.bgContainer}>
        <Image
          src="/auratein.jpeg"
          alt="Auratein Background"
          fill
          style={{ objectFit: "cover", objectPosition: "left center" }}
          priority
        />
        <div className={styles.overlay} />
        <div className={styles.orbA} />
        <div className={styles.orbB} />
        <div className={styles.orbC} />
        <div className={styles.noise} />
        <div className={styles.scanline} />
      </div>

      <div className={`container ${styles.content}`}>
        <div className={styles.heroGrid}>
          <div className={styles.heroLeft}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              <Sparkles size={14} />
              <span>AI-Powered Protection</span>
            </div>

            <h1 className={styles.title}>
              Your digital
              <br />
              <span className={styles.titleAccent}>safety shield.</span>
            </h1>

            <p className={styles.subtitle}>
              Upload chat screenshots and let our AI instantly analyze
              conversations for manipulation, threats, and harmful patterns.
              Stay informed, stay safe.
            </p>

            <div className={styles.actions}>
              <Link
                href="/auth"
                className={`${styles.heroBtn} ${styles.heroBtnPrimary}`}
              >
                <span className={styles.btnShimmer} />
                Start Analyzing
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/#how-it-works"
                className={`${styles.heroBtn} ${styles.heroBtnSecondary}`}
              >
                How It Works
              </Link>
            </div>

            {/* Trust badges */}
            <div className={styles.trustRow}>
              {trustBadges.map((badge, i) => {
                const Icon = badge.icon;
                return (
                  <div key={i} className={styles.trustBadge} style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                    <Icon size={14} />
                    <span>{badge.text}</span>
                  </div>
                );
              })}
            </div>

            <div className={styles.heroStats}>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>10K+</span>
                <span className={styles.statLabel}>Screenshots analyzed</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>98%</span>
                <span className={styles.statLabel}>Detection accuracy</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>&lt;30s</span>
                <span className={styles.statLabel}>Avg analysis time</span>
              </div>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroPanel}>
              {/* Animated border glow */}
              <div className={styles.panelGlow} />

              <div className={styles.panelHeader}>
                <div className={styles.panelChip}>
                  <Image
                    src="/red-circle-logo.svg"
                    alt="ShieldHer Logo"
                    width={22}
                    height={22}
                    className={styles.chipLogo}
                  />
                  <span className={styles.liveDot} />
                  Live Scan
                </div>
                <span className={styles.panelMeta}>Encrypted • Private</span>
              </div>

              <div className={styles.panelContent}>
                <div className={styles.panelScore}>
                  <div
                    className={styles.panelScoreRing}
                    style={{
                      background: `conic-gradient(${currentRisk.color} 0 ${currentRisk.percent}%, rgba(255,255,255,0.15) ${currentRisk.percent}% 100%)`,
                    }}
                  >
                    <div className={styles.panelScoreRingInner} />
                  </div>
                  <div>
                    <div className={styles.panelScoreLabel}>Risk Level</div>
                    <div className={styles.panelScoreValue} key={riskIndex}>
                      {currentRisk.level}
                    </div>
                  </div>
                </div>

                <div className={styles.panelList}>
                  {scanStatuses.map((item, i) => (
                    <div
                      key={i}
                      className={`${styles.panelItem} ${activeItem === i ? styles.panelItemActive : ""
                        } ${scanVisible ? styles.panelItemVisible : ""}`}
                      style={{ animationDelay: `${0.8 + i * 0.15}s` }}
                    >
                      <span>{item.label}</span>
                      <strong
                        className={
                          item.level === "danger"
                            ? styles.valueDanger
                            : item.level === "warn"
                              ? styles.valueWarn
                              : styles.valueSafe
                        }
                      >
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className={styles.panelFooter}>
                  <span className={styles.panelHint}>
                    AI verdict updates in real time
                  </span>
                  <div className={styles.panelPulse} />
                </div>
              </div>
            </div>

            <div className={styles.floatingCard}>
              <div className={styles.floatingIcon}>⚡</div>
              <div>
                <div className={styles.floatingTitle}>Instant Insights</div>
                <p className={styles.floatingText}>
                  Highlighting patterns across messages, tone shifts, and legal
                  signals in seconds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
