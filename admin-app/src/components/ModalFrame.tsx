import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalFrameProps {
  onClose: () => void;
  /** id of the element that names the dialog (its heading) */
  labelledBy: string;
  className: string;
  children: React.ReactNode;
}

/**
 * Accessible modal wrapper for the newsroom:
 * role="dialog" + aria-modal + aria-labelledby, focus moves in on open and back to the
 * triggering button on close, Tab is kept inside, Escape closes.
 */
export const ModalFrame: React.FC<ModalFrameProps> = ({ onClose, labelledBy, className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    (first || root)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts (e.g. history opened over the editor)
      const dialogs = document.querySelectorAll('[data-modal-frame]');
      if (dialogs[dialogs.length - 1] !== root) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === root)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-modal-frame=""
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={`${className} outline-none`}
    >
      {children}
    </div>
  );
};
