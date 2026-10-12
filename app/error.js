'use client';

export default function Error({ reset }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <span className="logo big">W</span>
        <h1>Something went wrong</h1>
        <p className="mut">WorkHub could not load. This is usually a connection problem.</p>
        <button className="btn pri wide" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
