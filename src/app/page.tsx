import Navbar from "@/components/Navbar";
import Image from "next/image";
import HeroSection from "@/components/HeroSection";
import FeatureCard from "@/components/FeatureCard";
import ScrollReveal from "@/components/ScrollReveal";
import {
  Shield,
  Brain,
  Eye,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle,
  Scale,
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

const features = [
  {
    icon: <Brain size={24} />,
    title: "AI-Powered Analysis",
    description:
      "Advanced AI examines your chat screenshots for manipulation tactics, gaslighting, coercion, and threatening language patterns.",
  },
  {
    icon: <Eye size={24} />,
    title: "Pattern Detection",
    description:
      "Identifies recurring toxic behavior patterns across multiple conversations to reveal escalating threats over time.",
  },
  {
    icon: <Shield size={24} />,
    title: "Risk Assessment",
    description:
      "Each analysis provides a clear risk level from Safe to Critical, helping you understand the severity of the situation.",
  },
  {
    icon: <Zap size={24} />,
    title: "Instant Results",
    description:
      "Get detailed analysis results in under 30 seconds. No waiting, no appointments — protection at your fingertips.",
  },
  {
    icon: <Lock size={24} />,
    title: "Complete Privacy & Ghost Mode",
    description:
      "Your uploads are encrypted and never shared. Use Ghost Mode to leave no trace. Only you can access your analysis history and results.",
  },
  {
    icon: <Scale size={24} />,
    title: "Legal Insights",
    description:
      "Get preliminary legal analysis highlighting potential violations, giving you a starting point for professional legal consultation.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload Screenshot",
    description:
      "Take a screenshot of any chat conversation and upload it to ShieldHer. We accept all major image formats.",
  },
  {
    number: "02",
    title: "AI Analyzes",
    description:
      "Our AI reads and analyzes the conversation for harmful patterns, red flags, and potential legal violations.",
  },
  {
    number: "03",
    title: "Get Results",
    description:
      "Receive a detailed risk assessment with specific flags, legal insights, and safety recommendations.",
  },
];

const testimonials = [
  {
    quote:
      "ShieldHer gave me the clarity I needed. It identified manipulation patterns I couldn't see myself.",
    name: "Sarah M.",
    role: "Early User",
    initial: "S",
  },
  {
    quote:
      "The legal analysis feature was a game-changer. It helped my lawyer understand the situation immediately.",
    name: "Priya K.",
    role: "Advocate",
    initial: "P",
  },
  {
    quote:
      "Finally a tool that takes digital safety seriously. The AI is incredibly accurate at detecting subtle threats.",
    name: "Aisha R.",
    role: "Counselor",
    initial: "A",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero — Gradient mesh like Stripe */}
        <HeroSection />

        {/* Dark Stats Banner — like Stripe's "backbone of global commerce" */}
        <section className={styles.statsBanner}>
          <div className={styles.statsBannerGlow} />
          <div className={`container ${styles.statsBannerInner}`}>
            <ScrollReveal>
              <h2 className={styles.statsBannerTitle}>
                The backbone of
                <br />
                digital safety
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className={styles.statsBannerGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>10K+</span>
                  <span className={styles.statName}>
                    screenshots analyzed with AI-powered insights
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>98%</span>
                  <span className={styles.statName}>
                    detection accuracy across threat categories
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>&lt;30s</span>
                  <span className={styles.statName}>
                    average analysis time per screenshot
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>24/7</span>
                  <span className={styles.statName}>
                    always available when you need it most
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Features */}
        <section className={styles.features} id="features">
          <div className="container">
            <ScrollReveal>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>Features</span>
                <h2 className={styles.sectionTitle}>
                  Everything you need to{" "}
                  <span className="gradient-text">stay safe</span>
                </h2>
                <p className={styles.sectionSubtitle}>
                  Powerful AI tools designed specifically for detecting and
                  analyzing harmful communication patterns.
                </p>
              </div>
            </ScrollReveal>
            <div className={styles.featureGrid}>
              {features.map((feature, i) => (
                <ScrollReveal key={i} delay={i * 80} className={styles.featureReveal}>
                  <FeatureCard {...feature} index={i} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className={styles.howItWorks} id="how-it-works">
          <div className="container">
            <ScrollReveal>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>How It Works</span>
                <h2 className={styles.sectionTitle}>
                  Simple. Fast.{" "}
                  <span className="gradient-text">Effective.</span>
                </h2>
              </div>
            </ScrollReveal>
            <div className={styles.steps}>
              {steps.map((step, i) => (
                <ScrollReveal key={i} delay={i * 120} className={styles.featureReveal}>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>{step.number}</div>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepDesc}>{step.description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / Testimonials */}
        <section className={styles.trust}>
          <div className="container">
            <ScrollReveal>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>Trusted</span>
                <h2 className={styles.sectionTitle}>
                  Real people.{" "}
                  <span className="gradient-text">Real protection.</span>
                </h2>
                <p className={styles.sectionSubtitle}>
                  Hear from people whose lives have been positively impacted by
                  ShieldHer.
                </p>
              </div>
            </ScrollReveal>
            <div className={styles.trustGrid}>
              {testimonials.map((t, i) => (
                <ScrollReveal key={i} delay={i * 100} className={styles.featureReveal}>
                  <div className={styles.trustCard}>
                    <p className={styles.trustQuote}>&ldquo;{t.quote}&rdquo;</p>
                    <div className={styles.trustAuthor}>
                      <div className={styles.trustAvatar}>{t.initial}</div>
                      <div>
                        <div className={styles.trustName}>{t.name}</div>
                        <div className={styles.trustRole}>{t.role}</div>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — Gradient like Stripe */}
        <section className={styles.cta}>
          <div className="container">
            <ScrollReveal direction="scale">
              <div className={styles.ctaCard}>
                <div className={styles.ctaContent}>
                  <h2 className={styles.ctaTitle}>Your safety matters</h2>
                  <p className={styles.ctaSubtitle}>
                    Start analyzing your conversations today. It takes less than
                    a minute to sign up and get your first analysis.
                  </p>
                  <div className={styles.ctaChecks}>
                    <div className={styles.ctaCheck}>
                      <CheckCircle size={16} />
                      <span>100% Free to start</span>
                    </div>
                    <div className={styles.ctaCheck}>
                      <CheckCircle size={16} />
                      <span>No credit card required</span>
                    </div>
                    <div className={styles.ctaCheck}>
                      <CheckCircle size={16} />
                      <span>Fully encrypted & private</span>
                    </div>
                  </div>
                  <Link href="/auth" className={styles.ctaBtnPrimary}>
                    Get Started Free
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className="container">
            <div className={styles.footerInner}>
              <Link href="/" className={styles.footerLogo} style={{textDecoration: 'none'}}>
                <Image src="/logo.png.jpeg" alt="ShieldHer Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
                <span>ShieldHer</span>
              </Link>
              <p className={styles.footerText}>
                © {new Date().getFullYear()} ShieldHer. Built with care for
                women&apos;s safety.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
