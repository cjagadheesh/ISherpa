import React from 'react';

// Shared card shell — standardizes the "icon box + title + subtitle + actions"
// header pattern that DueDiligenceManager, RegulatoryAlertBanner, and the
// rebuilt admin pages each used to hand-roll separately.
export default function Card({
  icon: Icon,
  iconVariant = 'accent',
  title,
  subtitle,
  actions,
  padded = true,
  className = '',
  bodyClassName = '',
  children,
}) {
  const iconBoxClasses = {
    accent:  'bg-accent-50 border-accent-200 text-accent-600',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    neutral: 'bg-gray-100 border-gray-200 text-gray-500',
    danger:  'bg-red-50 border-red-200 text-red-600',
  }[iconVariant];

  const hasHeader = Icon || title || actions;

  return (
    <div className={`card ${className}`}>
      {hasHeader && (
        <div className={`flex items-center justify-between gap-4 flex-wrap ${padded ? 'px-6 pt-6 pb-4' : 'p-4'} ${children ? 'border-b border-gray-100' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBoxClasses}`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-card-title truncate">{title}</h3>}
              {subtitle && <p className="text-caption mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children && (
        <div className={`${padded ? 'px-6 py-6' : ''} ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
