import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Flame, 
  Star, 
  RefreshCw, 
  CheckCircle, 
  Upload, 
  Users, 
  FileText, 
  History, 
  Mail, 
  Download, 
  Lock, 
  X, 
  Save, 
  Send, 
  AlertTriangle,
  Globe,
  Sliders,
  Clock,
  RotateCcw,
  Check
} from 'lucide-react';
import { 
  AdminUser, 
  AuditEntry, 
  SubscriberEntry, 
  UserRole,
  ArticleStatus,
  SourceType,
  LegalCheckType,
  ArticleRevision
} from '../types/news';
import {
  getAdminCurrentUser,
  getAdminArticles,
  createAdminArticle,
  updateAdminArticle,
  deleteAdminArticle,
  uploadAdminMedia,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  getAdminAuditLog,
  getAdminSubscribers,
  getArticleRevisions,
  restoreArticleRevision,
  getActivePreviewRole,
  setActivePreviewRole
} from '../services/adminApi';
import { CATEGORIES, GLASGOW_DISTRICTS, GLASGOW_IMAGE_PRESETS } from '../constants';

/** D1 UTC timestamp ('YYYY-MM-DD HH:MM:SS' or ISO) -> value for a datetime-local input (local time). */
function utcToLocalInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) -> ISO string in UTC, or undefined when empty/invalid. */
function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export const AdminPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<'articles' | 'review_queue' | 'users' | 'audit' | 'newsletter'>('articles');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Articles state
  const [articles, setArticles] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Users state
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Journalist');
  const [newUserBio, setNewUserBio] = useState('');

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  // Subscribers state
  const [subscribers, setSubscribers] = useState<SubscriberEntry[]>([]);

  // Article Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formStandfirst, setFormStandfirst] = useState('');
  const [formCategory, setFormCategory] = useState('news');
  const [formArea, setFormArea] = useState('City Centre');
  const [formHeroImage, setFormHeroImage] = useState('');
  const [formImageCaption, setFormImageCaption] = useState('');
  const [formPhotoCredit, setFormPhotoCredit] = useState('');
  const [formPhotoSource, setFormPhotoSource] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState<ArticleStatus>('draft');
  const [formIsBreaking, setFormIsBreaking] = useState(false);
  const [formBreakingUntil, setFormBreakingUntil] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formSeoTitle, setFormSeoTitle] = useState('');
  const [formMetaDesc, setFormMetaDesc] = useState('');
  
  // Editorial & Legal Workflow state
  const [formSourceType, setFormSourceType] = useState<SourceType>('Own reporting');
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [formSourceName, setFormSourceName] = useState('');
  const [formVerified, setFormVerified] = useState(false);
  const [formLegalCheck, setFormLegalCheck] = useState<LegalCheckType>('none');
  const [formLegalChecked, setFormLegalChecked] = useState(false);
  const [formEmbargoUntil, setFormEmbargoUntil] = useState('');
  const [formPublishAt, setFormPublishAt] = useState('');
  const [formCorrectionNote, setFormCorrectionNote] = useState('');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Revisions Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [revisionsList, setRevisionsList] = useState<ArticleRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load newsroom data
  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const user = await getAdminCurrentUser();
      setCurrentUser(user);

      const filterToUse = activeTab === 'review_queue' ? 'needs_review' : statusFilter;
      const arts = await getAdminArticles({
        status: filterToUse,
        category: categoryFilter,
      });
      setArticles(arts);

      if (user.role === 'Owner') {
        const uList = await getAdminUsers();
        setUsersList(uList);
      }

      if (user.role === 'Owner' || user.role === 'Editor') {
        const logs = await getAdminAuditLog();
        setAuditLogs(logs);
        const subs = await getAdminSubscribers();
        setSubscribers(subs);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setErrorMessage(err.message || 'Unable to connect to Cloudflare D1 Newsroom backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, statusFilter, categoryFilter]);

  // Handle open editor
  const handleOpenCreateModal = () => {
    setEditorMode('create');
    setCurrentEditId(null);
    setFormTitle('');
    setFormSlug('');
    setFormStandfirst('');
    setFormCategory('news');
    setFormArea('City Centre');
    setFormHeroImage('https://picsum.photos/seed/glasgowlead/800/450');
    setFormImageCaption('The Daily Scot file photography.');
    setFormPhotoCredit('The Daily Scot Staff');
    setFormPhotoSource('Newsdesk Archive');
    setFormBody('');
    setFormTags('Glasgow, Scotland, News');
    setFormStatus('draft');
    setFormIsBreaking(false);
    setFormBreakingUntil('');
    setFormPublishAt('');
    setFormIsFeatured(false);
    setFormSeoTitle('');
    setFormMetaDesc('');
    setFormSourceType('Own reporting');
    setFormSourceUrl('');
    setFormSourceName('');
    setFormVerified(false);
    setFormLegalCheck('none');
    setFormLegalChecked(false);
    setFormEmbargoUntil('');
    setFormCorrectionNote('');
    setIsDirty(false);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (article: any) => {
    setEditorMode('edit');
    setCurrentEditId(article.id);
    setFormTitle(article.title || '');
    setFormSlug(article.slug || '');
    setFormStandfirst(article.standfirst || '');
    setFormCategory(article.category || 'news');
    setFormArea(article.area || article.locationTag || 'City Centre');
    setFormHeroImage(article.hero_image || article.heroImage || '');
    setFormImageCaption(article.image_caption || article.heroCaption || '');
    setFormPhotoCredit(article.photo_credit || article.photoCredit || '');
    setFormPhotoSource(article.photo_source || article.photoSource || '');
    setFormBody(article.body || (article.content ? article.content.join('\n\n') : ''));
    setFormTags(Array.isArray(article.tags) ? article.tags.join(', ') : article.tags || '');
    setFormStatus(article.status || 'draft');
    setFormIsBreaking(Boolean(article.is_breaking || article.isBreaking));
    setFormBreakingUntil(utcToLocalInput(article.breaking_until));
    setFormPublishAt(article.status === 'scheduled' ? utcToLocalInput(article.published_at) : '');
    setFormIsFeatured(Boolean(article.is_featured || article.isFeaturedLead));
    setFormSeoTitle(article.seo_title || '');
    setFormMetaDesc(article.meta_description || '');
    setFormSourceType(article.source_type || 'Own reporting');
    setFormSourceUrl(article.source_url || '');
    setFormSourceName(article.source_name || '');
    setFormVerified(Boolean(article.verified));
    setFormLegalCheck(article.legal_check || 'none');
    setFormLegalChecked(Boolean(article.legal_checked));
    setFormEmbargoUntil(utcToLocalInput(article.embargo_until));
    setFormCorrectionNote(article.correction_note || '');
    setIsDirty(false);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes in this story. Are you sure you want to discard them?')) {
        return;
      }
    }
    setIsEditorOpen(false);
  };

  // Revisions Modal Handler
  const handleOpenHistoryModal = async () => {
    if (!currentEditId) return;
    setLoadingRevisions(true);
    setIsHistoryModalOpen(true);
    try {
      const revs = await getArticleRevisions(currentEditId);
      setRevisionsList(revs);
    } catch (e: any) {
      showToast('Failed to load revisions: ' + e.message);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleRestoreRevision = async (rev: ArticleRevision) => {
    if (!currentEditId) return;
    const prompt = rev.kind === 'proposal'
      ? `Apply ${rev.editor_email}'s proposed changes? This replaces the current title and body (a backup is kept).`
      : `Are you sure you want to restore the version from ${rev.created_at}? This will overwrite current title and body.`;
    if (!window.confirm(prompt)) {
      return;
    }
    try {
      await restoreArticleRevision(currentEditId, rev.id);
      setFormTitle(rev.previous_title);
      setFormBody(rev.previous_body);
      setIsDirty(true);
      setIsHistoryModalOpen(false);
      showToast('Article content restored to previous revision.');
    } catch (e: any) {
      alert('Restore failed: ' + e.message);
    }
  };

  // Save Article
  const handleSaveArticle = async (targetStatus?: ArticleStatus) => {
    if (!formTitle.trim()) {
      alert('Headline is required');
      return;
    }
    if (!formStandfirst.trim()) {
      alert('Standfirst is required');
      return;
    }
    if (!formBody.trim()) {
      alert('Article body content is required');
      return;
    }

    const finalStatus = targetStatus || formStatus;

    // Client-side pre-validation of publish rules
    if (finalStatus === 'scheduled') {
      const when = formPublishAt ? new Date(formPublishAt).getTime() : NaN;
      if (isNaN(when) || when <= Date.now()) {
        alert('Choose a "Publish at" time in the future to schedule this story.');
        return;
      }
    }

    if (finalStatus === 'published' || finalStatus === 'scheduled') {
      if (formLegalCheck !== 'none' && !formLegalChecked) {
        alert(`Cannot publish: Story has legal flag "${formLegalCheck}" but has not been cleared by Legal.`);
        return;
      }
      const goLive = finalStatus === 'scheduled' ? new Date(formPublishAt).getTime() : Date.now();
      if (formEmbargoUntil && new Date(formEmbargoUntil).getTime() > goLive) {
        alert(`Cannot publish: Story is embargoed until ${formEmbargoUntil}.`);
        return;
      }
      if (!formVerified && formSourceType !== 'Own reporting') {
        alert(`Cannot publish: Story sourced from "${formSourceType}" must be marked as verified before publishing.`);
        return;
      }
    }

    const payload = {
      title: formTitle.trim(),
      slug: formSlug.trim() || undefined,
      standfirst: formStandfirst.trim(),
      body: formBody,
      category: formCategory,
      area: formArea,
      hero_image: formHeroImage.trim() || null,
      image_caption: formImageCaption.trim() || null,
      photo_credit: formPhotoCredit.trim() || null,
      photo_source: formPhotoSource.trim() || null,
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      status: finalStatus,
      is_breaking: formIsBreaking ? 1 : 0,
      is_featured: formIsFeatured ? 1 : 0,
      seo_title: formSeoTitle.trim() || undefined,
      meta_description: formMetaDesc.trim() || undefined,
      source_type: formSourceType,
      source_url: formSourceUrl.trim() || undefined,
      source_name: formSourceName.trim() || undefined,
      verified: formVerified ? 1 : 0,
      legal_check: formLegalCheck,
      legal_checked: formLegalChecked ? 1 : 0,
      // datetime-local inputs are in the editor's local time; the API stores UTC
      embargo_until: localInputToIso(formEmbargoUntil) || '',
      breaking_until: formIsBreaking ? localInputToIso(formBreakingUntil) || undefined : undefined,
      published_at: finalStatus === 'scheduled' ? localInputToIso(formPublishAt) : undefined,
      correction_note: formCorrectionNote.trim() || undefined,
    };

    try {
      if (editorMode === 'create') {
        const res = await createAdminArticle(payload);
        showToast(`Article saved as ${res.status.toUpperCase()}`);
      } else if (currentEditId) {
        const res = await updateAdminArticle(currentEditId, payload);
        showToast((res as any).message || `Article updated: ${res.status.toUpperCase()}`);
      }
      setIsDirty(false);
      setIsEditorOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected image exceeds 5MB size limit.');
      return;
    }

    setUploadingImage(true);
    try {
      const res = await uploadAdminMedia(file);
      setFormHeroImage(res.url);
      setFormPhotoSource('Cloudflare R2 Upload');
      setIsDirty(true);
      showToast('Image uploaded to Cloudflare R2');
    } catch (err: any) {
      alert('Image upload failed: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Delete Article
  const handleDeleteArticle = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }
    try {
      await deleteAdminArticle(id);
      showToast('Article deleted.');
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // User role helpers
  const isOwner = currentUser?.role === 'Owner';
  const isEditor = currentUser?.role === 'Editor';
  const isJournalist = currentUser?.role === 'Journalist';
  const canPublish = isOwner || isEditor;

  const needsReviewCount = articles.filter(a => a.status === 'needs_review').length;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-[#005EB8] selection:text-white pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#005EB8] text-white px-5 py-3 rounded shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ADMIN MASTHEAD */}
      <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#005EB8] text-white p-2 rounded">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-black text-lg tracking-tight text-white uppercase">
                  The Daily Scot
                </span>
                <span className="bg-neutral-800 text-neutral-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-neutral-700 uppercase tracking-widest">
                  Newsroom
                </span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Editorial Control Desk • Glasgow & Scotland
              </div>
            </div>
          </div>

          {/* Current User & Status */}
          <div className="flex items-center gap-4 text-xs">
            {currentUser && (
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-neutral-200">{currentUser.name}</span>
                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                  currentUser.role === 'Owner'
                    ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                    : currentUser.role === 'Editor'
                    ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                    : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                }`}>
                  {currentUser.role}
                </span>
              </div>
            )}

            <button
              onClick={loadData}
              title="Refresh Newsroom Data"
              className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* DEV ROLE SWITCHER (Only shown in DEV mode) */}
      {import.meta.env.DEV && (
        <div className="bg-neutral-800/90 border-b border-neutral-700 py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Dev Environment Role Simulator:</span>
            </span>
            <div className="flex items-center gap-2">
              {(['Owner', 'Editor', 'Journalist'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setActivePreviewRole(r);
                    loadData();
                  }}
                  className={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                    getActivePreviewRole() === r
                      ? 'bg-amber-500 text-neutral-950 font-black shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Editorial Desk Alert Banner */}
        {isJournalist && (
          <div className="bg-neutral-800 border-l-4 border-amber-500 p-4 rounded text-xs text-neutral-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                Journalist Editorial Mode
              </span>
              <span>
                You can write drafts and submit stories to the <strong>Needs Review</strong> queue. Published stories can only be approved by Editors or Owners.
              </span>
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="bg-red-950 border border-red-700 text-red-200 p-4 rounded flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-bold text-white transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-700 pb-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('articles');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'articles'
                ? 'bg-[#005EB8] text-white shadow-xs'
                : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>All Stories ({articles.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('review_queue');
              setStatusFilter('needs_review');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'review_queue'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-300" />
            <span>Review Queue</span>
            {needsReviewCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-neutral-950 text-[10px] font-black rounded-full">
                {needsReviewCount}
              </span>
            )}
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                activeTab === 'users'
                  ? 'bg-[#005EB8] text-white shadow-xs'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Users ({usersList.length})</span>
            </button>
          )}

          {(isOwner || isEditor) && (
            <>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === 'audit'
                    ? 'bg-[#005EB8] text-white shadow-xs'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Security Audit Log</span>
              </button>

              <button
                onClick={() => setActiveTab('newsletter')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === 'newsletter'
                    ? 'bg-[#005EB8] text-white shadow-xs'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Subscribers ({subscribers.length})</span>
              </button>
            </>
          )}
        </div>

        {/* TAB 1 & 2: ARTICLES & REVIEW QUEUE */}
        {(activeTab === 'articles' || activeTab === 'review_queue') && (
          <div className="space-y-4">
            {/* Filter and Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-800 border border-neutral-700 p-3 rounded">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {activeTab === 'articles' && (
                  <div>
                    <label className="text-neutral-400 mr-2 uppercase font-bold text-[10px]">Status:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-neutral-200 outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="published">Published</option>
                      <option value="needs_review">Needs Review</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="approved">Approved</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-neutral-400 mr-2 uppercase font-bold text-[10px]">Category:</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-neutral-200 outline-none"
                  >
                    <option value="all">All Sections</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#005EB8] hover:bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-wider transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Draft New Story</span>
              </button>
            </div>

            {/* Articles Table */}
            <div className="bg-neutral-800 border border-neutral-700 rounded overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-950 text-neutral-400 uppercase border-b border-neutral-700 text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-4">Headline & Section</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Verification</th>
                      <th className="py-3 px-3">Author</th>
                      <th className="py-3 px-3 text-right">Updated</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {articles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-neutral-400">
                          {activeTab === 'review_queue' 
                            ? 'No stories pending review in the queue.' 
                            : 'No articles match the current filter.'}
                        </td>
                      </tr>
                    ) : (
                      articles.map((art) => (
                        <tr key={art.id} className="hover:bg-neutral-750 transition text-neutral-200">
                          <td className="py-3 px-4 max-w-md">
                            <div className="flex items-center gap-2">
                              {art.is_breaking ? (
                                <span className="px-1.5 py-0.5 bg-[#D92525] text-white text-[9px] font-black uppercase rounded shrink-0">
                                  Breaking
                                </span>
                              ) : null}
                              {art.is_featured ? (
                                <span className="px-1.5 py-0.5 bg-amber-500 text-neutral-950 text-[9px] font-black uppercase rounded shrink-0">
                                  Lead
                                </span>
                              ) : null}
                              <span className="font-bold text-white hover:text-[#005EB8] cursor-pointer line-clamp-1" onClick={() => handleOpenEditModal(art)}>
                                {art.title}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                              <span className="uppercase font-semibold text-[#005EB8]">{art.category}</span>
                              {art.area && <span>• {art.area}</span>}
                              {art.legal_check && art.legal_check !== 'none' && (
                                <span className="text-amber-400 font-medium">⚠️ {art.legal_check}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              art.status === 'published'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : art.status === 'needs_review'
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : art.status === 'approved'
                                ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                : art.status === 'scheduled'
                                ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                : 'bg-neutral-700 text-neutral-300 border border-neutral-600'
                            }`}>
                              {art.status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-[11px]">
                            {art.verified ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="text-neutral-500 italic">Unverified</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-neutral-300">
                            <div>{art.author_name || 'Staff Reporter'}</div>
                            <div className="text-[10px] text-neutral-500">{art.author_role}</div>
                          </td>

                          <td className="py-3 px-3 text-right text-neutral-400 font-mono text-[11px]">
                            {art.updated_at ? art.updated_at.split(' ')[0] : 'Today'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(art)}
                                title="Edit Story"
                                className="p-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              
                              {canPublish && (
                                <button
                                  onClick={() => handleDeleteArticle(art.id, art.title)}
                                  title="Delete Article"
                                  className="p-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 rounded transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USERS (Owner only) */}
        {activeTab === 'users' && isOwner && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  Newsroom Staff Management
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Role assignments determine publishing rights and access control.
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#005EB8] hover:bg-blue-600 text-white rounded text-xs font-bold uppercase transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff Member</span>
              </button>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 uppercase border-b border-neutral-700 text-[11px] font-bold tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Bio</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-750 transition text-neutral-200">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] text-neutral-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          u.role === 'Owner'
                            ? 'bg-purple-900 text-purple-200'
                            : u.role === 'Editor'
                            ? 'bg-blue-900 text-blue-200'
                            : u.role === 'Bot'
                            ? 'bg-cyan-900 text-cyan-200'
                            : 'bg-emerald-900 text-emerald-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-400 max-w-xs truncate">
                        {u.bio || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-bold ${u.active ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={async () => {
                            const newActive = u.active ? 0 : 1;
                            try {
                              await updateAdminUser(u.id, { active: newActive });
                              showToast(`Updated ${u.name}`);
                              loadData();
                            } catch (e: any) {
                              alert('Update failed: ' + e.message);
                            }
                          }}
                          className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-[11px] font-semibold transition"
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOG (Owner & Editor) */}
        {activeTab === 'audit' && (isOwner || isEditor) && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Security & Editorial Audit Trail
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cryptographic trace of all user actions, publishing events, IP addresses, and state transitions.
              </p>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 uppercase border-b border-neutral-700 text-[11px] font-bold tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3">Staff / Email</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Status Transition</th>
                    <th className="py-3 px-3">IP</th>
                    <th className="py-3 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        No audit records recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-750 transition text-[11px]">
                        <td className="py-2.5 px-4 font-mono text-neutral-400 whitespace-nowrap">
                          {log.created_at}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">{log.user_email}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-blue-400 font-mono">{log.action}</span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-300">
                          {log.before_status || log.after_status ? (
                            <span className="font-mono text-[10px]">
                              {log.before_status || 'none'} → {log.after_status || 'none'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-400">{log.ip || '—'}</td>
                        <td className="py-2.5 px-3 text-neutral-300 max-w-sm truncate">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SUBSCRIBERS (Owner & Editor) */}
        {activeTab === 'newsletter' && (isOwner || isEditor) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  The Glasgow Morning Briefing Subscribers
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Reader email list registered via public homepage and article footers.
                </p>
              </div>
              <button
                onClick={() => getAdminSubscribers('csv')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white rounded text-xs font-bold uppercase transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 uppercase border-b border-neutral-700 text-[11px] font-bold tracking-wider">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-3">Confirmed Status</th>
                    <th className="py-3 px-3 text-right">Subscribed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-neutral-400">
                        No subscribers registered yet.
                      </td>
                    </tr>
                  ) : (
                    subscribers.map((s, idx) => (
                      <tr key={idx} className="hover:bg-neutral-750 transition text-[11px]">
                        <td className="py-2.5 px-4 font-medium text-white">{s.email}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-emerald-400 font-bold">Confirmed</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-400">
                          {s.created_at}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ARTICLE EDITOR */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-neutral-950 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#005EB8]" />
                  <span>{editorMode === 'create' ? 'Draft New Story' : 'Edit Story'}</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  The Daily Scot editorial desk • Role permissions enforced server-side
                </p>
              </div>

              <div className="flex items-center gap-3">
                {editorMode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleOpenHistoryModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-xs text-neutral-200 transition font-bold"
                  >
                    <History className="w-3.5 h-3.5 text-blue-400" />
                    <span>Revision History</span>
                  </button>
                )}
                <button
                  onClick={handleCloseEditor}
                  className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Headline */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Headline <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Clyde Metro green light for £1.2bn light rail link"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white font-headline text-base outline-none focus:border-[#005EB8]"
                />
              </div>

              {/* Slug & Standfirst Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => {
                      setFormSlug(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="auto-generated-from-headline"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-[#005EB8]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    Section & Area
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formCategory}
                      onChange={(e) => {
                        setFormCategory(e.target.value);
                        setIsDirty(true);
                      }}
                      className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white outline-none focus:border-[#005EB8]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={formArea}
                      onChange={(e) => {
                        setFormArea(e.target.value);
                        setIsDirty(true);
                      }}
                      className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white outline-none focus:border-[#005EB8]"
                    >
                      {GLASGOW_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Standfirst */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Standfirst (Intro / Sub-heading) <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formStandfirst}
                  onChange={(e) => {
                    setFormStandfirst(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="One to two sentences summarizing the news angle..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white font-serif text-sm leading-snug outline-none focus:border-[#005EB8]"
                />
              </div>

              {/* SOURCING & VERIFICATION (New editorial fields) */}
              <div className="bg-neutral-800/80 border border-neutral-700 p-3.5 rounded space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Sourcing & Legal Standards</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Source Type</label>
                    <select
                      value={formSourceType}
                      onChange={(e) => {
                        setFormSourceType(e.target.value as SourceType);
                        setIsDirty(true);
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    >
                      <option value="Own reporting">Own reporting</option>
                      <option value="Police Scotland">Police Scotland</option>
                      <option value="Council">Council</option>
                      <option value="Press release">Press release</option>
                      <option value="Court">Court</option>
                      <option value="Other outlet - follow-up">Other outlet - follow-up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Source Name / Attribution</label>
                    <input
                      type="text"
                      value={formSourceName}
                      onChange={(e) => {
                        setFormSourceName(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Police Scotland Greater Glasgow"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Source URL / Link</label>
                    <input
                      type="text"
                      value={formSourceUrl}
                      onChange={(e) => {
                        setFormSourceUrl(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="https://..."
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-700">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Legal Risk Check</label>
                    <select
                      value={formLegalCheck}
                      onChange={(e) => {
                        setFormLegalCheck(e.target.value as LegalCheckType);
                        setIsDirty(true);
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    >
                      <option value="none">None (Standard reporting)</option>
                      <option value="contempt risk - active court case">Contempt risk - active court case</option>
                      <option value="defamation risk">Defamation risk</option>
                      <option value="anonymity required">Anonymity required (Vulnerable witness / Minor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Embargo Until (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formEmbargoUntil}
                      onChange={(e) => {
                        setFormEmbargoUntil(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>

                  {canPublish && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Publish At (for scheduling)</label>
                      <input
                        type="datetime-local"
                        value={formPublishAt}
                        onChange={(e) => {
                          setFormPublishAt(e.target.value);
                          setIsDirty(true);
                        }}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                      />
                      <p className="text-[10px] text-neutral-500 mt-1">Your local time. Use “Schedule” to publish automatically at this time.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formVerified}
                      onChange={(e) => {
                        setFormVerified(e.target.checked);
                        setIsDirty(true);
                      }}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-bold text-neutral-200">
                      Primary Sources Verified
                    </span>
                  </label>

                  <label className={`flex items-center gap-2 ${canPublish ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={formLegalChecked}
                      disabled={!canPublish}
                      onChange={(e) => {
                        setFormLegalChecked(e.target.checked);
                        setIsDirty(true);
                      }}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span className="font-bold text-neutral-200">
                      Cleared by Legal / Standards Editor
                    </span>
                  </label>
                </div>
              </div>

              {/* Photo & Caption */}
              <div className="bg-neutral-800 border border-neutral-700 p-3 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold uppercase tracking-wider text-neutral-300">
                    Lead Photograph
                  </label>
                  <label className="flex items-center gap-1.5 px-3 py-1 bg-[#005EB8] hover:bg-blue-600 text-white rounded text-xs font-bold cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Image to R2'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                </div>

                <input
                  type="text"
                  value={formHeroImage}
                  onChange={(e) => {
                    setFormHeroImage(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="https://... or upload above"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white text-xs outline-none"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Photo Credit</label>
                    <input
                      type="text"
                      value={formPhotoCredit}
                      onChange={(e) => {
                        setFormPhotoCredit(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Colin Mearns / Staff"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Photo Source</label>
                    <input
                      type="text"
                      value={formPhotoSource}
                      onChange={(e) => {
                        setFormPhotoSource(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Staff Photographer, PA Media, Wire"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Photo Caption</label>
                  <input
                    type="text"
                    value={formImageCaption}
                    onChange={(e) => {
                      setFormImageCaption(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Caption describing image contents"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-white text-xs outline-none"
                  />
                </div>
              </div>

              {/* Story Body */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Article Body (HTML / Paragraphs separated by blank lines) <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={8}
                  value={formBody}
                  onChange={(e) => {
                    setFormBody(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Write the full report here. You can use <p>, <h2>, <h3>, <blockquote>, or separate paragraphs with blank lines..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded p-3 text-white font-serif text-sm leading-relaxed outline-none focus:border-[#005EB8]"
                />
              </div>

              {/* Correction Note (for updates to published articles) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Correction Note (If updating a published story)
                </label>
                <input
                  type="text"
                  value={formCorrectionNote}
                  onChange={(e) => {
                    setFormCorrectionNote(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. This article was updated at 14:30 to clarify the council's response."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-white text-xs outline-none"
                />
              </div>

              {/* Editorial Flags (Editor/Owner only) */}
              <div className="bg-neutral-800 border border-neutral-700 p-3 rounded flex items-center gap-6">
                <label
                  className={`flex items-center gap-2 ${
                    canPublish ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formIsBreaking}
                    disabled={!canPublish}
                    onChange={(e) => {
                      setFormIsBreaking(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded text-[#D92525] focus:ring-0"
                  />
                  <span className="font-bold text-white flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-[#D92525]" />
                    <span>Breaking News Strip</span>
                  </span>
                </label>

                <label
                  className={`flex items-center gap-2 ${
                    canPublish ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formIsFeatured}
                    disabled={!canPublish}
                    onChange={(e) => {
                      setFormIsFeatured(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span className="font-bold text-white flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Front-Page Lead Story</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-neutral-950 border-t border-neutral-800 px-6 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-bold text-xs uppercase transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveArticle('draft')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded font-bold text-xs uppercase tracking-wider transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                {!canPublish ? (
                  <button
                    type="button"
                    onClick={() => handleSaveArticle('needs_review')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs uppercase tracking-wider transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Editorial Review</span>
                  </button>
                ) : (
                  <>
                  <button
                    type="button"
                    onClick={() => handleSaveArticle('scheduled')}
                    disabled={!formPublishAt}
                    title={formPublishAt ? 'Publish automatically at the chosen time' : 'Set a "Publish At" time first'}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-bold text-xs uppercase tracking-wider transition"
                  >
                    <span>Schedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveArticle('published')}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#005EB8] hover:bg-blue-600 text-white rounded font-bold text-xs uppercase tracking-wider transition shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Publish Immediately</span>
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REVISION HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-neutral-950 border-b border-neutral-800 px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <span>Article Revision History</span>
              </h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {loadingRevisions ? (
                <div className="py-8 text-center text-neutral-400">Loading revisions...</div>
              ) : revisionsList.length === 0 ? (
                <div className="py-8 text-center text-neutral-400">
                  No revisions found for this story yet. Revisions are created automatically whenever a published story is updated.
                </div>
              ) : (
                revisionsList.map((rev) => (
                  <div key={rev.id} className="bg-neutral-800 border border-neutral-700 p-3 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-neutral-400 text-[10px] flex items-center gap-2">
                        {rev.kind === 'proposal' && (
                          <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold uppercase">Proposed change</span>
                        )}
                        {rev.kind === 'applied' && (
                          <span className="bg-emerald-700 text-white px-1.5 py-0.5 rounded font-bold uppercase">Applied</span>
                        )}
                        <span>{rev.created_at} UTC • By {rev.editor_email}</span>
                      </div>
                      {canPublish && rev.kind !== 'applied' && (
                        <button
                          type="button"
                          onClick={() => handleRestoreRevision(rev)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold uppercase transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{rev.kind === 'proposal' ? 'Apply changes' : 'Restore'}</span>
                        </button>
                      )}
                    </div>
                    <div className="font-bold text-white text-xs">{rev.previous_title}</div>
                    {rev.change_summary && (
                      <div className="text-[11px] text-neutral-300 italic">{rev.change_summary}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD USER (Owner only) */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md shadow-2xl overflow-hidden text-xs">
            <div className="bg-neutral-950 border-b border-neutral-800 px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Add Newsroom Staff</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Fiona Bruce"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Staff Email (must match Cloudflare Access email)
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name@dailyscot.co.uk"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Role Permission
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="Journalist">Journalist (Draft & submit for review)</option>
                  <option value="Editor">Editor (Publish, edit any article, breaking news)</option>
                  <option value="Owner">Owner (All permissions + staff management)</option>
                  <option value="Bot">Bot (Automated ingest service token only)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  Job Title / Beat Bio
                </label>
                <input
                  type="text"
                  value={newUserBio}
                  onChange={(e) => setNewUserBio(e.target.value)}
                  placeholder="e.g. City Chambers & Council Reporter"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-white outline-none"
                />
              </div>
            </div>

            <div className="bg-neutral-950 border-t border-neutral-800 px-5 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newUserName.trim() || !newUserEmail.trim()) {
                    alert('Name and Email are required');
                    return;
                  }
                  try {
                    await createAdminUser({
                      name: newUserName.trim(),
                      email: newUserEmail.trim(),
                      role: newUserRole,
                      bio: newUserBio.trim(),
                    });
                    setShowAddUserModal(false);
                    setNewUserName('');
                    setNewUserEmail('');
                    setNewUserBio('');
                    showToast('Staff member added.');
                    loadData();
                  } catch (e: any) {
                    alert('Failed to add user: ' + e.message);
                  }
                }}
                className="px-4 py-1.5 bg-[#005EB8] hover:bg-blue-600 text-white rounded font-bold text-xs uppercase"
              >
                Add Staff Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
