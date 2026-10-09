import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Database, AlertCircle, Moon } from 'lucide-react';
import apiClient from '../services/apiClient';

const PING_INTERVAL_MS = 60 * 1000; // also keeps the free-tier server from sleeping while the app is open
const COLD_START_TIMEOUT_MS = 45 * 1000; // Render free tier can take ~30s to wake

const VIEWS = {
  checking: { cls: 'bg-slate-50 border-slate-200 text-slate-600', Icon: RefreshCw, label: 'Checking…' },
  waking: { cls: 'bg-amber-50 border-amber-200 text-amber-800', Icon: Moon, label: 'Waking server…' },
  online: { cls: 'bg-emerald-50 border-emerald-300 text-emerald-800', Icon: Database, label: 'DB Connected' },
  offline: { cls: 'bg-red-50 border-red-200 text-red-800', Icon: AlertCircle, label: 'Offline mode' },
};

export default function OnlineStatus() {
  // 'checking' | 'waking' | 'online' | 'offline'
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [busy, setBusy] = useState(false);
  const everOnline = useRef(false);

  const checkBackend = useCallback(async () => {
    setBusy(true);
    const started = performance.now();
    // First check (or after an outage) uses a long timeout so a cold start isn't reported as "offline".
    const slowTimer = everOnline.current
      ? null
      : setTimeout(() => setStatus((s) => (s === 'checking' ? 'waking' : s)), 3000);
    try {
      await apiClient.request('/health', {
        timeoutMs: everOnline.current ? 5000 : COLD_START_TIMEOUT_MS,
      });
      everOnline.current = true;
      setLatency(Math.round(performance.now() - started));
      setError(null);
      setStatus('online');
    } catch (err) {
      everOnline.current = false;
      setError(err.message);
      setStatus('offline');
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(() => {
      if (!document.hidden) checkBackend();
    }, PING_INTERVAL_MS);
    const onVisible = () => !document.hidden && checkBackend();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkBackend);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkBackend);
    };
  }, [checkBackend]);

  const { cls, Icon, label } = VIEWS[status];
  const title =
    status === 'offline' && error
      ? error
      : status === 'waking'
        ? 'Free-tier server is starting up, this can take up to 30 seconds'
        : undefined;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cls}`} role="status" title={title}>
      <Icon className={`w-4 h-4 ${status === 'checking' ? 'animate-spin' : ''} ${status === 'waking' ? 'animate-pulse' : ''}`} />
      <div className="leading-tight hidden sm:block">
        <p className="font-medium text-xs flex items-center gap-1.5 whitespace-nowrap">
          {label}
          {status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </p>
        {status === 'online' && latency != null && <p className="text-[10px] opacity-80">{latency} ms</p>}
        {status === 'offline' && <p className="text-[10px] opacity-80">Using local data</p>}
      </div>
      <button
        onClick={checkBackend}
        disabled={busy}
        className="p-1 rounded hover:bg-black/5 disabled:opacity-50"
        aria-label="Refresh connection"
      >
        <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
