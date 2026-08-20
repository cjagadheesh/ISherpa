import React from 'react';

// Compact, always-visible filing-progress rail — mounted once in the app
// shell's header (App.jsx) so it's on screen regardless of which tab is
// active, not just while inside the Wizard. The detailed per-section list
// with fill counts already lives in the sidebar, but that view collapses to
// icons-only and sits below the fold on a long section list; this is the
// single-glance summary that's never hidden. Segment colors reuse the same
// status language already established by the sidebar (getStatusDot/
// getStatusBorderClass in App.jsx) — complete/in_progress/error/empty —
// so this reads as part of the same system, not a bolted-on widget.
const SEGMENT_COLOR = {
  complete: 'bg-emerald-500',
  in_progress: 'bg-amber-400',
  error: 'bg-red-500',
  empty: 'bg-gray-200',
};

export default function JourneyProgress({ steps, activeTab, getStepStatus, onNavigate }) {
  const completed = steps.filter((s) => getStepStatus(s.id) === 'complete').length;

  return (
    <div className="hidden md:flex items-center gap-2.5 min-w-0" title={`Filing progress: ${completed} of ${steps.length} sections complete`}>
      <span className="text-[10.5px] font-bold text-gray-400 whitespace-nowrap shrink-0">
        {completed}/{steps.length} sections
      </span>
      <div className="flex items-center gap-[3px] shrink-0">
        {steps.map((step) => {
          const status = getStepStatus(step.id);
          const isActive = activeTab === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigate(step.id)}
              title={`${step.label} — ${status.replace('_', ' ')}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${SEGMENT_COLOR[status]} ${
                isActive ? 'w-5 ring-2 ring-offset-1 ring-accent-300' : 'w-2.5 hover:opacity-70'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
