'use client';

import { Icon } from './ui';

const Card = ({ icon, title, description, onClick }) => (
  <button className="module-card" onClick={onClick}>
    <Icon n={icon} />
    <b>{title}</b>
    <span>{description}</span>
    <i aria-hidden="true">›</i>
  </button>
);

const MoreLink = ({ icon, title, description, onClick }) => (
  <button className="module-link" onClick={onClick}>
    <Icon n={icon} />
    <span><b>{title}</b><small>{description}</small></span>
    <i aria-hidden="true">›</i>
  </button>
);

export function WorkHub({ go }) {
  return (
    <div className="module-hub">
      <h2>Good to see you at work</h2>
      <p className="mut">Your tasks, plans, and working notes in one place.</p>
      <div className="module-grid">
        <Card icon="cal" title="Calendar & tasks" description="Plan your days and track tasks." onClick={() => go('cal')} />
        <Card icon="diary" title="Diary / Notes" description="Draft ideas and keep checklists." onClick={() => go('diary')} />
        <Card icon="goals" title="Goals" description="Track weekly, monthly, and annual goals." onClick={() => go('goals')} />
      </div>
    </div>
  );
}

export function ClientsHub({ go }) {
  return (
    <div className="module-hub">
      <h2>Clients</h2>
      <p className="mut">Manage client work and see the related sales ledger.</p>
      <div className="module-grid">
        <Card icon="proj" title="Engagements" description="Projects, ongoing services, and deliverables." onClick={() => go('proj')} />
        <Card icon="money" title="Sales" description="View and record client payments." onClick={() => go('money', 'sales')} />
      </div>
    </div>
  );
}

export function MoreHub({ go }) {
  return (
    <div className="module-hub">
      <h2>More</h2>
      <p className="mut">Preferences and account options.</p>
      <h3 className="module-group-title">Preferences</h3>
      <div className="module-link-list">
        <MoreLink icon="set" title="Settings" description="Currency, backups, and sign out." onClick={() => go('set')} />
      </div>
    </div>
  );
}
