/**
 * Sigma AI • The Sigma Games
 * Hibrit Yapay Zeka (Gemini Motoru + @xenova/transformers API'siz Yerel Motor),
 * Hibrit Kimlik Doğrulama (Google, Apple, E-posta/Şifre — Misafir Kayıtsız / Üye Hesaba Özel),
 * Sesli Asistan, Belge/PDF Analizi, Yan Yana Karşılaştırma, 2B Oyun & Kod Sandbox,
 * Görsel Oluşturma, Çoklu Ajan Münazara ve Geliştirici Araçları Stüdyosu.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { ImageStudio } from './components/ImageStudio';
import { CodeStudio } from './components/CodeStudio';
import { DebateStudio } from './components/DebateStudio';
import { ToolsStudio } from './components/ToolsStudio';
import { VoiceDocStudio } from './components/VoiceDocStudio';
import { CompareStudio } from './components/CompareStudio';
import { Scene3DStudio } from './components/Scene3DStudio';
import {
  AuthModal,
  ConfirmModal,
  ExportModal,
  GuideModal,
  SettingsModal,
  ShortcutsModal,
  StatsModal
} from './components/Modals';
import {
  DEFAULT_SYSTEM_PROMPT,
  LOCAL_MODELS,
  PERSONA_META,
  createProceduralFallbackImage,
  detectImageIntent,
  generateAutoTitle,
  generateHybridAiReply,
  requestAiImage,
  simulateTransformersModelLoad
} from './services/localAiEngine';
import {
  confirmPasswordResetWithCodeHybrid,
  deleteChatFromFirestore,
  getSavedActiveUser,
  loadChatsFromFirestore,
  loadUserScopedData,
  loginWithEmailPasswordHybrid,
  logoutHybrid,
  mapFirebaseUserToProfile,
  registerWithEmailPasswordHybrid,
  requestPasswordResetCodeHybrid,
  saveActiveUser,
  saveUserScopedActiveId,
  saveUserScopedChats,
  saveUserScopedFolders,
  saveUserScopedGallery,
  signInWithAppleHybrid,
  signInWithGoogleHybrid,
  subscribeFirebaseAuth,
  syncChatSessionToFirestore,
  syncFolderToFirestore,
  syncUserProfileToFirestore,
  updateLocalAccountProfile
} from './services/firebaseClient';
import { playUiSound } from './services/soundEffects';
import type {
  AccentTheme,
  AiEngineMode,
  AppLanguage,
  AttachedImageData,
  ChatFolder,
  ChatMessage,
  ChatSession,
  CustomApiConfig,
  GeneratedImageItem,
  MessageRole,
  ModelStatus,
  Persona,
  ResponseLength,
  StudioView,
  ToastNotification,
  UserProfile
} from './types/chat';

const PREF_KEYS = {
  THEME: 'sigma_ai_pref_theme',
  ACCENT: 'sigma_ai_pref_accent',
  SOUND: 'sigma_ai_pref_sound',
  MODEL: 'sigma_ai_pref_model',
  ENGINE_MODE: 'sigma_ai_pref_engine_mode',
  CUSTOM_API: 'sigma_ai_pref_custom_api'
};

function formatTimeNow(): string {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function createEmptyChatObject(title = 'Yeni Sohbet', folderId?: string): ChatSession {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    pinned: false,
    folderId: folderId || '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    persona: 'general',
    language: 'tr',
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeLoadedChats(raw: unknown): ChatSession[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [createEmptyChatObject('Hoş Geldin Sohbeti')];
  }
  const normalized: ChatSession[] = raw
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.id || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      title: String(item.title || 'Sohbet'),
      pinned: Boolean(item.pinned),
      folderId: item.folderId ? String(item.folderId) : '',
      systemPrompt: String(item.systemPrompt || DEFAULT_SYSTEM_PROMPT),
      persona: (item.persona as Persona) || 'general',
      language: (item.language as AppLanguage) || 'tr',
      messages: Array.isArray(item.messages)
        ? item.messages.map((m: any) => ({
            id: String(m.id || `msg_${Math.random().toString(36).slice(2, 8)}`),
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            text: String(m.text || m.content || ''),
            time: String(m.time || formatTimeNow()),
            reaction: m.reaction === 'like' || m.reaction === 'dislike' ? m.reaction : null,
            edited: Boolean(m.edited),
            isStarred: Boolean(m.isStarred),
            attachmentName: m.attachmentName ? String(m.attachmentName) : undefined,
            image: m.image,
            generatedImage: m.generatedImage,
            sources: Array.isArray(m.sources) ? m.sources : undefined,
            engineUsed: m.engineUsed ? String(m.engineUsed) : undefined,
            deepThinking: Boolean(m.deepThinking),
            webSearch: Boolean(m.webSearch),
            latencyMs: typeof m.latencyMs === 'number' ? m.latencyMs : undefined
          }))
        : [],
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now()
    }));

  return normalized.length > 0 ? normalized : [createEmptyChatObject('Hoş Geldin Sohbeti')];
}

function wrapPreviewCode(code: string, language: string): string {
  const lang = language.toLowerCase();
  if (lang === 'html' || lang === 'htm') return code;
  if (lang === 'css') {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>${code}</style>
</head>
<body style="margin:0;padding:24px;font-family:system-ui,sans-serif;">
  <div class="card box container">
    <h2>CSS Önizleme Alanı</h2>
    <p>Oluşturulan stil kuralları bu önizleme üzerinde uygulanmıştır.</p>
    <button>Örnek Buton</button>
  </div>
</body>
</html>`;
  }
  if (lang === 'svg') {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;">
  ${code}
</body>
</html>`;
  }
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; padding: 20px; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, monospace; }
    h4 { margin: 0 0 12px; color: #38bdf8; font-family: system-ui, sans-serif; }
    pre { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  <h4>JavaScript Çıktısı</h4>
  <pre id="console-out"></pre>
  <script>
    const outEl = document.getElementById('console-out');
    const appendLine = (prefix, args) => {
      const txt = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
      outEl.textContent += (prefix ? prefix + ' ' : '') + txt + '\\n';
    };
    console.log = (...args) => appendLine('', args);
    console.error = (...args) => appendLine('[HATA]', args);
    console.warn = (...args) => appendLine('[UYARI]', args);
    try {
      ${code}
    } catch (err) {
      appendLine('[İSTİSNA]', [err.message || err]);
    }
  </script>
</body>
</html>`;
}

const SLASH_COMMANDS = [
  { cmd: '/görsel', desc: 'Doğal tariften görsel üret (örn: /görsel maymun muz yiyor)' },
  { cmd: '/kod', desc: 'Yazılım & Kod modunda canlı kod üret' },
  { cmd: '/grok', desc: 'Sigma Grok modunda esprili ve dobra yanıt al' },
  { cmd: '/özetle', desc: 'Aktif sohbeti maddeler halinde özetle' },
  { cmd: '/çevir', desc: 'Metni seçili dile veya İngilizceye çevir' },
  { cmd: '/temizle', desc: 'Aktif sohbet mesajlarını temizle' }
];

const STARTER_PROMPTS = [
  { label: 'Doğru Görsel Üretimi', text: 'Maymun yap muz yesin' },
  {
    label: 'Canlı HTML Oyunu Yaz',
    text: 'HTML ve JavaScript ile tek dosyada çalışan mini bir tıklama puan oyunu kodu yaz.'
  },
  {
    label: 'Web Araştırması & Link',
    text: 'Modern web oyun geliştirme motorlarını (Three.js, Phaser, Godot) resmi web linkleriyle karşılaştır.'
  },
  { label: 'Hızlı Matematik & Analiz', text: '(250 * 4) + 1200 / 3 kaç eder?' }
];

const FOLDER_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48'];

export default function App() {
  /* ------------------------------------------------------------------------
   * 1. KULLANICI DURUMU & KESİN MİSAFİR/ÜYE İZOLASYONU
   * ---------------------------------------------------------------------- */
  // Eski sürümdeki sahipsiz global sohbet kayıtlarını temizle (gizlilik garantisi)
  useEffect(() => {
    try {
      localStorage.removeItem('sigma_ai_ultra_v2_chats');
      localStorage.removeItem('sigma_ai_ultra_v2_active_chat');
      localStorage.removeItem('sigma_ai_ultra_v2_gallery');
      localStorage.removeItem('sigma_ai_ultra_v2_user');
    } catch {}
  }, []);

  const [user, setUser] = useState<UserProfile | null>(() => getSavedActiveUser());
  const userRef = useRef<UserProfile | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [chats, setChats] = useState<ChatSession[]>(() => {
    const initialUser = getSavedActiveUser();
    if (!initialUser) {
      return [createEmptyChatObject('Hoş Geldin Sohbeti')];
    }
    const scoped = loadUserScopedData(initialUser);
    return scoped.chats.length > 0
      ? normalizeLoadedChats(scoped.chats)
      : [createEmptyChatObject('Hoş Geldin Sohbeti')];
  });

  const [folders, setFolders] = useState<ChatFolder[]>(() => {
    const initialUser = getSavedActiveUser();
    if (!initialUser) return [];
    const scoped = loadUserScopedData(initialUser);
    return Array.isArray(scoped.folders) ? scoped.folders : [];
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const initialUser = getSavedActiveUser();
    if (!initialUser) return '';
    return loadUserScopedData(initialUser).activeChatId || '';
  });

  const currentChat = useMemo(() => {
    return chats.find((c) => c.id === activeChatId) || chats[0];
  }, [chats, activeChatId]);

  const [imageGallery, setImageGallery] = useState<GeneratedImageItem[]>(() => {
    const initialUser = getSavedActiveUser();
    if (!initialUser) return [];
    try {
      const raw = loadUserScopedData(initialUser).galleryJson;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Tercihler (Tema, Vurgu Paketi, Ses Efektleri, Motor)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem(PREF_KEYS.THEME);
      if (savedTheme === 'light') return false;
      if (savedTheme === 'dark') return true;
    } catch {}
    return true;
  });

  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => {
    try {
      const saved = localStorage.getItem(PREF_KEYS.ACCENT) as AccentTheme | null;
      if (saved && ['cobalt', 'emerald', 'amber', 'amethyst'].includes(saved)) return saved;
    } catch {}
    return 'cobalt';
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PREF_KEYS.SOUND) !== 'false';
    } catch {
      return true;
    }
  });

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem(PREF_KEYS.MODEL) || LOCAL_MODELS[0].id;
  });
  const [modelStatus, setModelStatus] = useState<ModelStatus>('ready');
  const [modelProgress, setModelProgress] = useState<number>(100);
  const [modelStage, setModelStage] = useState<string>('Yerel çıkarım motoru hazır.');

  const [engineMode, setEngineMode] = useState<AiEngineMode>(() => {
    const saved = localStorage.getItem(PREF_KEYS.ENGINE_MODE);
    if (saved === 'gemini' || saved === 'local' || saved === 'hybrid') return saved;
    return 'hybrid';
  });

  const [customApi, setCustomApi] = useState<CustomApiConfig>(() => {
    try {
      const raw = localStorage.getItem(PREF_KEYS.CUSTOM_API);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: false, endpointUrl: '', apiKey: '', modelName: '' };
  });

  // Stüdyo görünümü & sohbet yetenekleri
  const [activeView, setActiveView] = useState<StudioView>('chat');
  const [sandboxInitialCode, setSandboxInitialCode] = useState<string | undefined>(undefined);
  const [deepThinking, setDeepThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [responseLength, setResponseLength] = useState<ResponseLength>('normal');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [chatMessageFilter, setChatMessageFilter] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Sohbet & arayüz state'leri
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [brokenGalleryFallbacks, setBrokenGalleryFallbacks] = useState<Record<string, string>>({});

  // Mesaj düzenleme & ekler
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgDraft, setEditingMsgDraft] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [attachedImage, setAttachedImage] = useState<AttachedImageData | null>(null);

  // Modallar
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    action: (() => void) | null;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Sil',
    action: null
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Ref'ler
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const streamCancelRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const activeModel = useMemo(
    () => LOCAL_MODELS.find((m) => m.id === selectedModelId) || LOCAL_MODELS[0],
    [selectedModelId]
  );

  /* ------------------------------------------------------------------------
   * 2. YARDIMCI BİLDİRİM & HESABA ÖZEL KALICILIK FONKSİYONLARI
   * ---------------------------------------------------------------------- */
  const showToast = (message: string, type: ToastNotification['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (type === 'error') playUiSound('error', soundEnabled);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  /**
   * saveChats():
   * - Misafir modunda (user === null) KESİNLİKLE diske/buluta yazmaz!
   * - Giriş yapılmışsa yalnızca ilgili e-posta/kullanıcı alanına + doğrulanmışsa Firestore'a kaydeder.
   */
  const saveChats = (updatedChats: ChatSession[], targetUser: UserProfile | null = userRef.current) => {
    setChats(updatedChats);
    if (!targetUser) return;
    saveUserScopedChats(targetUser, updatedChats);
  };

  const saveFolders = (updatedFolders: ChatFolder[], targetUser: UserProfile | null = userRef.current) => {
    setFolders(updatedFolders);
    if (!targetUser) return;
    saveUserScopedFolders(targetUser, updatedFolders);
  };

  const saveGallery = (nextGallery: GeneratedImageItem[], targetUser: UserProfile | null = userRef.current) => {
    setImageGallery(nextGallery);
    if (!targetUser) return;
    saveUserScopedGallery(targetUser, nextGallery);
  };

  // Firebase Auth oturum değişimlerini dinle
  useEffect(() => {
    const unsub = subscribeFirebaseAuth(async (fbUser) => {
      if (fbUser && !userRef.current) {
        const mapped = mapFirebaseUserToProfile(fbUser);
        saveActiveUser(mapped);
        setUser(mapped);
        if (fbUser.emailVerified) {
          const remoteChats = await loadChatsFromFirestore(mapped);
          if (remoteChats && remoteChats.length > 0) {
            const norm = normalizeLoadedChats(remoteChats);
            saveChats(norm, mapped);
            setActiveChatId(norm[0].id);
          }
        }
      } else if (fbUser && userRef.current && fbUser.emailVerified && userRef.current.isFirebaseUser) {
        const remoteChats = await loadChatsFromFirestore(userRef.current);
        if (remoteChats && remoteChats.length > 0) {
          const localScoped = loadUserScopedData(userRef.current);
          if (localScoped.chats.length === 0) {
            const norm = normalizeLoadedChats(remoteChats);
            saveChats(norm, userRef.current);
            setActiveChatId(norm[0].id);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && currentChat?.id) {
      saveUserScopedActiveId(user, currentChat.id);
    }
  }, [currentChat?.id, user]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(PREF_KEYS.THEME, isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  useEffect(() => {
    if (accentTheme === 'cobalt') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', accentTheme);
    }
    try {
      localStorage.setItem(PREF_KEYS.ACCENT, accentTheme);
    } catch {}
  }, [accentTheme]);

  useEffect(() => {
    if (activeView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat?.messages.length, streamingText, activeView]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Global Klavye Kısayolları (Ctrl+K arama, Ctrl+N yeni sohbet, Ctrl+/ kısayollar, Esc modal kapat)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newChat();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setLightboxUrl(null);
        setIsSettingsOpen(false);
        setIsExportOpen(false);
        setIsStatsOpen(false);
        setIsAuthOpen(false);
        setIsGuideOpen(false);
        setIsShortcutsOpen(false);
        setIsRenamingTitle(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ------------------------------------------------------------------------
   * 3. KİMLİK DOĞRULAMA İŞLEYİCİLERİ (HİBRİT & HESABA ÖZEL VERİ HİDRASYONU)
   * ---------------------------------------------------------------------- */
  const hydrateAccountWorkspace = async (loggedInUser: UserProfile, carryGuestChats: boolean, note?: string) => {
    const guestHasMessages = !userRef.current && currentChat.messages.length > 0;
    const guestChatSnapshot = guestHasMessages && carryGuestChats ? { ...currentChat } : null;

    setUser(loggedInUser);
    userRef.current = loggedInUser;

    const scoped = loadUserScopedData(loggedInUser);
    let nextChats: ChatSession[] = scoped.chats.length > 0 ? normalizeLoadedChats(scoped.chats) : [];

    if (loggedInUser.isFirebaseUser && loggedInUser.emailVerified) {
      const cloudChats = await loadChatsFromFirestore(loggedInUser);
      if (cloudChats && cloudChats.length > 0) {
        const knownIds = new Set(nextChats.map((c) => c.id));
        const merged = [...nextChats];
        for (const cc of cloudChats) {
          if (!knownIds.has(cc.id)) merged.push(cc);
        }
        nextChats = merged;
      }
      await syncUserProfileToFirestore(loggedInUser).catch(() => {});
    }

    if (guestChatSnapshot) {
      nextChats = [guestChatSnapshot, ...nextChats];
      if (loggedInUser.isFirebaseUser && loggedInUser.emailVerified) {
        void syncChatSessionToFirestore(loggedInUser, guestChatSnapshot);
      }
    }

    if (nextChats.length === 0) {
      nextChats = [createEmptyChatObject('Hoş Geldin Sohbeti')];
    }

    saveChats(nextChats, loggedInUser);
    const nextFolders = Array.isArray(scoped.folders) ? scoped.folders : [];
    saveFolders(nextFolders, loggedInUser);

    let nextGallery: GeneratedImageItem[] = [];
    try {
      if (scoped.galleryJson) {
        const parsed = JSON.parse(scoped.galleryJson);
        if (Array.isArray(parsed)) nextGallery = parsed;
      }
    } catch {}
    saveGallery(nextGallery, loggedInUser);

    setActiveChatId(scoped.activeChatId && nextChats.some((c) => c.id === scoped.activeChatId) ? scoped.activeChatId : nextChats[0].id);
    setSelectedFolderId('all');
    playUiSound('success', soundEnabled);
    showToast(note || `Hoş geldiniz, ${loggedInUser.name}! Hesabınıza özel geçmişiniz yüklendi.`, 'success');
  };

  const handleGoogleAuth = async (carryGuestChats: boolean) => {
    const res = await signInWithGoogleHybrid();
    await hydrateAccountWorkspace(res.user, carryGuestChats, res.note);
  };

  const handleAppleAuth = async (
    carryGuestChats: boolean,
    fallbackForm?: { name: string; email: string; avatarColor: string }
  ) => {
    const res = await signInWithAppleHybrid(fallbackForm);
    await hydrateAccountWorkspace(res.user, carryGuestChats, res.note);
  };

  const handleEmailLogin = async (email: string, password: string, carryGuestChats: boolean) => {
    const res = await loginWithEmailPasswordHybrid({ email, password });
    await hydrateAccountWorkspace(res.user, carryGuestChats, res.note);
  };

  const handleEmailRegister = async (
    name: string,
    email: string,
    password: string,
    avatarColor: string,
    carryGuestChats: boolean
  ) => {
    const res = await registerWithEmailPasswordHybrid({ name, email, password, avatarColor });
    await hydrateAccountWorkspace(res.user, carryGuestChats, res.note);
  };

  const handleUpdateProfile = (name: string, avatarColor: string) => {
    if (!user) return;
    const updated: UserProfile = { ...user, name, avatarColor, accentTheme };
    setUser(updated);
    updateLocalAccountProfile(updated);
    if (updated.isFirebaseUser && updated.emailVerified) {
      void syncUserProfileToFirestore(updated).catch(() => {});
    }
    showToast('Profil bilgileri güncellendi.', 'success');
  };

  const handleLogout = async () => {
    await logoutHybrid();
    setUser(null);
    userRef.current = null;
    const freshGuest = createEmptyChatObject('Yeni Sohbet');
    setChats([freshGuest]);
    setFolders([]);
    setImageGallery([]);
    setSelectedFolderId('all');
    setActiveChatId(freshGuest.id);
    showToast('Çıkış yapıldı. Misafir moduna geçildi (kayıt tutulmaz).', 'info');
  };

  /* ------------------------------------------------------------------------
   * 4. SOHBET & KLASÖR YÖNETİM FONKSİYONLARI
   * ---------------------------------------------------------------------- */
  const newChat = () => {
    if (isGenerating) {
      streamCancelRef.current = true;
      setIsGenerating(false);
    }
    const created = createEmptyChatObject(
      'Yeni Sohbet',
      selectedFolderId !== 'all' ? selectedFolderId : ''
    );
    const next = [created, ...chats];
    saveChats(next);
    setActiveChatId(created.id);
    setEditingMsgId(null);
    setShowStarredOnly(false);
    setActiveView('chat');
    setIsSidebarOpen(false);
    playUiSound('click', soundEnabled);
    textareaRef.current?.focus();
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean) return;
    const folder: ChatFolder = {
      id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: clean.slice(0, 40),
      color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length],
      createdAt: Date.now()
    };
    const next = [...folders, folder];
    saveFolders(next);
    if (user?.isFirebaseUser && user.emailVerified) {
      void syncFolderToFirestore(user, folder);
    }
    setNewFolderName('');
    setShowNewFolderForm(false);
    setSelectedFolderId(folder.id);
    showToast(`"${folder.name}" klasörü oluşturuldu.`, 'success');
  };

  const handleAssignChatFolder = (chatId: string, folderId: string) => {
    const updated = chats.map((c) =>
      c.id === chatId ? { ...c, folderId, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    const target = updated.find((c) => c.id === chatId);
    if (user && target && user.isFirebaseUser && user.emailVerified) {
      void syncChatSessionToFirestore(user, target);
    }
    showToast('Sohbet klasörü güncellendi.', 'info');
  };

  const filterChats = (filterText: string) => setSearchQuery(filterText);

  const loadChatList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = chats.filter((c) => {
      const folderMatch = selectedFolderId === 'all' || c.folderId === selectedFolderId;
      if (!folderMatch) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [chats, searchQuery, selectedFolderId]);

  const loadChat = (id: string) => {
    if (isGenerating) {
      streamCancelRef.current = true;
      setIsGenerating(false);
    }
    setActiveChatId(id);
    setEditingMsgId(null);
    setShowStarredOnly(false);
    setActiveView('chat');
    setIsSidebarOpen(false);
  };

  const pinChat = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const target = chats.find((c) => c.id === id);
    const updated = chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
    saveChats(updated);
    const updatedTarget = updated.find((c) => c.id === id);
    if (user && updatedTarget && user.isFirebaseUser && user.emailVerified) {
      void syncChatSessionToFirestore(user, updatedTarget);
    }
    if (target) {
      playUiSound('click', soundEnabled);
      showToast(target.pinned ? 'Sabitleme kaldırıldı.' : 'Sohbet üste sabitlendi.', 'info');
    }
  };

  const deleteChat = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const target = chats.find((c) => c.id === id);
    if (!target) return;

    setConfirmState({
      isOpen: true,
      title: 'Sohbeti Sil',
      description: `"${target.title}" başlıklı sohbet ve içindeki tüm mesajlar silinecek. Onaylıyor musunuz?`,
      confirmLabel: 'Sohbeti Sil',
      action: () => {
        const remaining = chats.filter((c) => c.id !== id);
        if (user && user.isFirebaseUser && user.emailVerified) {
          void deleteChatFromFirestore(user, id);
        }
        if (remaining.length === 0) {
          const fresh = createEmptyChatObject('Yeni Sohbet');
          saveChats([fresh]);
          setActiveChatId(fresh.id);
        } else {
          saveChats(remaining);
          if (currentChat.id === id) {
            setActiveChatId(remaining[0].id);
          }
        }
        setConfirmState((prev) => ({ ...prev, isOpen: false, action: null }));
        showToast('Sohbet silindi.', 'success');
      }
    });
  };

  const restartCurrentChat = () => {
    if (currentChat.messages.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: 'Sohbeti Baştan Başlat',
      description: 'Bu sohbetteki tüm mesajlar temizlenecek ve sohbet sıfırdan başlatılacak.',
      confirmLabel: 'Baştan Başlat',
      action: () => {
        const updated = chats.map((c) =>
          c.id === currentChat.id
            ? { ...c, messages: [], title: 'Yeni Sohbet', updatedAt: Date.now() }
            : c
        );
        saveChats(updated);
        setShowStarredOnly(false);
        setConfirmState((prev) => ({ ...prev, isOpen: false, action: null }));
        showToast('Sohbet sıfırlandı ve yeniden başlatıldı.', 'info');
      }
    });
  };

  const duplicateChat = () => {
    const now = Date.now();
    const copy: ChatSession = {
      ...currentChat,
      id: `chat_${now}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${currentChat.title} (Kopya)`,
      pinned: false,
      messages: currentChat.messages.map((m) => ({ ...m })),
      createdAt: now,
      updatedAt: now
    };
    saveChats([copy, ...chats]);
    setActiveChatId(copy.id);
    showToast('Sohbet kopyası oluşturuldu.', 'success');
  };

  const saveChatTitle = () => {
    const clean = titleDraft.trim();
    setIsRenamingTitle(false);
    if (!clean || clean === currentChat.title) return;
    const updated = chats.map((c) =>
      c.id === currentChat.id ? { ...c, title: clean, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    const updatedTarget = updated.find((c) => c.id === currentChat.id);
    if (user && updatedTarget && user.isFirebaseUser && user.emailVerified) {
      void syncChatSessionToFirestore(user, updatedTarget);
    }
    showToast('Sohbet başlığı güncellendi.', 'success');
  };

  /* ------------------------------------------------------------------------
   * 5. MESAJ İŞLEMLERİ
   * ---------------------------------------------------------------------- */
  const createMessage = (
    role: MessageRole,
    text: string,
    time: string = formatTimeNow(),
    extras?: Partial<ChatMessage>
  ): ChatMessage => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    time,
    reaction: null,
    ...extras
  });

  const sendMessage = async (
    isRegenerate = false,
    overrideHistory?: ChatMessage[],
    overridePrompt?: string
  ) => {
    if (isGenerating) return;

    const targetChatId = currentChat.id;
    const activeUserAtStart = userRef.current;
    let workingMessages = overrideHistory ? [...overrideHistory] : [...currentChat.messages];
    let promptText = overridePrompt ?? inputValue.trim();
    const activeAttachment = isRegenerate ? null : attachedFile;
    const activeImg = isRegenerate ? null : attachedImage;

    if (!isRegenerate) {
      if (!promptText && !activeAttachment && !activeImg) return;

      if (/^\/temizle$/i.test(promptText)) {
        setInputValue('');
        restartCurrentChat();
        return;
      }

      if (!promptText && activeImg) {
        promptText = 'Bu görseli incele, içindeki detayları ve önemli noktaları açıkla.';
      } else if (!promptText && activeAttachment) {
        promptText = `"${activeAttachment.name}" dosyasını incele ve özetle.`;
      }

      const userMsg = createMessage('user', promptText, formatTimeNow(), {
        attachmentName: activeAttachment?.name,
        image: activeImg || undefined
      });
      workingMessages.push(userMsg);

      const shouldAutoTitle =
        currentChat.messages.length === 0 ||
        currentChat.title === 'Yeni Sohbet' ||
        currentChat.title === 'Hoş Geldin Sohbeti';

      const updatedChats = chats.map((c) =>
        c.id === targetChatId
          ? {
              ...c,
              title: shouldAutoTitle ? generateAutoTitle(promptText) : c.title,
              messages: workingMessages,
              updatedAt: Date.now()
            }
          : c
      );
      saveChats(updatedChats, activeUserAtStart);
      playUiSound('send', soundEnabled);
      setInputValue('');
      setAttachedFile(null);
      setAttachedImage(null);
      setActiveView('chat');
    } else {
      const lastUser = [...workingMessages].reverse().find((m) => m.role === 'user');
      if (!lastUser) {
        showToast('Yeniden üretilecek kullanıcı mesajı bulunamadı.', 'error');
        return;
      }
      promptText = lastUser.text;
    }

    setIsGenerating(true);
    setStreamingText('');
    streamCancelRef.current = false;

    try {
      const detectedImagePrompt = !activeImg ? detectImageIntent(promptText) : null;
      if (detectedImagePrompt) {
        const generated = await requestAiImage(detectedImagePrompt, '1:1', 'natural');
        saveGallery([generated, ...imageGallery], activeUserAtStart);

        const aiImgMsg = createMessage(
          'assistant',
          `**"${generated.originalPrompt}"** isteğin için görsel oluşturuldu.${
            generated.translatedSubject ? `\n\n*Algılanan Sahne:* \`${generated.translatedSubject}\`` : ''
          }\n\nGörsele tıklayarak büyütebilir veya **Görsel** sekmesinden farklı stil/seed ile yeniden üretebilirsin.`,
          formatTimeNow(),
          { generatedImage: generated, engineUsed: generated.model }
        );

        const finalMessages = [...workingMessages, aiImgMsg];
        setChats((prev) => {
          const next = prev.map((c) =>
            c.id === targetChatId ? { ...c, messages: finalMessages, updatedAt: Date.now() } : c
          );
          if (activeUserAtStart) saveUserScopedChats(activeUserAtStart, next);
          return next;
        });
        playUiSound('receive', soundEnabled);
        setIsGenerating(false);
        return;
      }

      let effectivePersona: Persona = currentChat.persona;
      let effectivePrompt = promptText;
      if (/^\/kod\b/i.test(promptText)) {
        effectivePersona = 'coder';
        effectivePrompt = promptText.replace(/^\/kod\s*/i, '') || 'Modern bir HTML/JS örneği yaz.';
      } else if (/^\/grok\b/i.test(promptText)) {
        effectivePersona = 'grok';
        effectivePrompt = promptText.replace(/^\/grok\s*/i, '') || 'Selam, ne haber?';
      } else if (/^\/özetle\b/i.test(promptText)) {
        effectivePrompt =
          promptText.replace(/^\/özetle\s*/i, '') ||
          'Bu sohbetin şu ana kadarki ana noktalarını kısa maddeler halinde özetle.';
      } else if (/^\/çevir\b/i.test(promptText)) {
        const rest = promptText.replace(/^\/çevir\s*/i, '');
        effectivePrompt = rest
          ? `Şu metni akıcı ve doğal biçimde Türkçeye ve İngilizceye çevir:\n\n${rest}`
          : 'Son mesajı akıcı biçimde İngilizceye çevir.';
      }

      const result = await generateHybridAiReply({
        userInput: effectivePrompt,
        history: workingMessages,
        systemPrompt: currentChat.systemPrompt,
        persona: effectivePersona,
        language: currentChat.language,
        deepThinking,
        webSearch,
        responseLength,
        engineMode,
        model: activeModel,
        customApi,
        attachmentContext: activeAttachment,
        attachedImage: activeImg
      });

      if (result.usedFallback) {
        showToast('Gemini yerine API’siz Yerel Motor yanıt verdi.', 'info');
      }

      const tokens = result.text.split(/(\s+)/);
      let accumulated = '';
      const stepSize = tokens.length > 180 ? 4 : 2;
      for (let idx = 0; idx < tokens.length; idx++) {
        if (streamCancelRef.current) break;
        accumulated += tokens[idx];
        if (idx % stepSize === 0 || idx === tokens.length - 1) {
          setStreamingText(accumulated);
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      const finalContent = accumulated.trim() || result.text;
      const aiMsg = createMessage('assistant', finalContent, formatTimeNow(), {
        sources: result.sources,
        engineUsed: result.engineUsed,
        deepThinking,
        webSearch,
        latencyMs: result.latencyMs
      });

      const finalMessages = [...workingMessages, aiMsg];
      setChats((prevChats) => {
        const nextChats = prevChats.map((c) =>
          c.id === targetChatId
            ? { ...c, messages: finalMessages, updatedAt: Date.now() }
            : c
        );
        if (activeUserAtStart) {
          saveUserScopedChats(activeUserAtStart, nextChats);
          const updatedTarget = nextChats.find((c) => c.id === targetChatId);
          if (updatedTarget && activeUserAtStart.isFirebaseUser && activeUserAtStart.emailVerified) {
            void syncChatSessionToFirestore(activeUserAtStart, updatedTarget);
          }
        }
        return nextChats;
      });
      playUiSound('receive', soundEnabled);

      if (autoSpeak) {
        toggleReadAloud(aiMsg);
      }
    } catch (err) {
      console.error('Mesaj üretim hatası:', err);
      showToast('Yanıt üretilirken beklenmeyen bir hata oluştu.', 'error');
    } finally {
      setStreamingText('');
      setIsGenerating(false);
    }
  };

  const regenerateLast = () => {
    if (isGenerating || currentChat.messages.length === 0) return;
    const msgs = [...currentChat.messages];
    if (msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    const updated = chats.map((c) =>
      c.id === currentChat.id ? { ...c, messages: msgs, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    void sendMessage(true, msgs);
  };

  const copyMessage = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('Mesaj panoya kopyalandı.', 'success'))
      .catch(() => showToast('Kopyalama izni reddedildi.', 'error'));
  };

  const likeMessage = (msgId: string) => {
    const updated = chats.map((c) =>
      c.id !== currentChat.id
        ? c
        : {
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, reaction: m.reaction === 'like' ? null : ('like' as const) } : m
            )
          }
    );
    saveChats(updated);
  };

  const dislikeMessage = (msgId: string) => {
    const updated = chats.map((c) =>
      c.id !== currentChat.id
        ? c
        : {
            ...c,
            messages: c.messages.map((m) =>
              m.id === msgId ? { ...m, reaction: m.reaction === 'dislike' ? null : ('dislike' as const) } : m
            )
          }
    );
    saveChats(updated);
  };

  const toggleStarMessage = (msgId: string) => {
    const updated = chats.map((c) =>
      c.id !== currentChat.id
        ? c
        : {
            ...c,
            messages: c.messages.map((m) => (m.id === msgId ? { ...m, isStarred: !m.isStarred } : m))
          }
    );
    saveChats(updated);
  };

  const startEditMessage = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingMsgDraft(msg.text);
  };

  const saveEditedMessage = (msgId: string) => {
    const trimmed = editingMsgDraft.trim();
    if (!trimmed) {
      setEditingMsgId(null);
      return;
    }
    const updated = chats.map((c) =>
      c.id !== currentChat.id
        ? c
        : {
            ...c,
            messages: c.messages.map((m) => (m.id === msgId ? { ...m, text: trimmed, edited: true } : m)),
            updatedAt: Date.now()
          }
    );
    saveChats(updated);
    setEditingMsgId(null);
    showToast('Mesaj güncellendi.', 'success');
  };

  const deleteMessage = (msgId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Mesajı Sil',
      description: 'Bu mesajı sohbetten kalıcı olarak silmek istiyor musunuz?',
      confirmLabel: 'Mesajı Sil',
      action: () => {
        const updated = chats.map((c) =>
          c.id !== currentChat.id
            ? c
            : {
                ...c,
                messages: c.messages.filter((m) => m.id !== msgId),
                updatedAt: Date.now()
              }
        );
        saveChats(updated);
        setConfirmState((prev) => ({ ...prev, isOpen: false, action: null }));
        showToast('Mesaj silindi.', 'success');
      }
    });
  };

  const toggleReadAloud = (msg: ChatMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Tarayıcınız sesli okumayı desteklemiyor.', 'error');
      return;
    }
    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = msg.text.replace(/```[\s\S]*?```/g, ' Kod bloğu. ').replace(/[*_#>`]/g, '');
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = currentChat.language === 'en' ? 'en-US' : 'tr-TR';
    utter.rate = speechRate;
    utter.onend = () => setSpeakingMsgId(null);
    utter.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utter);
  };

  /* ------------------------------------------------------------------------
   * 6. SESLE YAZMA (WEB SPEECH API), GÖRSEL & DOSYA EKLEME
   * ---------------------------------------------------------------------- */
  const toggleVoiceInput = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Tarayıcınız Web Speech API ses tanımayı desteklemiyor.', 'error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = currentChat.language === 'en' ? 'en-US' : 'tr-TR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
          showToast('Ses metne çevrildi.', 'success');
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        showToast('Mikrofon erişimi alınamadı veya konuşma algılanmadı.', 'error');
      };

      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      showToast('Ses tanıma başlatılamadı.', 'error');
    }
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 512) {
      showToast('Metin dosyası 512 KB sınırını aşmamalıdır.', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setAttachedFile({ name: file.name, content });
      showToast(`"${file.name}" bağlam olarak eklendi.`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Lütfen geçerli bir görsel dosyası seçin.', 'error');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast('Görsel boyutu 6 MB sınırını aşmamalıdır.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        setAttachedImage({ data: dataUrl, mimeType: file.type, name: file.name || 'gorsel.png' });
        showToast('Görsel analize hazır.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageFile(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          readImageFile(blob);
          break;
        }
      }
    }
  };

  /* ------------------------------------------------------------------------
   * 7. IMPORT / EXPORT, İSTATİSTİK, TEMA, MODEL & TERCİHLER
   * ---------------------------------------------------------------------- */
  const exportChat = () => setIsExportOpen(true);

  const importChats = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        const incomingArray = Array.isArray(parsed) ? parsed : [parsed];
        const validChats = normalizeLoadedChats(
          incomingArray.filter((item) => item && typeof item === 'object' && Array.isArray(item.messages))
        );

        const existingIds = new Set(chats.map((c) => c.id));
        const deduplicated = validChats.map((vc) =>
          existingIds.has(vc.id) ? { ...vc, id: `${vc.id}_${Math.random().toString(36).slice(2, 5)}` } : vc
        );

        const merged = [...deduplicated, ...chats];
        saveChats(merged);
        setActiveChatId(deduplicated[0].id);
        setActiveView('chat');
        showToast(`${validChats.length} sohbet başarıyla içe aktarıldı.`, 'success');
      } catch {
        showToast('JSON dosyası çözümlenemedi. Lütfen biçimi kontrol edin.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const showStats = () => setIsStatsOpen(true);
  const toggleTheme = () => setIsDark((prev) => !prev);
  const toggleSettings = () => setIsSettingsOpen((prev) => !prev);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PREF_KEYS.SOUND, String(next));
      } catch {}
      showToast(next ? 'Arayüz sesleri açıldı.' : 'Arayüz sesleri kapatıldı.', 'info');
      return next;
    });
  };

  const loadModel = async (modelId: string) => {
    setModelStatus('loading');
    setModelProgress(0);
    setModelStage('Model başlatılıyor...');

    try {
      const loadedSpec = await simulateTransformersModelLoad(modelId, (pct, stage) => {
        setModelProgress(pct);
        setModelStage(stage);
      });
      setSelectedModelId(loadedSpec.id);
      localStorage.setItem(PREF_KEYS.MODEL, loadedSpec.id);
      setModelStatus('ready');
      showToast(`${loadedSpec.shortName} tarayıcıya yüklendi.`, 'success');
    } catch {
      setModelStatus('error');
      showToast('Model yüklenirken hata oluştu.', 'error');
    }
  };

  const handleUpdateSystemPrompt = (nextPrompt: string) => {
    const updated = chats.map((c) =>
      c.id === currentChat.id ? { ...c, systemPrompt: nextPrompt, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    showToast('Sohbet System Prompt ayarı kaydedildi.', 'success');
  };

  const handleUpdateChatLanguage = (lang: AppLanguage) => {
    const updated = chats.map((c) =>
      c.id === currentChat.id ? { ...c, language: lang, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    showToast(`Yanıt dili "${lang.toUpperCase()}" olarak ayarlandı.`, 'info');
  };

  const handleChangePersona = (persona: Persona) => {
    const updated = chats.map((c) =>
      c.id === currentChat.id ? { ...c, persona, updatedAt: Date.now() } : c
    );
    saveChats(updated);
    showToast(`Kişilik: ${PERSONA_META[persona].title}`, 'info');
  };

  const handleChangeEngineMode = (mode: AiEngineMode) => {
    setEngineMode(mode);
    localStorage.setItem(PREF_KEYS.ENGINE_MODE, mode);
    showToast(
      mode === 'hybrid'
        ? 'Hibrit Motor (Gemini + Yerel Fallback) aktif.'
        : mode === 'gemini'
        ? 'Sadece Gemini Motoru aktif.'
        : 'API’siz %100 Yerel Motor aktif.',
      'info'
    );
  };

  const handleSaveCustomApi = (cfg: CustomApiConfig) => {
    setCustomApi(cfg);
    localStorage.setItem(PREF_KEYS.CUSTOM_API, JSON.stringify(cfg));
    showToast(cfg.enabled ? 'Harici API ayarları kaydedildi.' : 'Harici API devre dışı.', 'info');
  };

  const handleRequestClearAll = () => {
    setConfirmState({
      isOpen: true,
      title: 'Oturum Verilerini Temizle',
      description: user
        ? `"${user.email}" hesabınıza ait bu tarayıcıdaki sohbetler, klasörler ve görsel galerisi sıfırlanacak. Emin misiniz?`
        : 'Aktif misafir sohbetleriniz ve görsel galeriniz temizlenecek. Emin misiniz?',
      confirmLabel: 'Her Şeyi Sil',
      action: () => {
        const fresh = createEmptyChatObject('Yeni Sohbet');
        saveChats([fresh]);
        saveFolders([]);
        saveGallery([]);
        setSelectedFolderId('all');
        setActiveChatId(fresh.id);
        setConfirmState((prev) => ({ ...prev, isOpen: false, action: null }));
        setIsSettingsOpen(false);
        showToast('Oturum verileri temizlendi.', 'success');
      }
    });
  };

  const handlePreviewCode = (code: string, language: string) => {
    setSandboxInitialCode(wrapPreviewCode(code, language));
    setActiveView('code');
    showToast('Kod canlı sandbox önizlemesinde açıldı.', 'info');
  };

  const lastAiMsgIndex = useMemo(() => {
    for (let idx = currentChat.messages.length - 1; idx >= 0; idx--) {
      if (currentChat.messages[idx].role === 'assistant') return idx;
    }
    return -1;
  }, [currentChat.messages]);

  const visibleMessages = useMemo(() => {
    let list = showStarredOnly ? currentChat.messages.filter((m) => m.isStarred) : currentChat.messages;
    const q = chatMessageFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => m.text.toLowerCase().includes(q));
    }
    return list;
  }, [currentChat.messages, showStarredOnly, chatMessageFilter]);

  const engineStatusLabel = useMemo(() => {
    if (customApi.enabled) return 'Özel API';
    if (modelStatus === 'loading') return `Yükleniyor %${modelProgress}`;
    if (engineMode === 'local') return `${activeModel.shortName} · API’siz`;
    if (engineMode === 'gemini') return 'Gemini Motoru';
    return 'Hibrit (Gemini + Yerel)';
  }, [customApi.enabled, modelStatus, modelProgress, engineMode, activeModel.shortName]);

  /* ------------------------------------------------------------------------
   * 8. RENDER
   * ---------------------------------------------------------------------- */
  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importChats} className="hidden" />
      <input
        ref={attachmentInputRef}
        type="file"
        accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.py,.html,.css"
        onChange={handleAttachmentSelect}
        className="hidden"
      />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFileSelect} className="hidden" />

      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" />
      )}

      {/* ====================================================================
       * SOL SIDEBAR
       * ================================================================== */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[276px] shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Sigma AI
              </div>
              <a
                href="https://thesigmagames.github.io/sigma-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline truncate block"
              >
                thesigmagames.github.io
              </a>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Menüyü Kapat"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <button
            type="button"
            onClick={newChat}
            className="w-full py-2.5 px-4 rounded-xl sigma-accent-bg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="fa-solid fa-plus text-xs" />
            <span>Yeni Sohbet</span>
          </button>

          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => filterChats(e.target.value)}
              placeholder="Sohbetlerde ara (Ctrl+K)..."
              aria-label="Sohbetlerde ara"
              className="w-full pl-8 pr-7 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => filterChats('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Aramayı temizle"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>

          {/* Özel Sohbet Klasörleri */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Klasörler</span>
              <button
                type="button"
                onClick={() => setShowNewFolderForm((v) => !v)}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                + Klasör
              </button>
            </div>

            {showNewFolderForm && (
              <form onSubmit={handleCreateFolder} className="flex gap-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Klasör adı..."
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Ekle
                </button>
              </form>
            )}

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer border ${
                  selectedFolderId === 'all'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Tümü
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer border flex items-center gap-1 ${
                    selectedFolderId === f.id
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="truncate max-w-[90px]">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sohbet Listesi */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {loadChatList.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Eşleşen sohbet bulunamadı.
            </div>
          ) : (
            loadChatList.map((chat) => {
              const isActive = chat.id === currentChat.id && activeView === 'chat';
              return (
                <div
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {chat.pinned && (
                        <i
                          className="fa-solid fa-thumbtack text-[11px] sigma-accent-text shrink-0"
                          title="Sabitlenmiş sohbet"
                        />
                      )}
                      <span className="text-xs truncate">{chat.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5 tabular-nums">
                      {chat.messages.length} mesaj · {PERSONA_META[chat.persona]?.title || 'Genel'}
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1 shrink-0 transition-opacity ${
                      isActive || chat.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => pinChat(chat.id, e)}
                      title={chat.pinned ? 'Sabitlemeyi kaldır' : 'Üste sabitle'}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer ${
                        chat.pinned
                          ? 'sigma-accent-text hover:bg-blue-50 dark:hover:bg-blue-950/60'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      <i className="fa-solid fa-thumbtack" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteChat(chat.id, e)}
                      title="Sohbeti sil"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Alt Araçlar & Kullanıcı Profili */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-file-import text-[11px]" />
              <span>İçe Aktar</span>
            </button>
            <button
              type="button"
              onClick={showStats}
              className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-chart-simple text-[11px]" />
              <span>İstatistik</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-circle-question text-[11px]" />
              <span>Rehber</span>
            </button>
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-keyboard text-[11px]" />
              <span>Kısayollar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
          >
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: user?.avatarColor || '#475569' }}
            >
              {user ? user.name.slice(0, 1).toUpperCase() : <i className="fa-solid fa-user" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user ? user.name : 'Giriş Yap / Kayıt Ol'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user ? user.email : 'Misafir (Kayıt Tutulmaz)'}
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-[10px] text-slate-400" />
          </button>
        </div>
      </aside>

      {/* ====================================================================
       * ANA ÇALIŞMA ALANI
       * ================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Üst Başlık Çubuğu */}
        <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label="Menüyü Aç"
            >
              <i className="fa-solid fa-bars" />
            </button>

            <div className="min-w-0 hidden xl:flex items-center gap-2">
              {isRenamingTitle ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveChatTitle();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveChatTitle}
                    className="rounded-lg border border-blue-500 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-white w-40 focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(currentChat.title);
                    setIsRenamingTitle(true);
                  }}
                  title="Sohbet başlığını düzenlemek için tıkla"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[160px] hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left"
                >
                  {currentChat.title}
                </button>
              )}
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {engineStatusLabel}
              </span>
            </div>
          </div>

          {/* Orta: Stüdyo Sekmeleri */}
          <nav
            aria-label="Stüdyo Sekmeleri"
            className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 overflow-x-auto"
          >
            {[
              { id: 'chat' as StudioView, label: 'Sohbet', icon: 'fa-comments' },
              { id: 'voice_doc' as StudioView, label: 'Ses & Müzik', icon: 'fa-headset' },
              { id: 'compare' as StudioView, label: 'Karşılaştır', icon: 'fa-code-compare' },
              { id: 'image' as StudioView, label: 'Görsel', icon: 'fa-image' },
              { id: 'code' as StudioView, label: 'Kod & Oyun', icon: 'fa-code' },
              { id: 'scene3d' as StudioView, label: '3D Stüdyo', icon: 'fa-cube' },
              { id: 'debate' as StudioView, label: 'Münazara', icon: 'fa-scale-balanced' },
              { id: 'tools' as StudioView, label: 'Araçlar', icon: 'fa-toolbox' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playUiSound('click', soundEnabled);
                  setActiveView(tab.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-[11px]`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Sağ: Tema, Çoklu Aktar, Ayarlar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Açık Tema' : 'Koyu Tema'}
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} />
            </button>

            <button
              type="button"
              onClick={exportChat}
              title="Sohbetleri Çoklu Formatta Aktar (.txt, .md, .json, .html)"
              className="px-2.5 sm:px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-file-export" />
              <span className="hidden sm:inline">Aktar</span>
            </button>

            <button
              type="button"
              onClick={toggleSettings}
              title="Ayarlar"
              className="px-2.5 sm:px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-sliders" />
              <span className="hidden sm:inline">Ayarlar</span>
            </button>
          </div>
        </header>

        {/* Misafir Modu Gizlilik Bilgilendirme Şeridi */}
        {!user && (
          <div className="shrink-0 px-4 py-1.5 bg-amber-50/90 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-user-secret text-[11px]" />
              <span>
                <strong>Misafir Modu:</strong> Sohbet geçmişiniz kaydedilmiyor (sayfa yenilenince silinir).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="font-semibold underline hover:no-underline cursor-pointer"
            >
              Kaydetmek için Giriş Yap / Hesap Oluştur
            </button>
          </div>
        )}

        {/* ==================================================================
         * STÜDYO İÇERİĞİ
         * ================================================================ */}
        {activeView === 'voice_doc' ? (
          <VoiceDocStudio
            engineMode={engineMode}
            selectedModelId={selectedModelId}
            customApi={customApi}
            language={currentChat.language}
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'compare' ? (
          <CompareStudio
            selectedModelId={selectedModelId}
            customApi={customApi}
            language={currentChat.language}
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'image' ? (
          <ImageStudio
            gallery={imageGallery}
            onAddImage={(item) => saveGallery([item, ...imageGallery])}
            onDeleteImage={(id) => saveGallery(imageGallery.filter((g) => g.id !== id))}
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'code' ? (
          <CodeStudio
            initialCode={sandboxInitialCode}
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'scene3d' ? (
          <Scene3DStudio
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'debate' ? (
          <DebateStudio
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : activeView === 'tools' ? (
          <ToolsStudio
            onSendToChat={(promptText) => {
              setActiveView('chat');
              void sendMessage(false, undefined, promptText);
            }}
            onNotify={showToast}
          />
        ) : (
          /* SOHBET ÇALIŞMA ALANI */
          <>
            <div className="shrink-0 px-4 sm:px-6 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span>Mod:</span>
                  <select
                    value={currentChat.persona}
                    onChange={(e) => handleChangePersona(e.target.value as Persona)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    {(Object.keys(PERSONA_META) as Persona[]).map((key) => (
                      <option key={key} value={key}>
                        {PERSONA_META[key].title}
                      </option>
                    ))}
                  </select>
                </label>

                {folders.length > 0 && (
                  <select
                    value={currentChat.folderId || ''}
                    onChange={(e) => handleAssignChatFolder(currentChat.id, e.target.value)}
                    title="Sohbet Klasörü"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <option value="">Klasörsüz</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => setDeepThinking((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    deepThinking
                      ? 'sigma-accent-border sigma-accent-soft sigma-accent-text'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-brain text-[11px]" />
                  <span>Derin Düşünce</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWebSearch((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    webSearch
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-globe text-[11px]" />
                  <span>Web Arama</span>
                </button>

                <select
                  value={responseLength}
                  onChange={(e) => setResponseLength(e.target.value as ResponseLength)}
                  title="Yanıt Uzunluğu"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="short">Kısa Yanıt</option>
                  <option value="normal">Normal Yanıt</option>
                  <option value="detailed">Detaylı Yanıt</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative hidden md:block">
                  <input
                    type="text"
                    value={chatMessageFilter}
                    onChange={(e) => setChatMessageFilter(e.target.value)}
                    placeholder="Mesaj içinde ara..."
                    className="w-32 focus:w-44 transition-all rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100"
                  />
                  {chatMessageFilter && (
                    <button
                      type="button"
                      onClick={() => setChatMessageFilter('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>

                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  title="Sesli Okuma Hızı"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value={0.8}>0.8x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>

                <button
                  type="button"
                  onClick={() => setAutoSpeak((prev) => !prev)}
                  title="Yanıtları otomatik sesli oku"
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    autoSpeak
                      ? 'sigma-accent-border sigma-accent-soft sigma-accent-text'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-volume-high text-[11px]" />
                  <span className="hidden sm:inline">Sesli</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStarredOnly((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    showStarredOnly
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <i className="fa-solid fa-star text-[11px]" />
                  <span className="hidden sm:inline">Yıldızlılar</span>
                </button>

                {currentChat.messages.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={duplicateChat}
                      title="Bu sohbetin kopyasını oluştur"
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="fa-regular fa-clone text-[11px]" />
                      <span className="hidden sm:inline">Çoğalt</span>
                    </button>
                    <button
                      type="button"
                      onClick={restartCurrentChat}
                      title="Aktif sohbeti temizleyip baştan başlat"
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="fa-solid fa-rotate-left text-[11px]" />
                      <span>Baştan Başla</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mesaj Akış Alanı */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                {currentChat.messages.length === 0 && !isGenerating ? (
                  <div className="py-8 sm:py-14 space-y-7">
                    <div className="space-y-2.5 text-center max-w-xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                        Sigma AI • The Sigma Games
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Gemini Hibrit Zekası ve %100 API’siz Yerel Tarayıcı Motoru tek çalışma alanında: sohbet et, sesli konuş, belge özetle, görsel ve 2B oyun oluştur.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {engineMode === 'local'
                            ? `Yerel Model: ${activeModel.name}`
                            : engineMode === 'gemini'
                            ? 'Aktif Motor: Gemini Bulut Zekası'
                            : `Hibrit Motor: Gemini + ${activeModel.shortName} Yedeği`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {activeModel.specialty} · {activeModel.quantization}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadModel(selectedModelId)}
                        disabled={modelStatus === 'loading'}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <i className="fa-solid fa-microchip mr-1.5" />
                        {modelStatus === 'loading' ? `Yükleniyor (%${modelProgress})` : 'Yerel Modeli Yükle'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {STARTER_PROMPTS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => void sendMessage(false, undefined, item.text)}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 text-left transition-colors cursor-pointer space-y-1"
                        >
                          <div className="text-xs font-semibold sigma-accent-text">{item.label}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.text}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : visibleMessages.length === 0 && showStarredOnly ? (
                  <div className="py-16 text-center space-y-2">
                    <i className="fa-regular fa-star text-2xl text-slate-400" />
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Bu sohbette yıldızlanmış mesaj yok
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStarredOnly(false)}
                      className="text-xs sigma-accent-text hover:underline cursor-pointer"
                    >
                      Tüm mesajları göster
                    </button>
                  </div>
                ) : (
                  visibleMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const isEditing = editingMsgId === msg.id;
                    const originalIdx = currentChat.messages.findIndex((m) => m.id === msg.id);
                    const isLastAi = originalIdx === lastAiMsgIndex;
                    const genImgSrc = msg.generatedImage
                      ? brokenGalleryFallbacks[msg.generatedImage.id] || msg.generatedImage.url
                      : '';

                    return (
                      <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                            isUser
                              ? 'sigma-accent-bg text-white rounded-br-sm'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200/70 dark:border-slate-700/70'
                          }`}
                        >
                          {msg.image && (
                            <div className="mb-2.5 overflow-hidden rounded-xl border border-white/20">
                              <img
                                src={msg.image.data}
                                alt={msg.image.name}
                                onClick={() => setLightboxUrl(msg.image?.data || null)}
                                className="max-h-60 w-auto object-contain cursor-zoom-in"
                              />
                            </div>
                          )}

                          {msg.attachmentName && (
                            <div
                              className={`mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono ${
                                isUser ? 'bg-black/20 text-white' : 'bg-slate-300/60 dark:bg-slate-700'
                              }`}
                            >
                              <i className="fa-solid fa-paperclip text-[11px]" />
                              <span>{msg.attachmentName}</span>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="space-y-2 min-w-[240px]">
                              <textarea
                                rows={3}
                                value={editingMsgDraft}
                                onChange={(e) => setEditingMsgDraft(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  İptal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditedMessage(msg.id)}
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold sigma-accent-bg text-white cursor-pointer"
                                >
                                  Kaydet
                                </button>
                              </div>
                            </div>
                          ) : (
                            <MarkdownRenderer
                              content={msg.text}
                              isUser={isUser}
                              onPreviewCode={handlePreviewCode}
                            />
                          )}

                          {msg.generatedImage && (
                            <div className="mt-3 space-y-2">
                              <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950">
                                <img
                                  src={genImgSrc}
                                  alt={msg.generatedImage.originalPrompt}
                                  referrerPolicy="no-referrer"
                                  onClick={() => setLightboxUrl(genImgSrc)}
                                  onError={() => {
                                    const g = msg.generatedImage!;
                                    if (!brokenGalleryFallbacks[g.id]) {
                                      setBrokenGalleryFallbacks((prev) => ({
                                        ...prev,
                                        [g.id]: createProceduralFallbackImage(
                                          g.originalPrompt,
                                          g.style,
                                          g.aspectRatio
                                        )
                                      }));
                                    }
                                  }}
                                  className="max-h-80 w-full object-contain cursor-zoom-in"
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span className="truncate">{msg.generatedImage.model}</span>
                                <a
                                  href={genImgSrc}
                                  download={`sigma-gorsel-${msg.generatedImage.id}.png`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="sigma-accent-text hover:underline font-medium"
                                >
                                  İndir
                                </a>
                              </div>
                            </div>
                          )}

                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-300/70 dark:border-slate-700/80 space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Kaynaklar ve Bağlantılar
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.sources.map((src, idx) => (
                                  <a
                                    key={`${src.url}-${idx}`}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 text-[11px] sigma-accent-text hover:underline max-w-[240px] truncate"
                                  >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px] shrink-0" />
                                    <span className="truncate">{src.title}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div
                            className={`mt-1.5 flex items-center justify-between gap-3 text-[10px] ${
                              isUser ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <span className="truncate">
                              {msg.engineUsed ? `${msg.engineUsed}` : ''}
                              {msg.latencyMs ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s` : ''}
                            </span>
                            <span className="tabular-nums shrink-0 font-mono">
                              {msg.edited ? 'düzenlendi · ' : ''}
                              {msg.time}
                            </span>
                          </div>
                        </div>

                        {/* Mesaj Altı Aksiyonlar */}
                        <div className="mt-1.5 px-1 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => copyMessage(msg.text)}
                            className="px-2 py-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                          >
                            <i className="fa-regular fa-copy mr-1" />
                            <span>Kopyala</span>
                          </button>

                          {!isUser && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleReadAloud(msg)}
                                title={speakingMsgId === msg.id ? 'Okumayı durdur' : 'Sesli dinle'}
                                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                  speakingMsgId === msg.id
                                    ? 'sigma-accent-text sigma-accent-soft'
                                    : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                }`}
                              >
                                <i className={`fa-solid ${speakingMsgId === msg.id ? 'fa-volume-xmark' : 'fa-volume-high'}`} />
                              </button>

                              <button
                                type="button"
                                onClick={() => likeMessage(msg.id)}
                                title="Beğen"
                                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                  msg.reaction === 'like'
                                    ? 'sigma-accent-text sigma-accent-soft'
                                    : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                }`}
                              >
                                <i className="fa-regular fa-thumbs-up" />
                              </button>

                              <button
                                type="button"
                                onClick={() => dislikeMessage(msg.id)}
                                title="Beğenme"
                                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                  msg.reaction === 'dislike'
                                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60'
                                    : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                }`}
                              >
                                <i className="fa-regular fa-thumbs-down" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleStarMessage(msg.id)}
                            title={msg.isStarred ? 'Yıldızı kaldır' : 'Yıldızla'}
                            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                              msg.isStarred
                                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                                : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                          >
                            <i className={`${msg.isStarred ? 'fa-solid' : 'fa-regular'} fa-star`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditMessage(msg)}
                            className="px-2 py-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                          >
                            <i className="fa-regular fa-pen-to-square mr-1" />
                            <span>Düzenle</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteMessage(msg.id)}
                            className="px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <i className="fa-regular fa-trash-can mr-1" />
                            <span>Sil</span>
                          </button>

                          {!isUser && isLastAi && (
                            <>
                              <button
                                type="button"
                                onClick={regenerateLast}
                                disabled={isGenerating}
                                className="px-2 py-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-40"
                              >
                                <i className="fa-solid fa-rotate-right mr-1" />
                                <span>Yeniden Üret</span>
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => void sendMessage(false, undefined, 'Önceki yanıtını 3 kısa maddeyle özetle.')}
                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer disabled:opacity-40"
                              >
                                Kısalt
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => void sendMessage(false, undefined, 'Önceki yanıtını örneklerle daha detaylı açıkla.')}
                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer disabled:opacity-40"
                              >
                                Detaylandır
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => void sendMessage(false, undefined, 'Bu çözümü çalışır örnek bir koda dönüştür.')}
                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer disabled:opacity-40"
                              >
                                Koda Çevir
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {isGenerating && (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-bl-sm px-4 py-3 bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/70">
                      {streamingText ? (
                        <MarkdownRenderer content={streamingText} onPreviewCode={handlePreviewCode} />
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <i className="fa-solid fa-spinner fa-spin" />
                          <span>
                            {deepThinking
                              ? 'Derin düşünce analizi yürütülüyor...'
                              : webSearch
                              ? 'Web kaynakları taranıyor...'
                              : 'Yanıt hazırlanıyor...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Alt Mesaj Yazma Çubuğu */}
            <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="max-w-3xl mx-auto space-y-2 relative">
                {inputValue.startsWith('/') && !inputValue.includes(' ') && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 z-20 space-y-1">
                    {SLASH_COMMANDS.filter((c) => c.cmd.startsWith(inputValue.toLowerCase())).map((item) => (
                      <button
                        key={item.cmd}
                        type="button"
                        onClick={() => {
                          setInputValue(item.cmd === '/temizle' ? '/temizle' : `${item.cmd} `);
                          textareaRef.current?.focus();
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 text-left cursor-pointer"
                      >
                        <span className="font-mono text-xs font-bold sigma-accent-text">{item.cmd}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(attachedFile || attachedImage) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {attachedImage && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <img src={attachedImage.data} alt={attachedImage.name} className="w-7 h-7 rounded object-cover" />
                        <span className="truncate max-w-[140px]">{attachedImage.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachedImage(null)}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    )}
                    {attachedFile && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                        <i className="fa-solid fa-file-lines" />
                        <span className="truncate max-w-[160px]">{attachedFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachedFile(null)}
                          className="hover:text-rose-500 cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    title="Görsel ekle (veya Ctrl+V yapıştır)"
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <i className="fa-regular fa-image" />
                  </button>

                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    title="Metin veya kod dosyası ekle"
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <i className="fa-solid fa-paperclip" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!inputValue.startsWith('/görsel ')) setInputValue(`/görsel ${inputValue}`);
                      textareaRef.current?.focus();
                    }}
                    title="Sohbette hızlı görsel üret (/görsel)"
                    className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" />
                  </button>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(false);
                      }
                    }}
                    placeholder="Mesaj yaz, fotoğraf yapıştır veya /görsel ile çiz..."
                    className="flex-1 bg-transparent py-2 px-1 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none max-h-40"
                  />

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={isListening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isListening
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`} />
                  </button>

                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={() => {
                        streamCancelRef.current = true;
                        setIsGenerating(false);
                      }}
                      title="Üretimi durdur"
                      className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <i className="fa-solid fa-stop text-xs" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendMessage(false)}
                      disabled={!inputValue.trim() && !attachedFile && !attachedImage}
                      title="Gönder (Enter)"
                      className="w-9 h-9 rounded-xl sigma-accent-bg disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <i className="fa-solid fa-paper-plane text-xs" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span>Enter: Gönder · Ctrl+N: Yeni · Ctrl+/: Kısayollar</span>
                  <span>
                    {currentChat.language.toUpperCase()} · {PERSONA_META[currentChat.persona]?.title}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <footer className="shrink-0 px-4 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 truncate">
            Sigma AI · The Sigma Games
          </span>
          <a
            href="https://thesigmagames.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-200 font-medium transition-colors shrink-0"
          >
            <i className="fa-solid fa-gamepad sigma-accent-text" />
            <span>Sıkıldın mı? Biraz eğlen</span>
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">· thesigmagames.github.io</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400" />
          </a>
        </footer>
      </main>

      {/* ====================================================================
       * MODALLAR & GÖRSEL BÜYÜTEÇ
       * ================================================================== */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3">
            <img src={lightboxUrl} alt="Büyütülmüş Görsel" className="max-h-[82vh] w-auto rounded-2xl border border-slate-700 object-contain" />
            <div className="flex items-center gap-2">
              <a
                href={lightboxUrl}
                download={`sigma-gorsel-${Date.now()}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg sigma-accent-bg text-white text-xs font-semibold"
              >
                İndir
              </a>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentChat={currentChat}
        onUpdateSystemPrompt={handleUpdateSystemPrompt}
        onUpdateChatLanguage={handleUpdateChatLanguage}
        engineMode={engineMode}
        onChangeEngineMode={handleChangeEngineMode}
        selectedModelId={selectedModelId}
        modelStatus={modelStatus}
        modelProgress={modelProgress}
        modelStage={modelStage}
        onLoadModel={loadModel}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        accentTheme={accentTheme}
        onChangeAccentTheme={(t) => {
          setAccentTheme(t);
          if (user) {
            const nextUser = { ...user, accentTheme: t };
            setUser(nextUser);
            updateLocalAccountProfile(nextUser);
          }
          showToast('Vurgu tema paketi uygulandı.', 'success');
        }}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        customApi={customApi}
        onSaveCustomApi={handleSaveCustomApi}
        onRequestClearAll={handleRequestClearAll}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        chats={chats}
        activeChat={currentChat}
        onNotify={showToast}
      />

      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        chats={chats}
        imagesCount={imageGallery.length}
        activeModelName={engineStatusLabel}
        isGuest={!user}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        hasGuestMessages={!user && currentChat.messages.length > 0}
        onGoogleAuth={handleGoogleAuth}
        onAppleAuth={handleAppleAuth}
        onEmailLogin={handleEmailLogin}
        onEmailRegister={handleEmailRegister}
        onRequestPasswordReset={requestPasswordResetCodeHybrid}
        onConfirmPasswordReset={confirmPasswordResetWithCodeHybrid}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={() => confirmState.action?.()}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false, action: null }))}
      />

      {/* Bildirimler */}
      <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium border flex items-center gap-2 pointer-events-auto ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : t.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700 dark:border-slate-300'
            }`}
          >
            <i
              className={`fa-solid ${
                t.type === 'success'
                  ? 'fa-circle-check'
                  : t.type === 'error'
                  ? 'fa-circle-exclamation'
                  : 'fa-circle-info'
              }`}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
