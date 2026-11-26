import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type MobilePlatform = 'ios' | 'harmony' | 'android' | 'desktop';

function detectMobilePlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const isIOSDevice =
    /iphone|ipad|ipod/.test(ua) ||
    (ua.includes('macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  if (isIOSDevice) return 'ios';
  if (/harmonyos|openharmony|hms|huawei|honor|arkweb/.test(ua)) return 'harmony';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<MobilePlatform>('desktop');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    setPlatform(detectMobilePlatform());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canNativeInstall: Boolean(deferredPrompt),
    isInstalled,
    platform,
    install
  };
}

interface MobileInstallButtonProps {
  compact?: boolean;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MobileInstallButton: React.FC<MobileInstallButtonProps> = ({ compact = false, onNotify }) => {
  const { canNativeInstall, isInstalled, platform, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const isMobile = platform !== 'desktop';
  if (!canNativeInstall && !isMobile) return null;

  const handleClick = async () => {
    if (canNativeInstall) {
      const ok = await install();
      if (ok) {
        onNotify?.('Sigma AI ana ekrana eklendi.', 'success');
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Uygulamayı Telefona / Ana Ekrana Yükle"
        className={
          compact
            ? 'w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer'
            : 'px-2.5 sm:px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap'
        }
      >
        <i className="fa-solid fa-mobile-screen-button text-xs sigma-accent-text" />
        {!compact && <span className="hidden sm:inline">Yükle</span>}
      </button>

      {showGuide && (
        <div
          onClick={() => setShowGuide(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sigma AI Mobil Uygulama Olarak Ekle
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {platform === 'ios' ? (
              <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-decimal pl-4">
                <li>
                  Safari alt araç çubuğundaki <strong>Paylaş</strong> (<i className="fa-solid fa-arrow-up-from-bracket" />) simgesine dokunun.
                </li>
                <li>
                  Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.
                </li>
                <li>
                  Sağ üstten <strong>Ekle</strong> butonuna basın; Sigma AI iPhone/iPad tam ekran uygulama olarak açılır.
                </li>
              </ol>
            ) : platform === 'harmony' ? (
              <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-decimal pl-4">
                <li>
                  Huawei / HarmonyOS Tarayıcı sağ alt veya sağ üst <strong>Menü (⋮ / ≡)</strong> simgesine dokunun.
                </li>
                <li>
                  <strong>Ana Ekrana Ekle</strong> veya <strong>Uygulamayı Yükle</strong> seçeneğine dokunun.
                </li>
                <li>
                  Onayladıktan sonra HarmonyOS ana ekranınızdan tam ekran uygulama gibi başlatın.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-decimal pl-4">
                <li>
                  Tarayıcınızın sağ üstündeki <strong>⋮ Menü</strong> simgesine dokunun.
                </li>
                <li>
                  <strong>Uygulamayı yükle</strong> veya <strong>Ana ekrana ekle</strong> seçeneğini seçin.
                </li>
                <li>
                  Onaylayarak Android cihazınızda tam ekran PWA olarak kullanın.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
