'use client';

type Segment = { kind: string; label: string };

type OnboardingProgressProps = {
  segments: Segment[];
  activeIndex: number;
};

export function OnboardingProgress({ segments, activeIndex }: OnboardingProgressProps) {
  return (
    <div
      className="mt-6 flex gap-1"
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={segments.length}
    >
      {segments.map((s, i) => {
        const isActive = i <= activeIndex;
        return (
          <div
            key={`${s.kind}-${s.label}`}
            title={s.label}
            className={[
              'h-1 flex-1 rounded-full transition-colors duration-300 ease-out',
              isActive ? 'bg-yellow-400' : 'bg-slate-200 dark:bg-zinc-800',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}
