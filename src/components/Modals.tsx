import React, { useState, useEffect } from 'react';
import {
  LOCAL_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  buildExportPayload
} from '../services/localAiEngine';
import type {
  AccentTheme,
  AiEngineMode,
  AntigravityIntensity,
  AppLanguage,
  ChatSession,
  CustomApiConfig,
  ExportFormat,
  ModelStatus,
  UserProfile
} from '../types/chat';

/* ============================================================================
 * 1. AYARLAR MODALI (Motor Modu, System Prompt, Model, Tema Paketi, Ses, API)
 * ========================================================================== */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChat: ChatSession;
  onUpdateSystemPrompt: (prompt: string) => void;
  onUpdateChatLanguage: (lang: AppLanguage) => void;
  engineMode: AiEngineMode;
  onChangeEngineMode: (mode: AiEngineMode) => void;
  selectedModelId: string;
  modelStatus: ModelStatus;
  modelProgress: number;
  modelStage: string;
  onLoadModel: (modelId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  accentTheme: AccentTheme;
  onChangeAccentTheme: (theme: AccentTheme) => void;
  bgEffectIntensity: AntigravityIntensity;
  onChangeBgEffectIntensity: (val: AntigravityIntensity) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  customApi: CustomApiConfig;
  onSaveCustomApi: (cfg: CustomApiConfig) => void;
  onRequestClearAll: () => void;
}

const SYSTEM_PROMPT_PRESETS = [
  { label: 'Genel Asistan', value: DEFAULT_SYSTEM_PROMPT },
  {
    label: 'Yazılım & Kodlama',
    value: 'Sen kıdemli bir yazılım mimarısın. Temiz, hatasız, modern kod örnekleri ve mimari çözümler sun.'
  },
  {
    label: 'Kısa & Net',
    value: 'Yanıtlarını mümkün olduğunca kısa, öz ve doğrudan sonuca yönelik madde imleriyle ver.'
  },
  {
    label: 'English Tutor',
    value: 'Respond only in English. Help the user improve grammar and vocabulary with clear examples.'
  }
];

const ACCENT_OPTIONS: Array<{ id: AccentTheme; label: string; hex: string }> = [
  { id: 'cobalt', label: 'Sigma Kobalt', hex: '#2563eb' },
  { id: 'emerald', label: 'Zümrüt Terminal', hex: '#059669' },
  { id: 'amber', label: 'Kehribar Stüdyo', hex: '#d97706' },
  { id: 'amethyst', label: 'Ametist Gece', hex: '#7c3aed' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentChat,
  onUpdateSystemPrompt,
  onUpdateChatLanguage,
  engineMode,
  onChangeEngineMode,
  selectedModelId,
  modelStatus,
  modelProgress,
  modelStage,
  onLoadModel,
  isDark,
  onToggleTheme,
  accentTheme,
  onChangeAccentTheme,
  bgEffectIntensity,
  onChangeBgEffectIntensity,
  soundEnabled,
  onToggleSound,
  customApi,
  onSaveCustomApi,
  onRequestClearAll
}) => {
  const [promptDraft, setPromptDraft] = useState(currentChat.systemPrompt);
  const [pendingModelId, setPendingModelId] = useState(selectedModelId);
  const [apiDraft, setApiDraft] = useState<CustomApiConfig>(customApi);

  useEffect(() => {
    setPromptDraft(currentChat.systemPrompt);
  }, [currentChat.id, currentChat.systemPrompt]);

  useEffect(() => {
    setPendingModelId(selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    setApiDraft(customApi);
  }, [customApi]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-sliders sigma-accent-text" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Ayarlar, Kişiselleştirme ve AI Motoru
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Kapat"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Vurgu Tema Paketi & Arayüz Ses Efektleri */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tema Paketi & Ses Efektleri
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Çalışma alanınızın vurgu rengini ve etkileşim seslerini kişiselleştirin.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleSound}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  soundEnabled
                    ? 'sigma-accent-border sigma-accent-soft sigma-accent-text'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`} />
                <span>UI Sesleri: {soundEnabled ? 'Açık' : 'Kapalı'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeAccentTheme(opt.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-colors ${
                    accentTheme === opt.id
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: opt.hex }}
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Antigravity Kozmik Arka Plan Efektleri
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Parçacık & Aurora
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'full' as AntigravityIntensity, label: 'Tam Antigravity' },
                  { id: 'subtle' as AntigravityIntensity, label: 'Hafif (Pil Dostu)' },
                  { id: 'off' as AntigravityIntensity, label: 'Kapalı' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeBgEffectIntensity(opt.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      bgEffectIntensity === opt.id
                        ? 'sigma-accent-border sigma-accent-soft sigma-accent-text'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 2. Çalışma Motoru Seçimi */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Yapay Zeka Çalışma Modu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gemini tabanlı tam güç veya tamamen API’siz tarayıcı motoru arasında seçim yapın.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'hybrid' as AiEngineMode,
                  title: 'Hibrit (Önerilen)',
                  desc: 'Önce Gemini kullanır; kota/hata olursa API’siz yerele geçer.'
                },
                {
                  id: 'gemini' as AiEngineMode,
                  title: 'Sadece Gemini',
                  desc: 'Yalnızca sunucu tabanlı Gemini AI motorunu kullanır.'
                },
                {
                  id: 'local' as AiEngineMode,
                  title: 'API’siz Yerel',
                  desc: 'İnternet/API olmadan %100 cihazda yerel çalışır.'
                }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeEngineMode(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    engineMode === opt.id
                      ? 'sigma-accent-border sigma-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 3. Sohbete Özel System Prompt ve Dil */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="sys-prompt-box" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sohbet System Prompt ve Yanıt Dili
              </label>
              <div className="flex items-center gap-1">
                {(['tr', 'en', 'de', 'es'] as AppLanguage[]).map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    onClick={() => onUpdateChatLanguage(lng)}
                    className={`px-2 py-0.5 rounded text-xs font-mono uppercase cursor-pointer ${
                      currentChat.language === lng
                        ? 'sigma-accent-bg text-white font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SYSTEM_PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPromptDraft(preset.value);
                    onUpdateSystemPrompt(preset.value);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <textarea
              id="sys-prompt-box"
              rows={3}
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              placeholder="Yapay zekanın bu sohbette nasıl davranması gerektiğini yazın..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onUpdateSystemPrompt(promptDraft)}
                className="px-4 py-2 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
              >
                <i className="fa-solid fa-check mr-1.5" />
                Talimatı Kaydet
              </button>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 4. @xenova/transformers Yerel Model Yükleme */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sigma Ultra Reasoning Motoru &amp; Yerel Modeller
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {modelStatus === 'ready' ? 'Hazır' : modelStatus === 'loading' ? 'Yükleniyor...' : 'Beklemede'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LOCAL_MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    pendingModelId === m.id
                      ? 'sigma-accent-border sigma-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="local-model"
                    checked={pendingModelId === m.id}
                    onChange={() => setPendingModelId(m.id)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {m.shortName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">{m.sizeLabel}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {m.specialty}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {modelStatus === 'loading' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{modelStage}</span>
                  <span className="font-mono font-semibold sigma-accent-text tabular-nums">
                    %{modelProgress}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full sigma-accent-bg transition-all duration-200" style={{ width: `${modelProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={modelStatus === 'loading'}
                onClick={() => onLoadModel(pendingModelId)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <i className="fa-solid fa-microchip mr-1.5" />
                {modelStatus === 'loading' ? 'Yükleniyor...' : 'Modeli Tarayıcıya Yükle'}
              </button>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 5. Harici Özel API */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Özel API Uç Noktası (Opsiyonel Ollama / OpenAI)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kendi sunucunuz veya yerel Ollama bağlantınız varsa buradan bağlayabilirsiniz.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiDraft.enabled}
                  onChange={(e) => {
                    const next = { ...apiDraft, enabled: e.target.checked };
                    setApiDraft(next);
                    onSaveCustomApi(next);
                  }}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Aktif</span>
              </label>
            </div>

            {apiDraft.enabled && (
              <div className="grid grid-cols-1 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <input
                  type="url"
                  value={apiDraft.endpointUrl}
                  onChange={(e) => setApiDraft({ ...apiDraft, endpointUrl: e.target.value })}
                  placeholder="URL (örn: http://localhost:11434/v1/chat/completions)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={apiDraft.modelName}
                    onChange={(e) => setApiDraft({ ...apiDraft, modelName: e.target.value })}
                    placeholder="Model adı (örn: llama3)"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="password"
                    value={apiDraft.apiKey}
                    onChange={(e) => setApiDraft({ ...apiDraft, apiKey: e.target.value })}
                    placeholder="API Anahtarı (opsiyonel)"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSaveCustomApi(apiDraft)}
                    className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            )}
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 6. Tema & Sıfırlama */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <i className={`fa-solid ${isDark ? 'fa-sun text-amber-400' : 'fa-moon'} mr-1.5`} />
              {isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
            </button>

            <button
              type="button"
              onClick={onRequestClearAll}
              className="px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
            >
              <i className="fa-solid fa-trash-can mr-1.5" />
              Oturum Verilerini Sıfırla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. ÇOK SEÇENEKLİ DIŞA AKTARMA MODALI (JSON / MD / TXT / HTML + KOPYALA)
 * ========================================================================== */
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatSession[];
  activeChat: ChatSession;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  chats,
  activeChat,
  onNotify
}) => {
  const [scope, setScope] = useState<'single' | 'all'>('single');

  if (!isOpen) return null;

  const formats: Array<{ id: ExportFormat; title: string; ext: string; desc: string; icon: string }> = [
    {
      id: 'md',
      title: 'Markdown Belgesi',
      ext: '.md',
      desc: 'Başlıklar ve kod bloklarıyla GitHub/Notion uyumlu format',
      icon: 'fa-file-code'
    },
    {
      id: 'txt',
      title: 'Düz Metin',
      ext: '.txt',
      desc: 'Her cihazda açılabilen sade ve okunabilir metin dosyası',
      icon: 'fa-file-lines'
    },
    {
      id: 'json',
      title: 'JSON Yedeği',
      ext: '.json',
      desc: 'İçe aktarılabilir tam veri yedeği (mesajlar, pinler, sistem)',
      icon: 'fa-database'
    },
    {
      id: 'html',
      title: 'Web Raporu / PDF Hazır',
      ext: '.html',
      desc: 'Tarayıcıda şık açılan ve PDF olarak yazdırılabilir sayfa',
      icon: 'fa-globe'
    }
  ];

  const handleDownloadFormat = (format: ExportFormat) => {
    const { content, mimeType, extension } = buildExportPayload(
      chats,
      format,
      scope === 'single',
      activeChat
    );
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName =
      scope === 'single'
        ? activeChat.title.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, '-').slice(0, 32)
        : 'sigma-ai-tum-sohbetler';
    a.href = url;
    a.download = `${baseName || 'sigma-sohbet'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`${extension.toUpperCase()} dosyası indirildi.`, 'success');
    onClose();
  };

  const handleCopyFormat = (format: ExportFormat) => {
    const { content } = buildExportPayload(chats, format, scope === 'single', activeChat);
    navigator.clipboard
      .writeText(content)
      .then(() => {
        onNotify(`İçerik ${format.toUpperCase()} formatında panoya kopyalandı.`, 'success');
        onClose();
      })
      .catch(() => onNotify('Kopyalama başarısız oldu.', 'error'));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-file-export sigma-accent-text" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Sohbetleri Çoklu Formatta Aktar
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setScope('single')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                scope === 'single'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sadece Aktif Sohbet ({activeChat.messages.length} mesaj)
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tüm Arşiv ({chats.length} sohbet)
            </button>
          </div>

          <div className="space-y-2.5">
            {formats.map((f) => (
              <div
                key={f.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <i className={`fa-solid ${f.icon} sigma-accent-text mt-0.5`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {f.title} <span className="font-mono text-xs text-slate-500">({f.ext})</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyFormat(f.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFormat(f.id)}
                    className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                  >
                    İndir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. İSTATİSTİK MODALI
 * ========================================================================== */
interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatSession[];
  imagesCount: number;
  activeModelName: string;
  isGuest: boolean;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  chats,
  imagesCount,
  activeModelName,
  isGuest
}) => {
  if (!isOpen) return null;

  const totalChats = chats.length;
  const pinnedChats = chats.filter((c) => c.pinned).length;
  const totalMessages = chats.reduce((acc, c) => acc + c.messages.length, 0);
  const userMessages = chats.reduce((acc, c) => acc + c.messages.filter((m) => m.role === 'user').length, 0);
  const aiMessages = chats.reduce((acc, c) => acc + c.messages.filter((m) => m.role === 'assistant').length, 0);
  const likedMessages = chats.reduce((acc, c) => acc + c.messages.filter((m) => m.reaction === 'like').length, 0);
  const totalWords = chats.reduce(
    (acc, c) => acc + c.messages.reduce((mAcc, m) => mAcc + (m.text.trim() ? m.text.trim().split(/\s+/).length : 0), 0),
    0
  );
  const estTokens = Math.round(totalWords * 1.35);
  const storageKb = (new Blob([JSON.stringify(chats)]).size / 1024).toFixed(1);

  const items = [
    { label: 'Toplam Sohbet', value: totalChats, icon: 'fa-comments' },
    { label: 'Sabitlenmiş Sohbet', value: pinnedChats, icon: 'fa-thumbtack' },
    { label: 'Toplam Mesaj', value: totalMessages, icon: 'fa-message' },
    { label: 'Kullanıcı / AI', value: `${userMessages} / ${aiMessages}`, icon: 'fa-code-compare' },
    { label: 'Toplam Kelime', value: totalWords, icon: 'fa-font' },
    { label: 'Tahmini Token', value: estTokens, icon: 'fa-microchip' },
    { label: 'Beğenilen Yanıt', value: likedMessages, icon: 'fa-thumbs-up' },
    { label: 'Üretilen Görsel', value: imagesCount, icon: 'fa-image' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-chart-simple sigma-accent-text" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Kullanım İstatistikleri
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{item.label}</span>
                  <i className={`fa-solid ${item.icon}`} />
                </div>
                <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Aktif Motor: <strong className="text-slate-900 dark:text-slate-200">{activeModelName}</strong></span>
            <span className="font-mono tabular-nums">
              {isGuest ? 'Misafir Bellek (Kaydedilmez)' : `Hesap Alanı: ${storageKb} KB`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. HİBRİT KİMLİK DOĞRULAMA MODALI (Google + Apple + E-posta/Şifre Kayıt & Giriş)
 * ========================================================================== */
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  hasGuestMessages: boolean;
  onGoogleAuth: (carryGuestChats: boolean) => Promise<void>;
  onAppleAuth: (
    carryGuestChats: boolean,
    fallbackForm?: { name: string; email: string; avatarColor: string }
  ) => Promise<void>;
  onEmailLogin: (email: string, password: string, carryGuestChats: boolean) => Promise<void>;
  onEmailRegister: (
    name: string,
    email: string,
    password: string,
    avatarColor: string,
    carryGuestChats: boolean
  ) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<{
    deliveryMode: 'email' | 'simulated_inbox';
    previewCode?: string;
    firebaseEmailSent: boolean;
    expiresInSeconds: number;
  }>;
  onConfirmPasswordReset: (params: {
    email: string;
    code: string;
    newPassword: string;
  }) => Promise<{ note: string }>;
  onUpdateProfile: (name: string, avatarColor: string) => void;
  onLogout: () => Promise<void>;
}

const AVATAR_COLORS = ['#2563eb', '#059669', '#7c3aed', '#db2777', '#d97706'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  hasGuestMessages,
  onGoogleAuth,
  onAppleAuth,
  onEmailLogin,
  onEmailRegister,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  onUpdateProfile,
  onLogout
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [showAppleForm, setShowAppleForm] = useState(false);

  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [carryGuest, setCarryGuest] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  // Şifremi Unuttum (6 haneli kod akışı)
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [resetPreviewCode, setResetPreviewCode] = useState<string | null>(null);
  const [resetDeliveryMode, setResetDeliveryMode] = useState<'email' | 'simulated_inbox' | null>(null);
  const [resetSecondsLeft, setResetSecondsLeft] = useState(0);

  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setBusyProvider(null);
    setShowAppleForm(false);
    setPasswordInput('');
    setPasswordConfirm('');
    setResetStep('request');
    setResetCodeInput('');
    setResetPreviewCode(null);
    setResetDeliveryMode(null);
    setResetSecondsLeft(0);
    if (user) {
      setNameInput(user.name);
      setEmailInput(user.email);
      setSelectedColor(user.avatarColor || AVATAR_COLORS[0]);
    } else {
      setNameInput('');
      setEmailInput('');
      setSelectedColor(AVATAR_COLORS[0]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (resetSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setResetSecondsLeft((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resetSecondsLeft]);

  if (!isOpen) return null;

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleGoogleClick = async () => {
    setErrorMsg('');
    setBusyProvider('google');
    try {
      await onGoogleAuth(carryGuest);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google ile giriş başarısız oldu.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleAppleClick = async () => {
    setErrorMsg('');
    setBusyProvider('apple');
    try {
      await onAppleAuth(carryGuest);
      onClose();
    } catch (err: any) {
      if (err?.message === 'APPLE_NEEDS_FORM') {
        setShowAppleForm(true);
        setErrorMsg('');
      } else {
        setErrorMsg(err?.message || 'Apple ile giriş başarısız oldu.');
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const handleAppleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setBusyProvider('apple-form');
    try {
      await onAppleAuth(carryGuest, {
        name: nameInput.trim(),
        email: emailInput.trim(),
        avatarColor: selectedColor
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Apple hesabı doğrulanamadı.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (authTab === 'register') {
      if (!nameInput.trim() || nameInput.trim().length < 2) {
        setErrorMsg('Lütfen Ad Soyad alanını doldurun (en az 2 karakter).');
        return;
      }
      if (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
        setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
        return;
      }
      if (passwordInput.length < 6) {
        setErrorMsg('Belirlediğiniz şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (passwordInput !== passwordConfirm) {
        setErrorMsg('Şifre ve şifre tekrarı uyuşmuyor.');
        return;
      }

      setBusyProvider('email');
      try {
        await onEmailRegister(nameInput.trim(), emailInput.trim(), passwordInput, selectedColor, carryGuest);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Kayıt işlemi tamamlanamadı.');
      } finally {
        setBusyProvider(null);
      }
    } else {
      if (!emailInput.trim() || !passwordInput) {
        setErrorMsg('Lütfen e-posta adresinizi ve şifrenizi girin.');
        return;
      }
      setBusyProvider('email');
      try {
        await onEmailLogin(emailInput.trim(), passwordInput, carryGuest);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Giriş yapılamadı.');
      } finally {
        setBusyProvider(null);
      }
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    setBusyProvider('reset-send');
    try {
      const res = await onRequestPasswordReset(emailInput.trim());
      setResetDeliveryMode(res.deliveryMode);
      setResetPreviewCode(res.previewCode || null);
      setResetSecondsLeft(res.expiresInSeconds || 600);
      setResetStep('verify');
      setSuccessMsg(
        res.deliveryMode === 'email'
          ? '6 haneli doğrulama kodu e-posta adresinize gönderildi.'
          : '6 haneli doğrulama kodunuz oluşturuldu (Aşağıdaki Sigma Mail Kutusu ile doğrulayabilirsiniz).'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Doğrulama kodu gönderilemedi.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!/^\d{6}$/.test(resetCodeInput.trim())) {
      setErrorMsg('Lütfen e-postanıza gelen 6 haneli kodu girin.');
      return;
    }
    if (passwordInput.length < 6) {
      setErrorMsg('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (passwordInput !== passwordConfirm) {
      setErrorMsg('Yeni şifre ve şifre tekrarı eşleşmiyor.');
      return;
    }

    setBusyProvider('reset-confirm');
    try {
      const res = await onConfirmPasswordReset({
        email: emailInput.trim(),
        code: resetCodeInput.trim(),
        newPassword: passwordInput
      });
      setSuccessMsg(res.note);
      setPasswordInput('');
      setPasswordConfirm('');
      setResetCodeInput('');
      setResetPreviewCode(null);
      setResetStep('request');
      setAuthTab('login');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Şifre sıfırlanamadı.');
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {user
              ? 'Hesap ve Profil Yönetimi'
              : authTab === 'login'
              ? 'Giriş Yap'
              : authTab === 'register'
              ? 'Kayıt Ol / Hesap Oluştur'
              : 'Şifremi Unuttum'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div
                  className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-base shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  {(nameInput || user.name).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email} ·{' '}
                    {user.provider === 'google'
                      ? 'Google'
                      : user.provider === 'apple'
                      ? 'Apple ID'
                      : 'E-posta Hesabı'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                <i className="fa-solid fa-shield-halved mr-1.5" />
                Sohbetleriniz yalnızca <strong>{user.email}</strong> hesabınıza özel olarak kaydediliyor.
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Görünen Ad
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Görünen Ad"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                />

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Avatar Rengi:</span>
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        selectedColor === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {errorMsg && <p className="text-xs text-rose-600 dark:text-rose-400">{errorMsg}</p>}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!nameInput.trim()) {
                      setErrorMsg('Lütfen görünen adınızı yazın.');
                      return;
                    }
                    onUpdateProfile(nameInput.trim(), selectedColor);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Profili Güncelle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onLogout();
                    onClose();
                  }}
                  className="py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
                >
                  Çıkış Yap
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Misafir modunda sohbetler kaydedilmez. Sohbet geçmişinizi kendi hesabınıza özel saklamak için giriş yapın veya yeni hesap oluşturun.
              </div>

              {/* Giriş Yap / Kayıt Ol Sekmeleri */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setShowAppleForm(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    authTab === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setShowAppleForm(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    authTab === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Kayıt Ol / Hesap Oluştur
                </button>
              </div>

              {authTab !== 'forgot' && (
                <>
                  {/* Sosyal Giriş Butonları */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyProvider)}
                      onClick={() => void handleGoogleClick()}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {busyProvider === 'google' ? (
                        <i className="fa-solid fa-spinner fa-spin text-rose-500" />
                      ) : (
                        <i className="fa-brands fa-google text-rose-500" />
                      )}
                      <span>Google ile Devam Et</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(busyProvider)}
                      onClick={() => void handleAppleClick()}
                      className="p-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {busyProvider === 'apple' ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                      ) : (
                        <i className="fa-brands fa-apple text-base" />
                      )}
                      <span>Apple ile Devam Et</span>
                    </button>
                  </div>
                </>
              )}

              {showAppleForm ? (
                <form onSubmit={handleAppleFormSubmit} className="space-y-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Apple ID Bilgilerinizi Girin
                  </div>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Apple E-posta Adresiniz"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAppleForm(false)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={busyProvider === 'apple-form'}
                      className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
                    >
                      Apple Oturumunu Aç
                    </button>
                  </div>
                </form>
              ) : authTab === 'forgot' ? (
                <div className="space-y-3">
                  {resetStep === 'request' ? (
                    <form onSubmit={handleSendResetCode} className="space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Hesabınıza bağlı e-posta adresinizi yazın. Size 6 haneli şifre yenileme kodu gönderelim.
                      </p>
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="E-posta adresiniz"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                          {errorMsg}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={busyProvider === 'reset-send'}
                        className="w-full py-2.5 px-4 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {busyProvider === 'reset-send' ? 'Kod Gönderiliyor...' : 'E-postama 6 Haneli Kod Gönder'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmReset} className="space-y-3">
                      {resetPreviewCode && resetDeliveryMode === 'simulated_inbox' && (
                        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            <span>
                              <i className="fa-solid fa-envelope-open-text mr-1.5" />
                              Sigma Mail Doğrulama Kutusu
                            </span>
                            {resetSecondsLeft > 0 && (
                              <span className="font-mono tabular-nums">{formatCountdown(resetSecondsLeft)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-blue-200/80 dark:border-blue-800/80">
                            <span className="font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white">
                              {resetPreviewCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => setResetCodeInput(resetPreviewCode)}
                              className="px-2.5 py-1 rounded-md sigma-accent-bg text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Kodu Doldur
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Gerçek SMTP yapılandırması olmayan statik ortamlarda kodunuz güvenle burada gösterilir.
                          </p>
                        </div>
                      )}

                      {successMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                          {successMsg}
                        </div>
                      )}

                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={resetCodeInput}
                        onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 haneli doğrulama kodu"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Yeni Şifre (en az 6 karakter)"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Yeni Şifre Tekrarı"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />

                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                          {errorMsg}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetStep('request');
                            setErrorMsg('');
                            setSuccessMsg('');
                          }}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                        >
                          Yeni Kod
                        </button>
                        <button
                          type="submit"
                          disabled={busyProvider === 'reset-confirm'}
                          className="flex-1 py-2.5 px-4 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {busyProvider === 'reset-confirm' ? 'Güncelleniyor...' : 'Kodu Doğrula ve Şifreyi Yenile'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs sigma-accent-text font-semibold hover:underline cursor-pointer"
                    >
                      Giriş ekranına dön
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span>VEYA E-POSTA & ŞİFRE İLE</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {successMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                      {successMsg}
                    </div>
                  )}

                  {authTab === 'register' && (
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Adınız Soyadınız"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                  )}

                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="E-posta adresiniz"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />

                  <div className="space-y-1">
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Şifre (en az 6 karakter)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                    {authTab === 'login' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthTab('forgot');
                            setResetStep('request');
                            setPasswordInput('');
                            setPasswordConfirm('');
                            setErrorMsg('');
                            setSuccessMsg('');
                          }}
                          className="text-[11px] sigma-accent-text hover:underline font-medium cursor-pointer"
                        >
                          Şifremi Unuttum?
                        </button>
                      </div>
                    )}
                  </div>

                  {authTab === 'register' && (
                    <>
                      <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Şifre Tekrarı"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Profil Rengi:</span>
                        {AVATAR_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            className={`w-5 h-5 rounded-full cursor-pointer ${
                              selectedColor === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {hasGuestMessages && (
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={carryGuest}
                        onChange={(e) => setCarryGuest(e.target.checked)}
                        className="accent-blue-600"
                      />
                      <span>Mevcut misafir sohbetini hesabıma aktar</span>
                    </label>
                  )}

                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={Boolean(busyProvider)}
                    className="w-full py-2.5 px-4 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {busyProvider === 'email'
                      ? 'İşleniyor...'
                      : authTab === 'login'
                      ? 'E-posta ile Giriş Yap'
                      : 'Kayıt Ol ve Hesabı Oluştur'}
                  </button>

                  <div className="text-center pt-1">
                    {authTab === 'login' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('register');
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="text-xs sigma-accent-text font-semibold hover:underline cursor-pointer"
                      >
                        Hesabın yok mu? Kayıt Ol / Hesap Oluştur
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('login');
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="text-xs sigma-accent-text font-semibold hover:underline cursor-pointer"
                      >
                        Zaten hesabın var mı? Giriş Yap
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. KLAVYE KISAYOLLARI, ONAY & NASIL KULLANILIR MODALLARI
 * ========================================================================== */
export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: 'Ctrl + K', desc: 'Sohbetlerde hızlı arama kutusuna odaklan' },
    { keys: 'Ctrl + N', desc: 'Yeni sohbet oluştur' },
    { keys: 'Ctrl + /', desc: 'Klavye kısayolları penceresini aç/kapat' },
    { keys: 'Enter', desc: 'Mesajı gönder' },
    { keys: 'Shift + Enter', desc: 'Mesaj kutusunda alt satıra geç' },
    { keys: 'Ctrl + V', desc: 'Panodaki görseli sohbete yapıştır' },
    { keys: 'Esc', desc: 'Açık pencereleri ve büyütülmüş görseli kapat' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-keyboard sigma-accent-text" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Klavye Kısayolları
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-6 space-y-2.5">
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800/70 last:border-0 text-xs"
            >
              <span className="text-slate-600 dark:text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Sil',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const GuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      title: '1. Hibrit Hesap, Gizlilik & Şifre Yenileme',
      desc: 'Giriş yapmadan kullandığınızda sohbetleriniz kaydedilmez. Google, Apple veya E-posta/Şifre ile giriş yaptığınızda tüm geçmişiniz hesabınıza özel saklanır; "Şifremi Unuttum?" ile 6 haneli doğrulama koduyla şifrenizi yenileyebilirsiniz.'
    },
    {
      title: '2. 3D Stüdyo, Müzik & Beat Yapıcı ve Belge Analizi',
      desc: '"3D Stüdyo" sekmesinde etkileşimli 3B modelleri parça parça ayırıp inceleyin; "Ses & Belge & Müzik" sekmesinde eller serbest konuşun, PDF özetleyin veya 16 adımlı ritimler besteleyip WAV indirin.'
    },
    {
      title: '3. Akıllı Görsel Üretici & Canlı Görsel Düzenleyici',
      desc: '"Görsel" sekmesinde Türkçe istemlerle görseller üretin, mevcut veya kendi yüklediğiniz fotoğraflara filtre, döndürme ve poster metni uygulayın.'
    },
    {
      title: '4. 2B Oyun Yapıcı (4 Şablon), CSS/SVG & 10 Geliştirici Aracı',
      desc: '"Kod & Oyun" sekmesinde Uzay Savunması, Platform, Yılan veya Hedef Vurma oyunları üretin; "Araçlar" sekmesinde REST API Testi, SQL, Regex, Renk Paleti & ASCII ve Birim Çevirici kullanın.'
    },
    {
      title: '5. The Sigma Games • thesigmagames.github.io/sigma-ai',
      desc: 'Klasörler oluşturun, Vurgu Tema Paketlerini deneyin ve sohbetlerinizi .txt, .md, .json veya .html olarak dışa aktarın. Resmi geliştirici adresi: thesigmagames.github.io'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-question sigma-accent-text" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Sigma AI • Nasıl Kullanılır?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {steps.map((s) => (
            <div key={s.title} className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
};
