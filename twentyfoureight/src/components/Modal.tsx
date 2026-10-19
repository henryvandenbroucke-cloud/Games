import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Use role="alertdialog" for confirmations. */
  alert?: boolean;
}

/**
 * Accessible modal built on native <dialog>: the browser provides the focus
 * trap, Escape handling, inert background and top-layer rendering.
 */
export function Modal({ open, onClose, title, description, children, alert = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault(); // let React state own open/closed
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
    >
      <div className="modal-card rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {description && (
          <div id={descId} className="mb-5 text-[0.95rem] leading-relaxed text-muted">
            {description}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} description={message} alert>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn btn-secondary" autoFocus>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
