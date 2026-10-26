'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Icon, uid } from './ui';

const stamp = () => new Date().toISOString();
const fresh = type => ({ id: uid(), type, title: '', body: '', items: [], tags: [], updatedAt: stamp() });
const hasContent = note => !!((note.title || '').trim() || (note.type === 'checklist'
  ? (note.items || []).some(item => (item.text || '').trim()) : (note.body || '').trim()));
const updatedLabel = value => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not saved yet';
const noteTitle = note => (note.title || '').trim() || (note.type === 'checklist' ? 'Untitled checklist' : 'Untitled note');

const TABS = [
  { id: 'all', label: 'All Notes' },
  { id: 'mine', label: 'My Notes' },
  { id: 'checklists', label: 'Checklists' },
  { id: 'archived', label: 'Archived' },
];

export default function Diary({ of, put, del, workspace }) {
  // Keep the existing diary record store; blank drafts stay local until the user enters content.
  const notes = of('diary').filter(hasContent);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [filter, setFilter] = useState('all');
  const [openMenu, setOpenMenu] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [saveError, setSaveError] = useState('');
  const timer = useRef(null);
  const bodyRef = useRef(null);
  const menuRef = useRef(null);
  const initialSelectionDone = useRef(false);

  const visibleNotes = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return notes.filter(note => {
      if (tab === 'archived' ? !note.archived : note.archived) return false;
      if (tab === 'mine' && note.type === 'checklist') return false;
      if (tab === 'checklists' && note.type !== 'checklist') return false;
      if (filter === 'notes' && note.type === 'checklist') return false;
      if (filter === 'checklists' && note.type !== 'checklist') return false;
      if (filter === 'pinned' && !note.pinned) return false;
      if (search && ![note.title, note.body, ...(note.items || []).map(item => item.text), ...(note.tags || [])]
        .join(' ').toLocaleLowerCase().includes(search)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'oldest') return (a.updatedAt || '').localeCompare(b.updatedAt || '');
      if (sort === 'title') return noteTitle(a).localeCompare(noteTitle(b));
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [notes, tab, query, sort, filter]);

  useEffect(() => {
    if (!initialSelectionDone.current) {
      if (!visibleNotes.length) return;
      const first = visibleNotes[0];
      initialSelectionDone.current = true;
      setSelectedId(first.id); setDraft(first); setDirty(false); setTagDraft((first.tags || []).join(', '));
      return;
    }
    // Keep an empty, newly-created draft selected until it has content and is persisted.
    if (draft && !notes.some(note => note.id === draft.id)) return;
    // A cleared selection is intentional (for example, after Close note); leave the editor empty.
    if (!selectedId) return;
    if (!visibleNotes.length) {
      if (selectedId && !notes.some(note => note.id === selectedId)) {
        setSelectedId(null); setDraft(null); setDirty(false);
      }
      return;
    }
    if (!visibleNotes.some(note => note.id === selectedId)) {
      const selected = visibleNotes[0];
      setSelectedId(selected.id); setDraft(selected); setDirty(false); setTagDraft((selected.tags || []).join(', '));
    }
  }, [visibleNotes, selectedId, notes, draft]);

  useEffect(() => {
    const closeOutside = event => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null); };
    const closeEscape = event => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const save = note => {
    const saved = { ...note, updatedAt: stamp() };
    setSaveError('');
    setDraft(current => current?.id === saved.id ? saved : current);
    setDirty(false);
    Promise.resolve(put('diary', saved)).then(ok => {
      if (ok === false) setSaveError('Could not save this note. Check the connection and retry.');
    }).catch(() => setSaveError('Could not save this note. Check the connection and retry.'));
  };
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (draft && dirty && hasContent(draft)) save(draft);
    else setDirty(false);
  };
  const edit = next => {
    setDraft(next);
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (hasContent(next)) save(next);
      else setDirty(false);
    }, 600);
  };
  const create = type => {
    flush();
    initialSelectionDone.current = true;
    const note = fresh(type);
    setSelectedId(note.id); setDraft(note); setDirty(false); setNewItem(''); setTagDraft(''); setTab(type === 'checklist' ? 'checklists' : 'mine');
  };
  const select = note => {
    if (note.id === selectedId) return;
    flush();
    initialSelectionDone.current = true;
    setSelectedId(note.id); setDraft(note); setDirty(false); setNewItem(''); setTagDraft((note.tags || []).join(', ')); setSaveError('');
  };
  const remove = note => {
    if (!window.confirm(`Delete “${noteTitle(note)}”? This cannot be undone.`)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    del(note.id);
    if (note.id === selectedId) { setDraft(null); setSelectedId(null); setDirty(false); }
    setOpenMenu(null);
  };
  const togglePin = note => {
    const next = { ...note, pinned: !note.pinned, updatedAt: stamp() };
    put('diary', next);
    if (note.id === selectedId) setDraft(next);
  };
  const toggleArchive = note => {
    const next = { ...note, archived: !note.archived, updatedAt: stamp() };
    put('diary', next);
    if (note.id === selectedId) { setDraft(null); setSelectedId(null); setDirty(false); }
    setOpenMenu(null);
  };
  const addItem = event => {
    event.preventDefault();
    const text = newItem.trim();
    if (!draft || !text) return;
    edit({ ...draft, items: [...(draft.items || []), { id: uid(), text, done: false }] });
    setNewItem('');
  };
  const saveNow = () => {
    if (!draft) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const tags = tagDraft.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12);
    save({ ...draft, tags });
  };
  const closeEditor = () => {
    initialSelectionDone.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (draft && dirty && hasContent(draft)) {
      const tags = tagDraft.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12);
      save({ ...draft, tags });
    }
    setDraft(null); setSelectedId(null); setDirty(false); setNewItem('');
  };
  const insertFormat = (before, after = '', placeholder = 'text') => {
    const area = bodyRef.current;
    if (!area || !draft) return;
    const start = area.selectionStart, end = area.selectionEnd;
    const selected = (draft.body || '').slice(start, end) || placeholder;
    const body = (draft.body || '').slice(0, start) + before + selected + after + (draft.body || '').slice(end);
    edit({ ...draft, body });
    requestAnimationFrame(() => {
      area.focus();
      const caret = start + before.length + selected.length + after.length;
      area.setSelectionRange(caret, caret);
    });
  };

  const emptyText = query ? 'No notes match your search.' : tab === 'archived' ? 'Archived notes will appear here.' : tab === 'checklists' ? 'No checklists yet.' : 'No notes yet. Create a note or checklist to get started.';

  return (
    <div className="diary-workspace">
      <div className="diary-toolbar-row">
        <nav className="diary-tabs" role="tablist" aria-label="Note categories">
          {TABS.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}
            {item.id === 'all' && <span>{notes.filter(note => !note.archived).length}</span>}
          </button>)}
        </nav>
        <div className="diary-global-tools">
          <label className="diary-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search notes…" aria-label="Search notes" /></label>
          <label className="diary-filter"><span className="sr-only">Filter notes</span><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter notes">
            <option value="all">All types</option><option value="notes">Notes</option><option value="checklists">Checklists</option><option value="pinned">Pinned</option>
          </select></label>
          <button className="btn pri diary-new-note" onClick={() => create('note')}>＋ New note</button>
          <button className="btn diary-new-checklist" onClick={() => create('checklist')}>＋ Checklist</button>
        </div>
      </div>

      <div className="diary-layout">
        <aside className="card diary-list" aria-label="Notes list">
          <div className="diary-list-heading"><h2>Notes <span>({visibleNotes.length})</span></h2>
            <label><span className="sr-only">Sort notes</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort notes">
              <option value="newest">Latest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option>
            </select></label>
          </div>
          {!visibleNotes.length ? <div className="diary-empty"><Empty>{emptyText}</Empty>{!query && tab !== 'archived' && <button className="btn sm" onClick={() => create(tab === 'checklists' ? 'checklist' : 'note')}>Create your first note</button>}</div> :
            <div className="diary-note-list">
              {visibleNotes.map(note => <article key={note.id} className={'diary-entry' + (selectedId === note.id ? ' selected' : '')}>
                <button className={'diary-type-icon ' + (note.type === 'checklist' ? 'checklist' : 'note')} onClick={() => select(note)} aria-label={`Open ${noteTitle(note)}`}>
                  {note.type === 'checklist' ? '✓' : <Icon n="diary" />}
                </button>
                <button className="diary-entry-main" onClick={() => select(note)}>
                  <b>{noteTitle(note)}{note.pinned && <span className="diary-pin-mark" aria-label="Pinned">◆</span>}</b>
                  <span className="diary-preview">{note.type === 'checklist'
                    ? `${(note.items || []).filter(item => item.done).length}/${(note.items || []).length} items checked`
                    : (note.body || 'No text yet').replace(/[#*_`>-]/g, '').slice(0, 100)}</span>
                  <span className="diary-entry-date">{updatedLabel(note.updatedAt)}</span>
                </button>
                <div className="diary-entry-menu" ref={openMenu === note.id ? menuRef : null}>
                  <button className="diary-icon-btn" onClick={() => togglePin(note)} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} title={note.pinned ? 'Unpin' : 'Pin'}>{note.pinned ? '◆' : '⌁'}</button>
                  <button className="diary-icon-btn" onClick={() => setOpenMenu(openMenu === note.id ? null : note.id)} aria-expanded={openMenu === note.id} aria-label="More note actions">•••</button>
                  {openMenu === note.id && <div className="diary-note-menu">
                    <button onClick={() => toggleArchive(note)}>{note.archived ? 'Restore note' : 'Archive note'}</button>
                    <button className="danger" onClick={() => remove(note)}>Delete note</button>
                  </div>}
                </div>
              </article>)}
            </div>}
        </aside>

        <section className="card diary-editor" aria-label="Note editor">
          {!draft ? <div className="diary-editor-empty"><Empty>{notes.length ? 'Select a note to view or edit it.' : 'Create a note to start writing.'}</Empty></div> : <>
            <header className="diary-editor-header">
              <span className={'diary-editor-type ' + (draft.type === 'checklist' ? 'checklist' : 'note')}>{draft.type === 'checklist' ? '✓' : <Icon n="diary" />}</span>
              <div><input className="diary-title" value={draft.title || ''} onChange={event => edit({ ...draft, title: event.target.value })}
                  placeholder={draft.type === 'checklist' ? 'Checklist title' : 'Untitled note'} aria-label="Note title" />
                <div className="diary-meta">{updatedLabel(draft.updatedAt)} <span>·</span> {draft.type === 'checklist' ? 'Checklist' : 'Personal note'} <span>·</span> {workspace?.name || 'Current workspace'}</div>
              </div>
              <button className="diary-icon-btn diary-editor-pin" onClick={() => togglePin(draft)} aria-label={draft.pinned ? 'Unpin note' : 'Pin note'} title={draft.pinned ? 'Unpin note' : 'Pin note'}>{draft.pinned ? '◆' : '⌁'}</button>
              <button className="diary-icon-btn diary-close-editor" onClick={closeEditor} aria-label="Close note" title="Close note">×</button>
            </header>

            {draft.type === 'checklist' ? <div className="diary-checklist-editor">
              {(draft.items || []).map(item => <div className="diary-check-item" key={item.id}>
                <input type="checkbox" checked={!!item.done} onChange={() => edit({ ...draft, items: (draft.items || []).map(current => current.id === item.id ? { ...current, done: !current.done } : current) })} aria-label={`Mark ${item.text} ${item.done ? 'incomplete' : 'complete'}`} />
                <span className={item.done ? 'done' : ''}>{item.text}</span>
                <button className="diary-icon-btn" onClick={() => edit({ ...draft, items: (draft.items || []).filter(current => current.id !== item.id) })} aria-label={`Remove ${item.text}`}>×</button>
              </div>)}
              {!draft.items?.length && <p className="diary-editor-hint">Add your first checklist item below.</p>}
              <form className="diary-add-item" onSubmit={addItem}><input value={newItem} onChange={event => setNewItem(event.target.value)} placeholder="Add a checklist item…" aria-label="New checklist item" required /><button className="btn">Add item</button></form>
            </div> : <>
              <div className="diary-format-toolbar" role="toolbar" aria-label="Text formatting">
                <button onClick={() => insertFormat('**', '**', 'bold text')} aria-label="Bold" title="Bold"><b>B</b></button>
                <button onClick={() => insertFormat('*', '*', 'italic text')} aria-label="Italic" title="Italic"><i>I</i></button>
                <button onClick={() => insertFormat('\n## ', '\n', 'Heading')} aria-label="Heading" title="Heading">H₂</button>
                <span />
                <button onClick={() => insertFormat('\n- ', '', 'List item')} aria-label="Bulleted list" title="Bulleted list">• ≡</button>
                <button onClick={() => insertFormat('\n1. ', '', 'List item')} aria-label="Numbered list" title="Numbered list">1. ≡</button>
                <button onClick={() => insertFormat('\n- [ ] ', '', 'Checklist item')} aria-label="Insert checklist item" title="Checklist item">☑</button>
                <button onClick={() => insertFormat('[', '](https://)', 'link text')} aria-label="Insert link" title="Insert link">↗</button>
                <button onClick={() => insertFormat('\n> ', '', 'Quote')} aria-label="Quote" title="Quote">“</button>
              </div>
              <textarea ref={bodyRef} className="diary-body" value={draft.body || ''} onChange={event => edit({ ...draft, body: event.target.value })}
                placeholder="Start writing your idea or draft…" aria-label="Note text" />
            </>}

            <footer className="diary-editor-footer">
              <label className="diary-tags"><span aria-hidden="true">◇</span><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} onBlur={() => {
                const tags = tagDraft.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12);
                if (draft && JSON.stringify(tags) !== JSON.stringify(draft.tags || [])) edit({ ...draft, tags });
              }} placeholder="Add tags, separated by commas…" aria-label="Note tags" /></label>
              <span className={'diary-save-status' + (saveError ? ' error' : '')} role="status" aria-live="polite">{saveError || (dirty ? 'Saving changes…' : hasContent(draft) ? `Saved ${updatedLabel(draft.updatedAt)}` : 'Unsaved draft')}</span>
              <button className="btn pri" onClick={saveNow}>Save note</button>
            </footer>
            {saveError && <button className="diary-retry" onClick={saveNow}>Retry saving</button>}
          </>}
        </section>
      </div>
    </div>
  );
}
