import React, { useEffect, useRef, useState } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ── SVG Arc Constants ────────────────────────────────────────────────────────
const R = 80;              // arc radius
const CX = 110;            // SVG center-x
const CY = 115;            // SVG center-y (pushed down so top milestone label fits)
const CIRCUMFERENCE = 2 * Math.PI * R;   // ≈ 502.65
const ARC_DEG = 240;       // arc sweep in degrees (horseshoe shape)
const ARC_LENGTH = CIRCUMFERENCE * (ARC_DEG / 360);  // ≈ 335.1
const START_ANGLE = 150;   // degrees from positive x-axis (SVG clockwise)

function degToRad(d) { return (d * Math.PI) / 180; }

function polarToXY(cx, cy, r, angleDeg) {
  const rad = degToRad(angleDeg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function scoreToAngle(score) {
  return START_ANGLE + (score / 100) * ARC_DEG;
}

// ── Scoring helpers ──────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 80) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreGlow(s) {
  if (s >= 80) return 'rgba(16,185,129,0.18)';
  if (s >= 50) return 'rgba(245,158,11,0.15)';
  return 'rgba(239,68,68,0.15)';
}

function scoreLabel(s) {
  if (s >= 90) return 'IPO‑Ready';
  if (s >= 80) return 'Filing Ready';
  if (s >= 60) return 'Good Progress';
  if (s >= 40) return 'In Progress';
  if (s >= 20) return 'Early Stage';
  return 'Not Started';
}

function zoneStyle(s) {
  if (s >= 80) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'READY' };
  if (s >= 50) return { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   label: 'CAUTION' };
  return           { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     label: 'INCOMPLETE' };
}

// Milestone ticks rendered on the arc
const MILESTONES = [
  { score: 0   },
  { score: 30,  label: '30',  color: '#ef4444' },
  { score: 50,  label: '50',  color: '#f59e0b' },
  { score: 80,  label: '80',  color: '#10b981' },
  { score: 100 },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function ComplianceScoreMeter({ validationResults }) {
  const {
    filing_readiness        = 0,
    overall_completeness    = 0,
    status_counts           = { complete: 0, incomplete: 0, inconsistent: 0 },
    sections                = [],
    inconsistencies         = [],
    completed_fields        = 0,
    total_fields            = 0,
    has_blocking_flags      = false,
  } = validationResults || {};

  const score = filing_readiness;

  // ── Count-up animation ───────────────────────────────────────────────────
  const [displayScore, setDisplayScore] = useState(0);
  const [arcReady, setArcReady]         = useState(false);   // delays arc fill 1 frame so CSS transition fires
  const prevScore = useRef(0);
  const animRef   = useRef(null);

  // Trigger arc transition on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setArcReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Count-up whenever score changes
  useEffect(() => {
    if (!arcReady) return;
    const from = prevScore.current;
    const to   = score;
    prevScore.current = to;

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const duration = 1100;
    const t0 = performance.now();

    function tick(now) {
      const pct    = Math.min((now - t0) / duration, 1);
      const eased  = 1 - Math.pow(1 - pct, 3);           // cubic ease-out
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (pct < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score, arcReady]);

  // ── Derived values ───────────────────────────────────────────────────────
  const color   = scoreColor(score);
  const glow    = scoreGlow(score);
  const zone    = zoneStyle(score);

  // Arc dashoffset: ARC_LENGTH → 0 as score goes 0 → 100
  const dashOffset = ARC_LENGTH * (1 - (arcReady ? score : 0) / 100);

  // Sub-score rows
  const subScores = [
    {
      label: 'Filing Readiness',
      value: `${filing_readiness}%`,
      pct: filing_readiness,
      color,
      Icon: Shield,
    },
    {
      label: 'Form Completeness',
      value: `${overall_completeness}%`,
      pct: overall_completeness,
      color: '#6366f1',
      Icon: TrendingUp,
    },
    {
      label: 'Chapters Verified',
      value: `${status_counts.complete} / ${sections.length || 14}`,
      pct: sections.length ? Math.round((status_counts.complete / sections.length) * 100) : 0,
      color: '#3A7CA5',
      Icon: CheckCircle2,
    },
    {
      label: 'Active Conflicts',
      value: `${inconsistencies.length} flagged`,
      pct: inconsistencies.length === 0 ? 100 : Math.max(0, 100 - inconsistencies.length * 12),
      color: inconsistencies.length === 0 ? '#10b981' : '#ef4444',
      Icon: AlertTriangle,
    },
  ];

  return (
    <div className="card rounded-2xl overflow-hidden relative">

      {/* Ambient zone glow behind the whole card */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{ background: `radial-gradient(ellipse 70% 60% at 25% 50%, ${glow} 0%, transparent 75%)` }}
      />

      <div className="relative flex flex-col lg:flex-row">

        {/* ════ Left column: SVG arc meter ══════════════════════════════════ */}
        <div className="flex flex-col items-center justify-center px-6 pt-6 pb-4 lg:py-8 lg:px-8 shrink-0">

          {/* Header label */}
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400 mb-4 flex items-center gap-2 select-none">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
            ICDR Compliance Score
            <span className="ml-1 text-[9px] bg-gray-100 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full font-mono">LIVE</span>
          </p>

          {/* SVG arc */}
          <div style={{ width: 220, height: 172 }}>
            <svg width="220" height="172" viewBox="0 0 220 172" aria-label={`Compliance score: ${score} out of 100`}>
              <defs>
                {/* Subtle drop-shadow filter for the filled arc */}
                <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* ── Background track (240° arc, light gray) ── */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="13"
                strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE - ARC_LENGTH}`}
                transform={`rotate(${START_ANGLE} ${CX} ${CY})`}
                strokeLinecap="round"
              />

              {/* ── Coloured filled arc ── */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={color}
                strokeWidth="13"
                strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE - ARC_LENGTH}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(${START_ANGLE} ${CX} ${CY})`}
                strokeLinecap="round"
                filter="url(#arc-glow)"
                style={{
                  transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.7s ease',
                }}
              />

              {/* ── Milestone tick marks ── */}
              {MILESTONES.map((m) => {
                const angleDeg = scoreToAngle(m.score);
                const inner    = polarToXY(CX, CY, R - 8,  angleDeg);
                const outer    = polarToXY(CX, CY, R + 8,  angleDeg);
                const lblPt    = polarToXY(CX, CY, R + 22, angleDeg);
                const reached  = arcReady && score >= m.score;
                const tickColor = reached && m.score > 0 ? (m.color || color) : '#cbd5e1';

                return (
                  <g key={m.score}>
                    <line
                      x1={inner.x} y1={inner.y}
                      x2={outer.x} y2={outer.y}
                      stroke={tickColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{ transition: 'stroke 0.7s ease' }}
                    />
                    {m.label && (
                      <text
                        x={lblPt.x} y={lblPt.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                        fill={reached ? (m.color || color) : '#94a3b8'}
                        style={{ transition: 'fill 0.7s ease' }}
                      >
                        {m.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Center: big score number ── */}
              <text
                x={CX} y={CY - 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="40"
                fontWeight="800"
                fontFamily="Outfit, sans-serif"
                fill={color}
                style={{ transition: 'fill 0.7s ease' }}
              >
                {displayScore}
              </text>

              {/* "/ 100" */}
              <text
                x={CX} y={CY + 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="500"
                fontFamily="Inter, sans-serif"
                fill="#94a3b8"
              >
                / 100
              </text>

              {/* Score label text */}
              <text
                x={CX} y={CY + 35}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="700"
                fontFamily="Inter, sans-serif"
                letterSpacing="0.08em"
                fill={color}
                style={{ transition: 'fill 0.7s ease' }}
              >
                {scoreLabel(score).toUpperCase()}
              </text>
            </svg>
          </div>

          {/* Zone badge */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10.5px] font-bold select-none ${zone.bg} ${zone.border} ${zone.text}`}>
            {score >= 80
              ? <CheckCircle2 className="w-3 h-3" />
              : <AlertTriangle className="w-3 h-3" />
            }
            <span>{zone.label}</span>
            {has_blocking_flags && (
              <span className="opacity-60 font-semibold text-[9.5px]">· blocking flags</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-gray-100 hidden lg:block" />
        <div className="h-px w-full bg-gray-100 block lg:hidden" />

        {/* ════ Right column: Score Breakdown ═══════════════════════════════ */}
        <div className="flex-1 min-w-0 px-6 lg:px-8 py-6 lg:py-8 flex flex-col">

          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 select-none">
              Score Breakdown
            </p>
            <span className="text-[10px] font-mono font-bold text-gray-300 select-none">
              {completed_fields} / {total_fields} fields
            </span>
          </div>

          {/* Sub-score bars */}
          <div className="space-y-4 flex-1">
            {subScores.map((s, i) => (
              <div
                key={s.label}
                className="space-y-1.5 animate-fade-in-up"
                style={{ animationDelay: `${i * 110 + 100}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <s.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: s.color }} />
                    <span className="text-[12px] font-semibold text-gray-600 select-none">{s.label}</span>
                  </div>
                  <span
                    className="text-[12px] font-bold font-mono tabular-nums"
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </span>
                </div>
                {/* Bar track */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full score-bar"
                    style={{
                      width: `${Math.min(s.pct, 100)}%`,
                      background: s.color,
                      animationDelay: `${i * 110 + 250}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Milestone legend + chapter count pill */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap">
            {[
              { threshold: 30, label: 'Flag zone',    color: '#ef4444' },
              { threshold: 50, label: 'Caution zone', color: '#f59e0b' },
              { threshold: 80, label: 'Filing ready', color: '#10b981' },
            ].map((m) => (
              <div key={m.threshold} className="flex items-center gap-1.5 select-none">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="text-[10.5px] font-semibold text-gray-400">
                  {m.threshold}+ {m.label}
                </span>
              </div>
            ))}

            {/* Chapter summary pill */}
            <div className={`ml-auto flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-xl border select-none ${zone.bg} ${zone.border} ${zone.text}`}>
              <span className="text-emerald-600">{status_counts.complete}✓</span>
              <span className="text-gray-300">·</span>
              <span className="text-amber-500">{status_counts.incomplete} pending</span>
              {status_counts.inconsistent > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-red-500">{status_counts.inconsistent} conflict{status_counts.inconsistent !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
