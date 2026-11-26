/**
 * Sigma AI • The Sigma Games — Merkezi Tip Tanımları
 */

export type MessageRole = 'user' | 'assistant';
export type MessageReaction = 'like' | 'dislike' | null;
export type AiEngineMode = 'hybrid' | 'gemini' | 'local';
export type Persona = 'general' | 'coder' | 'writer' | 'tutor' | 'grok' | 'artist';
export type AppLanguage = 'tr' | 'en' | 'de' | 'es';
export type ResponseLength = 'short' | 'normal' | 'detailed';
export type StudioView = 'chat' | 'voice_doc' | 'compare' | 'image' | 'code' | 'scene3d' | 'debate' | 'tools';
export type ExportFormat = 'json' | 'md' | 'txt' | 'html';
export type AccentTheme = 'cobalt' | 'emerald' | 'amber' | 'amethyst';
export type AntigravityIntensity = 'full' | 'subtle' | 'off';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface AttachedImageData {
  data: string; // base64 data URL
  mimeType: string;
  name: string;
}

export interface GeneratedImageItem {
  id: string;
  url: string;
  prompt: string;
  originalPrompt: string;
  translatedSubject?: string;
  negativePrompt?: string;
  seed?: number;
  style: string;
  aspectRatio: string;
  model: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  time: string;
  reaction?: MessageReaction;
  edited?: boolean;
  isStarred?: boolean;
  attachmentName?: string;
  image?: AttachedImageData;
  generatedImage?: GeneratedImageItem;
  sources?: GroundingSource[];
  engineUsed?: string;
  thoughts?: string;
  thinkingMs?: number;
  deepThinking?: boolean;
  webSearch?: boolean;
  latencyMs?: number;
}

export interface ChatFolder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  pinned: boolean;
  folderId?: string;
  systemPrompt: string;
  persona: Persona;
  language: AppLanguage;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type AuthProvider = 'google' | 'apple' | 'email' | null;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  provider: AuthProvider;
  avatarColor: string;
  accentTheme?: AccentTheme;
  isFirebaseUser?: boolean;
  emailVerified?: boolean;
  loggedInAt: number;
}

export interface LocalModelSpec {
  id: string;
  name: string;
  shortName: string;
  sizeLabel: string;
  specialty: string;
  quantization: string;
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CustomApiConfig {
  enabled: boolean;
  endpointUrl: string;
  apiKey: string;
  modelName: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
