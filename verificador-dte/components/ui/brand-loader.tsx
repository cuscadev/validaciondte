import { cn } from '@/lib/utils';

type BrandLoaderProps = {
  size?: 'sm' | 'lg';
  label?: string;
  tone?: 'default' | 'onPrimary';
  className?: string;
};

const sizeClasses = {
  sm: 'size-4 border-2',
  lg: 'size-12 border-[3px]',
} as const;

const toneClasses = {
  default:
    'border-amber-500/25 border-t-amber-500 dark:border-yellow-400/25 dark:border-t-yellow-400 motion-reduce:border-t-amber-500',
  onPrimary:
    'border-black/20 border-t-black dark:border-black/30 dark:border-t-black motion-reduce:border-t-black',
} as const;

export function BrandLoader({
  size = 'lg',
  label,
  tone = 'default',
  className,
}: BrandLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Cargando'}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <span
        className={cn(
          'brand-loader-ring rounded-full',
          'motion-reduce:animate-none',
          toneClasses[tone],
          sizeClasses[size]
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
