import React, { useEffect, useId, useState } from 'react';
import { Plus, Edit3, Trash2, RefreshCw, CheckCircle, AlertTriangle, X, Save } from 'lucide-react';
import {
  CLOSURE_KINDS,
  CLOSURE_STATUSES,
  CLOSURES_PATH,
  ClosureKind,
  ClosureStatus,
  KIND_LABELS,
  LngLat,
  STATUS_LABELS,
  closureDatesText,
  parseLine,
} from '../../../src/config/closures';
import { ClosureMapEditor } from './ClosureMapEditor';

interface ClosureRow {
  id: string;
  name: string;
  area: string | null;
  kind: ClosureKind;
  status: ClosureStatus;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
  diversion: string | null;
  latitude: number | null;
  longitude: number | null;
  closure_geojson: string | null;
  diversion_geojson: string | null;
  article_id: string | null;
  story_title?: string | null;
  updated_at: string;
  last_updated_by?: string | null;
}

interface StoryOption {
  id: string;
  title: string;
  status: string;
}

interface FormState {
  id: string | null;
  name: string;
  area: string;
  kind: ClosureKind;
  status: ClosureStatus;
  startsAt: string;
  endsAt: string;
  reason: string;
  diversion: string;
  latitude: string;
  longitude: string;
  closedLine: LngLat[];
  diversionLine: LngLat[];
  articleId: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  area: '',
  kind: 'road',
  status: 'planned',
  startsAt: '',
  endsAt: '',
  reason: '',
  diversion: '',
  latitude: '',
  longitude: '',
  closedLine: [],
  diversionLine: [],
  articleId: '',
};

const toIso = (value?: string | null) =>
  value ? (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value) : null;

/** D1 UTC timestamp -> value for a datetime-local input (the editor's local time). */
function utcToLocalInput(value?: string | null): string {
  const iso = toIso(value);
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) -> ISO string in UTC, or null when empty. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error || `The newsroom server answered with an error (HTTP ${res.status}).`);
  return data;
}

const INPUT = 'w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-sm text-white focus:outline-2 focus:outline-[#f7e14b]';
const LABEL = 'block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1';

const STATUS_STYLE: Record<ClosureStatus, string> = {
  closed: 'bg-red-700 text-white',
  overnight: 'bg-red-700 text-white',
  extended: 'bg-red-700 text-white',
  planned: 'bg-[#f7e14b] text-neutral-900',
  reopened: 'bg-neutral-600 text-white',
};

/**
 * Newsroom screen for road closures: list, add, edit and end. Saving changes the public page at
 * /glasgow-road-closures within a minute or two and tells search engines the page has changed.
 */
export const ClosuresPanel: React.FC<{ canDelete: boolean }> = ({ canDelete }) => {
  const formId = useId();
  const [rows, setRows] = useState<ClosureRow[]>([]);
  const [stories, setStories] = useState<StoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/api/admin/closures');
      setRows(data.closures || []);
      setStories(data.stories || []);
      setSetupMessage(data.ready === false ? data.message : null);
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'Road closures could not be loaded.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const edit = (row: ClosureRow) =>
    setForm({
      id: row.id,
      name: row.name,
      area: row.area || '',
      kind: row.kind,
      status: row.status,
      startsAt: utcToLocalInput(row.starts_at),
      endsAt: utcToLocalInput(row.ends_at),
      reason: row.reason || '',
      diversion: row.diversion || '',
      latitude: row.latitude === null ? '' : String(row.latitude),
      longitude: row.longitude === null ? '' : String(row.longitude),
      closedLine: parseLine(row.closure_geojson) || [],
      diversionLine: parseLine(row.diversion_geojson) || [],
      articleId: row.article_id || '',
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setNotice(null);
    try {
      const body = JSON.stringify({
        name: form.name,
        area: form.area,
        kind: form.kind,
        status: form.status,
        starts_at: localInputToIso(form.startsAt),
        ends_at: localInputToIso(form.endsAt),
        reason: form.reason,
        diversion: form.diversion,
        latitude: form.latitude,
        longitude: form.longitude,
        closure_line: form.closedLine,
        diversion_line: form.diversionLine,
        article_id: form.articleId || null,
      });
      if (form.id) await api(`/api/admin/closures/${encodeURIComponent(form.id)}`, { method: 'PUT', body });
      else await api('/api/admin/closures', { method: 'POST', body });
      setNotice({ kind: 'ok', text: `Saved "${form.name}". The public page updates within a couple of minutes.` });
      setForm(null);
      await load();
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'The closure could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const end = async (row: ClosureRow) => {
    if (!window.confirm(`End "${row.name}" now? It will show as "Reopened" for two days, then leave the public page.`)) return;
    try {
      await api(`/api/admin/closures/${encodeURIComponent(row.id)}`, { method: 'PUT', body: JSON.stringify({ end: true }) });
      setNotice({ kind: 'ok', text: `"${row.name}" is now marked as reopened.` });
      await load();
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'The closure could not be ended.' });
    }
  };

  const remove = async (row: ClosureRow) => {
    if (!window.confirm(`Delete "${row.name}" completely? Use this only for a closure entered by mistake. To finish a real closure, use "End closure".`)) return;
    try {
      await api(`/api/admin/closures/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      setNotice({ kind: 'ok', text: `Deleted "${row.name}".` });
      await load();
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'The closure could not be deleted.' });
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const pin: LngLat | null =
    form && form.latitude !== '' && form.longitude !== '' && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude))
      ? [Number(form.longitude), Number(form.latitude)]
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Road closures</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Shown on the public page at {CLOSURES_PATH}, on the homepage panel and in the "Live travel" line.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold bg-neutral-800 border border-neutral-600 text-neutral-200 hover:bg-neutral-700">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            disabled={!!setupMessage}
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold bg-[#f7e14b] text-neutral-900 hover:bg-white disabled:opacity-40"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add closure
          </button>
        </div>
      </div>

      {setupMessage && (
        <p role="alert" className="flex items-start gap-2 bg-amber-900/40 border border-amber-600 text-amber-100 rounded p-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {setupMessage}
        </p>
      )}
      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded p-3 text-sm border ${
            notice.kind === 'error' ? 'bg-red-900/40 border-red-600 text-red-100' : 'bg-emerald-900/40 border-emerald-600 text-emerald-100'
          }`}
        >
          {notice.kind === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />}
          {notice.text}
        </p>
      )}

      {/* Add / edit form */}
      {form && (
        <form onSubmit={save} aria-labelledby={`${formId}-title`} className="bg-neutral-800 border border-neutral-600 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 id={`${formId}-title`} className="text-base font-bold text-white">
              {form.id ? 'Edit closure' : 'Add a closure'}
            </h3>
            <button type="button" onClick={() => setForm(null)} aria-label="Close the form without saving" className="p-2 rounded text-neutral-300 hover:bg-neutral-700">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor={`${formId}-name`} className={LABEL}>Name (what is closed)</label>
              <input id={`${formId}-name`} required maxLength={160} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="M8 eastbound, Junction 15 to Junction 17" className={INPUT} />
            </div>
            <div>
              <label htmlFor={`${formId}-area`} className={LABEL}>Area</label>
              <input id={`${formId}-area`} maxLength={100} value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="City Centre" className={INPUT} />
            </div>
            <div>
              <label htmlFor={`${formId}-kind`} className={LABEL}>What is affected</label>
              <select id={`${formId}-kind`} value={form.kind} onChange={(e) => set('kind', e.target.value as ClosureKind)} className={INPUT}>
                {CLOSURE_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-status`} className={LABEL}>Status</label>
              <select id={`${formId}-status`} value={form.status} onChange={(e) => set('status', e.target.value as ClosureStatus)} className={INPUT}>
                {CLOSURE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-story`} className={LABEL}>Linked story (optional)</label>
              <select id={`${formId}-story`} value={form.articleId} onChange={(e) => set('articleId', e.target.value)} className={INPUT}>
                <option value="">No linked story</option>
                {form.articleId && !stories.some((s) => s.id === form.articleId) && <option value={form.articleId}>Current linked story</option>}
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}{s.status !== 'published' ? ` (${s.status.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-start`} className={LABEL}>Starts (your local time)</label>
              <input id={`${formId}-start`} type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor={`${formId}-end`} className={LABEL}>Ends (leave empty if not known)</label>
              <input id={`${formId}-end`} type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={INPUT} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor={`${formId}-reason`} className={LABEL}>Reason</label>
              <input id={`${formId}-reason`} maxLength={500} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Resurfacing work" className={INPUT} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor={`${formId}-diversion`} className={LABEL}>Diversion (in words)</label>
              <textarea id={`${formId}-diversion`} maxLength={800} rows={2} value={form.diversion} onChange={(e) => set('diversion', e.target.value)} placeholder="Leave at Junction 15, follow the A803 and rejoin at Junction 17" className={INPUT} />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className={LABEL}>Position on the map</legend>
            <ClosureMapEditor
              pin={pin}
              closedLine={form.closedLine}
              diversionLine={form.diversionLine}
              onChange={(next) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        latitude: next.pin ? String(next.pin[1]) : '',
                        longitude: next.pin ? String(next.pin[0]) : '',
                        closedLine: next.closedLine,
                        diversionLine: next.diversionLine,
                      }
                    : f,
                )
              }
            />
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label htmlFor={`${formId}-lat`} className={LABEL}>Latitude</label>
                <input id={`${formId}-lat`} inputMode="decimal" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="55.8642" className={INPUT} />
              </div>
              <div>
                <label htmlFor={`${formId}-lng`} className={LABEL}>Longitude</label>
                <input id={`${formId}-lng`} inputMode="decimal" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="-4.2518" className={INPUT} />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded text-xs font-bold bg-neutral-700 text-white hover:bg-neutral-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold bg-[#f7e14b] text-neutral-900 hover:bg-white disabled:opacity-50">
              <Save className="w-4 h-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save closure'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-neutral-300">Loading road closures…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-300">No closures yet. Use "Add closure" to create the first one.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="bg-neutral-800 border border-neutral-700 rounded p-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[row.status] || STATUS_STYLE.planned}`}>
                    {STATUS_LABELS[row.status] || row.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-700 text-neutral-100">
                    {KIND_LABELS[row.kind] || row.kind}
                  </span>
                  {row.latitude === null && <span className="text-[11px] text-amber-300">No map pin</span>}
                </p>
                <p className="font-bold text-white">{row.name}{row.area ? ` · ${row.area}` : ''}</p>
                <p className="text-xs text-neutral-300 mt-0.5">
                  {closureDatesText({ startsAt: toIso(row.starts_at), endsAt: toIso(row.ends_at), status: row.status })}
                </p>
                {row.story_title && <p className="text-xs text-neutral-400 mt-0.5">Story: {row.story_title}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => edit(row)} className="flex items-center gap-1 px-3 py-2 rounded text-xs font-bold bg-neutral-700 text-white hover:bg-neutral-600">
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  Edit<span className="sr-only"> {row.name}</span>
                </button>
                {row.status !== 'reopened' && (
                  <button type="button" onClick={() => end(row)} className="flex items-center gap-1 px-3 py-2 rounded text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-600">
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    End closure<span className="sr-only"> {row.name}</span>
                  </button>
                )}
                {canDelete && (
                  <button type="button" onClick={() => remove(row)} className="flex items-center gap-1 px-3 py-2 rounded text-xs font-bold bg-neutral-900 border border-red-700 text-red-200 hover:bg-red-900/50">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete<span className="sr-only"> {row.name}</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
