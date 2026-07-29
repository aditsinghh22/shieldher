'use client';

import dynamic from 'next/dynamic';

const SafetyMap = dynamic(() => import('@/components/SafetyMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(212, 175, 55, 0.15)',
          borderTopColor: '#d4af37',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.5)',
          letterSpacing: '0.02em',
        }}
      >
        Loading Safety Map…
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function MapPage() {
  return <SafetyMap />;
}
