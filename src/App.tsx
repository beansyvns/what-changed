import { useEffect, useState } from 'react';
import { getPack } from '../shared/packs/index';
import type { PackId } from '../shared/packs/types';
import { getStatus, type AiStatus } from './lib/api';
import { LogoMark } from './components/Logo';
import { newSession, type Session } from './lib/session';
import { ReportView } from './views/Report';
import { StartView } from './views/Start';
import { WorkspaceView } from './views/Workspace';

type View = 'start' | 'workspace' | 'report';

export default function App() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [view, setView] = useState<View>('start');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const start = (pack: PackId, params: unknown, source: Session['source']) => {
    setSession(newSession(pack, params, source));
    setView('workspace');
  };
  const setS = (fn: (s: Session) => Session) => setSession((prev) => (prev ? fn(prev) : prev));

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView('start')} aria-label="What Changed? — home">
          <LogoMark className="logo" size={34} />
          <span className="wordmark">
            What <em>changed?</em>
          </span>
        </button>
        <ModeBadge status={status} />
      </header>
      <main id="main">
        {view === 'start' && <StartView status={status} onStart={start} />}
        {view === 'workspace' && session && <WorkspaceView s={session} setS={setS} onReport={() => setView('report')} onExit={() => setView('start')} />}
        {view === 'report' && session && (
          <ReportView
            s={session}
            setS={setS}
            onHarder={() => start(session.packId, getPack(session.packId)!.harder, 'harder')}
            onRestart={() => setView('start')}
          />
        )}
      </main>
      <footer className="footer">
        <span>Built for the CSC Back-to-School Hackathon.</span>
        <span>
          {status?.mode === 'live'
            ? `AI: ${status.provider} (${status.model}). Answers are always checked by the app, not the AI.`
            : 'Demo mode: no AI calls. Guidance comes from checked rules.'}
        </span>
      </footer>
    </div>
  );
}

function ModeBadge({ status }: { status: AiStatus | null }) {
  if (!status) return <span className="mode-badge">Checking AI…</span>;
  if (status.mode === 'live')
    return (
      <span className="mode-badge live" title={`Your typed text is sent to ${status.provider} to read your method. No personal info is collected.`}>
        AI on · {status.model}
      </span>
    );
  return (
    <span className="mode-badge demo" title={`No AI calls are made${status.reason ? ` (${status.reason})` : ''}. Guidance comes from the app’s checked rules.`}>
      Demo mode · no AI calls
    </span>
  );
}
