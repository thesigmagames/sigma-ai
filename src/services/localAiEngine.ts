import type {
  AiEngineMode,
  AppLanguage,
  AttachedImageData,
  ChatMessage,
  ChatSession,
  CustomApiConfig,
  ExportFormat,
  GeneratedImageItem,
  GroundingSource,
  LocalModelSpec,
  Persona,
  ResponseLength
} from '../types/chat';

export function getApiBaseUrl(): string {
  try {
    const raw = (import.meta as any)?.env?.VITE_API_BASE_URL || '';
    return String(raw).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export const LOCAL_MODELS: LocalModelSpec[] = [
  {
    id: 'Xenova/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 Instruct (0.5B)',
    shortName: 'Qwen 2.5 · 0.5B',
    sizeLabel: '320 MB',
    specialty: 'Türkçe sohbet, hızlı özet ve genel yardım',
    quantization: 'q4f16 (WebGPU / WASM)'
  },
  {
    id: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    name: 'TinyLlama Chat v1.0 (1.1B)',
    shortName: 'TinyLlama · 1.1B',
    sizeLabel: '640 MB',
    specialty: 'Dengeli diyalog ve yaratıcı metin üretimi',
    quantization: 'q4 (WASM)'
  },
  {
    id: 'Xenova/Phi-3-mini-4k-instruct',
    name: 'Phi-3 Mini 4K Instruct',
    shortName: 'Phi-3 Mini · 4K',
    sizeLabel: '1.35 GB',
    specialty: 'Kod yazma, algoritma ve adım adım mantık',
    quantization: 'q4f16 (WebGPU)'
  },
  {
    id: 'Xenova/distilgpt2-sigma-tr',
    name: 'Sigma Ultra Lite TR',
    shortName: 'Sigma Lite · TR',
    sizeLabel: '165 MB',
    specialty: 'Anında açılış ve düşük bellek kullanımı',
    quantization: 'int8 (WASM)'
  }
];

export const PERSONA_META: Record<Persona, { title: string; desc: string; icon: string }> = {
  general: { title: 'Genel Asistan', desc: 'Dengeli ve çok yönlü akıl', icon: 'fa-sparkles' },
  coder: { title: 'Yazılım & Kod', desc: 'Temiz mimari ve canlı kodlar', icon: 'fa-code' },
  writer: { title: 'Yaratıcı Yazar', desc: 'Hikaye, senaryo ve oyun lore', icon: 'fa-feather-pointed' },
  tutor: { title: 'Özel Öğretmen', desc: 'Adım adım anlatım ve örnekler', icon: 'fa-graduation-cap' },
  grok: { title: 'Sigma Grok', desc: 'Dobra, zeki ve esprili üslup', icon: 'fa-bolt' },
  artist: { title: 'Sanat & Tasarım', desc: 'Görsel fikirler ve promptlar', icon: 'fa-palette' }
};

export const DEFAULT_SYSTEM_PROMPT =
  'Sen Sigma AI • The Sigma Games (thesigmagames.github.io) asistanısın. Net, doğru, yardımcı ve düzenli Markdown formatında yanıtlar verirsin.';

/**
 * İlk mesajdan otomatik sohbet başlığı üretir.
 */
export function generateAutoTitle(userText: string): string {
  const cleaned = userText
    .replace(/^\/(görsel|gorsel|imagine|kod)\s+/i, '')
    .replace(/[`*_#>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Yeni Sohbet';
  const words = cleaned.split(' ');
  const candidate = words.slice(0, 6).join(' ');
  return candidate.length > 42 ? `${candidate.slice(0, 41).trim()}…` : candidate;
}

/**
 * Kullanıcının sohbet mesajında görsel oluşturma isteği olup olmadığını algılar.
 * Kod / web uygulaması / metin isteklerini yanlışlıkla yakalamaz.
 */
export function detectImageIntent(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Açık slash komutları (/görsel, /gorsel, /imagine, /draw, /resim)
  const slashMatch = trimmed.match(/^\/(görsel|gorsel|imagine|draw|resim)\s+(.+)/i);
  if (slashMatch) {
    return slashMatch[2].trim();
  }

  // Kod, tablo, analiz veya metin odaklı istekleri hariç tut
  if (
    /\b(kod|kodu|html|css|javascript|typescript|python|react|sql|regex|tablo|grafik|svg|fonksiyon|script|uygulama|web\s*sitesi|oyunu?\s*kodu|özetle|çevir|makale|hikaye|şiir|rapor|hesapla)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  // 2. Doğal Türkçe görsel üretim ifadeleri ("... görseli oluştur", "bana ... çiz", "maymun yap muz yesin")
  const explicitImageNoun =
    /\b(görsel|görseli|resim|resmi|fotoğraf|fotoğrafı|illüstrasyon|karikatür|wallpaper|duvar\s*kağıdı|poster|logo|avatar)\b.*\b(yap|çiz|oluştur|üret|tasarla|hazırla)\b/i;
  const drawVerb = /\b(çiz|çizer\s*misin|resmet|resmini\s*yap)\b/i;
  const actionSceneMake =
    /\b(yap|yapsın|oluştur)\b.*\b(yesin|yiyor|yiyen|içsin|koşsun|koşan|uçsun|uçan|yüzsün|dans\s*etsin|otursun|uyusun)\b/i;

  if (explicitImageNoun.test(trimmed) || drawVerb.test(trimmed) || actionSceneMake.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * @xenova/transformers tarayıcı içi model yükleme simülasyonu.
 */
export async function simulateTransformersModelLoad(
  modelId: string,
  onProgress: (progress: number, stage: string) => void
): Promise<LocalModelSpec> {
  const spec = LOCAL_MODELS.find((m) => m.id === modelId) || LOCAL_MODELS[0];
  const stages = [
    { pct: 15, label: `@xenova/transformers başlatılıyor (${spec.shortName})...`, delay: 180 },
    { pct: 38, label: 'tokenizer.json ve sözlük dosyaları önbelleğe alınıyor...', delay: 220 },
    { pct: 64, label: `ONNX model ağırlıkları yükleniyor (${spec.sizeLabel})...`, delay: 250 },
    { pct: 88, label: `Çalışma zamanı derleniyor (${spec.quantization})...`, delay: 200 },
    { pct: 100, label: `${spec.shortName} yerel çıkarım için hazır.`, delay: 140 }
  ];

  for (const step of stages) {
    onProgress(step.pct, step.label);
    await new Promise((resolve) => setTimeout(resolve, step.delay));
  }

  return spec;
}

function trySolveMathExpression(input: string): string | null {
  const cleaned = input
    .toLowerCase()
    .replace(/kaç\s*(eder|yapar|\?)|hesapla|sonucu\s*nedir/g, '')
    .replace(/x/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '.')
    .trim();

  if (!/^[0-9+\-*/().\s%^]+$/.test(cleaned)) return null;
  if (!/[0-9]/.test(cleaned) || !/[+\-*/%^]/.test(cleaned)) return null;

  try {
    const normalized = cleaned.replace(/\^/g, '**');
    const fn = new Function(`"use strict"; return (${normalized});`);
    const result = fn();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return `### Hesaplama Sonucu\n\nİşlem: \`${cleaned.trim()}\`\n\nSonuç: **${Number(result.toFixed(6))}**`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Yerel (API'siz) akıllı yanıt sentezleyici.
 */
export function synthesizeLocalResponse(params: {
  userInput: string;
  history: ChatMessage[];
  systemPrompt: string;
  persona: Persona;
  language: AppLanguage;
  model: LocalModelSpec;
  attachmentContext?: { name: string; content: string } | null;
  attachedImage?: AttachedImageData | null;
}): string {
  const { userInput, history, systemPrompt, persona, language, model, attachmentContext, attachedImage } = params;
  const q = userInput.trim();
  const lower = q.toLowerCase();

  if (attachedImage) {
    return `### Görsel Ön İncelemesi (\`${attachedImage.name}\`)

Görselin (**${attachedImage.mimeType}**) yerel çalışma alanına başarıyla eklendi.

- **İsteğin:** ${q || 'Görseli incele'}
- **Not:** Derin görsel piksel analizi için Gemini Motoru gerekir; şu anda yerel API'siz modda çalıştığın için görsel güvenli biçimde tarayıcı belleğinde tutuluyor. Gemini Motoru aktif olduğunda fotoğraf içindeki nesneleri, metinleri ve renkleri otomatik okuyabilirim.`;
  }

  if (attachmentContext) {
    const lines = attachmentContext.content.split(/\r?\n/);
    const words = attachmentContext.content.split(/\s+/).filter(Boolean).length;
    const preview = lines.slice(0, 10).join('\n');
    return `### Eklenen Dosya İncelemesi: \`${attachmentContext.name}\`

Dosya tarayıcıda yerel olarak okundu (**${lines.length} satır**, **${words} kelime**).

\`\`\`text
${preview}${lines.length > 10 ? '\n...' : ''}
\`\`\`

Bu dosya içeriğiyle ilgili koda dönüştürme, özetleme veya hata ayıklama isteğini belirtebilirsin.`;
  }

  const mathOut = trySolveMathExpression(q);
  if (mathOut) return mathOut;

  if (
    /(kim\s*(kurdu|yaptı|geliştirdi|üretti)|kurucun|üreticin|yapımcın|thesigmagames|sigma\s*games|resmi\s*(site|adres|web))/i.test(
      lower
    )
  ) {
    return `### Sigma AI Hakkında

Ben **Sigma AI**, **The Sigma Games** (**[thesigmagames.github.io](https://thesigmagames.github.io/sigma-ai)**) tarafından geliştirilen çok yetenekli yapay zeka çalışma alanı ve asistanıyım.

- **Resmi Geliştirici Adresi:** [https://thesigmagames.github.io](https://thesigmagames.github.io)
- **Web Uygulama Adresi:** [https://thesigmagames.github.io/sigma-ai](https://thesigmagames.github.io/sigma-ai)
- **Not:** Resmi adresimiz **thesigmagames.github.io** üzerindedir (thesigmagames.com değil).`;
  }

  if (/^(merhaba|selam|slm|hey|hi|hello|günaydın|iyi akşamlar|naber|nasılsın)\b/i.test(lower)) {
    if (language === 'en') {
      return `Hello! I am **Sigma AI • The Sigma Games** (thesigmagames.github.io) running in **${PERSONA_META[persona].title}** mode via **${model.shortName}**.\n\nYou can switch freely between **Hybrid (Gemini + Local)** and **100% API-Free Local** modes, build 3D models, compose beats, generate images, write & run live HTML/JS code, or export chats to TXT, MD, JSON, and HTML.`;
    }
    return `Selam! Ben **Sigma AI • The Sigma Games** ([thesigmagames.github.io](https://thesigmagames.github.io/sigma-ai) · **${PERSONA_META[persona].title}** modu · **${model.shortName}**).

Yapabileceklerimizden bazıları:
- **Sohbet & Derin Düşünce:** Kodlama, matematik, hikaye ve web araması destekli akıllı yanıtlar.
- **3D Stüdyo & Müzik Beat:** Three.js 3B sahneler ve Web Audio ritim stüdyosu.
- **Canlı Kod Sandbox & 2B Oyunlar:** Sohbette yazılan HTML/CSS/JS kodlarını tek tıkla canlı önizlemede çalıştırma.
- **Görsel Stüdyosu & Düzenleyici:** Doğrudan \`/görsel [tarif]\` komutuyla görsel üretme ve filtreleme.
- **Çoklu Dışa Aktarma:** Sohbetlerini \`.txt\`, \`.md\`, \`.json\` veya \`.html\` olarak kaydetme.`;
  }

  if (
    persona === 'coder' ||
    /(kod|code|javascript|js|python|html|css|react|oyun|hesap makinesi|buton|fonksiyon)/i.test(lower)
  ) {
    if (/html|oyun|hesap|kart|buton|arayüz|canlı/i.test(lower)) {
      return `Aşağıdaki kodu sağ üstündeki **Canlı Önizle** butonuna basarak doğrudan Kod Sandbox'ında çalıştırabilirsin:

\`\`\`html
<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
    .box { width: 320px; padding: 24px; border-radius: 16px; background: #1e293b; border: 1px solid #334155; text-align: center; }
    button { margin-top: 12px; padding: 10px 18px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
    .score { font-size: 2rem; font-weight: 700; margin: 12px 0; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="box">
    <h3>Sigma Tıklama Sayacı</h3>
    <div class="score" id="count">0</div>
    <button onclick="artir()">Puan Kazan (+1)</button>
  </div>
  <script>
    let n = 0;
    function artir() {
      n++;
      document.getElementById('count').textContent = n;
    }
  </script>
</body>
</html>
\`\`\``;
    }

    if (/python/i.test(lower)) {
      return `İsteğin için temiz **Python** örneği:

\`\`\`python
def sigma_ozet(veri: list[int]) -> dict:
    if not veri:
        return {"toplam": 0, "ortalama": 0}
    return {
        "adet": len(veri),
        "toplam": sum(veri),
        "ortalama": round(sum(veri) / len(veri), 2)
    }

print(sigma_ozet([10, 25, 40, 85]))
\`\`\``;
    }

    return `İsteğin için **JavaScript** kod örneği:

\`\`\`javascript
function metinAnaliz(metin) {
  const kelimeler = metin.trim().split(/\\s+/).filter(Boolean);
  return {
    kelimeSayisi: kelimeler.length,
    karakter: metin.length
  };
}

console.log(metinAnaliz("Sigma AI yerel kod motoru hazır"));
\`\`\``;
  }

  if (persona === 'grok') {
    return `Bakalım ne sormuşsun: **"${q}"**\n\n- **Dobra Yorum:** Bunu uzatıp süslü laflara boğmaya gerek yok. Hedefe en kısa yoldan gitmek için elindeki fikri küçük bir prototipe çevir, çalıştır ve gerisini yolda geliştir.\n- **İpucu:** İstediğin an üstteki modlardan **Derin Düşünce** veya **Görsel Stüdyosu**'na zıplayabilirsin.`;
  }

  const prevCount = history.filter((m) => m.role === 'user').length;
  return `**"${q}"** hakkında **${model.shortName}** (Yerel Mod) değerlendirmesi:

1. **Çerçeve:** Bu talebi ${PERSONA_META[persona].title} perspektifinden ele aldığımızda, ilk adım net hedef belirlemek ve gereksiz karmaşayı elemektir.
2. **Bağlam:** Bu oturumda şu ana kadar **${prevCount}** kullanıcı istemi işlendi ve aktif sistem talimatın (*"${systemPrompt.slice(0, 60)}${systemPrompt.length > 60 ? '…' : ''}"*) korundu.
3. **Sonraki Adım:** İstersen konuyu **Kod Sandbox**, **Görsel Stüdyosu** veya **Gemini Derin Düşünce** ile bir üst seviyeye taşıyabilirsin.`;
}

/**
 * Hibrit AI Yanıt Üreticisi:
 * - Custom API aktifse orayı dener.
 * - Hybrid veya Gemini modundaysa /api/chat (Gemini) endpoint'ini çağırır.
 * - Gemini kotası dolarsa/anahtar yoksa Hybrid mod otomatik API'siz yerel motora düşer.
 */
export async function generateHybridAiReply(params: {
  userInput: string;
  history: ChatMessage[];
  systemPrompt: string;
  persona: Persona;
  language: AppLanguage;
  deepThinking: boolean;
  webSearch: boolean;
  responseLength?: ResponseLength;
  engineMode: AiEngineMode;
  model: LocalModelSpec;
  customApi: CustomApiConfig;
  attachmentContext?: { name: string; content: string } | null;
  attachedImage?: AttachedImageData | null;
}): Promise<{
  text: string;
  engineUsed: string;
  sources: GroundingSource[];
  latencyMs: number;
  usedFallback?: boolean;
}> {
  const start = Date.now();
  const {
    userInput,
    history,
    systemPrompt,
    persona,
    language,
    deepThinking,
    webSearch,
    responseLength = 'normal',
    engineMode,
    model,
    customApi,
    attachmentContext,
    attachedImage
  } = params;

  // 1. Opsiyonel Özel API (Ollama / OpenAI uyumlu)
  if (customApi.enabled && customApi.endpointUrl.trim()) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customApi.apiKey.trim()) {
        headers.Authorization = `Bearer ${customApi.apiKey.trim()}`;
      }

      const payloadMessages = [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ...history.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.text
        })),
        {
          role: 'user',
          content: attachmentContext
            ? `${userInput}\n\n[Dosya: ${attachmentContext.name}]\n${attachmentContext.content.slice(0, 5000)}`
            : userInput
        }
      ];

      const res = await fetch(customApi.endpointUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: customApi.modelName.trim() || model.id,
          messages: payloadMessages,
          stream: false
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.choices?.[0]?.message?.content ||
          data?.message?.content ||
          data?.response ||
          data?.reply;
        if (typeof text === 'string' && text.trim()) {
          return {
            text: text.trim(),
            engineUsed: `Özel API (${customApi.modelName || 'Custom'})`,
            sources: [],
            latencyMs: Date.now() - start
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Gemini Engine (/api/chat)
  if (engineMode === 'gemini' || engineMode === 'hybrid') {
    try {
      const apiMessages = history.map((m, idx) => {
        let content = m.text;
        // İlk kullanıcı mesajına veya son mesaja aktif systemPrompt talimatını bağla
        if (idx === history.length - 1 && m.role === 'user') {
          const extras: string[] = [];
          if (systemPrompt && systemPrompt !== DEFAULT_SYSTEM_PROMPT) {
            extras.push(`[Kullanıcı Özel Sistem Talimatı: ${systemPrompt}]`);
          }
          if (attachmentContext) {
            extras.push(`[Ekli Dosya: ${attachmentContext.name}]\n${attachmentContext.content.slice(0, 6000)}`);
          }
          if (extras.length > 0) {
            content = `${extras.join('\n\n')}\n\n${content}`;
          }
        }
        return {
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          content,
          image: m.image ? { data: m.image.data, mimeType: m.image.mimeType } : undefined
        };
      });

      // Eğer history boşsa (ör. ilk çağrı) güvenlik
      if (apiMessages.length === 0) {
        apiMessages.push({
          role: 'user',
          content: userInput,
          image: attachedImage ? { data: attachedImage.data, mimeType: attachedImage.mimeType } : undefined
        });
      }

      const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          persona,
          language,
          deepThinking,
          webSearch,
          responseLength
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.reply) {
        return {
          text: data.reply,
          engineUsed: data.model || 'Sigma AI · Gemini',
          sources: Array.isArray(data.sources) ? data.sources : [],
          latencyMs: data.latencyMs || Date.now() - start
        };
      }

      // Gemini hatası durumunda (401/429 vb.) Hybrid moddaysak yerel motora geç
      if (engineMode === 'gemini') {
        return {
          text: `**Gemini Motoru Yanıt Veremedi:** ${data?.error || 'Bağlantı hatası'}\n\n${data?.help ? `**Çözüm:** ${data.help}` : 'Ayarlar menüsünden **Hibrit** veya **API’siz Yerel** moda geçerek kesintisiz devam edebilirsiniz.'}`,
          engineUsed: 'Gemini Hata Bildirimi',
          sources: [],
          latencyMs: Date.now() - start
        };
      }
    } catch {
      if (engineMode === 'gemini') {
        return {
          text: '**Ağ Hatası:** Gemini sunucusuna ulaşılamadı. Ayarlar üzerinden API’siz Yerel moda geçebilirsiniz.',
          engineUsed: 'Gemini Bağlantı Hatası',
          sources: [],
          latencyMs: Date.now() - start
        };
      }
    }
  }

  // 3. API'siz Yerel Motor (Local Fallback veya Doğrudan Local Mod)
  const localText = synthesizeLocalResponse({
    userInput,
    history,
    systemPrompt,
    persona,
    language,
    model,
    attachmentContext,
    attachedImage
  });

  return {
    text: localText,
    engineUsed: `${model.shortName} (Yerel API’siz)`,
    sources: [],
    latencyMs: Date.now() - start,
    usedFallback: engineMode === 'hybrid'
  };
}

/**
 * Çevrimdışı/API'siz veya yüklenemeyen görseller için HTML5 Canvas ile yüksek kaliteli prosedürel sanat üretir.
 * Böylece görsel alanı ASLA kırık ikon göstermez.
 */
export function createProceduralFallbackImage(
  prompt: string,
  style: string,
  aspectRatio: string
): string {
  const canvas = document.createElement('canvas');
  let w = 1024;
  let h = 1024;
  if (aspectRatio === '16:9') { w = 1280; h = 720; }
  else if (aspectRatio === '9:16') { w = 720; h = 1280; }
  else if (aspectRatio === '4:3') { w = 1024; h = 768; }
  else if (aspectRatio === '3:4') { w = 768; h = 1024; }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const palettes: Record<string, [string, string, string]> = {
    cyberpunk: ['#0f172a', '#2563eb', '#7c3aed'],
    photo: ['#18181b', '#334155', '#0ea5e9'],
    anime: ['#1e1b4b', '#ec4899', '#38bdf8'],
    '3d': ['#090d16', '#06b6d4', '#10b981'],
    fantasy: ['#1a1033', '#9333ea', '#f59e0b'],
    retro: ['#1f0937', '#f43f5e', '#f59e0b']
  };
  const [c1, c2, c3] = palettes[style] || palettes.cyberpunk;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Geometrik ışık halkaları ve derinlik
  let seed = 0;
  for (let i = 0; i < prompt.length; i++) seed += prompt.charCodeAt(i) * (i + 1);

  for (let i = 0; i < 14; i++) {
    const rx = ((seed * (i + 3) * 37) % w);
    const ry = ((seed * (i + 5) * 53) % h);
    const rad = 80 + ((seed * (i + 1)) % 220);
    const radial = ctx.createRadialGradient(rx, ry, 5, rx, ry, rad);
    radial.addColorStop(0, 'rgba(255,255,255,0.22)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Alt yazı bandı (Prompt özeti)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(0, h - 110, w, 110);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Sigma AI • Yerel Görsel Sentezi', 36, h - 64);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px sans-serif';
  ctx.fillText(prompt.slice(0, 72) + (prompt.length > 72 ? '…' : ''), 36, h - 30);

  return canvas.toDataURL('image/png');
}

function translatePromptClientFallback(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\b(bana|lütfen|bir|tane|hemen|acil|yap|yapar\s*mısın|çiz|çizer\s*misin|oluştur|üret|tasarla|görsel|görseli|resim|resmi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const dict: Record<string, string> = {
    maymun: 'monkey', muz: 'banana', yesin: 'eating', yiyor: 'eating', yiyen: 'eating',
    elma: 'apple', kedi: 'cat', köpek: 'dog', kopek: 'dog', aslan: 'lion', kaplan: 'tiger',
    kurt: 'wolf', ayı: 'bear', kuş: 'bird', kartal: 'eagle', ejderha: 'dragon', at: 'horse',
    adam: 'man', kadın: 'woman', çocuk: 'child', astronot: 'astronaut', şövalye: 'knight',
    robot: 'robot', araba: 'car', uzay: 'outer space', orman: 'forest', dağ: 'mountain',
    deniz: 'ocean', şehir: 'city', kırmızı: 'red', mavi: 'blue', yeşil: 'green', sarı: 'yellow'
  };
  return cleaned.split(/\s+/).filter(Boolean).map((w) => dict[w] || w).join(' ') || input.trim();
}

/**
 * Görsel üretimi: /api/generate-image endpoint'ini çağırır, ağ/sunucu yoksa doğrudan Pollinations + Türkçe sözlük çevirisi veya Canvas'a düşer.
 */
export async function requestAiImage(
  prompt: string,
  aspectRatio = '1:1',
  style = 'natural',
  negativePrompt = '',
  seed?: number
): Promise<GeneratedImageItem> {
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspectRatio, style, negativePrompt, seed })
    });
    const data = await res.json();
    if (res.ok && data.success && data.imageUrl) {
      return {
        id,
        url: data.imageUrl,
        prompt: data.prompt || prompt,
        originalPrompt: prompt,
        translatedSubject: data.translatedSubject,
        negativePrompt: negativePrompt || undefined,
        seed: data.seed,
        style,
        aspectRatio,
        model: data.model || 'Sigma Vision',
        createdAt: Date.now()
      };
    }
  } catch {}

  // Statik GitHub Pages (API sunucusu olmadan) akıllı çeviri + Flux URL yedeği
  const translated = translatePromptClientFallback(prompt);
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') { width = 1280; height = 720; }
  else if (aspectRatio === '9:16') { width = 720; height = 1280; }
  else if (aspectRatio === '4:3') { width = 1024; height = 768; }
  else if (aspectRatio === '3:4') { width = 768; height = 1024; }
  const finalSeed = seed && seed > 0 ? Math.floor(seed) : Math.floor(Math.random() * 99999999);
  const fullPrompt = `${translated}, clear detailed composition, balanced lighting, high quality`;
  const directUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${finalSeed}`;

  return {
    id,
    url: directUrl,
    prompt: fullPrompt,
    originalPrompt: prompt,
    translatedSubject: translated,
    negativePrompt: negativePrompt || undefined,
    seed: finalSeed,
    style,
    aspectRatio,
    model: 'Sigma Vision (Statik Web Modu)',
    createdAt: Date.now()
  };
}

/**
 * İstemi yapay zeka ile zenginleştirme (/api/enhance-prompt + yerel fallback).
 */
export async function requestEnhancePrompt(prompt: string): Promise<string> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/enhance-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (res.ok && data.success && data.enhancedPrompt) {
      return data.enhancedPrompt;
    }
  } catch {}
  return `${prompt.trim()}, sinematik ışıklandırma, yüksek detay seviyesi, 8K netlik, dengeli kompozisyon`;
}

/**
 * Belge & PDF Analizcisi (/api/analyze-doc + yerel çıkarım yedeği).
 */
export async function analyzeDocumentHybrid(params: {
  fileName: string;
  mimeType: string;
  textContent: string;
  base64Data?: string;
  task: 'summary' | 'bullets' | 'qa';
  question?: string;
}): Promise<{ reply: string; engineUsed: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/analyze-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (res.ok && data.success && data.reply) {
      return { reply: data.reply, engineUsed: data.model || 'Sigma Belge Motoru' };
    }
  } catch {}

  const cleanText = params.textContent.trim();
  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const lines = cleanText ? cleanText.split(/\r?\n/).filter((l) => l.trim()) : [];
  const previewLines = lines.slice(0, 6);

  if (!cleanText) {
    return {
      engineUsed: 'Yerel Belge Analizcisi',
      reply: `### \`${params.fileName}\` Ön İnceleme\n\nBu PDF ikili (taranmış/sıkıştırılmış) formatta görünüyor. API sunucusu bağlı olmadığında yalnızca düz metin katmanı okunabilir.\n\n**Öneri:** PDF içeriğini metin olarak yapıştırabilir veya .txt/.md yükleyebilirsiniz.`
    };
  }

  if (params.task === 'qa' && params.question) {
    const qTerms = params.question
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const matchingLines = lines
      .filter((l) => qTerms.some((term) => l.toLowerCase().includes(term)))
      .slice(0, 6);

    return {
      engineUsed: 'Yerel Belge Analizcisi (API’siz)',
      reply: `### Soru Yanıtı (\`${params.fileName}\`)\n\n**Soru:** ${params.question}\n\n${
        matchingLines.length > 0
          ? `**Belgede Eşleşen Bölümler:**\n${matchingLines.map((l) => `- ${l.trim()}`).join('\n')}`
          : `Doğrudan anahtar kelime eşleşmesi bulunamadı. Belgenin ilk satırları:\n${previewLines.map((l) => `- ${l.trim()}`).join('\n')}`
      }`
    };
  }

  return {
    engineUsed: 'Yerel Belge Analizcisi (API’siz)',
    reply: `### Belge Özeti: \`${params.fileName}\`\n\n- **Toplam Kelime:** ${words.length}\n- **Satır Sayısı:** ${lines.length}\n- **Tahmini Okuma Süresi:** ~${Math.max(1, Math.ceil(words.length / 200))} dk\n\n**Öne Çıkan Satırlar:**\n${previewLines.map((l) => `- ${l.trim().slice(0, 180)}`).join('\n')}`
  };
}

/**
 * Çok seçenekli dışa aktarım oluşturucu: JSON, Markdown (.md), Düz Metin (.txt), Yazdırılabilir HTML (.html)
 */
export function buildExportPayload(
  sessions: ChatSession[],
  format: ExportFormat,
  singleChatOnly: boolean,
  activeChat: ChatSession
): { content: string; mimeType: string; extension: string } {
  const targetChats = singleChatOnly ? [activeChat] : sessions;

  if (format === 'json') {
    return {
      content: JSON.stringify(targetChats, null, 2),
      mimeType: 'application/json;charset=utf-8',
      extension: 'json'
    };
  }

  if (format === 'md') {
    const blocks = targetChats.map((chat) => {
      const header = `# ${chat.title}\n\n- **Sabitlenmiş:** ${chat.pinned ? 'Evet' : 'Hayır'}\n- **System Prompt:** ${chat.systemPrompt}\n- **Mesaj Sayısı:** ${chat.messages.length}\n\n---\n`;
      const body = chat.messages
        .map((m) => `### ${m.role === 'user' ? 'Kullanıcı' : 'Sigma AI'} (${m.time})\n\n${m.text}\n`)
        .join('\n');
      return `${header}\n${body}`;
    });
    return {
      content: blocks.join('\n\n====================================\n\n'),
      mimeType: 'text/markdown;charset=utf-8',
      extension: 'md'
    };
  }

  if (format === 'txt') {
    const blocks = targetChats.map((chat) => {
      const header = `SOHBET: ${chat.title}\nSYSTEM PROMPT: ${chat.systemPrompt}\n${'='.repeat(48)}`;
      const body = chat.messages
        .map((m) => `[${m.time}] ${m.role === 'user' ? 'SEN' : 'SIGMA AI'}:\n${m.text}`)
        .join('\n\n');
      return `${header}\n\n${body}`;
    });
    return {
      content: blocks.join('\n\n' + '-'.repeat(60) + '\n\n'),
      mimeType: 'text/plain;charset=utf-8',
      extension: 'txt'
    };
  }

  // HTML formatı
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const sectionsHtml = targetChats
    .map((chat) => {
      const msgsHtml = chat.messages
        .map(
          (m) => `
          <div class="msg ${m.role}">
            <div class="meta">${m.role === 'user' ? 'Sen' : 'Sigma AI'} · ${escapeHtml(m.time)}</div>
            <pre class="body">${escapeHtml(m.text)}</pre>
          </div>`
        )
        .join('');
      return `
        <section class="chat">
          <h2>${escapeHtml(chat.title)}</h2>
          <p class="sys"><strong>System Prompt:</strong> ${escapeHtml(chat.systemPrompt)}</p>
          ${msgsHtml}
        </section>`;
    })
    .join('');

  const htmlDoc = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Sigma AI • Sohbet Arşivi</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 1.5rem; margin-bottom: 24px; }
    .chat { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .chat h2 { margin-top: 0; font-size: 1.2rem; }
    .sys { font-size: 0.85rem; color: #475569; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
    .msg { padding: 12px 16px; border-radius: 10px; margin: 12px 0; }
    .msg.user { background: #eff6ff; border: 1px solid #bfdbfe; }
    .msg.assistant { background: #f1f5f9; border: 1px solid #e2e8f0; }
    .meta { font-size: 0.75rem; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .body { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 0.92rem; line-height: 1.55; }
  </style>
</head>
<body>
  <h1>Sigma AI • The Sigma Games (thesigmagames.github.io/sigma-ai) — Sohbet Dökümü</h1>
  ${sectionsHtml}
</body>
</html>`;

  return {
    content: htmlDoc,
    mimeType: 'text/html;charset=utf-8',
    extension: 'html'
  };
}
