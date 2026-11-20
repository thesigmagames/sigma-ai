import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getApiBaseUrl } from '../services/localAiEngine';

interface DebateTurn {
  id: string;
  speaker: string;
  side: 'A' | 'B';
  text: string;
  time: string;
}

interface DebateStudioProps {
  onSendToChat: (text: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DebateStudio: React.FC<DebateStudioProps> = ({ onSendToChat, onNotify }) => {
  const [topic, setTopic] = useState('Yapay zeka gelecekte oyun geliştiricilerinin yerini alacak mı?');
  const [personaA, setPersonaA] = useState('Teknoloji İyimseri');
  const [personaB, setPersonaB] = useState('Geleneksel Tasarımcı');
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [nextSide, setNextSide] = useState<'A' | 'B'>('A');
  const [isLoading, setIsLoading] = useState(false);

  const runNextTurn = async () => {
    if (!topic.trim() || isLoading) return;
    setIsLoading(true);
    const activeSide = nextSide;
    const round = Math.floor(turns.length / 2) + 1;
    const fallbackSpeaker = activeSide === 'A' ? personaA : personaB;
    const opponentSpeaker = activeSide === 'A' ? personaB : personaA;

    let speaker = fallbackSpeaker;
    let reply = '';

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/debate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          personaA,
          personaB,
          activeAgent: activeSide,
          history: turns.map((t) => ({ speaker: t.speaker, text: t.text })),
          round
        })
      });
      const data = await res.json();
      speaker = data?.speaker || fallbackSpeaker;
      reply = data?.reply || '';
    } catch {
      // Statik Web Modu yerel münazara sentezi
    }

    if (!reply) {
      reply =
        activeSide === 'A'
          ? `**${topic}** konusunda **${speaker}** olarak duruşum nettir (Tur ${round}):\n\n- **Yenilik Avantajı:** Modern araçlar geliştirme döngülerini hızlandırarak küçük ekiplerin bile dev projeler üretmesini sağlar.\n- **Karşı Tez (${opponentSpeaker}'e):** Değişimi durdurmaya çalışmak yerine yeni araçlara yön vermek kazandırır.`
          : `**${topic}** konusunda **${speaker}** açısından bakıldığında (Tur ${round}):\n\n- **İnsan İmzası:** Özgün sanat yönetimi, duygusal ritim ve oyuncu psikolojisi yalnızca otomasyonla taklit edilemez.\n- **Kritik Soru (${opponentSpeaker}'e):** Herkes aynı yapay kalıpları kullanırsa özgünlük nasıl korunacak?`;
    }

    setTurns((prev) => [
      ...prev,
      {
        id: `turn_${Date.now()}`,
        speaker,
        side: activeSide,
        text: reply,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setNextSide(activeSide === 'A' ? 'B' : 'A');
    setIsLoading(false);
    onNotify(`${speaker} turunu tamamladı.`, 'info');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Çoklu Ajan Münazara Arenası
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                İki farklı yapay zeka karakterini belirlediğiniz konu üzerinde tur tur tartıştırın.
              </p>
            </div>
            {turns.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSendToChat(
                      `"${topic}" konulu şu münazarayı özetle ve kazanan argümanları değerlendir:\n\n` +
                        turns.map((t) => `${t.speaker}: ${t.text}`).join('\n\n')
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Sohbette Özetle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTurns([]);
                    setNextSide('A');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  Temizle
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Ajan A (Savunan)
              </label>
              <input
                type="text"
                value={personaA}
                onChange={(e) => setPersonaA(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Ajan B (Karşı Tez)
              </label>
              <input
                type="text"
                value={personaB}
                onChange={(e) => setPersonaB(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Münazara Konusu
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={runNextTurn}
                disabled={isLoading || !topic.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : 'fa-comments'} mr-1.5`} />
                {isLoading ? 'Düşünüyor...' : `${nextSide === 'A' ? personaA : personaB} Konuşsun`}
              </button>
            </div>
          </div>
        </div>

        {/* Münazara Turları */}
        <div className="space-y-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold ${turn.side === 'A' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {turn.speaker}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{turn.time}</span>
              </div>
              <MarkdownRenderer content={turn.text} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
