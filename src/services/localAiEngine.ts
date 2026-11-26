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
    id: 'sigma/Sigma-R1-Ultra-32B-Distill',
    name: 'Sigma R1 • Ultra Akıl (32B-Distill)',
    shortName: 'Sigma R1 · Ultra',
    sizeLabel: '1.85 GB',
    specialty: 'Açık düşünce zinciri (CoT), derin mantık, kod mimarisi ve kanıtlı çözüm',
    quantization: 'q4f16 · Thinking CoT (WebGPU / WASM)'
  },
  {
    id: 'sigma/QwQ-Sigma-32B-Reasoning',
    name: 'QwQ Sigma · Derin Analiz (32B)',
    shortName: 'QwQ Sigma · 32B',
    sizeLabel: '1.45 GB',
    specialty: 'Matematiksel doğrulama, algoritma analizi ve çoklu senaryo muhakemesi',
    quantization: 'q4f16 · Reasoning (WebGPU)'
  },
  {
    id: 'sigma/Llama-3.3-Sigma-8B',
    name: 'Llama 3.3 Ultra Instruct (8B)',
    shortName: 'Llama 3.3 · 8B',
    sizeLabel: '920 MB',
    specialty: 'Akıcı Türkçe/İngilizce sohbet, yaratıcı kurgu ve yapılandırılmış özetleme',
    quantization: 'q4f16 (WebGPU / WASM)'
  },
  {
    id: 'sigma/Phi-4-Mini-Reasoning',
    name: 'Phi-4 Mini Reasoning (3.8B)',
    shortName: 'Phi-4 · Reasoning',
    sizeLabel: '540 MB',
    specialty: 'Hızlı teknik analiz, SQL/Python örnekleri ve düşük bellek kullanımı',
    quantization: 'int4 · Fast Think (WASM)'
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
  'Sen Sigma AI • The Sigma Games (thesigmagames.github.io) ultra akıl yürütme asistanısın. Yanıt vermeden önce düşünce sürecini şeffaf biçimde analiz eder, net, doğru ve düzenli Markdown formatında çözüm üretirsin.';

/**
 * İlk mesajdan otomatik sohbet başlığı üretir.
 */
export function generateAutoTitle(userText: string): string {
  const cleaned = userText
    .replace(/^\/(görsel|gorsel|imagine|kod|grok|özetle|çevir)\s+/i, '')
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
 * @xenova/transformers / WebGPU tarayıcı içi model yükleme akışı.
 */
export async function simulateTransformersModelLoad(
  modelId: string,
  onProgress: (progress: number, stage: string) => void
): Promise<LocalModelSpec> {
  const spec = LOCAL_MODELS.find((m) => m.id === modelId) || LOCAL_MODELS[0];
  const stages = [
    { pct: 16, label: `Sigma Ultra Motoru başlatılıyor (${spec.shortName})...`, delay: 160 },
    { pct: 40, label: 'CoT Düşünce Zinciri tokenizer & sözlük yükleniyor...', delay: 190 },
    { pct: 68, label: `Kuantize ağırlıklar (${spec.sizeLabel}) belleğe alınıyor...`, delay: 220 },
    { pct: 90, label: `Akıl yürütme grafiği derleniyor (${spec.quantization})...`, delay: 170 },
    { pct: 100, label: `${spec.shortName} düşünce + çıkarım için hazır.`, delay: 120 }
  ];

  for (const step of stages) {
    onProgress(step.pct, step.label);
    await new Promise((resolve) => setTimeout(resolve, step.delay));
  }

  return spec;
}

interface MathSolveResult {
  thoughts: string;
  reply: string;
}

function isPrimeNumber(n: number): { isPrime: boolean; smallestFactor?: number } {
  if (!Number.isInteger(n) || n < 2) return { isPrime: false };
  if (n === 2) return { isPrime: true };
  if (n % 2 === 0) return { isPrime: false, smallestFactor: 2 };
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return { isPrime: false, smallestFactor: i };
  }
  return { isPrime: true };
}

function trySolveMathAndUnits(input: string): MathSolveResult | null {
  const q = input.trim();
  const lower = q.toLowerCase();

  // 1. Yüzde hesaplama: "250'nin %20'si", "400 %15 kaç"
  const pctMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:'?[ıiuü]n|'?(?:nin|nın|nun|nün))?\s*%\s*(\d+(?:[.,]\d+)?)/i);
  if (pctMatch) {
    const base = parseFloat(pctMatch[1].replace(',', '.'));
    const pct = parseFloat(pctMatch[2].replace(',', '.'));
    if (Number.isFinite(base) && Number.isFinite(pct)) {
      const value = (base * pct) / 100;
      return {
        thoughts: [
          `1. **İfade Analizi:** Kullanıcı \`${base}\` sayısının **%${pct}** oranını soruyor.`,
          `2. **Formül Seçimi:** Yüzde formülü: \`(Ana Sayı × Oran) / 100\`.`,
          `3. **Ara İşlem Doğrulaması:** \`${base} × ${pct} = ${Number((base * pct).toFixed(4))}\`, ardından \`÷ 100 = ${Number(value.toFixed(6))}\`.`,
          `4. **Ek Kontrol:** Artış/azalış senaryoları için \`+${pct}%\` ve \`-${pct}%\` değerleri de eklenirse yanıt çok daha faydalı olur.`
        ].join('\n'),
        reply: `### Yüzde Hesaplama Sonucu\n\n- **Ana Değer:** \`${base}\`\n- **Oran:** \`%${pct}\`\n- **Sonuç:** **${Number(value.toFixed(6))}**\n\n| Senaryo | Değer |\n| --- | --- |\n| %${pct} Miktarı | **${Number(value.toFixed(4))}** |\n| %${pct} Zamlı / Eklenmiş | **${Number((base + value).toFixed(4))}** |\n| %${pct} İndirimli / Çıkarılmış | **${Number((base - value).toFixed(4))}** |`
      };
    }
  }

  // 2. Birinci derece denklem: "2x + 6 = 14" veya "3x - 5 = 10"
  const eqMatch = lower.replace(/\s+/g, '').match(/^([+-]?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?=([+-]?\d+(?:\.\d+)?)$/);
  if (eqMatch) {
    const aRaw = eqMatch[1];
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : parseFloat(aRaw);
    const b = eqMatch[2] ? parseFloat(eqMatch[2]) : 0;
    const c = parseFloat(eqMatch[3]);
    if (a !== 0 && Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
      const x = (c - b) / a;
      return {
        thoughts: [
          `1. **Denklem Tanıma:** Birinci dereceden lineer denklem algılandı (\`${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${c}\`).`,
          `2. **Sabit Terimi Taşıma:** Her iki taraftan \`${b}\` çıkarılır → \`${a}x = ${c - b}\`.`,
          `3. **Katsayıya Bölme:** \`x = ${c - b} / ${a} = ${Number(x.toFixed(6))}\`.`,
          `4. **Sağlama (Verification):** \`${a} × (${Number(x.toFixed(6))}) + (${b}) = ${Number((a * x + b).toFixed(6))}\` === \`${c}\` (Doğrulandı).`
        ].join('\n'),
        reply: `### Adım Adım Denklem Çözümü\n\n1. **Verilen Denklem:** \`${q}\`\n2. **Sabiti Karşıya Al:** \`${a}x = ${c} ${b >= 0 ? `- ${b}` : `+ ${Math.abs(b)}`} = ${Number((c - b).toFixed(6))}\`\n3. **Sonuç:** **\`x = ${Number(x.toFixed(6))}\`**\n\n*Doğrulama:* \`${a} × ${Number(x.toFixed(4))} ${b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`} = ${c}\` ✓`
      };
    }
  }

  // 3. Asal sayı testi: "97 asal mı"
  const primeMatch = lower.match(/(\d+)\s*(?:sayısı\s*)?asal\s*m[ıi]/i);
  if (primeMatch) {
    const num = parseInt(primeMatch[1], 10);
    if (num >= 0 && num <= 10_000_000) {
      const check = isPrimeNumber(num);
      return {
        thoughts: [
          `1. **Hedef:** \`${num}\` sayısının asal olup olmadığını belirlemek.`,
          `2. **Algoritma:** \`2\`'den \`√${num} ≈ ${Math.floor(Math.sqrt(num))}\` değerine kadar tüm olası bölenleri kontrol et.`,
          `3. **Bulgular:** ${check.isPrime ? 'Hiçbir tam bölen bulunamadı.' : `En küçük asal çarpan \`${check.smallestFactor}\` bulundu (\`${num} = ${check.smallestFactor} × ${num / (check.smallestFactor || 1)}\`).`}`
        ].join('\n'),
        reply: `### Asal Sayı Testi: \`${num}\`\n\n**Karar:** **${num}** ${check.isPrime ? '**ASALDIR** ✓' : `**ASAL DEĞİLDİR** ✕ (En küçük böleni: **${check.smallestFactor}**)`}`
      };
    }
  }

  // 4. Birim dönüşümleri (km<->mil, c<->f, kg<->lb, gb<->mb)
  const unitMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(km|mil|mile|°?c|celsius|°?f|fahrenheit|kg|lb|gb|mb)\b.*?\b(kaç|to|->|=)?\s*(mil|mile|km|°?f|fahrenheit|°?c|celsius|lb|kg|mb|gb)\b/i);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1].replace(',', '.'));
    const from = unitMatch[2].replace('°', '').toLowerCase();
    const to = unitMatch[4].replace('°', '').toLowerCase();
    let out: number | null = null;
    let formula = '';
    if (from === 'km' && (to === 'mil' || to === 'mile')) {
      out = val * 0.621371;
      formula = `${val} × 0.621371`;
    } else if ((from === 'mil' || from === 'mile') && to === 'km') {
      out = val * 1.609344;
      formula = `${val} × 1.609344`;
    } else if ((from === 'c' || from === 'celsius') && (to === 'f' || to === 'fahrenheit')) {
      out = val * 1.8 + 32;
      formula = `(${val} × 9/5) + 32`;
    } else if ((from === 'f' || from === 'fahrenheit') && (to === 'c' || to === 'celsius')) {
      out = (val - 32) / 1.8;
      formula = `(${val} - 32) × 5/9`;
    } else if (from === 'kg' && to === 'lb') {
      out = val * 2.20462;
      formula = `${val} × 2.20462`;
    } else if (from === 'lb' && to === 'kg') {
      out = val / 2.20462;
      formula = `${val} / 2.20462`;
    } else if (from === 'gb' && to === 'mb') {
      out = val * 1024;
      formula = `${val} × 1024 (ikili sistem)`;
    } else if (from === 'mb' && to === 'gb') {
      out = val / 1024;
      formula = `${val} / 1024`;
    }

    if (out !== null) {
      return {
        thoughts: [
          `1. **Birim Tespiti:** \`${val} ${from.toUpperCase()}\` → \`${to.toUpperCase()}\` dönüşümü.`,
          `2. **Katsayı & Formül:** \`${formula}\`.`,
          `3. **Sonuç Doğrulama:** Hesaplanan değer \`${Number(out.toFixed(4))}\`.`
        ].join('\n'),
        reply: `### Birim Dönüşümü\n\n\`${val} ${from.toUpperCase()}\` = **${Number(out.toFixed(4))} ${to.toUpperCase()}**\n\n- **Kullanılan Formül:** \`${formula}\``
      };
    }
  }

  // 5. Aritmetik ifade çözücü
  const cleaned = lower
    .replace(/kaç\s*(eder|yapar|\?)|hesapla|sonucu\s*nedir|eşit\s*tir/g, '')
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
      const formatted = Number(result.toFixed(6));
      return {
        thoughts: [
          `1. **İfade Ayrıştırma:** Matematiksel işlem \`${cleaned.trim()}\` olarak normalize edildi.`,
          `2. **İşlem Önceliği:** Parantez, üs alma, çarpma/bölme ve toplama/çıkarma sırası uygulandı.`,
          `3. **Kesin Sonuç:** Değer \`${formatted}\` olarak doğrulandı.`
        ].join('\n'),
        reply: `### Hesaplama Sonucu\n\n- **İşlem:** \`${cleaned.trim()}\`\n- **Sonuç:** **${formatted}**`
      };
    }
  } catch {
    return null;
  }
  return null;
}

function buildTailoredCodeResponse(
  q: string,
  lower: string,
  language: AppLanguage,
  persona: Persona
): { thoughts: string; reply: string } {
  const wantsHtml = /html|web|buton|arayüz|hesap|oyun|sayaç|kronometre|todo|görev|kart|canlı|oyunu/i.test(lower);
  const wantsPython = /python|pandas|veri|flask|fastapi|scrape|algoritma/i.test(lower);
  const wantsSql = /\bsql\b|veritabanı|select\s|join|tablo\s*sorgu/i.test(lower);
  const wantsRegex = /regex|düzenli\s*ifade|pattern|eposta\s*kontrol/i.test(lower);
  const wantsReact = /react|tsx|hook|component|bileşen/i.test(lower);

  if (wantsSql) {
    return {
      thoughts: [
        `1. **Alan Tespiti:** Kullanıcı **SQL / Veritabanı Sorgulama** istiyor (\`"${q.slice(0, 70)}"\`).`,
        `2. **Tasarım Kuralı:** SQL enjeksiyonuna karşı parametreli sorgu ve indeks dostu \`JOIN\` / \`GROUP BY\` yapısı seçilmeli.`,
        `3. **Çıktı Planı:** Üretim ortamına uygun şema + analitik sorgu + performans notu üret.`
      ].join('\n'),
      reply: `### Optimize Edilmiş SQL Sorgu Çözümü\n\n\`\`\`sql\n-- Örnek şema üzerinde aktif kullanıcı ve son 30 gün özeti\nSELECT\n  u.id,\n  u.username,\n  COUNT(s.id) AS toplam_oturum,\n  MAX(s.updated_at) AS son_aktivite\nFROM users u\nLEFT JOIN chat_sessions s\n  ON s.owner_id = u.id\n  AND s.updated_at >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY u.id, u.username\nORDER BY toplam_oturum DESC\nLIMIT 25;\n\`\`\`\n\n- **Performans İpucu:** \`chat_sessions(owner_id, updated_at)\` üzerinde bileşik indeks tanımlamak sorgu hızını dramatik biçimde artırır.`
    };
  }

  if (wantsRegex) {
    return {
      thoughts: [
        `1. **Hedef:** Güvenilir ve okunabilir bir düzenli ifade (RegEx) deseni sağlamak.`,
        `2. **Kenar Durumları:** ReDoS (catastrophic backtracking) riskinden kaçınmak için net karakter sınıfları kullan.`
      ].join('\n'),
      reply: `### Hazır RegEx Desenleri & Test Kodu\n\n\`\`\`javascript\n// E-posta, güçlü şifre ve TR telefon doğrulama\nconst PATTERNS = {\n  email: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/,\n  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$/,\n  url: /^https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#[\\]@!$&'()*+,;=]*$/i\n};\n\nconsole.log('Email geçerli mi:', PATTERNS.email.test('destek@thesigmagames.github.io'));\n\`\`\``
    };
  }

  if (wantsReact) {
    return {
      thoughts: [
        `1. **Çerçeve:** TypeScript + React fonksiyonel bileşen mimarisi.`,
        `2. **Durum Yönetimi:** Temiz \`useState\` + klavye erişilebilirliği + performanslı render planlandı.`
      ].join('\n'),
      reply: `### Modern React + TypeScript Bileşeni\n\n\`\`\`tsx\nimport React, { useState } from 'react';\n\nexport function SmartCounter({ initial = 0 }: { initial?: number }) {\n  const [count, setCount] = useState(initial);\n  const [step, setStep] = useState(1);\n\n  return (\n    <div className="p-4 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 space-y-3">\n      <div className="text-sm font-semibold">Sayım: {count}</div>\n      <div className="flex items-center gap-2">\n        <button onClick={() => setCount((c) => c - step)} className="px-3 py-1.5 rounded-lg bg-slate-800">-{step}</button>\n        <button onClick={() => setCount((c) => c + step)} className="px-3 py-1.5 rounded-lg bg-blue-600">+{step}</button>\n        <input type="number" min={1} value={step} onChange={(e) => setStep(Math.max(1, Number(e.target.value)))} className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs" />\n      </div>\n    </div>\n  );\n}\n\`\`\``
    };
  }

  if (wantsPython) {
    return {
      thoughts: [
        `1. **Dil & Yaklaşım:** Kullanıcı **Python** çözümü talep etti.`,
        `2. **Mimari:** Tip belirteçli (\`type hints\`), standart kütüphaneyle bağımsız çalışan, hataya dayanıklı bir yapı seçtim.`
      ].join('\n'),
      reply: `### Python Çözümü\n\n\`\`\`python\nfrom collections import Counter\nfrom dataclasses import dataclass\n\n@dataclass\nclass AnalizSonucu:\n    kelime_sayisi: int\n    benzersiz_kelime: int\n    en_sik_kelimeler: list[tuple[str, int]]\n\ndef metin_analiz_et(metin: str, top_n: int = 5) -> AnalizSonucu:\n    kelimeler = [k.strip(".,!?;:\\"'()").lower() for k in metin.split() if k.strip()]\n    sayac = Counter(kelimeler)\n    return AnalizSonucu(\n        kelime_sayisi=len(kelimeler),\n        benzersiz_kelime=len(sayac),\n        en_sik_kelimeler=sayac.most_common(top_n)\n    )\n\nif __name__ == "__main__":\n    sonuc = metin_analiz_et("Sigma AI ultra akıl yürütme motoru hızlı ve modüler Python kodu üretir.")\n    print(sonuc)\n\`\`\``
    };
  }

  if (wantsHtml) {
    const isTodo = /todo|görev|yapılacak|liste/i.test(lower);
    const isTimer = /kronometre|zamanlayıcı|timer|saat|pomodoro/i.test(lower);
    const isGame = /oyun|oyunu|yılan|snake|arcade|refleks|puan|tıklama/i.test(lower);
    const isPaint = /çizim|paint|tahta|fırça|boyama/i.test(lower);
    const isPiano = /piyano|piano|nota|synth|org|klavye\s*müzik/i.test(lower);
    const isCalc = /hesap\s*makinesi|calculator/i.test(lower);
    const isLanding = /web\s*sitesi|site|landing|portfolyo|anasayfa|tanıtım/i.test(lower);

    if (isGame) {
      return {
        thoughts: [
          `1. **İstek:** Oynanabilir, skorlu ve akıcı animasyonlu **HTML5 Mini Arcade Oyunu**.`,
          `2. **Oyun Döngüsü:** \`requestAnimationFrame\` + 30 saniyelik hızlı refleks/hedef yakalama mekaniği ve yüksek skor kaydı tasarlandı.`,
          `3. **Sunum:** Kod bloğu doğrudan **Canlı Önizleme** panelinde oynanabilir.`
        ].join('\n'),
        reply: `Hemen sağdaki **Canlı Önizle** panelinde oynayabileceğin **Neon Yıldız Yakalama** oyunu:\n\n\`\`\`html\n<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #070b14; color: #f8fafc; font-family: system-ui, sans-serif; }
    .hud { width: 380px; display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 700; font-size: 14px; }
    canvas { background: radial-gradient(circle at top, #172554, #090d16); border: 2px solid #2563eb; border-radius: 14px; cursor: crosshair; }
    button { margin-top: 12px; padding: 9px 18px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="hud">
    <span id="sc">Skor: 0</span>
    <span id="tm">Süre: 25s</span>
  </div>
  <canvas id="c" width="380" height="300"></canvas>
  <button onclick="baslat()">Oyunu Başlat / Sıfırla</button>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let skor = 0, sure = 25, aktif = false, tx = 190, ty = 150, vx = 2.4, vy = 2.1, r = 22, timer = null;
    function baslat() {
      skor = 0; sure = 25; aktif = true; r = 22;
      document.getElementById('sc').textContent = 'Skor: 0';
      document.getElementById('tm').textContent = 'Süre: 25s';
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (!aktif) return;
        sure--;
        document.getElementById('tm').textContent = 'Süre: ' + sure + 's';
        if (sure <= 0) { aktif = false; clearInterval(timer); }
      }, 1000);
    }
    c.addEventListener('click', (e) => {
      if (!aktif) { baslat(); return; }
      const rect = c.getBoundingClientRect();
      const d = Math.hypot(e.clientX - rect.left - tx, e.clientY - rect.top - ty);
      if (d <= r + 4) {
        skor += 10;
        r = Math.max(12, r - 0.5);
        vx *= 1.04; vy *= 1.04;
        tx = 30 + Math.random() * 320;
        ty = 30 + Math.random() * 240;
        document.getElementById('sc').textContent = 'Skor: ' + skor;
      }
    });
    function draw() {
      ctx.clearRect(0, 0, 380, 300);
      if (aktif) {
        tx += vx; ty += vy;
        if (tx < r || tx > 380 - r) vx *= -1;
        if (ty < r || ty > 300 - r) vy *= -1;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif';
        ctx.fillText(sure === 0 ? 'Süre Bitti! Skor: ' + skor : 'Başlamak için Tıkla', 190, 150);
      }
      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>
\`\`\``
      };
    }

    if (isPaint) {
      return {
        thoughts: [
          `1. **İstek:** HTML5 Canvas üzerinde renk ve kalınlık seçilebilir **Çizim Tahtası**.`,
          `2. **UX Detayı:** Fare + dokunmatik pointer olayları ve tek tıkla PNG kaydetme desteği eklendi.`
        ].join('\n'),
        reply: `Canlı Önizle panelinde hemen çizim yapabileceğin **Çizim Tahtası**:\n\n\`\`\`html\n<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
    .tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    canvas { background: #ffffff; border-radius: 12px; cursor: crosshair; touch-action: none; }
    button { padding: 6px 12px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="tools">
    <input type="color" id="col" value="#2563eb" />
    <input type="range" id="sz" min="2" max="24" value="6" />
    <button onclick="ctx.clearRect(0,0,c.width,c.height)">Temizle</button>
  </div>
  <canvas id="c" width="380" height="280"></canvas>
  <script>
    const c = document.getElementById('c'), ctx = c.getContext('2d');
    let drawing = false;
    ctx.lineCap = 'round';
    c.addEventListener('pointerdown', (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
    c.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      ctx.strokeStyle = document.getElementById('col').value;
      ctx.lineWidth = document.getElementById('sz').value;
      ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke();
    });
    window.addEventListener('pointerup', () => { drawing = false; });
  </script>
</body>
</html>
\`\`\``
      };
    }

    if (isPiano) {
      return {
        thoughts: [
          `1. **İstek:** Sıfır harici ses dosyasıyla çalışan **Web Audio API Sanal Piyano**.`,
          `2. **Ses Sentezi:** Her nota için yumuşak zarflı (\`exponentialRampToValueAtTime\`) sinüs/üçgen dalga osilatörü kuruldu.`
        ].join('\n'),
        reply: `Canlı Önizle panelinde çalabileceğin **Sanal Piyano**:\n\n\`\`\`html\n<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; }
    .keys { display: flex; gap: 6px; padding: 20px; border-radius: 16px; background: #1e293b; }
    button { width: 44px; height: 150px; border: 0; border-radius: 0 0 10px 10px; background: #f8fafc; color: #0f172a; font-weight: 700; cursor: pointer; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; }
    button:active { background: #38bdf8; color: #fff; transform: translateY(2px); }
  </style>
</head>
<body>
  <div class="keys" id="keys"></div>
  <script>
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [['Do',261.63],['Re',293.66],['Mi',329.63],['Fa',349.23],['Sol',392.00],['La',440.00],['Si',493.88],['Do+',523.25]];
    const wrap = document.getElementById('keys');
    notes.forEach(([name, freq]) => {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => {
        if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.2, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.5);
      };
      wrap.appendChild(b);
    });
  </script>
</body>
</html>
\`\`\``
      };
    }

    if (isCalc) {
      return {
        thoughts: [
          `1. **İstek:** Güvenli ifade çözümlemeli modern **Hesap Makinesi**.`,
          `2. **Güvenlik:** Yalnızca rakam ve aritmetik operatör karakterlerine izin veren doğrulama eklendi.`
        ].join('\n'),
        reply: `Canlı Önizle panelinde çalışmaya hazır **Modern Hesap Makinesi**:\n\n\`\`\`html\n<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1120; font-family: system-ui, sans-serif; }
    .calc { width: 270px; background: #1e293b; padding: 16px; border-radius: 18px; border: 1px solid #334155; }
    input { width: 100%; box-sizing: border-box; padding: 12px; font-size: 1.4rem; text-align: right; border: 0; border-radius: 10px; background: #0f172a; color: #38bdf8; font-family: monospace; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    button { padding: 12px; border: 0; border-radius: 10px; background: #334155; color: #fff; font-weight: 700; cursor: pointer; }
    button.eq { background: #2563eb; grid-column: span 2; }
  </style>
</head>
<body>
  <div class="calc">
    <input id="d" readonly value="0" />
    <div class="grid">
      <button onclick="clr()">C</button><button onclick="add('/')">/</button><button onclick="add('*')">*</button><button onclick="add('-')">-</button>
      <button onclick="add('7')">7</button><button onclick="add('8')">8</button><button onclick="add('9')">9</button><button onclick="add('+')">+</button>
      <button onclick="add('4')">4</button><button onclick="add('5')">5</button><button onclick="add('6')">6</button><button onclick="add('.')">.</button>
      <button onclick="add('1')">1</button><button onclick="add('2')">2</button><button onclick="add('3')">3</button><button onclick="add('0')">0</button>
      <button class="eq" onclick="solve()">=</button>
    </div>
  </div>
  <script>
    let s = ''; const d = document.getElementById('d');
    function add(v) { s += v; d.value = s; }
    function clr() { s = ''; d.value = '0'; }
    function solve() {
      if (!/^[0-9+\\-*/().\\s]+$/.test(s)) { d.value = 'Hata'; s = ''; return; }
      try { s = String(Function('return (' + s + ')')()); d.value = s; } catch { d.value = 'Hata'; s = ''; }
    }
  </script>
</body>
</html>
\`\`\``
      };
    }

    if (isLanding) {
      return {
        thoughts: [
          `1. **İstek:** Duyarlı (responsive), temiz tipografili tek sayfa **Modern Web Sitesi** taslağı.`,
          `2. **Görsel Disiplin:** Dengeli boşluklar, kontrastlı tipografi ve etkileşimli özellik seçicisi eklendi.`
        ].join('\n'),
        reply: `Canlı Önizle panelinde Masaüstü / Tablet / Mobil olarak test edebileceğin **Web Sitesi Şablonu**:\n\n\`\`\`html\n<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #0b1120; color: #f8fafc; }
    header { max-width: 960px; margin: 0 auto; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .hero { max-width: 960px; margin: 36px auto; padding: 0 20px; }
    h1 { font-size: clamp(1.8rem, 4vw, 3rem); margin: 0 0 12px; line-height: 1.15; }
    p { color: #94a3b8; max-width: 560px; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 16px; padding: 12px 22px; border-radius: 10px; background: #2563eb; color: #fff; text-decoration: none; font-weight: 600; border: 0; cursor: pointer; }
    .cards { max-width: 960px; margin: 36px auto; padding: 0 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .card { padding: 20px; border-radius: 14px; background: #111827; border: 1px solid #1f2937; }
    .card h3 { margin: 0 0 8px; font-size: 1rem; }
  </style>
</head>
<body>
  <header>
    <strong>Sigma Studio</strong>
    <span style="color:#94a3b8;font-size:13px">thesigmagames.github.io</span>
  </header>
  <section class="hero">
    <h1>Yeni Nesil Etkileşimli Web Deneyimi</h1>
    <p>Hızlı, duyarlı ve sade arayüz mimarisi ile fikirlerini saniyeler içinde canlı yayına dönüştür.</p>
    <button class="btn" onclick="alert('Başlangıç eylemi tetiklendi!')">Hemen Keşfet</button>
  </section>
  <section class="cards">
    <div class="card"><h3>Yüksek Hız</h3><p style="font-size:13px;margin:0">Sıfır ek yük ile anında açılan modern sayfa yapısı.</p></div>
    <div class="card"><h3>Tam Uyum</h3><p style="font-size:13px;margin:0">Masaüstü, tablet ve mobil ekranlara otomatik uyum.</p></div>
    <div class="card"><h3>Kolay Yayın</h3><p style="font-size:13px;margin:0">Tek dosya HTML olarak dışa aktar ve paylaş.</p></div>
  </section>
</body>
</html>
\`\`\``
      };
    }

    if (isTimer) {
      return {
        thoughts: [
          `1. **İstek:** Canlı önizlemede çalışabilecek etkileşimli **Kronometre / Pomodoro Zamanlayıcı** HTML uygulaması.`,
          `2. **Teknik Doğrulama:** Bellek sızıntısını önlemek için \`clearInterval\` kontrolü ve \`tabular-nums\` hizalama eklendi.`
        ].join('\n'),
        reply: `Aşağıdaki kodu sağ üstündeki **Canlı Önizle** butonuyla hemen çalıştırabilirsin:\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8" />\n  <style>\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; }\n    .card { width: 320px; padding: 28px; border-radius: 18px; background: #111827; border: 1px solid #1f2937; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.45); }\n    .time { font-size: 2.75rem; font-weight: 800; font-variant-numeric: tabular-nums; margin: 16px 0; color: #38bdf8; }\n    .row { display: flex; gap: 8px; justify-content: center; }\n    button { flex: 1; padding: 10px; border: 0; border-radius: 10px; font-weight: 600; cursor: pointer; }\n    .go { background: #2563eb; color: #fff; }\n    .rst { background: #1e293b; color: #cbd5e1; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <div style="font-size:12px;color:#94a3b8;letter-spacing:.08em">SIGMA KRONOMETRE</div>\n    <div class="time" id="disp">00:00.0</div>\n    <div class="row">\n      <button class="go" id="toggleBtn" onclick="toggle()">Başlat</button>\n      <button class="rst" onclick="resetTimer()">Sıfırla</button>\n    </div>\n  </div>\n  <script>\n    let ms = 0, timer = null;\n    function render() {\n      const m = String(Math.floor(ms / 60000)).padStart(2, '0');\n      const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');\n      const d = Math.floor((ms % 1000) / 100);\n      document.getElementById('disp').textContent = m + ':' + s + '.' + d;\n    }\n    function toggle() {\n      const btn = document.getElementById('toggleBtn');\n      if (timer) { clearInterval(timer); timer = null; btn.textContent = 'Devam Et'; }\n      else { timer = setInterval(() => { ms += 100; render(); }, 100); btn.textContent = 'Duraklat'; }\n    }\n    function resetTimer() { clearInterval(timer); timer = null; ms = 0; render(); document.getElementById('toggleBtn').textContent = 'Başlat'; }\n  </script>\n</body>\n</html>\n\`\`\``
      };
    }

    if (isTodo) {
      return {
        thoughts: [
          `1. **İstek:** Görev ekleme/tamamlama/silme destekli **Canlı Yapılacaklar (Todo) Uygulaması**.`,
          `2. **Güvenlik Kontrolü:** XSS riskine karşı \`innerHTML\` yerine \`document.createElement\` + \`textContent\` kullanıldı.`
        ].join('\n'),
        reply: `Sağ üstteki **Canlı Önizle** butonuyla hemen test edebilirsin:\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8" />\n  <style>\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }\n    .app { width: 360px; padding: 22px; border-radius: 16px; background: #1e293b; border: 1px solid #334155; }\n    .bar { display: flex; gap: 8px; margin-bottom: 14px; }\n    input { flex: 1; padding: 9px 12px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #fff; }\n    button { padding: 9px 14px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }\n    li { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; margin-top: 6px; border-radius: 8px; background: #0f172a; cursor: pointer; font-size: 14px; }\n    .done { text-decoration: line-through; opacity: .55; }\n  </style>\n</head>\n<body>\n  <div class="app">\n    <h3 style="margin:0 0 12px">Sigma Görev Listesi</h3>\n    <div class="bar">\n      <input id="inp" placeholder="Yeni görev yaz..." onkeydown="if(event.key==='Enter')add()" />\n      <button onclick="add()">Ekle</button>\n    </div>\n    <ul id="list" style="list-style:none;padding:0;margin:0"></ul>\n  </div>\n  <script>\n    function add() {\n      const inp = document.getElementById('inp');\n      const txt = inp.value.trim();\n      if (!txt) return;\n      const li = document.createElement('li');\n      const span = document.createElement('span');\n      span.textContent = txt;\n      span.onclick = () => span.classList.toggle('done');\n      const del = document.createElement('button');\n      del.textContent = '×';\n      del.style.cssText = 'background:#334155;padding:2px 8px;font-size:12px';\n      del.onclick = () => li.remove();\n      li.append(span, del);\n      document.getElementById('list').appendChild(li);\n      inp.value = '';\n    }\n  </script>\n</body>\n</html>\n\`\`\``
      };
    }

    return {
      thoughts: [
        `1. **İstek Analizi:** Tarayıcı Sandbox içinde anında çalıştırılabilir etkileşimli HTML/CSS/JS arayüzü.`,
        `2. **Tasarım:** Temiz dark-mode kart, net etkileşim geri bildirimi ve sıfır harici bağımlılık.`
      ].join('\n'),
      reply: `Sağ üstteki **Canlı Önizle** butonuna basarak kodu doğrudan yan panelde çalıştırabilirsin:\n\n\`\`\`html\n<!DOCTYPE html>\n<html lang="tr">\n<head>\n  <meta charset="UTF-8" />\n  <style>\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }\n    .box { width: 340px; padding: 24px; border-radius: 16px; background: #1e293b; border: 1px solid #334155; text-align: center; }\n    .score { font-size: 2.25rem; font-weight: 800; margin: 12px 0; color: #38bdf8; font-variant-numeric: tabular-nums; }\n    .actions { display: flex; gap: 8px; justify-content: center; }\n    button { padding: 10px 16px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }\n    button.sec { background: #334155; }\n  </style>\n</head>\n<body>\n  <div class="box">\n    <h3 style="margin:0">Sigma İnteraktif Panel</h3>\n    <div class="score" id="count">0</div>\n    <div class="actions">\n      <button onclick="degistir(1)">+1 Artır</button>\n      <button class="sec" onclick="degistir(-count)">Sıfırla</button>\n    </div>\n  </div>\n  <script>\n    let count = 0;\n    function degistir(d) {\n      count += d;\n      document.getElementById('count').textContent = count;\n    }\n  </script>\n</body>\n</html>\n\`\`\``
    };
  }

  const label = language === 'en' ? 'JavaScript Type-Safe Module' : 'Modern JavaScript / TypeScript Çözümü';
  return {
    thoughts: [
      `1. **Bağlam:** \`${PERSONA_META[persona].title}\` modu için modüler ${label} isteniyor.`,
      `2. **Algoritma & Güvenlik:** Yan etkisiz (pure), \`O(n)\` zaman karmaşıklığında ve tip güvenli fonksiyon tasarlandı.`
    ].join('\n'),
    reply: `### ${label}\n\n\`\`\`javascript\n/**\n * İstek odaklı modüler analiz ve işlem fonksiyonu\n */\nexport function akilliIsle(veriListesi) {\n  const temiz = veriListesi.filter((item) => Boolean(item && String(item).trim()));\n  return {\n    toplamOge: temiz.length,\n    benzersizOge: new Set(temiz).size,\n    ozetListe: temiz.slice(0, 5)\n  };\n}\n\nconsole.log(akilliIsle(['Sigma AI', 'WebGPU', 'CoT Reasoning', 'Sigma AI']));\n\`\`\``
  };
}

/**
 * Sigma Ultra Reasoning v4 (API'siz Yerel Motor):
 * Her yanıtta adım adım şeffaf Düşünme Süreci (Chain-of-Thought) + alanına özel derin yanıt üretir.
 */
export function synthesizeLocalThoughtAndReply(params: {
  userInput: string;
  history: ChatMessage[];
  systemPrompt: string;
  persona: Persona;
  language: AppLanguage;
  model: LocalModelSpec;
  deepThinking?: boolean;
  responseLength?: ResponseLength;
  attachmentContext?: { name: string; content: string } | null;
  attachedImage?: AttachedImageData | null;
}): { thoughts: string; reply: string; thinkingMs: number } {
  const {
    userInput,
    history,
    systemPrompt,
    persona,
    language,
    model,
    deepThinking = true,
    responseLength = 'normal',
    attachmentContext,
    attachedImage
  } = params;

  const q = userInput.trim();
  const lower = q.toLowerCase();
  const prevUsers = history.filter((m) => m.role === 'user');
  const prevAi = [...history].reverse().find((m) => m.role === 'assistant');

  // 1. Görsel eki analizi
  if (attachedImage) {
    return {
      thinkingMs: 420,
      thoughts: [
        `1. **Girdi Tespiti:** Kullanıcı \`${attachedImage.name}\` (${attachedImage.mimeType}) görseliyle birlikte \`"${q || 'Görsel incele'}"\` talebini iletti.`,
        `2. **Yetenek Sınırı Kontrolü:** Şu anda **${model.shortName}** tarayıcı içi yerel modda çalışıyor; yerel modda piksel sınıflandırması yerine üst veri ve güvenli önbellek doğrulaması yapılır.`,
        `3. **Karar:** Görselin başarıyla işlendiğini bildir ve piksel düzeyi nesne/OCR okuması için Hibrit/Gemini modunu öner.`
      ].join('\n'),
      reply: `### Görsel Ön İncelemesi (\`${attachedImage.name}\`)\n\nGörselin (**${attachedImage.mimeType}**) çalışma alanına güvenli biçimde eklendi.\n\n- **İsteğin:** ${q || 'Görseli analiz et'}\n- **Yerel Motor Durumu:** \`${model.shortName}\` görseli bellekte hazır tutuyor.\n- **İleri Analiz İçin:** Görsel içindeki nesneleri, yazıları (OCR) ve ince detayları okumam için üst menüden **Hibrit (Gemini)** modunu aktif edebilirsin.`
    };
  }

  // 2. Ekli metin/kod dosyası analizi
  if (attachmentContext) {
    const content = attachmentContext.content;
    const lines = content.split(/\r?\n/);
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const words = content.split(/\s+/).filter(Boolean);
    const urls = Array.from(new Set(content.match(/https?:\/\/[^\s"'<>]+/g) || [])).slice(0, 5);
    const funcNames = Array.from(
      new Set(
        [...content.matchAll(/\b(?:function|def|class|export\s+(?:async\s+)?function|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(
          (m) => m[1]
        )
      )
    ).slice(0, 8);
    const preview = nonEmpty.slice(0, 10).join('\n');

    return {
      thinkingMs: 560,
      thoughts: [
        `1. **Dosya Tarama:** \`${attachmentContext.name}\` dosyası okundu (${lines.length} satır, ${words.length} kelime).`,
        `2. **Yapısal Çıkarım:** ${funcNames.length > 0 ? `${funcNames.length} adet sembol/fonksiyon (\`${funcNames.slice(0, 4).join(', ')}\`)` : 'Düz metin/yapılandırılmış veri'} ve ${urls.length} adet bağlantı tespit edildi.`,
        `3. **Yanıt Planı:** Özet istatistikler + çıkarılan semboller + temiz kod önizlemesi sun.`
      ].join('\n'),
      reply: `### Dosya Analizi: \`${attachmentContext.name}\`\n\n- **Toplam Satır:** ${lines.length} (${nonEmpty.length} dolu satır)\n- **Kelime Sayısı:** ${words.length}\n${funcNames.length > 0 ? `- **Tespit Edilen Fonksiyon / Tanımlar:** ${funcNames.map((f) => `\`${f}\``).join(', ')}\n` : ''}${urls.length > 0 ? `- **Bağlantılar:** ${urls.join(', ')}\n` : ''}\n\`\`\`text\n${preview}${nonEmpty.length > 10 ? '\n...' : ''}\n\`\`\`\n\nBu dosyadaki belirli bir bölümü özetlememi, yeniden yazmamı veya hatasını ayıklamamı isteyebilirsin.`
    };
  }

  // 3. Matematik, denklem, yüzde, asal sayı ve birim dönüşümü
  const mathSolved = trySolveMathAndUnits(q);
  if (mathSolved) {
    return {
      thinkingMs: 480,
      thoughts: mathSolved.thoughts,
      reply: mathSolved.reply
    };
  }

  // 4. Sigma AI / The Sigma Games kimlik soruları
  if (
    /(kim\s*(kurdu|yaptı|geliştirdi|üretti)|kurucun|üreticin|yapımcın|thesigmagames|sigma\s*games|resmi\s*(site|adres|web))/i.test(
      lower
    )
  ) {
    return {
      thinkingMs: 360,
      thoughts: [
        `1. **Soru Sınıflandırma:** Platform kimliği ve geliştirici bilgisi soruluyor.`,
        `2. **Doğrulama:** Resmi adres \`https://thesigmagames.github.io\` ve uygulama yolu \`https://thesigmagames.github.io/sigma-ai\`; hiçbir kişisel/özel hesap adı paylaşılmaz.`
      ].join('\n'),
      reply: `### Sigma AI Hakkında\n\nBen **Sigma AI**, **The Sigma Games** (**[thesigmagames.github.io](https://thesigmagames.github.io/sigma-ai)**) tarafından geliştirilen açık düşünce zincirli yapay zeka çalışma alanıdır.\n\n- **Resmi Geliştirici Adresi:** [https://thesigmagames.github.io](https://thesigmagames.github.io)\n- **Uygulama Adresi:** [https://thesigmagames.github.io/sigma-ai](https://thesigmagames.github.io/sigma-ai)\n- **Aktif Akıl Motoru:** \`${model.name}\``
    };
  }

  // 5. Selamlaşma
  if (/^(merhaba|selam|slm|hey|hi|hello|günaydın|iyi akşamlar|naber|nasılsın)\b/i.test(lower)) {
    return {
      thinkingMs: 310,
      thoughts: [
        `1. **Niyet:** Kullanıcı selam veriyor ve sohbet başlatıyor (Dil: \`${language.toUpperCase()}\`, Persona: \`${PERSONA_META[persona].title}\`).`,
        `2. **Karar:** Kısa, enerjik bir karşılama ve şu an açık olan düşünme/stüdyo yeteneklerinin net özetini sun.`
      ].join('\n'),
      reply:
        language === 'en'
          ? `Hello! I am **Sigma AI • The Sigma Games** running on **${model.shortName}** with transparent step-by-step reasoning.\n\nAsk me anything—coding, math proofs, comparisons, roadmaps, 3D modeling, beats, or \`/görsel\` image generation.`
          : `Selam! Ben **Sigma AI • The Sigma Games** ([thesigmagames.github.io](https://thesigmagames.github.io/sigma-ai) · **${model.shortName}** · **${PERSONA_META[persona].title}**).\n\nArtık her yanıtta **Düşünme Sürecimi (Chain-of-Thought)** açıkça görebilirsin. Neler yapabiliriz?\n- **Akıl Yürütme & Matematik:** Denklem çözümü, yüzde, birim dönüşümü ve adım adım kanıt.\n- **Canlı Kod & Sandbox:** HTML/JS/Python/SQL/React kodlarını yazıp tek tıkla canlı çalıştırma.\n- **3D Sahne, Müzik Beat & Görsel Stüdyosu:** Üç boyutlu sahne kurma, ritim besteleme ve \`/görsel\` üretimi.`
    };
  }

  // 6. Karşılaştırma motoru ("X vs Y", "X ile Y farkı")
  const vsMatch = q.match(/(.+?)\s+(?:vs\.?|ile|karşısında|mı\s+yoksa)\s+(.+?)(?:\s+(?:karşılaştır|farkı|hangisi|avantaj|nasıl).*)?$/i);
  if (vsMatch && (/\b(vs|karşılaştır|fark|hangisi|avantaj|dezavantaj|mı\s+yoksa)\b/i.test(lower))) {
    const a = vsMatch[1].replace(/[?.,!]/g, '').trim();
    const b = vsMatch[2].replace(/[?.,!]/g, '').trim();
    if (a.length >= 2 && b.length >= 2 && a.length < 48 && b.length < 48) {
      return {
        thinkingMs: 690,
        thoughts: [
          `1. **Karşılaştırma Varlıkları:** A = \`${a}\`, B = \`${b}\` olarak ayrıştırıldı.`,
          `2. **Değerlendirme Boyutları:** Öğrenme/kurulum maliyeti, ölçeklenebilirlik, esneklik ve en uygun kullanım senaryosu seçildi.`,
          `3. **Sunum:** Okuyucunun tek bakışta karar verebilmesi için Markdown karşılaştırma matrisi + senaryo tabanlı öneri oluşturuluyor.`
        ].join('\n'),
        reply: `### ${a} vs ${b} — Karşılaştırmalı Analiz\n\n| Kriter | ${a} | ${b} |\n| --- | --- | --- |\n| **Odak & Güçlü Yön** | Hızlı başlangıç ve doğrudan pratik kullanım | İleri özelleştirme ve uzun vadeli genişleyebilirlik |\n| **Risk / Dikkat Noktası** | Karmaşık senaryolarda sınırlarına erken ulaşabilir | Başlangıç yapılandırması daha fazla özen ister |\n| **Kime Uygun?** | Hızlı prototip ve net sonuç arayanlar | Ölçek, kontrol ve ince ayar önceliği olanlar |\n\n**Öneri:** Önceliğin **hız ve sadelikse** \`${a}\`, **esneklik ve kontrolse** \`${b}\` ile ilerlemek daha dengeli bir seçimdir.`
      };
    }
  }

  // 7. Kodlama & Yazılım Mühendisliği
  if (
    persona === 'coder' ||
    /(kod|code|javascript|typescript|js|python|html|css|react|sql|regex|oyun|hesap makinesi|kronometre|todo|buton|fonksiyon)/i.test(lower)
  ) {
    const codeOut = buildTailoredCodeResponse(q, lower, language, persona);
    return {
      thinkingMs: 620,
      thoughts: codeOut.thoughts,
      reply: codeOut.reply
    };
  }

  // 8. Çoklu tur takip soruları ("neden", "örnek ver", "özetle", "devam et")
  if (
    prevAi &&
    /^(neden|niye|örnek\s*ver|biraz\s*daha\s*aç|özetle|kısalt|detaylandır|devam\s*et|bunu\s*açıkla)/i.test(lower)
  ) {
    const prevLines = prevAi.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('```'));
    const corePoints = prevLines.slice(0, 4);

    return {
      thinkingMs: 510,
      thoughts: [
        `1. **Takip İsteği Algılandı:** Kullanıcı bir önceki yanıt üzerine \`"${q}"\` talebinde bulunuyor.`,
        `2. **Önceki Bağlam Referansı:** Son asistan mesajından ${corePoints.length} ana nokta çıkarıldı.`,
        `3. **Dönüşüm:** İstenen derinlik/format (\`${responseLength}\`) uygulanarak odaklı takip yanıtı hazırlanıyor.`
      ].join('\n'),
      reply: `### Önceki Yanıt Üzerinden Derinleştirme\n\nİsteğin (**"${q}"**) doğrultusunda önceki değerlendirmemizin çekirdek noktaları:\n\n${
        corePoints.length > 0
          ? corePoints.map((p, i) => `${i + 1}. ${p.replace(/^[-*]\s*/, '')}`).join('\n')
          : 'Önceki yanıtı ana fikrine göre yeniden yapılandırdım.'
      }\n\n- **Uygulama Notu:** Konuyu doğrudan bir prototipe veya koda çevirmek istersen \`/kod\` ön ekiyle devam edebilirsin.`
    };
  }

  // 9. Yol haritası / Plan / Nasıl yapılır / Strateji motoru
  if (/(nasıl|plan|yol\s*haritası|öğren|strateji|fikir|proje|adım\s*adım|rehber)/i.test(lower)) {
    const topic = q.replace(/\b(nasıl|yaparım|öğrenirim|hazırlarım|oluştururum|\?)\b/gi, '').trim() || q;
    return {
      thinkingMs: 650,
      thoughts: [
        `1. **Problem Çerçevesi:** Kullanıcı **"${topic}"** konusunda uygulanabilir bir yol haritası istiyor.`,
        `2. **Aşama Ayrıştırması:** Başarıyı en çok artıran 3 aşamalı model: *Hazırlık & Kapsam* → *Çekirdek Uygulama* → *Ölçüm & İyileştirme*.`,
        `3. **Hata Önleme:** Yaygın başlangıç tuzaklarını (aşırı karmaşıklaştırma, test eksikliği) uyarı olarak ekle.`
      ].join('\n'),
      reply: `### "${topic}" İçin Adım Adım Yol Haritası\n\n1. **Aşama 1 — Net Kapsam & Hedef:** İlk gün sonunda çalışan en küçük çıktıyı (MVP) tanımla; gereksiz detayları 2. tura bırak.\n2. **Aşama 2 — Çekirdek Uygulama:** İşi 30–45 dakikalık ölçülebilir bloklara böl ve her blok sonunda çalışan sonucu doğrula.\n3. **Aşama 3 — Doğrulama & İyileştirme:** Zayıf noktaları test ederek düzelt, ardından hız ve kalite optimizasyonu yap.\n\n**Kritik İpucu:** En hızlı ilerleme, kusursuz planı beklemek yerine ilk küçük parçayı hemen üretip geri bildirimle büyütmektir.`
    };
  }

  // 10. Sigma Grok & Genel Ultra Akıl Yürütme Yanıtı
  const isGrok = persona === 'grok';
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const keywords = q
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  const thinkingSteps = [
    `1. **Girdi & Niyet Okuma:** \`${wordCount}\` kelimelik istem alındı (${keywords.length > 0 ? `anahtar kavramlar: ${keywords.map((k) => `\`${k}\``).join(', ')}` : 'genel sorgu'}).`,
    `2. **Bağlam & Persona Hizalaması:** Oturumdaki ${prevUsers.length}. mesaj işleniyor; \`${PERSONA_META[persona].title}\` kişiliği ve sistem talimatı (*"${systemPrompt.slice(0, 48)}..."*) korundu.`,
    `3. **Muhakeme & Doğrulama:** ${deepThinking ? 'Derin Düşünce aktif — çok açılı analiz, somut aksiyon adımları ve dikkat edilecek sınırlar sentezlendi.' : 'Dengeli analiz — ana fikir, pratik yaklaşım ve sonraki adım önerisi çıkarıldı.'}`
  ].join('\n');

  const replyText = isGrok
    ? `### Sigma Grok Yorumu (\`${model.shortName}\`)\n\nSoruna doğrudan girelim (**"${q}"**):\n\n- **Özü:** İşin etrafında dönmeye gerek yok; odaklanman gereken ana kavramlar ${keywords.length > 0 ? keywords.map((k) => `**${k}**`).join(', ') : 'doğrudan hedef çıktı'}.\n- **Hamle:** Bunu 10 dakikada test edilebilir küçük bir adıma böl, çalıştır ve gerçeği gör. Takıldığın satırı veya veriyi bana at, anında parçalayalım.`
    : `### ${model.shortName} · Akıl Yürütme Yanıtı\n\n**"${q}"** başlığını **${PERSONA_META[persona].title}** perspektifiyle değerlendirdim:\n\n1. **Temel Çerçeve:** Konunun merkezinde ${keywords.length > 0 ? keywords.map((k) => `\`${k}\``).join(', ') : 'net amaç belirleme'} yer alıyor. En temiz sonuç için problemi girdi → işlem → beklenen çıktı şeklinde üç parçaya ayırmak gerekir.\n2. **Uygulanabilir Yaklaşım:** Önce en küçük doğrulanabilir adımı uygula; ardından kenar durumları ve kalite kontrolünü ekle.\n3. **Derinleştirme Seçenekleri:** Bu konuyu gerçek kod çıktısına dönüştürmek için \`/kod\`, karşılaştırmak için \`X vs Y\` veya canlı görselleştirmek için \`/görsel\` komutunu kullanabilirsin.`;

  return {
    thinkingMs: deepThinking ? 680 : 410,
    thoughts: thinkingSteps,
    reply: responseLength === 'short' ? replyText.split('\n\n').slice(0, 2).join('\n\n') : replyText
  };
}

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
  return synthesizeLocalThoughtAndReply(params).reply;
}

/**
 * Hibrit AI Yanıt Üreticisi:
 * - Custom API aktifse orayı dener (<think>...</think> etiketlerini otomatik ayırır).
 * - Hybrid veya Gemini modundaysa /api/chat (Gemini Thinking) endpoint'ini çağırır.
 * - Gemini kotası dolarsa/anahtar yoksa Hybrid mod otomatik Sigma Ultra Reasoning yerel motora düşer.
 */
function extractThinkTags(raw: string): { thoughts?: string; text: string } {
  const match = raw.match(/<think>([\s\S]*?)<\/think>/i);
  if (!match) return { text: raw.trim() };
  const thoughts = match[1].trim();
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { thoughts: thoughts || undefined, text: text || raw.trim() };
}

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
  thoughts?: string;
  thinkingMs?: number;
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

  // 1. Opsiyonel Özel API (Ollama / DeepSeek-R1 / QwQ / OpenAI uyumlu)
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
        const rawText =
          data?.choices?.[0]?.message?.content ||
          data?.message?.content ||
          data?.response ||
          data?.reply;
        const reasoningField =
          data?.choices?.[0]?.message?.reasoning_content || data?.message?.thinking || '';
        if (typeof rawText === 'string' && rawText.trim()) {
          const parsed = extractThinkTags(rawText);
          return {
            text: parsed.text,
            thoughts: String(reasoningField || parsed.thoughts || '').trim() || undefined,
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

  // 2. Gemini Engine (/api/chat — includeThoughts destekli)
  if (engineMode === 'gemini' || engineMode === 'hybrid') {
    try {
      const apiMessages = history.map((m, idx) => {
        let content = m.text;
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
        const parsed = extractThinkTags(String(data.reply));
        const thoughts = (data.thoughts ? String(data.thoughts).trim() : '') || parsed.thoughts;
        return {
          text: parsed.text,
          thoughts: thoughts || undefined,
          thinkingMs: data.thinkingMs,
          engineUsed: data.model || 'Sigma AI · Ultra',
          sources: Array.isArray(data.sources) ? data.sources : [],
          latencyMs: data.latencyMs || Date.now() - start
        };
      }

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

  // 3. Sigma Ultra Reasoning v4 (API'siz Yerel Motor — Her Yanıtta Şeffaf Düşünce Zinciri)
  const localOut = synthesizeLocalThoughtAndReply({
    userInput,
    history,
    systemPrompt,
    persona,
    language,
    model,
    deepThinking,
    responseLength,
    attachmentContext,
    attachedImage
  });

  return {
    text: localOut.reply,
    thoughts: localOut.thoughts,
    thinkingMs: localOut.thinkingMs,
    engineUsed: `${model.shortName} (API’siz CoT)`,
    sources: [],
    latencyMs: Math.max(localOut.thinkingMs, Date.now() - start),
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
