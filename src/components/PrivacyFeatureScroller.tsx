"use client";

import { useEffect, useRef } from "react";

type PrivacySlide = {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  toneClass: string;
  pills: string[];
};

const privacySlides: PrivacySlide[] = [
  {
    eyebrow: "Encryption",
    title: "End-to-End Encrypted",
    description:
      "Every screenshot and conversation is encrypted with AES-256 before analysis. Nobody but you can access raw data.",
    icon: "encrypted",
    toneClass: "tone-mint",
    pills: ["AES-256", "Client-side sealed", "Zero raw exposure"],
  },
  {
    eyebrow: "Privacy",
    title: "Ghost Mode",
    description:
      "Activate Ghost Mode to remove traces automatically so sensitive evidence never lingers on your device.",
    icon: "visibility_off",
    toneClass: "tone-sage",
    pills: ["24h auto-delete", "One tap on", "Forensic-safe"],
  },
  {
    eyebrow: "Monitoring",
    title: "24/7 AI Monitoring",
    description:
      "Our AI scans patterns in real time and escalates high-risk scenarios instantly so you never face threats alone.",
    icon: "shield",
    toneClass: "tone-ice",
    pills: ["Continuous scan", "Instant escalation", "Live risk score"],
  },
  {
    eyebrow: "Response",
    title: "Rapid Safety Routing",
    description:
      "The app can route you to safer paths and trusted contacts with contextual alerts when risk rises nearby.",
    icon: "route",
    toneClass: "tone-sand",
    pills: ["Safer route map", "Local risk radar", "Emergency share"],
  },
  {
    eyebrow: "Support",
    title: "Trusted Human Backup",
    description:
      "Escalate from AI to trained support when you need immediate help, documentation guidance, or response coordination.",
    icon: "support_agent",
    toneClass: "tone-cloud",
    pills: ["Human-in-the-loop", "Guided next steps", "Always available"],
  },
];

export default function PrivacyFeatureScroller() {
  const shellRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const track = trackRef.current;
    if (!shell || !track) return;

    let currentShift = 0;
    let targetShift = 0;
    let rafId = 0;
    let animating = false;

    const clamp = (value: number, min: number, max: number) => {
      if (value < min) return min;
      if (value > max) return max;
      return value;
    };

    const animate = () => {
      const activeTrack = trackRef.current;
      if (!activeTrack) return;

      currentShift += (targetShift - currentShift) * 0.12;
      if (Math.abs(targetShift - currentShift) < 0.2) {
        currentShift = targetShift;
      }

      activeTrack.style.transform = `translate3d(${currentShift}px, 0, 0)`;

      if (Math.abs(targetShift - currentShift) >= 0.2) {
        rafId = window.requestAnimationFrame(animate);
      } else {
        animating = false;
      }
    };

    const updateTarget = () => {
      const activeShell = shellRef.current;
      const activeTrack = trackRef.current;
      if (!activeShell || !activeTrack) return;

      const rect = activeShell.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const maxShift = Math.max(0, activeTrack.scrollWidth - activeShell.clientWidth);

      const start = viewportHeight * 0.82;
      const end = -rect.height * 0.5;
      const progress = clamp((start - rect.top) / (start - end), 0, 1);

      targetShift = -progress * maxShift;

      if (!animating) {
        animating = true;
        rafId = window.requestAnimationFrame(animate);
      }
    };

    updateTarget();
    window.addEventListener("scroll", updateTarget, { passive: true });
    window.addEventListener("resize", updateTarget);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updateTarget);
      window.removeEventListener("resize", updateTarget);
    };
  }, []);

  return (
    <div ref={shellRef} className="support-slider-shell">
      <div className="support-slider-meta">
        <p className="support-slider-hint">Scroll down to slide cards</p>
      </div>

      <div className="support-slider-window" aria-label="Privacy and safety feature cards">
        <div ref={trackRef} className="support-slider-track">
          {privacySlides.map((slide) => (
            <article key={slide.title} className={`support-slide-card ${slide.toneClass}`}>
              <div>
                <p className="support-slide-eyebrow">{slide.eyebrow}</p>
                <h3>{slide.title}</h3>
                <p className="support-slide-desc">{slide.description}</p>
              </div>

              <div className="support-slide-visual">
                <div className="support-slide-icon">
                  <span className="material-symbols-outlined">{slide.icon}</span>
                </div>
                <div className="support-pill-list">
                  {slide.pills.map((pill) => (
                    <span key={`${slide.title}-${pill}`} className="support-pill">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
