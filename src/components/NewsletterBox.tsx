import React, { useState } from 'react';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { submitNewsletter } from '../services/api';

export const NewsletterBox: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubmitting(true);
    try {
      await submitNewsletter(email);
      setSubscribed(true);
    } catch {
      setSubscribed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`bg-[#0B2545] text-white p-5 rounded border border-[#07172B] shadow-sm relative overflow-hidden ${className}`}>
      {/* Subtle Scottish saltire graphic decoration */}
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

      {subscribed ? (
        <div className="bg-emerald-900/60 border border-emerald-500/40 p-3 rounded text-center text-xs text-emerald-200 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Fàilte! You’re subscribed. Check your inbox tomorrow morning.</span>
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
              className="w-full bg-white text-neutral-900 placeholder-neutral-400 text-xs px-3 py-2.5 rounded focus:outline-hidden focus:ring-2 focus:ring-[#005EB8] border border-neutral-300"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#005EB8] hover:bg-blue-600 text-white font-bold text-xs py-2.5 px-4 rounded transition flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Subscribe Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="text-[10px] text-neutral-400 text-center">
            Zero spam. Unsubscribe anytime in one click. Regulated by IPSO.
          </div>
        </form>
      )}
    </div>
  );
};
