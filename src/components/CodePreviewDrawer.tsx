import React, { useEffect, useMemo, useState } from 'react';

export interface PreviewArtifact {
  id: string;
  title: string;
  language: string;
  code: string;
  updatedAt: number;
}

interface ConsoleEntry {
  id: string;
  level: 'log' | 'warn' | 'error';
  text: string;
  time: string;
}

interface CodePreviewDrawerProps {
  artifact: PreviewArtifact | null;
  onUpdateCode: (nextCode: string) => void;
  onOpenInCodeStudio: (wrappedHtml: string) => void;
  onAskAiToFix: (promptText: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onClose: () => void;
}

type PreviewTab = 'preview' | 'code' | 'console';
type ViewportMode = 'desktop' | 'tablet' | 'mobile';

function injectConsoleBridge(html: string, instanceId: string): string {
  const bridgeScript = `<script>
(function(){
  var SIGMA_ID = ${JSON.stringify(instanceId)};
  function emit(level, args) {
    try {
      var msg = Array.prototype.slice.call(args).map(function(a) {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object' && a !== null) {
          try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ source: 'sigma-preview-console', instanceId: SIGMA_ID, level: level, text: msg }, '*');
    } catch (e) {}
  }
  var origLog = console.log, origWarn = console.warn, origErr = console.error;
  console.log = function() { emit('log', arguments); if (origLog) origLog.apply(console, arguments); };
  console.warn = function() { emit('warn', arguments); if (origWarn) origWarn.apply(console, arguments); };
  console.error = function() { emit('error', arguments); if (origErr) origErr.apply(console, arguments); };
  window.addEventListener('error', function(ev) {
    emit('error', [ev.message + (ev.lineno ? ' (Satır ' + ev.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function(ev) {
    emit('error', ['Promise Hatası: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason))]);
  });
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridgeScript}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${bridgeScript}\n${m}`);
  }
  return `${bridgeScript}\n${html}`;
}

export function buildArtifactSrcDoc(code: string, language: string, instanceId = 'sigma'): string {
  const lang = (language || 'html').toLowerCase().trim();
  const trimmed = code.trim();

  if (lang === 'html' || lang === 'htm' || /^<!doctype\s+html|^<html\b/i.test(trimmed)) {
    return injectConsoleBridge(code, instanceId);
  }

  if (lang === 'css') {
    return injectConsoleBridge(
      `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>${code}</style>
</head>
<body style="margin:0;padding:24px;font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;">
  <div class="card box container panel sigma-glass-card">
    <h2>CSS Canlı Önizleme</h2>
    <p>Oluşturulan stil kuralları bu alan üzerinde canlı olarak uygulanır.</p>
    <button type="button">Örnek Eylem</button>
  </div>
</body>
</html>`,
      instanceId
    );
  }

  if (lang === 'svg' || /^<svg\b/i.test(trimmed)) {
    return injectConsoleBridge(
      `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;">
  ${code}
</body>
</html>`,
      instanceId
    );
  }

  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
    const cleanedJsx = code
      .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, 'function $1')
      .replace(/export\s+default\s+([A-Za-z0-9_]+);?/, '')
      .replace(/export\s+/g, '');

    const compMatch = cleanedJsx.match(/function\s+([A-Z][A-Za-z0-9_]*)|const\s+([A-Z][A-Za-z0-9_]*)\s*=/);
    const compName = compMatch ? compMatch[1] || compMatch[2] : 'App';

    return injectConsoleBridge(
      `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4">
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    ${cleanedJsx}
    try {
      const rootEl = document.getElementById('root');
      const Target = typeof ${compName} !== 'undefined' ? ${compName} : () => React.createElement('div', null, 'Bileşen yüklenemedi.');
      ReactDOM.createRoot(rootEl).render(React.createElement(Target));
    } catch (err) {
      console.error(err.message || err);
    }
  </script>
</body>
</html>`,
      instanceId
    );
  }

  // JavaScript / TypeScript konsol çalıştırıcısı
  return injectConsoleBridge(
    `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 20px; background: #0b1120; color: #e2e8f0; font-family: ui-monospace, monospace; }
    h4 { margin: 0 0 12px; color: #38bdf8; font-family: system-ui, sans-serif; font-size: 14px; }
    pre { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; white-space: pre-wrap; font-size: 12px; line-height: 1.55; margin: 0; }
    .err { color: #fda4af; }
  </style>
</head>
<body>
  <h4>JavaScript Çalışma Çıktısı</h4>
  <pre id="console-out"></pre>
  <script>
    const outEl = document.getElementById('console-out');
    const writeLine = (tag, args) => {
      const txt = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
      outEl.textContent += (tag ? tag + ' ' : '') + txt + '\\n';
    };
    const prevLog = console.log, prevErr = console.error, prevWarn = console.warn;
    console.log = (...a) => { writeLine('', a); prevLog(...a); };
    console.warn = (...a) => { writeLine('[UYARI]', a); prevWarn(...a); };
    console.error = (...a) => { writeLine('[HATA]', a); prevErr(...a); };
    try {
      ${code}
      if (!outEl.textContent.trim()) {
        outEl.textContent = '(Kod hatasız çalıştı — çıktı üretmek için console.log(...) kullanabilirsiniz.)';
      }
    } catch (err) {
      writeLine('[İSTİSNA]', [err && err.message ? err.message : String(err)]);
    }
  </script>
</body>
</html>`,
    instanceId
  );
}

export const CodePreviewDrawer: React.FC<CodePreviewDrawerProps> = ({
  artifact,
  onUpdateCode,
  onOpenInCodeStudio,
  onAskAiToFix,
  onNotify,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [draftCode, setDraftCode] = useState('');
  const [runNonce, setRunNonce] = useState(0);
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);

  useEffect(() => {
    if (artifact) {
      setDraftCode(artifact.code);
      setLogs([]);
      setRunNonce((n) => n + 1);
    }
  }, [artifact?.id, artifact?.updatedAt]);

  useEffect(() => {
    if (!artifact) return;
    const handleMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || d.source !== 'sigma-preview-console' || d.instanceId !== artifact.id) return;
      const now = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setLogs((prev) => [
        ...prev.slice(-79),
        {
          id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          level: d.level === 'error' ? 'error' : d.level === 'warn' ? 'warn' : 'log',
          text: String(d.text || ''),
          time: now
        }
      ]);
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [artifact?.id]);

  const errorLogs = useMemo(() => logs.filter((l) => l.level === 'error'), [logs]);
  const lineCount = useMemo(() => (draftCode ? draftCode.split('\n').length : 0), [draftCode]);

  if (!artifact) return null;

  const srcDoc = buildArtifactSrcDoc(draftCode, artifact.language, artifact.id);
  const isDirty = draftCode !== artifact.code;

  const handleApplyDraft = () => {
    onUpdateCode(draftCode);
    setLogs([]);
    setRunNonce((n) => n + 1);
    setActiveTab('preview');
    onNotify('Önizleme güncellendi.', 'success');
  };

  const handleDownload = () => {
    const blob = new Blob([srcDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigma-preview-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('HTML önizleme dosyası indirildi.', 'success');
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(draftCode)
      .then(() => onNotify('Kod panoya kopyalandı.', 'success'))
      .catch(() => onNotify('Kopyalama izni reddedildi.', 'error'));
  };

  return (
    <aside
      aria-label="Canlı Kod Önizleme Paneli"
      className="fixed inset-0 z-50 lg:static lg:z-auto w-full lg:w-[46%] xl:w-[48%] shrink-0 h-full flex flex-col border-l border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md safe-pt safe-pb"
    >
      {/* Üst Başlık & Kontroller */}
      <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" />
            <span>Sohbet</span>
          </button>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {artifact.title}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono uppercase">{artifact.language || 'html'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{lineCount} satır</span>
              {errorLogs.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    {errorLogs.length} hata
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setLogs([]);
              setRunNonce((n) => n + 1);
            }}
            title="Önizlemeyi Yenile"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-rotate-right text-xs" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Kodu Kopyala"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-regular fa-copy text-xs" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="HTML Olarak İndir"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-download text-xs" />
          </button>

          <button
            type="button"
            onClick={() => onOpenInCodeStudio(srcDoc)}
            title="Tam Kod Stüdyosunda Aç"
            className="px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-expand text-[10px]" />
            <span className="hidden sm:inline">Stüdyo</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Önizleme Panelini Kapat"
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
      </div>

      {/* Alt Kontrol Çubuğu: Sekmeler + Cihaz Boyutu */}
      <div className="shrink-0 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
          {[
            { id: 'preview' as PreviewTab, label: 'Önizleme', icon: 'fa-play' },
            { id: 'code' as PreviewTab, label: 'Kod', icon: 'fa-code' },
            {
              id: 'console' as PreviewTab,
              label: logs.length > 0 ? `Konsol (${logs.length})` : 'Konsol',
              icon: 'fa-terminal'
            }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <i className={`fa-solid ${t.icon} text-[10px]`} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'preview' && (
          <div className="flex items-center gap-1">
            {[
              { id: 'desktop' as ViewportMode, icon: 'fa-desktop', title: 'Masaüstü (%100)' },
              { id: 'tablet' as ViewportMode, icon: 'fa-tablet-screen-button', title: 'Tablet (768px)' },
              { id: 'mobile' as ViewportMode, icon: 'fa-mobile-screen-button', title: 'Mobil (375px)' }
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                title={v.title}
                onClick={() => setViewport(v.id)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs cursor-pointer transition-colors ${
                  viewport === v.id
                    ? 'sigma-accent-bg text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <i className={`fa-solid ${v.icon}`} />
              </button>
            ))}
          </div>
        )}

        {activeTab === 'code' && (
          <button
            type="button"
            onClick={handleApplyDraft}
            className="px-3 py-1 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
          >
            <i className="fa-solid fa-play mr-1.5 text-[10px]" />
            {isDirty ? 'Değişikliği Çalıştır' : 'Önizlemede Aç'}
          </button>
        )}
      </div>

      {/* İçerik Alanı */}
      <div className="flex-1 min-h-0 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="flex-1 min-h-0 flex items-stretch justify-center p-2 sm:p-3 overflow-auto">
            <div
              className="h-full bg-white rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-200 flex flex-col"
              style={{
                width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
                maxWidth: '100%'
              }}
            >
              <iframe
                key={`${artifact.id}_${runNonce}`}
                title={artifact.title}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-modals"
                className="w-full h-full flex-1 bg-white"
              />
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <textarea
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            spellCheck={false}
            aria-label="Önizleme Kodu Düzenleyici"
            className="flex-1 w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none"
          />
        )}

        {activeTab === 'console' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs bg-slate-950 text-slate-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="text-[11px] font-sans font-semibold text-slate-400">
                Canlı Çalışma Zamanı Konsolu
              </span>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[11px] font-sans text-slate-400 hover:text-white cursor-pointer"
              >
                Temizle
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="py-10 text-center font-sans text-xs text-slate-500">
                Henüz console.log veya çalışma zamanı hatası yok.
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`px-2.5 py-1.5 rounded-lg border ${
                    entry.level === 'error'
                      ? 'border-rose-800 bg-rose-950/60 text-rose-200'
                      : entry.level === 'warn'
                      ? 'border-amber-800 bg-amber-950/50 text-amber-200'
                      : 'border-slate-800 bg-slate-900 text-slate-200'
                  }`}
                >
                  <span className="text-slate-500 mr-2">[{entry.time}]</span>
                  <span className="whitespace-pre-wrap break-words">{entry.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Alt Akıllı Eylem Şeridi */}
      <div className="shrink-0 px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 text-xs">
        {errorLogs.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              onAskAiToFix(
                `Önizlemede şu çalışma zamanı hatası oluştu:\n\`${errorLogs[errorLogs.length - 1].text}\`\n\nLütfen aşağıdaki kodu hatayı düzelterek tekrar yaz:\n\`\`\`${artifact.language || 'html'}\n${draftCode}\n\`\`\``
              )
            }
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-wrench text-[11px]" />
            <span>Hatayı AI ile Düzelt</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onAskAiToFix(
                `Mevcut kodu daha modern tasarım ve ekstra özelliklerle geliştir:\n\`\`\`${artifact.language || 'html'}\n${draftCode}\n\`\`\``
              )
            }
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-wand-magic-sparkles sigma-accent-text text-[11px]" />
            <span>AI ile Geliştir</span>
          </button>
        )}

        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          Güvenli Sandbox · Canlı Önizleme
        </span>
      </div>
    </aside>
  );
};
