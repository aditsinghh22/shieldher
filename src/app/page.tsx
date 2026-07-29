import HeroVideo from "@/components/HeroVideo";
import PrivacyFeatureScroller from "@/components/PrivacyFeatureScroller";
import Reveal from "@/components/Reveal";
import ShieldSceneWrapper from "@/components/ShieldSceneWrapper";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      {/* ══════════════════════════════════════
          HERO SECTION — full-screen video bg
          ══════════════════════════════════════ */}
      <section className="hero-section">
        {/* Looping background video */}
        <HeroVideo />

        {/* Navigation inside hero */}
        <nav className="hero-nav">
          <div />

          <div className="hero-nav-logo" aria-label="Shield Her">
            Shield Her
          </div>

          <div>
            <Link href="/auth" className="hero-nav-cta">
              Log in
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="hero-content">
          <h1 className="hero-title">
            Safety is a Shared Value
          </h1>
          <p className="hero-subtitle">
            Shield Her uses AI to analyze threatening conversations, detect manipulation,
            and give you clarity — protecting your safety, privacy, and peace of mind and help.
          </p>
          <div className="hero-cta-group">
            <Link href="/auth" className="hero-cta-btn">
              Get Started Free
            </Link>
            <a href="#how-it-works" className="hero-cta-btn">
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES SECTION — Bento Grid
          ══════════════════════════════════════ */}
      <section className="features-section" id="how-it-works">
        <div className="section-inner">
          <Reveal>
            <div className="section-header">
              <div className="section-tag">Features</div>
              <h2 className="section-title">
                Designed to protect, built to empower.
              </h2>
              <p className="section-subtitle">
                We've reimagined personal safety as a seamless, intelligent experience
                that fits into your daily life.
              </p>
            </div>
          </Reveal>

          <div className="bento-grid">

            {/* ── Card 1: AI Threat Analysis (blue) ── */}
            <Reveal delay={0}>
              <div className="bento-card bento-card-1">
                <div className="bento-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>

                <div>
                  <div className="bento-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>psychology</span>
                    AI-Powered
                  </div>
                  <div className="bento-title">AI Threat Analysis</div>
                  <p className="bento-desc">
                    Upload any conversation screenshot. Our AI instantly flags manipulation,
                    gaslighting, coercion, and threatening language patterns.
                  </p>
                </div>

                {/* Floating chat mockup */}
                <div className="bento-mockup bento-mockup-1">
                  <div className="chat-bubble-mock chat-bubble-user">
                    "I know where you live."
                  </div>
                  <div className="chat-bubble-mock chat-bubble-threat">
                    <span className="threat-dot" />
                    ⚠ Threat detected — Explicit
                  </div>
                </div>
              </div>
            </Reveal>

            {/* ── Card 2: Pattern Detection (green) ── */}
            <Reveal delay={80}>
              <div className="bento-card bento-card-2">
                <div className="bento-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>

                <div>
                  <div className="bento-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>trending_up</span>
                    Behavioral
                  </div>
                  <div className="bento-title">Pattern Detection</div>
                  <p className="bento-desc">
                    Recognizes recurring toxic behavior across multiple conversations,
                    revealing escalating threats before they become crises.
                  </p>
                </div>

                {/* Floating bar chart mockup */}
                <div className="bento-mockup bento-mockup-2">
                  <div className="pattern-timeline">
                    <div className="pt-header">Behavior patterns</div>
                    <div className="pt-bar-row">
                      <span className="pt-bar-label">Coercion</span>
                      <div className="pt-bar-track">
                        <div className="pt-bar-fill pt-bar-fill-1" />
                      </div>
                    </div>
                    <div className="pt-bar-row">
                      <span className="pt-bar-label">Control</span>
                      <div className="pt-bar-track">
                        <div className="pt-bar-fill pt-bar-fill-2" />
                      </div>
                    </div>
                    <div className="pt-bar-row">
                      <span className="pt-bar-label">Isolation</span>
                      <div className="pt-bar-track">
                        <div className="pt-bar-fill pt-bar-fill-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* ── Card 3: Instant Risk Report (peach) ── */}
            <Reveal delay={160}>
              <div className="bento-card bento-card-3">
                <div className="bento-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>

                <div>
                  <div className="bento-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>bolt</span>
                    Instant
                  </div>
                  <div className="bento-title">Risk Report in &lt;30s</div>
                  <p className="bento-desc">
                    Get a full risk assessment — from Safe to Critical — with legal
                    insights and safety recommendations before you even blink.
                  </p>
                </div>

                {/* Floating risk UI mockup */}
                <div className="bento-mockup bento-mockup-3">
                  <div className="risk-report-mock">
                    <div className="risk-report-title">Risk Assessment</div>
                    <div className="risk-level-badge risk-medium">
                      ⚠ Moderate Risk
                    </div>
                    <div className="risk-score-row">
                      <span className="risk-score-label">Threat score</span>
                      <span className="risk-score-val">6.4 / 10</span>
                    </div>
                    <div className="risk-meter">
                      <div className="risk-meter-fill" />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* ── Card 4: Privacy & Ghost Mode (dark) ── */}
            <Reveal delay={240}>
              <div className="bento-card bento-card-4">
                <div className="bento-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>

                <div>
                  <div className="bento-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>lock</span>
                    Privacy-First
                  </div>
                  <div className="bento-title">Ghost Mode & Encryption</div>
                  <p className="bento-desc">
                    End-to-end encrypted analysis. Activate Ghost Mode and leave
                    absolutely zero trace — because your safety is your secret.
                  </p>
                </div>

                {/* Floating privacy pills */}
                <div className="bento-mockup bento-mockup-4">
                  <div className="privacy-badge-mock">
                    <div className="priv-pill">
                      <span className="priv-pill-dot" />
                      AES-256 Encrypted
                    </div>
                    <div className="priv-pill">
                      <span className="priv-pill-dot" />
                      Ghost Mode Active
                    </div>
                    <div className="priv-pill">
                      <span className="priv-pill-dot" />
                      Zero Data Retention
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          OUTCOMES / STATS SECTION (dark card)
          ══════════════════════════════════════ */}
      <section className="outcomes-section" id="outcomes">
        <div className="outcomes-card">
          {/* Ambient glow */}
          <div className="outcomes-card-glow">
            <div className="outcomes-card-glow-1" />
            <div className="outcomes-card-glow-2" />
            <div className="outcomes-card-glow-3" />
          </div>

          {/* Centered content wrapper — constrains to readable width while bg is full-bleed */}
          <div className="outcomes-inner">

            <Reveal>
              <div className="outcomes-header">
                <h2>
                  Changing lives through
                  <br />
                  proven outcomes
                </h2>
                <p>
                  Our AI-driven approach to digital safety has redefined what
                  personal protection looks like in the modern world.
                </p>
              </div>
            </Reveal>

            <div className="outcomes-body">
              <Reveal delay={0}>
                <div className="outcomes-stats">
                  <div>
                    <span className="outcomes-stat-label">Detection Accuracy</span>
                    <div className="outcomes-stat-number">98%</div>
                    <p className="outcomes-stat-desc">
                      Our AI correctly identifies threatening patterns with 98% accuracy
                      across all major threat categories — from subtle coercion to explicit danger.
                    </p>
                  </div>

                  <div>
                    <span className="outcomes-stat-label">Analysis Speed</span>
                    <div className="outcomes-stat-number">&lt;30s</div>
                    <p className="outcomes-stat-desc">
                      Every screenshot is fully analyzed in under 30 seconds. No waiting,
                      no appointments — protection exactly when you need it most.
                    </p>
                  </div>

                  <div style={{ paddingTop: "2rem" }}>
                    <Link href="/auth" className="outcomes-download-btn">
                      Start Your Free Analysis
                    </Link>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={150}>
                <div className="outcomes-chart-card">
                  <div className="chart-header">
                    <div>
                      <h4>Safety Index</h4>
                      <p>Protection Level vs. Time</p>
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: "#a2cbef" }} />
                        <span className="legend-label">Shield Her</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: "#757575" }} />
                        <span className="legend-label">Standard</span>
                      </div>
                    </div>
                  </div>

                  <div className="chart-area">
                    <svg
                      viewBox="0 0 400 250"
                      width="100%"
                      height="100%"
                      style={{ overflow: "visible" }}
                    >
                      {/* Grid lines */}
                      <line x1="0" y1="250" x2="400" y2="250" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <line x1="0" y1="187.5" x2="400" y2="187.5" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <line x1="0" y1="125" x2="400" y2="125" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <line x1="0" y1="62.5" x2="400" y2="62.5" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      {/* Standard / baseline */}
                      <path
                        d="M0,200 L100,190 L200,195 L300,185 L400,190"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="2"
                        strokeDasharray="4"
                      />
                      {/* Shield Her curve */}
                      <path
                        d="M0,200 C100,190 200,50 400,20"
                        fill="none"
                        stroke="#a2cbef"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      {/* Data points */}
                      <circle cx="400" cy="20" r="6" fill="white" />
                      <circle cx="0" cy="200" r="4" fill="white" opacity="0.5" />
                    </svg>

                    <div className="chart-peak-badge">Peak Safety Achieved</div>
                  </div>
                </div>
              </Reveal>
            </div>
            {/* /outcomes-inner */}
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          PRIVACY & SUPPORT SECTION — animated bg + scroll slider
          ══════════════════════════════════════ */}
      <section className="support-section" id="privacy">
        {/* Full-section animated background */}
        <ShieldSceneWrapper />

        {/* Content on top */}
        <div className="support-content">
          <Reveal>
            <div className="support-header">
              <div className="support-tag">Privacy & Security</div>
              <h2>Expert protection at<br />every corner.</h2>
              <p>
                Your data is fully encrypted and never shared. Use Ghost Mode to leave
                no trace. Our network and AI work around the clock so you never face
                a threatening situation alone.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <PrivacyFeatureScroller />
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA SECTION
          ══════════════════════════════════════ */}
      <section className="cta-section">
        <div className="cta-inner">
          <Reveal>
            <div className="footer-cta-card">
              <div className="footer-cta-aurora footer-cta-aurora-1" aria-hidden="true" />
              <div className="footer-cta-aurora footer-cta-aurora-2" aria-hidden="true" />
              <div className="footer-cta-aurora footer-cta-aurora-3" aria-hidden="true" />
              <div className="footer-cta-aurora footer-cta-aurora-4" aria-hidden="true" />

              <div className="footer-cta-content">
                <h2>Make every day feel safer.</h2>
                <p>
                  Take the next step with AI-powered threat analysis, private Ghost
                  Mode, and trusted support from Shield Her.
                </p>
                <Link href="/auth" className="footer-cta-btn">
                  Start Your Free Safety Check
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
          ══════════════════════════════════════ */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">Shield Her</div>
            <p className="footer-tagline">
              © {new Date().getFullYear()} Shield Her. Built for digital safety,
              privacy, and peace of mind.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-link-group">
              <h5>Legal</h5>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
            <div className="footer-link-group">
              <h5>Trust</h5>
              <a href="#">Security Report</a>
              <a href="#">Data Protection</a>
            </div>
            <div className="footer-link-group">
              <h5>Support</h5>
              <a href="#">Help Center</a>
              <a href="#">Contact Team</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
