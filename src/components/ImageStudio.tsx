import React, { useState, useRef, useEffect } from 'react';
import {
  createProceduralFallbackImage,
  requestAiImage,
  requestEnhancePrompt
} from '../services/localAiEngine';
import type { GeneratedImageItem } from '../types/chat';

interface ImageStudioProps {
  gallery: GeneratedImageItem[];
  onAddImage: (item: GeneratedImageItem) => void;
  onDeleteImage: (id: string) => void;
  onSendToChat: (promptText: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const STYLES = [
  { id: 'natural', label: 'Doğal (Tam İstek)' },
  { id: 'photo', label: 'Fotorealistik' },
  { id: '3d', label: '3D Render' },
  { id: 'anime', label: 'Anime Sanat' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'fantasy', label: 'Fantastik' },
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'watercolor', label: 'Suluboya' },
  { id: 'retro', label: 'Retro' }
];

const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const SAMPLE_IDEAS = [
  'Sevimli bir maymun ormanda oturmuş sarı muz yiyor',
  'Yağmurlu Neo-İstanbul sokaklarında süzülen fütüristik spor araba',
  'Cam kubbe içinde yıldız haritalarını inceleyen kaşif astronot',
  'Minimalist stüdyo ışığında el yapımı mekanik klavye'
];

export const ImageStudio: React.FC<ImageStudioProps> = ({
  gallery,
  onAddImage,
  onDeleteImage,
  onSendToChat,
  onNotify
}) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [style, setStyle] = useState('natural');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [seedInput, setSeedInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activePreview, setActivePreview] = useState<GeneratedImageItem | null>(gallery[0] || null);
  const [brokenIds, setBrokenIds] = useState<Record<string, string>>({});

  // Canlı Görsel Düzenleyici State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSourceUrl, setEditorSourceUrl] = useState('');
  const [edBrightness, setEdBrightness] = useState(100);
  const [edContrast, setEdContrast] = useState(100);
  const [edSaturate, setEdSaturate] = useState(100);
  const [edSepia, setEdSepia] = useState(0);
  const [edBlur, setEdBlur] = useState(0);
  const [edRotation, setEdRotation] = useState(0);
  const [edCaption, setEdCaption] = useState('');
  const [edCaptionColor, setEdCaptionColor] = useState('#ffffff');

  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const localImgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditorOpen || !editorSourceUrl) return;
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const swap = edRotation % 180 !== 0;
      const cw = swap ? img.naturalHeight || 800 : img.naturalWidth || 800;
      const ch = swap ? img.naturalWidth || 800 : img.naturalHeight || 800;
      canvas.width = Math.min(1200, cw);
      canvas.height = Math.round(canvas.width * (ch / cw));

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${edBrightness}%) contrast(${edContrast}%) saturate(${edSaturate}%) sepia(${edSepia}%) blur(${edBlur}px)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((edRotation * Math.PI) / 180);
      const drawW = swap ? canvas.height : canvas.width;
      const drawH = swap ? canvas.width : canvas.height;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      if (edCaption.trim()) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
        ctx.fillRect(0, canvas.height - 64, canvas.width, 64);
        ctx.fillStyle = edCaptionColor;
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(edCaption.trim().slice(0, 60), canvas.width / 2, canvas.height - 24);
      }
    };
    img.onerror = () => {
      if (activePreview) {
        const fb = createProceduralFallbackImage(activePreview.originalPrompt, activePreview.style, activePreview.aspectRatio);
        if (fb && fb !== editorSourceUrl) setEditorSourceUrl(fb);
      }
    };
    img.src = editorSourceUrl;
  }, [isEditorOpen, editorSourceUrl, edBrightness, edContrast, edSaturate, edSepia, edBlur, edRotation, edCaption, edCaptionColor, activePreview]);

  const handleEnhance = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await requestEnhancePrompt(prompt);
      setPrompt(enhanced);
      onNotify('İstem yapay zeka ile zenginleştirildi.', 'success');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async (forceRandomSeed = false) => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const parsedSeed =
        !forceRandomSeed && seedInput.trim() && Number(seedInput.trim()) > 0
          ? Number(seedInput.trim())
          : undefined;
      const item = await requestAiImage(
        prompt.trim(),
        aspectRatio,
        style,
        negativePrompt.trim(),
        parsedSeed
      );
      onAddImage(item);
      setActivePreview(item);
      onNotify('Görsel başarıyla oluşturuldu ve galeriye eklendi.', 'success');
    } catch {
      onNotify('Görsel oluşturma sırasında hata oluştu.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveSrc = (item: GeneratedImageItem) => brokenIds[item.id] || item.url;

  const handleImageError = (item: GeneratedImageItem) => {
    if (brokenIds[item.id]) return;
    const fallbackUrl = createProceduralFallbackImage(item.originalPrompt, item.style, item.aspectRatio);
    setBrokenIds((prev) => ({ ...prev, [item.id]: fallbackUrl }));
  };

  const handleDownload = (item: GeneratedImageItem) => {
    try {
      const src = resolveSrc(item);
      const a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.download = `sigma-ai-gorsel-${item.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onNotify('Görsel indirme başlatıldı.', 'success');
    } catch {
      onNotify('İndirme başlatılamadı.', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sol: Üretim Kontrolleri */}
          <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Akıllı Görsel Oluşturma Stüdyosu
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Türkçe yazdığınız sahneleri otomatik olarak yüksek doğruluklu görsel istemine çevirir.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ne Çizilsin?
                </label>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={!prompt.trim() || isEnhancing}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  <i className={`fa-solid ${isEnhancing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} mr-1`} />
                  {isEnhancing ? 'Geliştiriliyor...' : 'İstemi Zenginleştir'}
                </button>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Örn: Sevimli bir maymun ormanda muz yiyor..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setPrompt(idea)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-blue-400 text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[200px] cursor-pointer"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Sanat Stili
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStyle(st.id)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer truncate ${
                      style === st.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                En / Boy Oranı
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAspectRatio(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${
                      aspectRatio === r
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Gelişmiş Ayarlar: Negatif İstem ve Seed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Hariç Tut (Negatif)
                </label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Örn: bulanık, yazı"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Seed (Sabit Tohum)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    placeholder="Rastgele"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                  {seedInput && (
                    <button
                      type="button"
                      onClick={() => setSeedInput('')}
                      title="Sıfırla"
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleGenerate(false)}
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-image'}`} />
              <span>{isGenerating ? 'Görsel Oluşturuluyor...' : 'Görsel Oluştur'}</span>
            </button>
          </div>

          {/* Sağ: Önizleme Alanı */}
          <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Önizleme
              </span>
              {activePreview && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditorSourceUrl(resolveSrc(activePreview));
                      setIsEditorOpen((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      isEditorOpen
                        ? 'sigma-accent-bg text-white border-transparent'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <i className="fa-solid fa-sliders mr-1" />
                    {isEditorOpen ? 'Önizlemeye Dön' : 'Düzenle & Filtre'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(activePreview.originalPrompt);
                      handleGenerate(true);
                    }}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    <i className="fa-solid fa-shuffle mr-1" />
                    Varyasyon
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(activePreview)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    <i className="fa-solid fa-download mr-1" />
                    İndir
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSendToChat(
                        `Oluşturduğum şu görsel hakkında kısa bir hikaye veya sahne açıklaması yaz: "${activePreview.originalPrompt}"`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="fa-solid fa-comment-dots mr-1" />
                    Sohbete Gönder
                  </button>
                </div>
              )}
              {!activePreview && (
                <div>
                  <input
                    ref={localImgInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => {
                        const url = typeof r.result === 'string' ? r.result : '';
                        if (url) {
                          setEditorSourceUrl(url);
                          setIsEditorOpen(true);
                        }
                      };
                      r.readAsDataURL(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => localImgInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <i className="fa-solid fa-upload mr-1" />
                    Cihazdan Görsel Düzenle
                  </button>
                </div>
              )}
            </div>

            {isEditorOpen && editorSourceUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center p-2">
                  <canvas ref={editCanvasRef} className="max-h-[380px] w-auto object-contain rounded-lg" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="flex justify-between"><span>Parlaklık</span><span className="font-mono">{edBrightness}%</span></span>
                    <input type="range" min={50} max={150} value={edBrightness} onChange={(e) => setEdBrightness(Number(e.target.value))} className="w-full accent-blue-600" />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between"><span>Kontrast</span><span className="font-mono">{edContrast}%</span></span>
                    <input type="range" min={50} max={150} value={edContrast} onChange={(e) => setEdContrast(Number(e.target.value))} className="w-full accent-blue-600" />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between"><span>Doygunluk</span><span className="font-mono">{edSaturate}%</span></span>
                    <input type="range" min={0} max={200} value={edSaturate} onChange={(e) => setEdSaturate(Number(e.target.value))} className="w-full accent-blue-600" />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between"><span>Sepya</span><span className="font-mono">{edSepia}%</span></span>
                    <input type="range" min={0} max={100} value={edSepia} onChange={(e) => setEdSepia(Number(e.target.value))} className="w-full accent-blue-600" />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between"><span>Bulanıklık</span><span className="font-mono">{edBlur}px</span></span>
                    <input type="range" min={0} max={8} value={edBlur} onChange={(e) => setEdBlur(Number(e.target.value))} className="w-full accent-blue-600" />
                  </label>
                  <div className="flex items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEdRotation((r) => (r + 90) % 360)}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                    >
                      <i className="fa-solid fa-rotate-right mr-1" />
                      90° Döndür
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    value={edCaption}
                    onChange={(e) => setEdCaption(e.target.value)}
                    placeholder="Poster alt yazısı ekle (isteğe bağlı)..."
                    className="flex-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="color"
                    value={edCaptionColor}
                    onChange={(e) => setEdCaptionColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-700"
                    title="Yazı rengi"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEdBrightness(100);
                      setEdContrast(100);
                      setEdSaturate(100);
                      setEdSepia(0);
                      setEdBlur(0);
                      setEdRotation(0);
                      setEdCaption('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                  >
                    Sıfırla
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const dataUrl = editCanvasRef.current?.toDataURL('image/png');
                        if (!dataUrl) throw new Error();
                        const newItem: GeneratedImageItem = {
                          id: `edit_${Date.now()}`,
                          url: dataUrl,
                          prompt: edCaption || activePreview?.originalPrompt || 'Düzenlenen Görsel',
                          originalPrompt: `${activePreview?.originalPrompt || 'Özel Görsel'} (Düzenlenmiş)`,
                          style: 'edited',
                          aspectRatio: activePreview?.aspectRatio || '1:1',
                          model: 'Sigma Canlı Düzenleyici',
                          createdAt: Date.now()
                        };
                        onAddImage(newItem);
                        setActivePreview(newItem);
                        setIsEditorOpen(false);
                        onNotify('Düzenlenmiş görsel galeriye kaydedildi.', 'success');
                      } catch {
                        onNotify('Uzak sunucu görseli tarayıcı güvenlik politikası nedeniyle tuvalden dışa aktarılamadı; yerel görsel yükleyerek düzenleyebilirsiniz.', 'info');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                  >
                    Galeriye Kaydet
                  </button>
                </div>
              </div>
            ) : activePreview ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[320px]">
                  <img
                    src={resolveSrc(activePreview)}
                    alt={activePreview.originalPrompt}
                    referrerPolicy="no-referrer"
                    onError={() => handleImageError(activePreview)}
                    className="max-h-[460px] w-auto object-contain"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-slate-200 font-medium">
                    <span>İstek: {activePreview.originalPrompt}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {activePreview.style} · {activePreview.aspectRatio}
                      {activePreview.seed ? ` · Seed: ${activePreview.seed}` : ''}
                    </span>
                  </div>
                  {activePreview.translatedSubject && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Çevrilen Sahne: {activePreview.translatedSubject}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-[340px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center p-8 space-y-2">
                <i className="fa-regular fa-image text-3xl text-slate-400" />
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Henüz görsel seçilmedi
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  Sol panelden Türkçe veya İngilizce bir sahne yazarak ilk görselinizi üretin.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Galeri Geçmişi */}
        {gallery.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Oluşturulan Görseller ({gallery.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActivePreview(item)}
                  className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all bg-white dark:bg-slate-900 ${
                    activePreview?.id === item.id
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-950 overflow-hidden">
                    <img
                      src={resolveSrc(item)}
                      alt={item.originalPrompt}
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError(item)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(item.id);
                      if (activePreview?.id === item.id) {
                        setActivePreview(gallery.find((g) => g.id !== item.id) || null);
                      }
                    }}
                    title="Görseli sil"
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-slate-900/80 text-white hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                  <div className="p-2 text-xs truncate text-slate-700 dark:text-slate-300">
                    {item.originalPrompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
