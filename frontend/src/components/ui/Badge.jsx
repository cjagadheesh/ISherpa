import React from 'react';

// Shared pill badge — replaces the ~40+ hand-duplicated
// "icon + colored text/bg/border" spans scattered across the app with one
// consistent, always-999px-pill component.
const VARIANTS = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  danger:  'text-red-700 bg-red-50 border-red-200',
  neutral: 'text-gray-500 bg-gray-100 border-gray-200',
  accent:  'text-accent-700 bg-accent-50 border-accent-200',
  info:    'text-blue-700 bg-blue-50 border-blue-200',
  indigo:  'text-indigo-700 bg-indigo-50 border-indigo-200',
};

const SIZES = {
  sm: 'text-[10.5px] px-2.5 py-1 gap-1.5',
  xs: 'text-[9.5px] px-2 py-0.5 gap-1',
};

export default function Badge({
  variant = 'neutral',
  size = 'sm',
  icon: Icon,
  dot = false,
  pulse = false,
  onClick,
  title,
  className = '',
  children,
}) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'span';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center rounded-full border font-bold select-none shrink-0 ${VARIANTS[variant]} ${SIZES[size]} ${interactive ? 'cursor-pointer transition-colors hover:brightness-95' : ''} ${pulse ? 'animate-soft-pulse' : ''} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {Icon && <Icon className={size === 'xs' ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />}
      {children}
    </Tag>
  );
}
