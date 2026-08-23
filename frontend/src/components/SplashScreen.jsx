import React, { useState, useEffect } from 'react';

// Total splash timeline (ms):
//  0      → Logo + tagline animate in
//  700    → Loading bar starts filling (2s duration → fills at ~2700ms)
//  2700   → Bar is full → blockchain phase begins
//  2900   → Chain animation snaps in
//  4000   → Hold briefly
//  4200   → Fade out begins
//  4400   → onFinish fires, App takes over

const SPLASH_DURATION = 4400;
const FADE_START      = 4200;

export default function SplashScreen({ onFinish }) {
  const [phase, setPhase] = useState('enter');      // enter → blockchain → exit
  const [showChain, setShowChain] = useState(false);

  useEffect(() => {
    // After bar fills (~2700ms), reveal blockchain badge
    const chainTimer = setTimeout(() => setShowChain(true), 2700);
    // Begin fade-out
    const exitTimer  = setTimeout(() => setPhase('exit'), FADE_START);
    // Notify parent
    const doneTimer  = setTimeout(onFinish, SPLASH_DURATION);
    return () => {
      clearTimeout(chainTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d1f2d 0%, #1a3a4a 40%, #0d2b3e 100%)',
        transition: 'opacity 0.5s ease',
        opacity: phase === 'exit' ? 0 : 1,
        pointerEvents: phase === 'exit' ? 'none' : 'all',
      }}
    >
      {/* Radial glow behind logo */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(58,124,165,0.18) 0%, transparent 70%)',
        animation: 'splashGlow 2s ease-out forwards',
      }} />

      {/* Secondary glow that pulses when blockchain badge appears */}
      {showChain && (
        <div style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          animation: 'chainGlow 1.2s ease-out forwards',
        }} />
      )}

      {/* Main content column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        animation: 'splashRise 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        opacity: 0,
        transform: 'translateY(24px)',
      }}>

        {/* Logo */}
        <div style={{
          position: 'relative',
          filter: 'drop-shadow(0 8px 32px rgba(58,124,165,0.35))',
        }}>
          <img
            src="/logo.png"
            alt="IPO Sherpa"
            style={{
              width: 200,
              height: 'auto',
              borderRadius: 16,
              animation: 'splashLogoPulse 2s ease-in-out 0.5s infinite alternate',
            }}
          />
        </div>

        {/* Tagline */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            animation: 'splashFadeIn 0.5s ease 0.4s forwards',
            opacity: 0,
          }}>
            SEBI Chapter IX · SME IPO Workspace
          </p>
        </div>

        {/* Loading bar */}
        <div style={{
          width: 200,
          height: 3,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 999,
          overflow: 'hidden',
          animation: 'splashFadeIn 0.4s ease 0.6s forwards',
          opacity: 0,
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #3A7CA5, #55A3C6)',
            borderRadius: 999,
            animation: 'splashBar 2s cubic-bezier(0.4,0,0.2,1) 0.7s forwards',
            width: '0%',
          }} />
        </div>

        {/* Status text — swaps to blockchain text once chain appears */}
        <p style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 10.5,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
          letterSpacing: '0.05em',
          animation: 'splashFadeIn 0.4s ease 0.9s forwards',
          opacity: 0,
          transition: 'color 0.4s ease',
        }}>
          {showChain ? 'Blockchain integrity layer active…' : 'Initializing compliance workspace…'}
        </p>
      </div>

      {/* ── Blockchain continuation badge ──────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        opacity: showChain ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}>

        {/* Chain link animation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          animation: showChain ? 'chainSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
          opacity: 0,
          transform: 'translateY(10px)',
        }}>
          {/* Left chain segment */}
          <ChainLink />
          <ChainLink />
          <ChainLink />

          {/* Lock icon (center) */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 8px',
            boxShadow: '0 0 20px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)',
            animation: showChain ? 'lockSnap 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' : 'none',
            transform: 'scale(0)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="11" rx="2" fill="white" opacity="0.9"/>
              <path d="M8 11V7a4 4 0 018 0v4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
              <circle cx="12" cy="16" r="1.5" fill="#a855f7"/>
            </svg>
          </div>

          {/* Right chain segment */}
          <ChainLink />
          <ChainLink />
          <ChainLink />
        </div>

        {/* "Secured by Blockchain" text — letter-by-letter reveal */}
        {showChain && <BlockchainText />}

        {/* Polygon network pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.3)',
          animation: showChain ? 'splashFadeIn 0.5s ease 0.9s both' : 'none',
          opacity: 0,
        }}>
          {/* Polygon diamond */}
          <svg width="12" height="12" viewBox="0 0 38 38" fill="none">
            <polygon points="19,2 36,10 36,28 19,36 2,28 2,10" fill="#8247e5"/>
            <polygon points="19,8 30,14 30,24 19,30 8,24 8,14" fill="#a66ff5"/>
          </svg>
          <span style={{
            color: 'rgba(166,111,245,0.85)',
            fontSize: 9.5,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Polygon Amoy · Testnet
          </span>
          {/* Live pulse dot */}
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#3A7CA5',
            display: 'inline-block',
            animation: 'livePulse 1.2s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Keyframe injector */}
      <style>{`
        @keyframes splashRise {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeIn {
          to { opacity: 1; }
        }
        @keyframes splashBar {
          to { width: 100%; }
        }
        @keyframes splashGlow {
          0%   { transform: scale(0.4); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes chainGlow {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 1; }
        }
        @keyframes splashLogoPulse {
          from { filter: brightness(1);    }
          to   { filter: brightness(1.08); }
        }
        @keyframes chainSlideIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lockSnap {
          to { transform: scale(1); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes letterReveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chainLinkPop {
          0%   { transform: scaleX(0); opacity: 0; }
          60%  { transform: scaleX(1.1); }
          100% { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChainLink() {
  return (
    <div style={{
      width: 18,
      height: 10,
      borderRadius: 999,
      border: '2px solid rgba(139,92,246,0.6)',
      background: 'rgba(139,92,246,0.08)',
      animation: 'chainLinkPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
      transformOrigin: 'center',
    }} />
  );
}

const LABEL = 'Secured by Blockchain';

function BlockchainText() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
    }}>
      {LABEL.split('').map((char, i) => (
        <span
          key={i}
          style={{
            color: char === ' ' ? 'transparent' : 'rgba(255,255,255,0.82)',
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            letterSpacing: char === ' ' ? '0.15em' : '0.04em',
            width: char === ' ' ? 6 : 'auto',
            display: 'inline-block',
            animation: `letterReveal 0.25s ease ${0.05 + i * 0.035}s both`,
            opacity: 0,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
