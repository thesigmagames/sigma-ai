import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { generateHybridAiReply, LOCAL_MODELS, PERSONA_META } from '../services/localAiEngine';
import type { AiEngineMode, AppLanguage, CustomApiConfig, Persona } from '../types/chat';

interface CompareStudioProps {
  selectedModelId: string;
  customApi: CustomApiConfig;
  language: AppLanguage;
  onSendToChat: (prompt: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CompareResult {
  text: string;
  engineUsed: string;
  latencyMs: number;
}

export const CompareStudio: React.FC<CompareStudioProps> = ({
  selectedModelId,
  customApi,
  language,
  onSendToChat,
  onNotify
}) => {
  const [prompt, setPrompt] = useState(
    'Bağımsız bir 2D platform oyunu geliştirirken dikkat edilmesi gereken en kritik 5 kuralı özetle.'
  );
  const [engineA, setEngineA] = useState<AiEngineMode>('gemini');
  const [personaA, setPersonaA] = useState<Persona>('coder');
  const [engineB, setEngineB] = useState<AiEngineMode>('local');
  const [personaB, setPersonaB] = useState<Persona>('grok');

  const [isRunning, setIsRunning] = useState(false);
  const [resultA, setResultA] = useState<CompareResult | null>(null);
  const [resultB, setResultB] = useState<CompareResult | null>(null);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);

  const activeModel = LOCAL_MODELS.find((m) => m.id === selectedModelId) || LOCAL_MODELS[0];

  const handleRunCompare = async () => {
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    setWinner(null);

    try {
      const [resA, resB] = await Promise.all([
        generateHybridAiReply({
          userInput: prompt.trim(),
          history: [],
          systemPrompt: `Sen ${PERSONA_META[personaA].title} modundasın.`,
          persona: personaA,
          language,
          deepThinking: false,
          webSearch: false,
          responseLength: 'normal',
          engineMode: engineA,
          model: activeModel,
          customApi
        }),
        generateHybridAiReply({
          userInput: prompt.trim(),
          history: [],
          systemPrompt: `Sen ${PERSONA_META[personaB].title} modundasın.`,
          persona: personaB,
          language,
          deepThinking: false,
          webSearch: false,
          responseLength: 'normal',
          engineMode: engineB,
          model: activeModel,
          customApi
        })
      ]);

      setResultA({ text: resA.text, engineUsed: resA.engineUsed, latencyMs: resA.latencyMs });
      setResultB({ text: resB.text, engineUsed: resB.engineUsed, latencyMs: resB.latencyMs });
      onNotify('Yan yana karşılaştırma tamamlandı.', 'success');
    } catch {
      onNotify('Karşılaştırma sırasında hata oluştu.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Yan Yana AI Model & Persona Karşılaştırma
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aynı istemi iki farklı motor veya karakter ayarıyla eşzamanlı çalıştırıp hız ve kaliteyi kıyaslayın.
              </p>
            </div>
            <button
              type="button"
              disabled={isRunning || !prompt.trim()}
              onClick={() => void handleRunCompare()}
              className="px-4 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <i className={`fa-solid ${isRunning ? 'fa-spinner fa-spin' : 'fa-code-compare'} mr-1.5`} />
              {isRunning ? 'Karşılaştırılıyor...' : 'Eşzamanlı Çalıştır'}
            </button>
          </div>

          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="İki modelin aynı anda yanıtlamasını istediğiniz istemi yazın..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">A Sütunu:</span>
              <select
                value={engineA}
                onChange={(e) => setEngineA(e.target.value as AiEngineMode)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1"
              >
                <option value="gemini">Gemini Bulut</option>
                <option value="hybrid">Hibrit Motor</option>
                <option value="local">API’siz Yerel</option>
              </select>
              <select
                value={personaA}
                onChange={(e) => setPersonaA(e.target.value as Persona)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1"
              >
                {(Object.keys(PERSONA_META) as Persona[]).map((p) => (
                  <option key={p} value={p}>{PERSONA_META[p].title}</option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-2">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">B Sütunu:</span>
              <select
                value={engineB}
                onChange={(e) => setEngineB(e.target.value as AiEngineMode)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1"
              >
                <option value="local">API’siz Yerel</option>
                <option value="gemini">Gemini Bulut</option>
                <option value="hybrid">Hibrit Motor</option>
              </select>
              <select
                value={personaB}
                onChange={(e) => setPersonaB(e.target.value as Persona)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1"
              >
                {(Object.keys(PERSONA_META) as Persona[]).map((p) => (
                  <option key={p} value={p}>{PERSONA_META[p].title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Yan Yana Çıktı Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { key: 'A' as const, res: resultA, engine: engineA, persona: personaA },
            { key: 'B' as const, res: resultB, engine: engineB, persona: personaB }
          ].map((col) => (
            <div
              key={col.key}
              className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[340px] ${
                winner === col.key
                  ? 'border-emerald-500 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                      Model {col.key}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {PERSONA_META[col.persona].title}
                    </span>
                  </div>
                  {col.res && (
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {(col.res.latencyMs / 1000).toFixed(2)}s · {col.res.engineUsed}
                    </span>
                  )}
                </div>

                {isRunning ? (
                  <div className="py-16 text-center text-xs text-slate-500 space-y-2">
                    <i className="fa-solid fa-spinner fa-spin text-lg text-blue-600" />
                    <div>Yanıt üretiliyor...</div>
                  </div>
                ) : col.res ? (
                  <div className="text-sm">
                    <MarkdownRenderer content={col.res.text} />
                  </div>
                ) : (
                  <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                    Karşılaştırmayı başlatmak için yukarıdaki "Eşzamanlı Çalıştır" butonuna tıklayın.
                  </div>
                )}
              </div>

              {col.res && (
                <div className="pt-3 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWinner(col.key);
                      onNotify(`Model ${col.key} kazanan olarak işaretlendi!`, 'success');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      winner === col.key
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <i className="fa-solid fa-trophy mr-1.5" />
                    {winner === col.key ? 'Kazanan Seçildi' : 'Daha İyi'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSendToChat(col.res!.text)}
                    className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                  >
                    Sohbete Aktar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
