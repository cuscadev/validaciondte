'use client';

type Props = {
  show: boolean;
  title?: string;
  subtitle?: string;
};

export default function LoadingOverlay({
  show,
  title = 'Procesando tus archivos…',
  subtitle = 'Esto puede tardar unos segundos. No cierres esta ventana.',
}: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center 
                    bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl shadow-2xl
                      bg-white/90 dark:bg-zinc-900/90 border
                      border-zinc-200/70 dark:border-zinc-800/70 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {/* Spinner con halo */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md 
                            bg-blue-500/30 dark:bg-blue-400/20 animate-pulse" />
            <div className="h-12 w-12 rounded-full border-4 
                            border-blue-600/30 dark:border-blue-400/30 
                            border-t-blue-600 dark:border-t-blue-400 
                            animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
        </div>

        {/* Barra indeterminada */}
        <div className="mt-6 h-2 w-full rounded-full overflow-hidden>
                        bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full w-1/2 rounded-full shimmer 
                          bg-white/70 dark:bg-white/20" />
        </div>

        {/* Tips / Detalle */}
        <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Sugerencia: puedes seguir trabajando en otra pestaña mientras termina.
        </div>
      </div>
    </div>
  );
}
