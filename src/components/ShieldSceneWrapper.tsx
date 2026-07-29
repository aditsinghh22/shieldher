"use client";

import dynamic from "next/dynamic";

const ShieldScene = dynamic(() => import("./ShieldScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "480px",
        background: "linear-gradient(170deg, #f2f7f1, #e7efe4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(41, 73, 50, 0.35)",
        fontSize: "0.8rem",
        fontFamily: "sans-serif",
        letterSpacing: "0.1em",
      }}
    >
      INITIALIZING...
    </div>
  ),
});

export default function ShieldSceneWrapper() {
  return <ShieldScene />;
}
