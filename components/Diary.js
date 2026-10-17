'use client';

import { useRef, useState } from 'react';
import { Empty, uid } from './ui';

const stamp = () => new Date().toISOString();
const fresh = type => ({
  id: uid(), type, title: '', body: '', items: [], updatedAt: stamp(),
});
const hasContent = note => !!(
  (note.title || '').trim() ||
  (note.type === 'checklist'
    ? (note.items || []).some(item => (item.text || '').trim())
    : (note.body || '').trim())
);
const updatedLabel = value => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not saved yet';

export default function Diary({ of, put, del }) {
  // Older versions may have saved blank records when New was clicked. Hide them without deleting stored data.
  const notes = of('diary').filter(hasContent).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [view, setView] = useState('list');
  const timer = useRef(null);

  const save = note => {
    const saved = { ...note, updatedAt: stamp() };
    put('diary', saved);
    setDraft(current => current?.id === saved.id ? saved : current);
    setDirty(false);
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
    // The timer intentionally survives navigation away from this screen, so the last keystroke is saved too.
    timer.current = setTimeout(() => {
      timer.current = null;
      if (hasContent(next)) save(next);
      else setDirty(false);
    }, 600);
  };
  const create = type => {
    flush();
    const note = fresh(type);
    setSelectedId(note.id);
    setDraft(note);
    setDirty(false);
    setNewItem('');
  };
  const select = note => {
    if (note.id === selectedId) return;
    flush();
    setSelectedId(note.id);
    setDraft(note);
    setDirty(false);
    setNewItem('');
  };
  const remove = note => {
    if (!confirm('Delete this note?')) return;
    if (note.id === selectedId) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setDraft(null); setSelectedId(null); setDirty(false);
    }
    del(note.id);
  };
  const saveAndClose = () => {
    if (!draft) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (hasContent(draft)) save(draft);
    else setDirty(false);
    setDraft(null);
    setSelectedId(null);
    setDirty(false);
    setNewItem('');
  };
  const addItem = e => {
    e.preventDefault();
    const text = newItem.trim();
    if (!draft || !text) return;
    edit({ ...draft, items: [...(draft.items || []), { id: uid(), text, done: false }] });
    setNewItem('');
  };

  return (
    <div className="diary-layout">
      <aside className="card diary-list">
        <div className="top">
          <h2 style={{ margin: 0 }}>Your notes</h2>
          <div className="diary-list-tools">
            <div className="diary-view-toggle" aria-label="Notes display format">
              <button className={'btn sm' + (view === 'list' ? ' pri' : '')} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
              <button className={'btn sm' + (view === 'grid' ? ' pri' : '')} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
            </div>
            <button className="btn sm" onClick={() => create('note')}>New note</button>
            <button className="btn sm pri" onClick={() => create('checklist')}>New checklist</button>
          </div>
        </div>
        {!notes.length && <Empty>Your saved ideas and drafts will appear here.</Empty>}
        <div className={'diary-entries ' + view}>
          {notes.map(note => (
            <div key={note.id} className={'diary-entry' + (selectedId === note.id ? ' selected' : '')}>
              <button className="diary-entry-main" onClick={() => select(note)}>
                <b>{(note.title || '').trim() || (note.type === 'checklist' ? 'Untitled checklist' : 'Untitled note')}</b>
                <span className="mut">{note.type === 'checklist' ? 'Checklist' : 'Note'} · {updatedLabel(note.updatedAt)}</span>
                <span className="diary-preview">{note.type === 'checklist'
                  ? `${(note.items || []).filter(item => item.done).length}/${(note.items || []).length} items checked`
                  : (note.body || 'No text yet').slice(0, 110)}</span>
              </button>
              <div className="diary-actions">
                <button className="btn sm" onClick={() => select(note)} aria-label="Edit note" title="Edit">Edit</button>
                <button className="btn sm" onClick={() => remove(note)} aria-label="Delete note" title="Delete">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="card diary-editor">
        {!draft ? <Empty>Select a note or create one to start writing.</Empty> : <>
          <input className="diary-title" value={draft.title || ''} onChange={e => edit({ ...draft, title: e.target.value })}
            placeholder={draft.type === 'checklist' ? 'Checklist title' : 'Note title'} aria-label="Note title" />
          <div className="mut diary-updated" aria-live="polite">
            {dirty ? 'Saving changes…' : hasContent(draft) ? `Last updated ${updatedLabel(draft.updatedAt)}` : 'Empty drafts are not saved.'}
          </div>
          <div className="diary-save-row">
            <button className="btn pri" onClick={saveAndClose}>Save</button>
          </div>
          {draft.type === 'checklist' ? <>
            {(draft.items || []).map(item => <div className="row" key={item.id}>
              <input type="checkbox" checked={!!item.done} onChange={() => edit({ ...draft, items: (draft.items || []).map(x => x.id === item.id ? { ...x, done: !x.done } : x) })} />
              <span className={'g ' + (item.done ? 'done' : '')}>{item.text}</span>
              <button className="x" onClick={() => edit({ ...draft, items: (draft.items || []).filter(x => x.id !== item.id) })} aria-label="Remove checklist item">×</button>
            </div>)}
            {!draft.items?.length && <Empty>Add checklist items below.</Empty>}
            <form onSubmit={addItem}>
              <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add a checklist item…" required />
              <button className="btn pri">Add item</button>
            </form>
          </> : <textarea className="diary-body" value={draft.body || ''} onChange={e => edit({ ...draft, body: e.target.value })}
              placeholder="Start writing your idea or draft…" aria-label="Note text" />}
        </>}
      </section>
    </div>
  );
}
