"use client";

import { useEffect, useRef, useState } from "react";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // When the video approaches its end, trigger the fade overlay
    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      // Start fade 1.4s before end
      if (timeLeft <= 1.4 && !fading) {
        setFading(true);
      }
    };

    // When video loops/ends, remove the fade
    const handleSeeked = () => {
      if (video.currentTime < 1) {
        setFading(false);
      }
    };

    const handleEnded = () => {
      // The video should loop automatically; this is a safety net
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    const handleLoop = () => {
      // On each play event after seeking back to 0, clear fade
      if (video.currentTime < 0.5) {
        setFading(false);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("playing", handleLoop);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("playing", handleLoop);
    };
  }, [fading]);

  return (
    <div className="hero-video-bg">
      {/* Subtle fade overlay for loop transition */}
      <div className={`video-fade-overlay${fading ? " fading" : ""}`} />

      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/stock video.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
