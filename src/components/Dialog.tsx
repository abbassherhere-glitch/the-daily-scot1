import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible title, used as the dialog's accessible name */
  title: React.ReactNode;
  /** Render the title yourself (e.g. styled header). Receives the id to put on the heading. */
  renderHeader?: (titleId: string) => React.ReactNode;
  /** Outer overlay classes (positioning of the panel) */
  overlayClassName?: string;
  /** Panel classes */
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible modal dialog:
 * - role="dialog" + aria-modal + aria-labelledby (announced as a dialog with its title)
 * - moves focus into the dialog when it opens and returns it to the triggering control on close
 * - keeps Tab / Shift+Tab inside the dialog
 * - closes on Escape and on clicking the dark backdrop
 * - stops the page behind from scrolling
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  renderHeader,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60',
  className = '',
  children,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Focus the first focusable control, or the panel itself
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first || panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={overlayClassName}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`outline-none ${className}`}
      >
        {renderHeader ? (
          renderHeader(titleId)
        ) : (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
};
