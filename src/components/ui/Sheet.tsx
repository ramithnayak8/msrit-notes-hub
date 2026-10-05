'use client';

import { useEffect, useRef } from 'react';

/**
 * Modal built on the native <dialog>: focus trapping, Escape, inert
 * background and focus return come from the browser. Clicking the backdrop
 * closes it.
 */
export function Sheet({
  open,
  onClose,
  label,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && <div className="sheet-body">{children}</div>}
    </dialog>
  );
}
