import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import { BlockLabel } from './BlockLabel';
import { submitNewsletter } from '../services/api';

// Cloudflare Turnstile site key (public). Set VITE_TURNSTILE_SITE_KEY in the Pages build environment.
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
    if (!existing) {
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export const NewsletterBox: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || done) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !widgetRef.current || !window.turnstile || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      })
      .catch(() => setError('Spam protection failed to load. Please refresh and try again.'));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) return;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the verification check.');
      return;
    }
    setSubmitting(true);
    try {
      await submitNewsletter(email, turnstileToken || undefined);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Subscription failed. Please try again.');
      // Tokens are single-use; get a fresh one for the next attempt.
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`on-dark bg-brand-ink text-white p-5 ${className}`}>
      <p className="mb-3">
        <BlockLabel>Free every weekday</BlockLabel>
      </p>

      <h3 className="font-headline text-2xl font-extrabold text-white mb-2">The Glasgow Morning Briefing</h3>

      <p className="text-sm text-neutral-200 leading-relaxed mb-4">
        Wake up with the West of Scotland’s essential news: city politics, Clydeside transport updates, culture picks, and morning weather delivered every weekday at 7:00 AM.
      </p>

      {done ? (
        <div className="border-2 border-brand p-3 text-sm text-white flex items-start gap-2" role="status">
          <CheckCircle2 className="w-5 h-5 text-brand shrink-0" aria-hidden="true" />
          <span>Almost done! Check your inbox and click the link to confirm your subscription.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            autoComplete="email"
            aria-label="Email address"
            className="w-full h-11 bg-white text-brand-ink placeholder-neutral-500 text-base px-3 border-2 border-white"
          />
          {TURNSTILE_SITE_KEY && <div ref={widgetRef} className="min-h-[65px]" />}
          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-white bg-alert p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-brand hover:bg-white disabled:opacity-60 text-brand-ink font-extrabold text-sm px-4 flex items-center justify-center gap-2"
          >
            <span>{submitting ? 'Subscribing…' : 'Subscribe free'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <p className="text-xs text-neutral-300">Zero spam. Every email includes a one-click unsubscribe link.</p>
        </form>
      )}
    </div>
  );
};
