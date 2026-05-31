import * as React from "react";

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
  if (!open) return null;

  function handleBackdropClick() {
    if (!disableClose) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={cn(
          "relative max-w-full min-w-[320px] rounded-xl bg-background p-6 shadow-xl",
          className
        )}
        onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}
