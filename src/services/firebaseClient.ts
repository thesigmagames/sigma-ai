/**
 * Sigma AI • Hibrit Firebase + Yerel Web Crypto Kimlik Doğrulama & Hesap Bazlı Veri Eşitleme Servisi
 * - Misafirler için disk/bulut kaydı KESİNLİKLE yapılmaz.
 * - Doğrulanmış Firebase kullanıcıları Firestore'a + yerel önbelleğe senkronize edilir.
 * - E-posta/Şifre ve Apple oturumları Firebase Console'da aktif değilse bile yerel şifreli Web Crypto deposu
 *   sayesinde hesaba özel (e-posta izole) depolama kesintisiz çalışır.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser
} from 'firebase/auth';
import { getApiBaseUrl } from './localAiEngine';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  type Firestore
} from 'firebase/firestore';
import type {
  AccentTheme,
  AuthProvider,
  ChatFolder,
  ChatMessage,
  ChatSession,
  UserProfile
} from '../types/chat';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

interface FirebaseClientConfig {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

function resolveFirebaseConfig(): FirebaseClientConfig | null {
  try {
    const localModules = import.meta.glob<{ default: FirebaseClientConfig }>(
      '../../firebase-applet-config.json',
      { eager: true }
    );
    const localCfg = Object.values(localModules)[0]?.default;
    if (localCfg && localCfg.apiKey && localCfg.projectId) {
      return localCfg;
    }
  } catch {
    // Statik GitHub Pages ortamında yerel dosya yoksa env fallback'e geç
  }

  try {
    const env = (import.meta as any)?.env || {};
    if (typeof env.VITE_FIREBASE_CONFIG_JSON === 'string' && env.VITE_FIREBASE_CONFIG_JSON.trim()) {
      const parsed = JSON.parse(env.VITE_FIREBASE_CONFIG_JSON) as FirebaseClientConfig;
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
    if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: String(env.VITE_FIREBASE_API_KEY),
        projectId: String(env.VITE_FIREBASE_PROJECT_ID),
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ? String(env.VITE_FIREBASE_AUTH_DOMAIN) : undefined,
        appId: env.VITE_FIREBASE_APP_ID ? String(env.VITE_FIREBASE_APP_ID) : undefined,
        firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID ? String(env.VITE_FIREBASE_DATABASE_ID) : undefined,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ? String(env.VITE_FIREBASE_STORAGE_BUCKET) : undefined,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID
          ? String(env.VITE_FIREBASE_MESSAGING_SENDER_ID)
          : undefined
      };
    }
  } catch {
    // Env parse error
  }
  return null;
}

const firebaseConfig = resolveFirebaseConfig();

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
    appInstance = initializeApp(firebaseConfig);
    dbInstance = firebaseConfig.firestoreDatabaseId
      ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
      : getFirestore(appInstance);
    authInstance = getAuth(appInstance);
  }
} catch (err) {
  console.warn('Firebase initialization notice:', err);
}

export const db = dbInstance;
export const auth = authInstance;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

/* ============================================================================
 * YEREL WEB CRYPTO HESAP DEPOSU (E-POSTA + ŞİFRE HİBRİT YEDEĞİ)
 * ========================================================================== */
const LOCAL_ACCOUNTS_KEY = 'sigma_ai_hybrid_accounts_v2';
const ACTIVE_SESSION_KEY = 'sigma_ai_active_session_v2';

interface StoredLocalAccount {
  uid: string;
  email: string;
  name: string;
  provider: AuthProvider;
  avatarColor: string;
  accentTheme: AccentTheme;
  salt: string;
  passwordHash: string;
  createdAt: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeAuthDisplayText(raw: string): string {
  return raw
    .replace(/gen-lang-client-[a-z0-9-]+\.firebaseapp\.com/gi, 'Sigma AI (thesigmagames.github.io)')
    .replace(/[a-z0-9-]+\.firebaseapp\.com/gi, 'thesigmagames.github.io');
}

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export function getUserStorageNamespace(user: UserProfile | null): string | null {
  if (!user) return null;
  const base = user.email ? normalizeEmail(user.email) : user.uid;
  return sanitizeFirestoreId(base);
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readLocalAccounts(): Record<string, StoredLocalAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalAccounts(map: Record<string, StoredLocalAccount>): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota issues cleanly
  }
}

export function getSavedActiveUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || !parsed.uid || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveUser(user: UserProfile | null): void {
  try {
    if (!user) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage errors
  }
}

export function subscribeFirebaseAuth(callback: (fbUser: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function mapFirebaseUserToProfile(
  fbUser: FirebaseUser,
  providerOverride?: AuthProvider,
  avatarColor = '#2563eb'
): UserProfile {
  const pId = fbUser.providerData?.[0]?.providerId || '';
  const detectedProvider: AuthProvider =
    providerOverride ||
    (pId.includes('google') ? 'google' : pId.includes('apple') ? 'apple' : 'email');
  return {
    uid: sanitizeFirestoreId(fbUser.uid),
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Sigma Kullanıcısı',
    email: fbUser.email || '',
    provider: detectedProvider,
    avatarColor,
    accentTheme: 'cobalt',
    isFirebaseUser: true,
    emailVerified: fbUser.emailVerified,
    loggedInAt: Date.now()
  };
}

/**
 * Google ile Giriş (Firebase Popup + temiz hata yönetimi)
 */
export async function signInWithGoogleHybrid(): Promise<{
  user: UserProfile;
  note?: string;
}> {
  if (!auth) {
    throw new Error('Firebase Auth başlatılamadı.');
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const profile = mapFirebaseUserToProfile(cred.user, 'google', '#2563eb');
    saveActiveUser(profile);
    if (cred.user.emailVerified) {
      await syncUserProfileToFirestore(profile).catch(() => {});
    }
    return { user: profile };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google giriş penceresi kapatıldı.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Tarayıcı açılır pencereyi engelledi. Lütfen popup izni verip tekrar deneyin.');
    }
    if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-supported-in-this-environment') {
      throw new Error(
        'Bu alan adı Firebase Console -> Authentication -> Authorized domains listesine eklenmelidir.'
      );
    }
    throw new Error(sanitizeAuthDisplayText(err?.message || 'Google ile giriş yapılamadı.'));
  }
}

/**
 * Apple ile Giriş (Firebase OAuthProvider denemesi + kullanıcının girdiği Apple ID ile kesintisiz hibrit fallback)
 */
export async function signInWithAppleHybrid(fallbackInput?: {
  name?: string;
  email?: string;
  avatarColor?: string;
}): Promise<{ user: UserProfile; note?: string }> {
  if (auth && !fallbackInput?.email) {
    try {
      const appleProvider = new OAuthProvider('apple.com');
      appleProvider.addScope('email');
      appleProvider.addScope('name');
      const cred = await signInWithPopup(auth, appleProvider);
      const profile = mapFirebaseUserToProfile(cred.user, 'apple', fallbackInput?.avatarColor || '#0f172a');
      saveActiveUser(profile);
      return { user: profile };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        throw new Error('Apple giriş penceresi kapatıldı.');
      }
      // Apple OAuth Firebase Console'da yapılandırılmadıysa kullanıcı e-posta formuna yönlendir
      if (!fallbackInput?.email) {
        throw new Error('APPLE_NEEDS_FORM');
      }
    }
  }

  const email = normalizeEmail(fallbackInput?.email || '');
  const name = (fallbackInput?.name || '').trim() || email.split('@')[0] || 'Apple Kullanıcısı';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Geçerli bir Apple e-posta adresi girin.');
  }

  const accounts = readLocalAccounts();
  let existingAcc = accounts[email];
  if (!existingAcc) {
    existingAcc = {
      uid: sanitizeFirestoreId(`apple_${email}`),
      email,
      name,
      provider: 'apple',
      avatarColor: fallbackInput?.avatarColor || '#0f172a',
      accentTheme: 'cobalt',
      salt: '',
      passwordHash: '',
      createdAt: Date.now()
    };
    accounts[email] = existingAcc;
    writeLocalAccounts(accounts);
  }

  const profile: UserProfile = {
    uid: existingAcc.uid,
    name: existingAcc.name || name,
    email,
    provider: 'apple',
    avatarColor: fallbackInput?.avatarColor || existingAcc.avatarColor || '#0f172a',
    accentTheme: existingAcc.accentTheme || 'cobalt',
    isFirebaseUser: false,
    emailVerified: false,
    loggedInAt: Date.now()
  };
  saveActiveUser(profile);
  return {
    user: profile,
    note: 'Apple kimliğiniz bu tarayıcıda hesabınıza izole edilerek açıldı.'
  };
}

/**
 * E-posta ve Şifre ile Kayıt Ol (Hesap Oluştur)
 */
export async function registerWithEmailPasswordHybrid(params: {
  name: string;
  email: string;
  password: string;
  avatarColor: string;
}): Promise<{ user: UserProfile; note?: string }> {
  const cleanName = params.name.trim();
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password;

  if (!cleanName || cleanName.length < 2) {
    throw new Error('Ad Soyad en az 2 karakter olmalıdır.');
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Lütfen geçerli bir e-posta adresi girin.');
  }
  if (!password || password.length < 6) {
    throw new Error('Şifre en az 6 karakter olmalıdır.');
  }

  // Yerel Web Crypto hesabı oluştur/kontrol et
  const accounts = readLocalAccounts();
  if (accounts[cleanEmail]) {
    throw new Error('Bu e-posta adresiyle zaten kayıtlı bir hesap var. Lütfen Giriş Yap sekmesini kullanın.');
  }

  const salt = generateSalt();
  const passwordHash = await hashPasswordWithSalt(password, salt);
  let uid = sanitizeFirestoreId(`usr_${cleanEmail}_${Date.now().toString(36)}`);
  let isFirebaseUser = false;
  let note = 'Hesabınız oluşturuldu! Tüm sohbetleriniz artık bu e-posta hesabınıza özel kaydedilecek.';

  if (auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await firebaseUpdateProfile(cred.user, { displayName: cleanName }).catch(() => {});
      await sendEmailVerification(cred.user).catch(() => {});
      uid = sanitizeFirestoreId(cred.user.uid);
      isFirebaseUser = true;
      note = 'Hesap oluşturuldu ve doğrulama e-postası gönderildi. Sohbetleriniz hesabınıza özel kaydediliyor.';
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (code === 'auth/email-already-in-use') {
        throw new Error('Bu e-posta adresi Firebase üzerinde zaten kayıtlı. Giriş Yap sekmesini deneyin.');
      }
      if (code === 'auth/weak-password') {
        throw new Error('Şifre çok zayıf. Lütfen en az 6 karakterli güçlü bir şifre belirleyin.');
      }
      // auth/operation-not-allowed -> Firebase Console E-posta/Şifre açık değilse yerel Web Crypto devam eder
    }
  }

  accounts[cleanEmail] = {
    uid,
    email: cleanEmail,
    name: cleanName,
    provider: 'email',
    avatarColor: params.avatarColor,
    accentTheme: 'cobalt',
    salt,
    passwordHash,
    createdAt: Date.now()
  };
  writeLocalAccounts(accounts);

  const profile: UserProfile = {
    uid,
    name: cleanName,
    email: cleanEmail,
    provider: 'email',
    avatarColor: params.avatarColor,
    accentTheme: 'cobalt',
    isFirebaseUser,
    emailVerified: false,
    loggedInAt: Date.now()
  };
  saveActiveUser(profile);
  return { user: profile, note };
}

/**
 * E-posta ve Şifre ile Giriş Yap
 */
export async function loginWithEmailPasswordHybrid(params: {
  email: string;
  password: string;
}): Promise<{ user: UserProfile; note?: string }> {
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password;

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Geçerli bir e-posta adresi girin.');
  }
  if (!password) {
    throw new Error('Lütfen şifrenizi girin.');
  }

  const accounts = readLocalAccounts();
  const localAcc = accounts[cleanEmail];

  if (auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const profile = mapFirebaseUserToProfile(
        cred.user,
        'email',
        localAcc?.avatarColor || '#2563eb'
      );
      if (localAcc?.name) profile.name = localAcc.name;
      saveActiveUser(profile);
      return { user: profile };
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        if (!localAcc) {
          throw new Error('E-posta veya şifre hatalı.');
        }
      } else if (code === 'auth/user-not-found' && !localAcc) {
        throw new Error('Bu e-posta adresine ait hesap bulunamadı. Kayıt Ol sekmesinden yeni hesap oluşturabilirsiniz.');
      }
      // Fallback to local verification if registered locally
    }
  }

  if (!localAcc) {
    throw new Error('Bu e-posta adresine ait hesap bulunamadı. Lütfen "Kayıt Ol / Hesap Oluştur" butonuna tıklayın.');
  }

  const candidateHash = await hashPasswordWithSalt(password, localAcc.salt);
  if (candidateHash !== localAcc.passwordHash) {
    throw new Error('Girdiğiniz şifre hatalı.');
  }

  const profile: UserProfile = {
    uid: localAcc.uid,
    name: localAcc.name,
    email: localAcc.email,
    provider: localAcc.provider || 'email',
    avatarColor: localAcc.avatarColor,
    accentTheme: localAcc.accentTheme || 'cobalt',
    isFirebaseUser: false,
    emailVerified: false,
    loggedInAt: Date.now()
  };
  saveActiveUser(profile);
  return { user: profile };
}

export async function logoutHybrid(): Promise<void> {
  saveActiveUser(null);
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      // ignore if local-only session
    }
  }
}

/* ============================================================================
 * ŞİFREMİ UNUTTUM (E-POSTAYA 6 HANELİ KOD + FIREBASE RESET + HİBRİT GÜNCELLEME)
 * ========================================================================== */
const CLIENT_OTP_PREFIX = 'sigma_ai_otp_';

export async function requestPasswordResetCodeHybrid(rawEmail: string): Promise<{
  deliveryMode: 'email' | 'simulated_inbox';
  previewCode?: string;
  firebaseEmailSent: boolean;
  expiresInSeconds: number;
}> {
  const cleanEmail = normalizeEmail(rawEmail);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Lütfen geçerli bir e-posta adresi girin.');
  }

  let firebaseEmailSent = false;
  if (auth) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      firebaseEmailSent = true;
    } catch {
      // Yerel veya Google hesabı için sessizce devam et
    }
  }

  // Sunucu API (/api/auth/send-reset-code) dene
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/send-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        deliveryMode: data.deliveryMode === 'email' ? 'email' : 'simulated_inbox',
        previewCode: data.previewCode,
        firebaseEmailSent,
        expiresInSeconds: Number(data.expiresInSeconds) || 600
      };
    }
  } catch {
    // Statik GitHub Pages ortamında istemci tarafı OTP yedeği devreye girer
  }

  // Statik web / API'siz yedek OTP (sessionStorage içinde tuzlanmış SHA-256)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(100000 + (buf[0] % 900000));
  const salt = generateSalt();
  const codeHash = await hashPasswordWithSalt(code, salt);
  try {
    sessionStorage.setItem(
      `${CLIENT_OTP_PREFIX}${cleanEmail}`,
      JSON.stringify({
        salt,
        codeHash,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0
      })
    );
  } catch {
    // ignore sessionStorage error
  }

  return {
    deliveryMode: 'simulated_inbox',
    previewCode: code,
    firebaseEmailSent,
    expiresInSeconds: 600
  };
}

export async function confirmPasswordResetWithCodeHybrid(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ note: string }> {
  const cleanEmail = normalizeEmail(params.email);
  const cleanCode = params.code.trim();
  const newPassword = params.newPassword;

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Geçerli bir e-posta adresi girin.');
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Lütfen 6 haneli doğrulama kodunu eksiksiz girin.');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Yeni şifre en az 6 karakter olmalıdır.');
  }

  let verified = false;
  let verifyError = '';

  // 1. Önce sunucu OTP kontrolü
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode })
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      verified = true;
    } else if (data?.error && !String(data.error).includes('Aktif bir doğrulama kodu bulunamadı')) {
      verifyError = data.error;
    }
  } catch {
    // Sunucu erişilemiyorsa client OTP yedeğine düş
  }

  // 2. Statik web / client OTP kontrolü
  if (!verified && !verifyError) {
    try {
      const rawOtp = sessionStorage.getItem(`${CLIENT_OTP_PREFIX}${cleanEmail}`);
      if (rawOtp) {
        const rec = JSON.parse(rawOtp) as {
          salt: string;
          codeHash: string;
          expiresAt: number;
          attempts: number;
        };
        if (Date.now() > rec.expiresAt) {
          sessionStorage.removeItem(`${CLIENT_OTP_PREFIX}${cleanEmail}`);
          throw new Error('Doğrulama kodunun süresi doldu. Lütfen yeni kod isteyin.');
        }
        rec.attempts = (rec.attempts || 0) + 1;
        if (rec.attempts > 5) {
          sessionStorage.removeItem(`${CLIENT_OTP_PREFIX}${cleanEmail}`);
          throw new Error('Çok fazla hatalı deneme. Yeni kod talep edin.');
        }
        const candHash = await hashPasswordWithSalt(cleanCode, rec.salt);
        if (candHash !== rec.codeHash) {
          sessionStorage.setItem(`${CLIENT_OTP_PREFIX}${cleanEmail}`, JSON.stringify(rec));
          throw new Error(`Doğrulama kodu hatalı (Kalan deneme: ${Math.max(0, 5 - rec.attempts)}).`);
        }
        sessionStorage.removeItem(`${CLIENT_OTP_PREFIX}${cleanEmail}`);
        verified = true;
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Doğrulama kodu kontrol edilemedi.');
    }
  }

  if (!verified) {
    throw new Error(verifyError || 'Doğrulama kodu geçersiz veya süresi dolmuş. Lütfen tekrar kod isteyin.');
  }

  // 3. Tuzlanmış SHA-256 şifreyi hibrit hesap deposunda güncelle (veya oluştur)
  const accounts = readLocalAccounts();
  const salt = generateSalt();
  const passwordHash = await hashPasswordWithSalt(newPassword, salt);
  const existing = accounts[cleanEmail];

  accounts[cleanEmail] = existing
    ? { ...existing, provider: 'email', salt, passwordHash }
    : {
        uid: sanitizeFirestoreId(`usr_${cleanEmail}_${Date.now().toString(36)}`),
        email: cleanEmail,
        name: cleanEmail.split('@')[0] || 'Sigma Kullanıcısı',
        provider: 'email',
        avatarColor: '#2563eb',
        accentTheme: 'cobalt',
        salt,
        passwordHash,
        createdAt: Date.now()
      };
  writeLocalAccounts(accounts);

  return {
    note: 'Şifreniz başarıyla güncellendi! Artık yeni şifrenizle giriş yapabilirsiniz.'
  };
}

export function updateLocalAccountProfile(user: UserProfile): void {
  saveActiveUser(user);
  const accounts = readLocalAccounts();
  const key = normalizeEmail(user.email);
  if (accounts[key]) {
    accounts[key] = {
      ...accounts[key],
      name: user.name,
      avatarColor: user.avatarColor,
      accentTheme: user.accentTheme || 'cobalt'
    };
    writeLocalAccounts(accounts);
  }
}

/* ============================================================================
 * HESABA ÖZEL DEPOLAMA + DOĞRULANMIŞ FIRESTORE EŞİTLEMESİ
 * ========================================================================== */

export function loadUserScopedData(user: UserProfile): {
  chats: ChatSession[];
  folders: ChatFolder[];
  galleryJson: string | null;
  activeChatId: string;
} {
  const ns = getUserStorageNamespace(user);
  if (!ns) return { chats: [], folders: [], galleryJson: null, activeChatId: '' };

  let chats: ChatSession[] = [];
  let folders: ChatFolder[] = [];
  let galleryJson: string | null = null;
  let activeChatId = '';

  try {
    const rawChats = localStorage.getItem(`sigma_ai_u_${ns}_chats`);
    if (rawChats) chats = JSON.parse(rawChats);
  } catch {}
  try {
    const rawFolders = localStorage.getItem(`sigma_ai_u_${ns}_folders`);
    if (rawFolders) folders = JSON.parse(rawFolders);
  } catch {}
  try {
    galleryJson = localStorage.getItem(`sigma_ai_u_${ns}_gallery`);
  } catch {}
  try {
    activeChatId = localStorage.getItem(`sigma_ai_u_${ns}_active_id`) || '';
  } catch {}

  return { chats, folders, galleryJson, activeChatId };
}

export function saveUserScopedChats(user: UserProfile, chats: ChatSession[]): void {
  const ns = getUserStorageNamespace(user);
  if (!ns) return;
  try {
    localStorage.setItem(`sigma_ai_u_${ns}_chats`, JSON.stringify(chats));
  } catch {}
}

export function saveUserScopedFolders(user: UserProfile, folders: ChatFolder[]): void {
  const ns = getUserStorageNamespace(user);
  if (!ns) return;
  try {
    localStorage.setItem(`sigma_ai_u_${ns}_folders`, JSON.stringify(folders));
  } catch {}
}

export function saveUserScopedGallery(user: UserProfile, gallery: unknown[]): void {
  const ns = getUserStorageNamespace(user);
  if (!ns) return;
  try {
    localStorage.setItem(`sigma_ai_u_${ns}_gallery`, JSON.stringify(gallery.slice(0, 30)));
  } catch {}
}

export function saveUserScopedActiveId(user: UserProfile, activeId: string): void {
  const ns = getUserStorageNamespace(user);
  if (!ns) return;
  try {
    localStorage.setItem(`sigma_ai_u_${ns}_active_id`, activeId);
  } catch {}
}

function canUseVerifiedFirestore(user: UserProfile | null): boolean {
  return Boolean(
    db &&
      auth?.currentUser &&
      auth.currentUser.emailVerified === true &&
      user &&
      sanitizeFirestoreId(auth.currentUser.uid) === user.uid
  );
}

export async function syncUserProfileToFirestore(user: UserProfile): Promise<void> {
  if (!canUseVerifiedFirestore(user) || !db || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        name: user.name.slice(0, 100),
        email: user.email.slice(0, 254),
        provider: user.provider || 'google',
        avatarColor: user.avatarColor.slice(0, 24),
        accentTheme: user.accentTheme || 'cobalt',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(
        ref,
        {
          name: user.name.slice(0, 100),
          email: user.email.slice(0, 254),
          avatarColor: user.avatarColor.slice(0, 24),
          accentTheme: user.accentTheme || 'cobalt',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncChatSessionToFirestore(
  user: UserProfile,
  chat: ChatSession
): Promise<void> {
  if (!canUseVerifiedFirestore(user) || !db || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  const chatId = sanitizeFirestoreId(chat.id);
  const chatPath = `users/${uid}/chats/${chatId}`;

  try {
    const chatRef = doc(db, 'users', uid, 'chats', chatId);
    const existingSnap = await getDoc(chatRef);
    const basePayload = {
      id: chatId,
      ownerId: uid,
      title: (chat.title || 'Yeni Sohbet').slice(0, 140),
      pinned: Boolean(chat.pinned),
      folderId: (chat.folderId || '').slice(0, 128),
      systemPrompt: (chat.systemPrompt || '').slice(0, 4000),
      persona: chat.persona || 'general',
      language: chat.language || 'tr',
      messageCount: Math.min(chat.messages.length, 5000),
      updatedAt: serverTimestamp()
    };

    if (!existingSnap.exists()) {
      await setDoc(chatRef, {
        ...basePayload,
        createdAt: serverTimestamp()
      });
    } else {
      await setDoc(chatRef, basePayload, { merge: true });
    }

    // Son mesajları senkronize et (en fazla son 40 metin mesajı; görsel base64 Firestore limitine takılmaz)
    for (const m of chat.messages.slice(-40)) {
      const msgId = sanitizeFirestoreId(m.id);
      const msgRef = doc(db, 'users', uid, 'chats', chatId, 'messages', msgId);
      const msgSnap = await getDoc(msgRef);
      const safeText = (m.text || '').slice(0, 40000);
      const reactionVal = m.reaction === 'like' || m.reaction === 'dislike' ? m.reaction : 'none';
      if (!msgSnap.exists()) {
        await setDoc(msgRef, {
          id: msgId,
          ownerId: uid,
          chatId,
          role: m.role,
          text: safeText,
          time: (m.time || '').slice(0, 32),
          reaction: reactionVal,
          edited: Boolean(m.edited),
          isStarred: Boolean(m.isStarred),
          engineUsed: (m.engineUsed || 'Sigma AI').slice(0, 120),
          createdAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.warn('Firestore chat sync warning:', err);
  }
}

export async function deleteChatFromFirestore(user: UserProfile, chatId: string): Promise<void> {
  if (!canUseVerifiedFirestore(user) || !db || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  const safeId = sanitizeFirestoreId(chatId);
  try {
    await deleteDoc(doc(db, 'users', uid, 'chats', safeId));
  } catch (err) {
    console.warn('Firestore delete chat warning:', err);
  }
}

export async function loadChatsFromFirestore(user: UserProfile): Promise<ChatSession[] | null> {
  if (!canUseVerifiedFirestore(user) || !db || !auth?.currentUser) return null;
  const uid = auth.currentUser.uid;
  const chatsColPath = `users/${uid}/chats`;

  try {
    const q = query(
      collection(db, 'users', uid, 'chats'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const sessions: ChatSession[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      const msgsSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'chats', d.id, 'messages'),
          where('ownerId', '==', uid)
        )
      );
      const messages: Array<ChatMessage & { _ts?: number }> = msgsSnap.docs.map((md) => {
        const m = md.data();
        return {
          id: String(m.id || md.id),
          role: m.role === 'user' ? 'user' : 'assistant',
          text: String(m.text || ''),
          time: String(m.time || ''),
          reaction: m.reaction === 'like' || m.reaction === 'dislike' ? m.reaction : null,
          edited: Boolean(m.edited),
          isStarred: Boolean(m.isStarred),
          engineUsed: m.engineUsed ? String(m.engineUsed) : undefined,
          _ts: m.createdAt?.toMillis?.() || 0
        };
      });
      messages.sort((a, b) => (a._ts || 0) - (b._ts || 0));

      sessions.push({
        id: String(data.id || d.id),
        title: String(data.title || 'Sohbet'),
        pinned: Boolean(data.pinned),
        folderId: data.folderId ? String(data.folderId) : undefined,
        systemPrompt: String(data.systemPrompt || ''),
        persona: data.persona || 'general',
        language: data.language || 'tr',
        messages: messages.map(({ _ts, ...rest }) => rest),
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() || Date.now()
      });
    }
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;
  } catch (err) {
    console.warn('Firestore load chats notice (falling back to account cache):', err);
    return null;
  }
}

export async function syncFolderToFirestore(user: UserProfile, folder: ChatFolder): Promise<void> {
  if (!canUseVerifiedFirestore(user) || !db || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  const safeId = sanitizeFirestoreId(folder.id);
  try {
    await setDoc(doc(db, 'users', uid, 'folders', safeId), {
      id: safeId,
      ownerId: uid,
      name: folder.name.slice(0, 60),
      color: folder.color.slice(0, 24),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore folder sync warning:', err);
  }
}
