'use client';

interface ProgressBarProps {
  /** Progress percentage 0–100 */
  value: number;
  /** Height in Tailwind units, e.g. "h-2", "h-3" */
  height?: string;
  /** Color class for the fill bar, e.g. "bg-green-500" */
  color?: string;
  /** Whether to auto-color based on threshold (green < 75, yellow < 90, red >= 90) */
  autoColor?: boolean;
  /** Show percentage label */
  showLabel?: boolean;
  className?: string;
}

function getAutoColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function ProgressBar({
  value,
  height = 'h-2',
  color,
  autoColor = false,
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const fillColor = autoColor ? getAutoColor(clamped) : color || 'bg-brand-navy';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${fillColor} ${height} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-500 w-10 text-right">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
