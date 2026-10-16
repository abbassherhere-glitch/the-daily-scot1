import React, { useEffect, useRef, useState } from 'react';
import { Mail, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
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
    <div className={`bg-[#0B2545] text-white p-5 rounded border border-[#07172B] shadow-sm relative overflow-hidden ${className}`}>
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#005EB8]/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1.5">
        <Mail className="w-4 h-4" />
        <span>Direct to Your Inbox</span>
      </div>

      <h3 className="font-headline text-xl font-bold tracking-tight text-white mb-1.5">
        The Glasgow Morning Briefing
      </h3>

      <p className="text-xs text-neutral-300 leading-relaxed mb-4">
        Wake up with the West of Scotland’s essential news: city politics, Clydeside transport updates, culture picks, and morning weather delivered every weekday at 7:00 AM.
      </p>

      {done ? (
        <div className="bg-emerald-900/60 border border-emerald-500/40 p-3 rounded text-center text-xs text-emerald-200 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Almost done! Check your inbox and click the link to confirm your subscription.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              required
              aria-label="Email address"
              className="w-full bg-white text-neutral-900 placeholder-neutral-400 text-xs px-3 py-2.5 rounded focus:outline-hidden focus:ring-2 focus:ring-[#005EB8] border border-neutral-300"
            />
          </div>
          {TURNSTILE_SITE_KEY && <div ref={widgetRef} className="min-h-[65px]" />}
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-200 bg-red-900/40 border border-red-500/40 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#005EB8] hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-xs py-2.5 px-4 rounded transition flex items-center justify-center gap-2 shadow-xs"
          >
            <span>{submitting ? 'Subscribing…' : 'Subscribe Free'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="text-[10px] text-neutral-400 text-center">
            Zero spam. Every email includes a one-click unsubscribe link.
          </div>
        </form>
      )}
    </div>
  );
};
