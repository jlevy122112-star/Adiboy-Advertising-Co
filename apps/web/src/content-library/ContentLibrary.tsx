import { useState, useEffect, useId } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  useLibraryStore,
  PLATFORM_META,
  FORMAT_LABELS,
} from './contentLibraryStore';
import type {
  LibraryItem,
  Platform,
  ContentFormat,
  LibraryItemSource,
} from './contentLibraryStore';
import './content-library.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentLibraryProps {
  onUse?: (item: LibraryItem) => void;
}

type SortOption = 'newest' | 'az' | 'most_used' | 'favorites';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sourceLabel(source: LibraryItemSource): string {
  const map: Record<LibraryItemSource, string> = {
    template: 'Template',
    saved: 'Saved',
    ai_generated: 'AI Generated',
    imported: 'Imported',
  };
  return map[source];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
  return (
    <div className="cl-empty">
      <div className="cl-empty-icon">{search ? '🔍' : '📭'}</div>
      <p className="cl-empty-title">
        {search ? 'No results found' : 'No content here yet'}
      </p>
      <p className="cl-empty-desc">
        {search
          ? `We couldn't find anything matching "${search}". Try different keywords or clear the filters.`
          : 'Add your first piece of content or switch to a different platform filter.'}
      </p>
      {!search && (
        <button className="cl-add-btn" onClick={onAdd} style={{ marginTop: 8 }}>
          ＋ Add Content
        </button>
      )}
    </div>
  );
}

// ─── Library Card ─────────────────────────────────────────────────────────────

interface LibraryCardProps {
  item: LibraryItem;
  onPreview: () => void;
  onEdit: () => void;
  onUse: () => void;
  onToggleFavorite: () => void;
}

function LibraryCard({ item, onPreview, onEdit, onUse, onToggleFavorite }: LibraryCardProps) {
  const meta = PLATFORM_META[item.platform];
  const visibleTags = item.hashtags.slice(0, 3);
  const extraCount = item.hashtags.length - visibleTags.length;

  return (
    <div className="cl-card">
      <div
        className="cl-card-stripe"
        style={{ background: meta.color }}
        aria-hidden="true"
      />
      <div className="cl-card-body">
        <div className="cl-card-meta">
          <span className="cl-card-format-badge">
            {FORMAT_LABELS[item.format]}
          </span>
          <span className="cl-card-source-badge">
            {sourceLabel(item.source)}
          </span>
        </div>
        <h3 className="cl-card-title">{item.title}</h3>
        <p className="cl-card-preview">{item.body}</p>
        {visibleTags.length > 0 && (
          <div className="cl-card-tags">
            {visibleTags.map((tag) => (
              <span key={tag} className="cl-card-hashtag">
                {tag}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="cl-card-tag-more">+{extraCount}</span>
            )}
          </div>
        )}
      </div>
      <div className="cl-card-footer">
        <div className="cl-card-footer-left">
          <button
            className={`cl-card-heart${item.isFavorite ? ' cl-favorited' : ''}`}
            onClick={onToggleFavorite}
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {item.isFavorite ? '♥' : '♡'}
          </button>
          <span className="cl-card-usage">
            {item.usageCount > 0 ? `Used ${item.usageCount}×` : 'Unused'}
          </span>
        </div>
        <div className="cl-card-actions">
          <button
            className="cl-card-action-btn"
            onClick={onPreview}
            title="Preview"
          >
            👁 Preview
          </button>
          <button
            className="cl-card-action-btn"
            onClick={onEdit}
            title="Edit"
          >
            ✏ Edit
          </button>
          <button
            className="cl-card-action-btn cl-use-btn"
            onClick={onUse}
            title="Use this content"
          >
            → Use
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  item: LibraryItem;
  onClose: () => void;
  onEdit: () => void;
  onUse: () => void;
}

function PreviewModal({ item, onClose, onEdit, onUse }: PreviewModalProps) {
  const meta = PLATFORM_META[item.platform];

  return (
    <div
      className="cl-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cl-modal" role="dialog" aria-modal="true" aria-label="Content Preview">
        <div
          className="cl-preview-platform-strip"
          style={{ background: meta.color }}
        />
        <div className="cl-modal-header">
          <div>
            <h2 className="cl-modal-title">{item.title}</h2>
            <p className="cl-modal-subtitle">
              {meta.icon} {meta.label} · {FORMAT_LABELS[item.format]}
            </p>
          </div>
          <button className="cl-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cl-preview-meta-row">
          <span className="cl-preview-badge">{FORMAT_LABELS[item.format]}</span>
          <span className="cl-preview-badge">{sourceLabel(item.source)}</span>
          <span className="cl-preview-badge">Used {item.usageCount}×</span>
          {item.isFavorite && <span className="cl-preview-badge">♥ Favorite</span>}
        </div>

        <div className="cl-preview-section">
          <div className="cl-preview-label">Body Copy</div>
          <div className="cl-preview-value">{item.body}</div>
        </div>

        {item.hashtags.length > 0 && (
          <>
            <div className="cl-preview-divider" />
            <div className="cl-preview-section">
              <div className="cl-preview-label">Hashtags</div>
              <div className="cl-card-tags" style={{ marginTop: 4 }}>
                {item.hashtags.map((tag) => (
                  <span key={tag} className="cl-card-hashtag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {item.tags.length > 0 && (
          <>
            <div className="cl-preview-divider" />
            <div className="cl-preview-section">
              <div className="cl-preview-label">Tags</div>
              <div className="cl-card-tags" style={{ marginTop: 4 }}>
                {item.tags.map((tag) => (
                  <span key={tag} className="cl-card-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {item.mediaUrl && (
          <>
            <div className="cl-preview-divider" />
            <div className="cl-preview-section">
              <div className="cl-preview-label">Media</div>
              {item.mediaType === 'image' ? (
                <img
                  src={item.mediaUrl}
                  alt="Content media"
                  style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }}
                />
              ) : (
                <video
                  src={item.mediaUrl}
                  controls
                  style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }}
                />
              )}
            </div>
          </>
        )}

        <div className="cl-preview-divider" />
        <div className="cl-preview-section">
          <div className="cl-preview-label">Metadata</div>
          <div className="cl-preview-value" style={{ fontSize: 12 }}>
            Created: {formatDate(item.createdAt)}&nbsp;·&nbsp;
            Updated: {formatDate(item.updatedAt)}
          </div>
        </div>

        <div className="cl-modal-footer">
          <button className="cl-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="cl-btn-secondary" onClick={onEdit}>
            ✏ Edit
          </button>
          <button className="cl-btn-primary" onClick={onUse}>
            → Use This
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Form (shared by Add & Edit) ────────────────────────────────────────

interface ItemFormData {
  title: string;
  body: string;
  hashtagsRaw: string;
  tagsRaw: string;
  platform: Platform;
  format: ContentFormat;
  mediaFile: File | null;
}

interface ItemFormProps {
  formId: string;
  data: ItemFormData;
  onChange: (field: keyof ItemFormData, value: string | File | null) => void;
}

function ItemForm({ formId, data, onChange }: ItemFormProps) {
  const availableFormats = PLATFORM_META[data.platform].formats;

  function handlePlatformChange(e: ChangeEvent<HTMLSelectElement>) {
    const newPlatform = e.target.value as Platform;
    onChange('platform', newPlatform);
    // Reset format if current format not available on new platform
    if (!PLATFORM_META[newPlatform].formats.includes(data.format)) {
      onChange('format', PLATFORM_META[newPlatform].formats[0]);
    }
  }

  return (
    <div id={formId}>
      <div className="cl-form-row">
        <div className="cl-field">
          <label className="cl-label" htmlFor={`${formId}-platform`}>
            Platform
          </label>
          <select
            id={`${formId}-platform`}
            className="cl-select"
            value={data.platform}
            onChange={handlePlatformChange}
          >
            {(Object.keys(PLATFORM_META) as Platform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label" htmlFor={`${formId}-format`}>
            Format
          </label>
          <select
            id={`${formId}-format`}
            className="cl-select"
            value={data.format}
            onChange={(e) => onChange('format', e.target.value as ContentFormat)}
          >
            {availableFormats.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cl-field">
        <label className="cl-label" htmlFor={`${formId}-title`}>
          Title
        </label>
        <input
          id={`${formId}-title`}
          type="text"
          className="cl-input"
          placeholder="Give this content a clear, descriptive title"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          required
        />
      </div>

      <div className="cl-field">
        <label className="cl-label" htmlFor={`${formId}-body`}>
          Body Copy
        </label>
        <textarea
          id={`${formId}-body`}
          className="cl-textarea"
          placeholder="Write your content here. Use [BRAND] as a placeholder for the brand name."
          value={data.body}
          onChange={(e) => onChange('body', e.target.value)}
          style={{ minHeight: 140 }}
        />
      </div>

      <div className="cl-field">
        <label className="cl-label" htmlFor={`${formId}-hashtags`}>
          Hashtags
        </label>
        <input
          id={`${formId}-hashtags`}
          type="text"
          className="cl-input"
          placeholder="#tag1, #tag2, #tag3"
          value={data.hashtagsRaw}
          onChange={(e) => onChange('hashtagsRaw', e.target.value)}
        />
        <p className="cl-hint">Comma-separated. Include the # prefix.</p>
      </div>

      <div className="cl-field">
        <label className="cl-label" htmlFor={`${formId}-tags`}>
          Internal Tags
        </label>
        <input
          id={`${formId}-tags`}
          type="text"
          className="cl-input"
          placeholder="launch, product, seasonal, ..."
          value={data.tagsRaw}
          onChange={(e) => onChange('tagsRaw', e.target.value)}
        />
        <p className="cl-hint">Comma-separated. Used for internal organization only.</p>
      </div>

      <div className="cl-field">
        <label className="cl-label" htmlFor={`${formId}-media`}>
          Media (optional)
        </label>
        <input
          id={`${formId}-media`}
          type="file"
          className="cl-file-input"
          accept="image/*,video/*"
          onChange={(e) => onChange('mediaFile', e.target.files?.[0] ?? null)}
        />
        <p className="cl-hint">Accepts images and videos. File is stored as a preview URL in this session.</p>
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onSave: (item: LibraryItem) => void;
}

function AddModal({ onClose, onSave }: AddModalProps) {
  const formId = useId();
  const [data, setData] = useState<ItemFormData>({
    title: '',
    body: '',
    hashtagsRaw: '',
    tagsRaw: '',
    platform: 'instagram',
    format: 'feed_post',
    mediaFile: null,
  });

  function handleChange(field: keyof ItemFormData, value: string | File | null) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data.title.trim()) return;

    const now = new Date().toISOString();
    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'video' | undefined;

    if (data.mediaFile) {
      mediaUrl = URL.createObjectURL(data.mediaFile);
      mediaType = data.mediaFile.type.startsWith('video/') ? 'video' : 'image';
    }

    const item: LibraryItem = {
      id: generateId(),
      platform: data.platform,
      format: data.format,
      title: data.title.trim(),
      body: data.body.trim(),
      hashtags: data.hashtagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      tags: data.tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      source: 'saved',
      mediaUrl,
      mediaType,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isFavorite: false,
    };

    onSave(item);
  }

  return (
    <div
      className="cl-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cl-modal" role="dialog" aria-modal="true" aria-label="Add Content">
        <div className="cl-modal-header">
          <div>
            <h2 className="cl-modal-title">＋ Add Content</h2>
            <p className="cl-modal-subtitle">Create a new item in your content library</p>
          </div>
          <button className="cl-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <ItemForm formId={`add-${formId}`} data={data} onChange={handleChange} />
          <div className="cl-modal-footer">
            <button type="button" className="cl-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cl-btn-primary" disabled={!data.title.trim()}>
              Save to Library
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  item: LibraryItem;
  onClose: () => void;
  onSave: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
}

function EditModal({ item, onClose, onSave, onDelete }: EditModalProps) {
  const formId = useId();
  const [data, setData] = useState<ItemFormData>({
    title: item.title,
    body: item.body,
    hashtagsRaw: item.hashtags.join(', '),
    tagsRaw: item.tags.join(', '),
    platform: item.platform,
    format: item.format,
    mediaFile: null,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleChange(field: keyof ItemFormData, value: string | File | null) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data.title.trim()) return;

    let mediaUrl = item.mediaUrl;
    let mediaType = item.mediaType;

    if (data.mediaFile) {
      mediaUrl = URL.createObjectURL(data.mediaFile);
      mediaType = data.mediaFile.type.startsWith('video/') ? 'video' : 'image';
    }

    const updated: LibraryItem = {
      ...item,
      platform: data.platform,
      format: data.format,
      title: data.title.trim(),
      body: data.body.trim(),
      hashtags: data.hashtagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      tags: data.tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      mediaUrl,
      mediaType,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
  }

  return (
    <div
      className="cl-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cl-modal" role="dialog" aria-modal="true" aria-label="Edit Content">
        <div className="cl-modal-header">
          <div>
            <h2 className="cl-modal-title">✏ Edit Content</h2>
            <p className="cl-modal-subtitle">Update this library item</p>
          </div>
          <button className="cl-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <ItemForm formId={`edit-${formId}`} data={data} onChange={handleChange} />
          <div className="cl-modal-footer">
            {!confirmDelete ? (
              <button
                type="button"
                className="cl-btn-danger"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                className="cl-btn-danger"
                onClick={() => onDelete(item.id)}
              >
                Confirm Delete
              </button>
            )}
            <button type="button" className="cl-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cl-btn-primary" disabled={!data.title.trim()}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContentLibrary({ onUse }: ContentLibraryProps) {
  const store = useLibraryStore();

  // UI state
  const [activePlatform, setActivePlatform] = useState<Platform | 'all'>('all');
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<ContentFormat | 'all'>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filtering & Sorting ────────────────────────────────────────────────────

  const filteredItems = store.items
    .filter((item) => {
      if (activePlatform !== 'all' && item.platform !== activePlatform) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.title.toLowerCase().includes(q) &&
          !item.body.toLowerCase().includes(q)
        ) return false;
      }
      if (formatFilter !== 'all' && item.format !== formatFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'az':
          return a.title.localeCompare(b.title);
        case 'most_used':
          return b.usageCount - a.usageCount;
        case 'favorites':
          if (a.isFavorite === b.isFavorite) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return a.isFavorite ? -1 : 1;
        default:
          return 0;
      }
    });

  // Build format options for the active platform
  const formatOptions: ContentFormat[] =
    activePlatform === 'all'
      ? (Object.keys(FORMAT_LABELS) as ContentFormat[])
      : PLATFORM_META[activePlatform].formats;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleUse(item: LibraryItem) {
    store.incrementUsage(item.id);
    if (onUse) {
      onUse(item);
    } else {
      navigator.clipboard.writeText(item.body).catch(() => {
        // fallback for browsers without clipboard API
      });
      setToast('Copied to clipboard!');
    }
  }

  function handleSaveNew(item: LibraryItem) {
    store.addItem(item);
    setShowAdd(false);
    setToast('Content added to library!');
  }

  function handleSaveEdit(item: LibraryItem) {
    store.updateItem(item);
    setEditItem(null);
    // Close preview if it was showing the same item
    if (previewItem?.id === item.id) setPreviewItem(item);
    setToast('Content updated!');
  }

  function handleDelete(id: string) {
    store.deleteItem(id);
    setEditItem(null);
    if (previewItem?.id === id) setPreviewItem(null);
    setToast('Content deleted.');
  }

  function handlePlatformSelect(platform: Platform | 'all') {
    setActivePlatform(platform);
    // Reset format filter when switching platforms
    setFormatFilter('all');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const platforms = Object.keys(PLATFORM_META) as Platform[];

  return (
    <div className="cl-root">
      {/* ── Topbar ── */}
      <header className="cl-topbar">
        <div className="cl-topbar-left">
          <span className="cl-title">✦ Content Library</span>
          <span className="cl-subtitle">Your formats, repurposed fast</span>
        </div>
        <div className="cl-topbar-right">
          <input
            type="search"
            className="cl-search"
            placeholder="Search content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search content"
          />
          <select
            className="cl-filter-select"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as ContentFormat | 'all')}
            aria-label="Filter by format"
          >
            <option value="all">All Formats</option>
            {formatOptions.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
          <select
            className="cl-filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="Sort by"
          >
            <option value="newest">Newest</option>
            <option value="az">A–Z</option>
            <option value="most_used">Most Used</option>
            <option value="favorites">Favorites First</option>
          </select>
          <button
            className="cl-add-btn"
            onClick={() => setShowAdd(true)}
          >
            ＋ Add Content
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="cl-body">
        {/* Platform Sidebar */}
        <nav className="cl-sidebar" aria-label="Platform filter">
          <button
            className={`cl-sidebar-btn${activePlatform === 'all' ? ' cl-active' : ''}`}
            onClick={() => handlePlatformSelect('all')}
            title="All platforms"
          >
            <span className="cl-sidebar-icon">◈</span>
            <span className="cl-sidebar-label">All</span>
          </button>
          <div className="cl-sidebar-divider" />
          {platforms.map((platform) => {
            const meta = PLATFORM_META[platform];
            return (
              <button
                key={platform}
                className={`cl-sidebar-btn${activePlatform === platform ? ' cl-active' : ''}`}
                onClick={() => handlePlatformSelect(platform)}
                title={meta.label}
                style={
                  activePlatform === platform
                    ? { borderColor: meta.color, color: meta.color }
                    : undefined
                }
              >
                <span className="cl-sidebar-icon">{meta.icon}</span>
                <span className="cl-sidebar-label">{meta.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Grid Area */}
        <main className="cl-grid-area">
          <div className="cl-grid-header">
            <span className="cl-grid-count">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              {activePlatform !== 'all' && ` · ${PLATFORM_META[activePlatform].label}`}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState search={search} onAdd={() => setShowAdd(true)} />
          ) : (
            <div className="cl-grid">
              {filteredItems.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  onPreview={() => setPreviewItem(item)}
                  onEdit={() => setEditItem(item)}
                  onUse={() => handleUse(item)}
                  onToggleFavorite={() => store.toggleFavorite(item.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onEdit={() => {
            setEditItem(previewItem);
            setPreviewItem(null);
          }}
          onUse={() => {
            handleUse(previewItem);
            setPreviewItem(null);
          }}
        />
      )}

      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSave={handleSaveNew}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="cl-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
