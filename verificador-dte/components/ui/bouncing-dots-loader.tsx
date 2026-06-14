import { cn } from '@/lib/utils';

type BouncingDotsLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
};

const dotSizeClasses = {
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
} as const;

const gapClasses = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2',
} as const;

export function BouncingDotsLoader({
  size = 'md',
  label,
  className,
}: BouncingDotsLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Cargando'}
      className={cn('inline-flex items-center justify-center', gapClasses[size], className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'bouncing-dot rounded-full bg-primary',
            dotSizeClasses[size]
          )}
        />
      ))}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
