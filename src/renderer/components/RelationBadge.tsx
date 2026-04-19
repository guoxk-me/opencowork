import React from 'react';

interface RelationBadgeProps {
  label: string;
  value: string;
  tone?: 'default' | 'primary' | 'muted';
  onClick?: () => void;
}

export function RelationBadge({
  label,
  value,
  tone = 'default',
  onClick,
}: RelationBadgeProps) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : tone === 'muted'
        ? 'border-border bg-background text-text-muted'
        : 'border-border bg-surface text-text-secondary';

  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${toneClass}`}
    >
      <span className="uppercase tracking-wide opacity-70">{label}</span>
      <span className="max-w-[180px] truncate">{value}</span>
    </span>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button onClick={onClick} className="text-left hover:opacity-90">
      {content}
    </button>
  );
}

export default RelationBadge;
