import React, { useEffect, useRef, useState } from 'react';

/** Stories shorter than this many screens do not get a progress bar */
const MIN_SCREENS = 2.5;

/**
 * Thin yellow bar across the top of the screen showing how far through a long story the reader is.
 * Decorative (hidden from screen readers). It tracks the scroll position directly rather than animating,
 * so it is the same for readers who have asked for reduced motion.
 */
export const ReadingProgress: React.FC<{ targetRef: React.RefObject<HTMLElement | null> }> = ({ targetRef }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const distance = rect.height - viewport;
      const long = rect.height > viewport * MIN_SCREENS;
      setShow(long);
      if (!long || !barRef.current) return;
      const done = Math.min(1, Math.max(0, -rect.top / distance));
      barRef.current.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targetRef]);

  return (
    <div className={`fixed top-0 inset-x-0 z-50 h-1 pointer-events-none no-print ${show ? '' : 'hidden'}`} aria-hidden="true">
      <div ref={barRef} className="h-full bg-brand origin-left" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
};
