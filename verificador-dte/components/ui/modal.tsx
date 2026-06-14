import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  disableClose = false,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  disableClose?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  function handleBackdropClick() {
    if (!disableClose) onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-black/40 p-4 sm:items-center"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={cn(
          "relative my-auto w-full min-w-0 max-w-md rounded-xl bg-background p-4 shadow-xl sm:p-6",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute top-2 right-2 text-xl font-bold text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={onClose}
          disabled={disableClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
