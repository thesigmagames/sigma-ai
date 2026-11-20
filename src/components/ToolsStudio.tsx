import React, { useState, useEffect, useMemo } from 'react';

interface ToolsStudioProps {
  onSendToChat: (prompt: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ToolTab = 'prompts' | 'api_tester' | 'sql_pad' | 'json' | 'regex' | 'encode' | 'password' | 'focus' | 'colors_ascii' | 'units_timer';

const PROMPT_LIBRARY = [
  {
    category: 'Kodlama',
    title: 'Tam Tek Dosya HTML5 Oyunu',
    prompt:
      'HTML, CSS ve JavaScript kullanarak tek dosyada çalışan akıcı, skor tabanlı ve mobil uyumlu bir uzay kaçış oyunu kodu yaz.'
  },
  {
    category: 'Kodlama',
    title: 'Kod Hata Ayıklama ve Optimizasyon',
    prompt:
      'Sana vereceğim kodu performans, güvenlik açıkları, okunabilirlik ve bellek yönetimi açısından incele ve iyileştirilmiş halini yaz:'
  },
  {
    category: 'Görsel',
    title: 'Sevimli Maymun ve Muz Sahnesi',
    prompt: '/görsel Sevimli bir maymun tropikal ormanda dalda oturmuş taze sarı muz yiyor'
  },
  {
    category: 'Görsel',
    title: 'Oyun Konsept Sanatı',
    prompt: '/görsel Bulutların üzerinde yükselen yüzen adalar ve antik taş köprü, gün batımı ışığı'
  },
  {
    category: 'Oyun',
    title: 'RPG Karakter ve Hikaye Tasarımı',
    prompt:
      'The Sigma Games evreni için özgün bir ana karakter, 3 özel yetenek, zayıf yön ve kısa başlangıç hikayesi oluştur.'
  },
  {
    category: 'Eğitim',
    title: 'Sıfırdan Konu Anlatımı',
    prompt:
      'Karmaşık bir konuyu önce 10 yaşındaki birine anlatır gibi sade örneklerle, sonra teknik detaylarıyla tablo halinde açıkla:'
  },
  {
    category: 'Verimlilik',
    title: 'Profesyonel E-posta ve Sunum',
    prompt:
      'Aşağıdaki notları akıcı, ikna edici ve net maddelerden oluşan profesyonel bir toplantı özetine dönüştür:'
  },
  {
    category: 'Kodlama',
    title: 'SQL & Veritabanı Mimarisi',
    prompt:
      'Çok oyunculu bir oyun sistemi için kullanıcılar, envanter, skor tablosu ve arkadaşlık ilişkilerini içeren temiz SQL şeması tasarla.'
  }
];

const SAMPLE_SQL_DB: Record<string, Array<Record<string, any>>> = {
  oyuncular: [
    { id: 1, takma_ad: 'SigmaHero', seviye: 42, puan: 9850, bolge: 'TR' },
    { id: 2, takma_ad: 'NeonFalcon', seviye: 38, puan: 8420, bolge: 'EU' },
    { id: 3, takma_ad: 'PixelMancer', seviye: 51, puan: 12400, bolge: 'TR' },
    { id: 4, takma_ad: 'CyberNinja', seviye: 29, puan: 6150, bolge: 'US' },
    { id: 5, takma_ad: 'AstroKnight', seviye: 45, puan: 10300, bolge: 'TR' }
  ],
  oyunlar: [
    { id: 101, ad: 'Uzay Kaçışı', tur: 'Arcade', aktif_oyuncu: 1420 },
    { id: 102, ad: 'Yılan Arenası', tur: 'Retro', aktif_oyuncu: 890 },
    { id: 103, ad: 'Gölge Kalesi', tur: 'RPG', aktif_oyuncu: 2340 }
  ]
};

function runInMemorySql(rawQuery: string): { columns: string[]; rows: any[]; error?: string } {
  const cleaned = rawQuery.trim().replace(/;+$/, '').replace(/\s+/g, ' ');
  const m = cleaned.match(
    /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i
  );
  if (!m) {
    return {
      columns: [],
      rows: [],
      error: 'Sözdizimi: SELECT * FROM oyuncular WHERE seviye >= 30 ORDER BY puan DESC LIMIT 5'
    };
  }

  const [, selectPart, tableName, whereClause, orderCol, orderDir, limitStr] = m;
  const sourceRows = SAMPLE_SQL_DB[tableName.toLowerCase()];
  if (!sourceRows) {
    return {
      columns: [],
      rows: [],
      error: `Tablo bulunamadı: "${tableName}". Mevcut tablolar: oyuncular, oyunlar`
    };
  }

  let rows = [...sourceRows];

  if (whereClause) {
    const cond = whereClause.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|>|<|>=|<=)\s*(['"]?)(.+?)\3$/);
    if (!cond) {
      return { columns: [], rows: [], error: 'WHERE koşulu anlaşılamadı (örn: bolge = "TR" veya seviye > 35).' };
    }
    const [, col, op, , rawVal] = cond;
    rows = rows.filter((r) => {
      const rv = r[col];
      const cmp = isNaN(Number(rawVal)) ? rawVal : Number(rawVal);
      if (op === '=') return rv == cmp;
      if (op === '!=') return rv != cmp;
      if (op === '>') return Number(rv) > Number(cmp);
      if (op === '<') return Number(rv) < Number(cmp);
      if (op === '>=') return Number(rv) >= Number(cmp);
      if (op === '<=') return Number(rv) <= Number(cmp);
      return true;
    });
  }

  if (orderCol) {
    rows.sort((a, b) => {
      const va = a[orderCol];
      const vb = b[orderCol];
      const res = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return orderDir?.toUpperCase() === 'DESC' ? -res : res;
    });
  }

  if (limitStr) {
    rows = rows.slice(0, Number(limitStr));
  }

  const columns =
    selectPart.trim() === '*'
      ? rows.length > 0
        ? Object.keys(rows[0])
        : Object.keys(sourceRows[0])
      : selectPart.split(',').map((s) => s.trim());

  const projected = rows.map((r) => {
    const obj: Record<string, any> = {};
    columns.forEach((c) => {
      obj[c] = r[c] ?? null;
    });
    return obj;
  });

  return { columns, rows: projected };
}

export const ToolsStudio: React.FC<ToolsStudioProps> = ({ onSendToChat, onNotify }) => {
  const [activeTool, setActiveTool] = useState<ToolTab>('prompts');
  const [promptCat, setPromptCat] = useState<string>('Tümü');

  // REST API Tester
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [apiUrl, setApiUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [apiBody, setApiBody] = useState('{\n  "title": "Sigma AI Test",\n  "completed": true\n}');
  const [apiResponse, setApiResponse] = useState('');
  const [apiMeta, setApiMeta] = useState<{ status: number; ms: number } | null>(null);
  const [isSendingApi, setIsSendingApi] = useState(false);

  // SQL Karalama Defteri
  const [sqlInput, setSqlInput] = useState(
    'SELECT id, takma_ad, seviye, puan, bolge FROM oyuncular WHERE seviye >= 30 ORDER BY puan DESC'
  );
  const [sqlOutput, setSqlOutput] = useState<{ columns: string[]; rows: any[]; error?: string }>(() =>
    runInMemorySql('SELECT id, takma_ad, seviye, puan, bolge FROM oyuncular WHERE seviye >= 30 ORDER BY puan DESC')
  );

  // JSON aracı
  const [jsonInput, setJsonInput] = useState('{"oyun":"Sigma AI","surum":2,"ozellikler":["sohbet","gorsel","kod"]}');
  const [jsonError, setJsonError] = useState('');

  // Regex aracı (Kişisel e-posta içermeyen resmi domain örneği)
  const [regexPattern, setRegexPattern] = useState('\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b');
  const [regexFlags, setRegexFlags] = useState('gi');
  const [regexTestText, setRegexTestText] = useState(
    'İletişim kanalları: destek@thesigmagames.github.io veya iletisim@example.com adreslerinden ulaşabilirsiniz.'
  );

  // Encode/Decode aracı
  const [encodeInput, setEncodeInput] = useState('Sigma AI • The Sigma Games (thesigmagames.github.io)');
  const [encodeOutput, setEncodeOutput] = useState('');

  // Şifre aracı
  const [pwLength, setPwLength] = useState(16);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwDigits, setPwDigits] = useState(true);
  const [pwSymbols, setPwSymbols] = useState(true);
  const [generatedPw, setGeneratedPw] = useState('');

  // Odak Zamanlayıcı & Metin Analizi
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusMode, setFocusMode] = useState<'work' | 'break'>('work');
  const [textStatInput, setTextStatInput] = useState(
    'Buraya analiz etmek istediğiniz herhangi bir metni yapıştırarak kelime, karakter ve okuma süresini anında hesaplayabilirsiniz.'
  );

  // Renk Paleti & ASCII Banner
  const [baseHue, setBaseHue] = useState(218);
  const [asciiText, setAsciiText] = useState('SIGMA AI');

  // Birim Çevirici & Kronometre
  const [pxInput, setPxInput] = useState('16');
  const [byteMbInput, setByteMbInput] = useState('10');
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [swLaps, setSwLaps] = useState<string[]>([]);

  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => setSwMs((v) => v + 100), 100);
    return () => clearInterval(id);
  }, [swRunning]);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = setInterval(() => {
      setFocusSeconds((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          onNotify(
            focusMode === 'work' ? 'Odak oturumu tamamlandı! Mola zamanı.' : 'Mola bitti, çalışmaya hazır!',
            'success'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [focusRunning, focusMode, onNotify]);

  const generatePassword = () => {
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (pwUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (pwDigits) chars += '0123456789';
    if (pwSymbols) chars += '!@#$%^&*()-_=+[]{}';

    const arr = new Uint32Array(pwLength);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < pwLength; i++) {
      out += chars[arr[i] % chars.length];
    }
    setGeneratedPw(out);
  };

  useEffect(() => {
    generatePassword();
  }, [pwLength, pwUpper, pwDigits, pwSymbols]);

  const handleSendApiRequest = async () => {
    if (!apiUrl.trim() || isSendingApi) return;
    setIsSendingApi(true);
    const t0 = Date.now();
    try {
      const opts: RequestInit = { method: apiMethod };
      if (apiMethod !== 'GET' && apiMethod !== 'DELETE') {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = apiBody;
      }
      const res = await fetch(apiUrl.trim(), opts);
      const raw = await res.text();
      let formatted = raw;
      try {
        formatted = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {}
      setApiMeta({ status: res.status, ms: Date.now() - t0 });
      setApiResponse(formatted);
    } catch (err: any) {
      setApiMeta({ status: 0, ms: Date.now() - t0 });
      setApiResponse(`İstek hatası (CORS veya ağ erişimi): ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsSendingApi(false);
    }
  };

  const regexMatches = useMemo(() => {
    if (!regexPattern) return { matches: [] as string[], error: '' };
    try {
      const re = new RegExp(regexPattern, regexFlags);
      const found = regexTestText.match(re) || [];
      return { matches: Array.from(found), error: '' };
    } catch (err: any) {
      return { matches: [] as string[], error: err?.message || 'Geçersiz düzenli ifade' };
    }
  }, [regexPattern, regexFlags, regexTestText]);

  const textStats = useMemo(() => {
    const chars = textStatInput.length;
    const charsNoSpaces = textStatInput.replace(/\s/g, '').length;
    const words = textStatInput.trim() ? textStatInput.trim().split(/\s+/).length : 0;
    const lines = textStatInput ? textStatInput.split(/\r?\n/).length : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { chars, charsNoSpaces, words, lines, readMinutes };
  }, [textStatInput]);

  const copyText = (val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => onNotify('Panoya kopyalandı.', 'success'));
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const categories = ['Tümü', ...Array.from(new Set(PROMPT_LIBRARY.map((p) => p.category)))];
  const visiblePrompts =
    promptCat === 'Tümü' ? PROMPT_LIBRARY : PROMPT_LIBRARY.filter((p) => p.category === promptCat);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Araç Sekmeleri */}
        <div className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-1.5">
          {[
            { id: 'prompts' as ToolTab, label: 'Prompt Kütüphanesi', icon: 'fa-wand-magic-sparkles' },
            { id: 'api_tester' as ToolTab, label: 'REST API Testi', icon: 'fa-plug' },
            { id: 'sql_pad' as ToolTab, label: 'SQL Karalama', icon: 'fa-database' },
            { id: 'json' as ToolTab, label: 'JSON Formatlayıcı', icon: 'fa-code' },
            { id: 'regex' as ToolTab, label: 'Regex Test', icon: 'fa-asterisk' },
            { id: 'encode' as ToolTab, label: 'Base64 / URL', icon: 'fa-arrows-rotate' },
            { id: 'password' as ToolTab, label: 'Şifre Üretici', icon: 'fa-key' },
            { id: 'focus' as ToolTab, label: 'Odak & Metin', icon: 'fa-stopwatch' },
            { id: 'colors_ascii' as ToolTab, label: 'Renk & ASCII', icon: 'fa-palette' },
            { id: 'units_timer' as ToolTab, label: 'Birim & Kronometre', icon: 'fa-calculator' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTool === t.id
                  ? 'sigma-accent-bg text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <i className={`fa-solid ${t.icon}`} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* 1. PROMPT KÜTÜPHANESİ */}
        {activeTool === 'prompts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPromptCat(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    promptCat === cat
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visiblePrompts.map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{item.title}</span>
                      <span className="text-[11px] font-medium sigma-accent-text">{item.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.prompt}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(item.prompt)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Kopyala
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendToChat(item.prompt)}
                      className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                    >
                      Sohbette Çalıştır
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. REST API TEST KONSOLU */}
        {activeTool === 'api_tester' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                REST API İstek Testi
              </h3>
              {apiMeta && (
                <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  HTTP {apiMeta.status || 'ERR'} · {apiMeta.ms} ms
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={apiMethod}
                onChange={(e) => setApiMethod(e.target.value as any)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs font-bold"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 font-mono text-xs"
              />
              <button
                type="button"
                disabled={isSendingApi}
                onClick={() => void handleSendApiRequest()}
                className="px-4 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {isSendingApi ? 'Gönderiliyor...' : 'İstek Gönder'}
              </button>
            </div>

            {apiMethod !== 'GET' && apiMethod !== 'DELETE' && (
              <textarea
                rows={4}
                value={apiBody}
                onChange={(e) => setApiBody(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs"
                placeholder="JSON İstek Gövdesi..."
              />
            )}

            <textarea
              rows={9}
              readOnly
              value={apiResponse}
              placeholder="Sunucu yanıtı burada görüntülenecek..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-slate-100 p-3.5 font-mono text-xs"
            />
          </div>
        )}

        {/* 3. SQL KARALAMA DEFTERİ */}
        {activeTool === 'sql_pad' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tarayıcı İçi SQL Karalama Defteri
                </h3>
                <p className="text-xs text-slate-500">
                  Örnek Tablolar: <code className="font-mono">oyuncular</code>, <code className="font-mono">oyunlar</code>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = 'SELECT * FROM oyunlar ORDER BY aktif_oyuncu DESC';
                    setSqlInput(q);
                    setSqlOutput(runInMemorySql(q));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Oyunlar Tablosu
                </button>
                <button
                  type="button"
                  onClick={() => setSqlOutput(runInMemorySql(sqlInput))}
                  className="px-4 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Sorguyu Çalıştır
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-slate-100 p-3 font-mono text-xs"
            />

            {sqlOutput.error ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-mono">
                {sqlOutput.error}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-200">
                    <tr>
                      {sqlOutput.columns.map((c) => (
                        <th key={c} className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlOutput.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {sqlOutput.columns.map((c) => (
                          <td key={c} className="px-3 py-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {String(r[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. JSON FORMATLAYICI */}
        {activeTool === 'json' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                JSON Doğrulayıcı ve Biçimlendirici
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(jsonInput);
                      setJsonInput(JSON.stringify(parsed, null, 2));
                      setJsonError('');
                      onNotify('JSON biçimlendirildi.', 'success');
                    } catch (e: any) {
                      setJsonError(e?.message || 'Geçersiz JSON');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Güzelleştir (Pretty)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(jsonInput);
                      setJsonInput(JSON.stringify(parsed));
                      setJsonError('');
                      onNotify('JSON sıkıştırıldı.', 'success');
                    } catch (e: any) {
                      setJsonError(e?.message || 'Geçersiz JSON');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Sıkıştır (Minify)
                </button>
                <button
                  type="button"
                  onClick={() => copyText(jsonInput)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendToChat(`Şu JSON verisini analiz et ve TypeScript arayüzünü (interface) oluştur:\n\n\`\`\`json\n${jsonInput}\n\`\`\``)
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
                >
                  TS Interface Üret
                </button>
              </div>
            </div>
            <textarea
              rows={11}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {jsonError ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-mono">
                Hata: {jsonError}
              </div>
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                Geçerli JSON söz dizimi kontrolüne hazır.
              </div>
            )}
          </div>
        )}

        {/* 5. REGEX TEST LABORATUVARI */}
        {activeTool === 'regex' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Düzenli İfade (Regex) Test Laboratuvarı
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
                placeholder="Regex deseni"
                className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={regexFlags}
                onChange={(e) => setRegexFlags(e.target.value)}
                placeholder="Bayraklar (gi)"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <textarea
              rows={5}
              value={regexTestText}
              onChange={(e) => setRegexTestText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-slate-100"
            />
            {regexMatches.error ? (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-mono">{regexMatches.error}</div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bulunan Eşleşmeler ({regexMatches.matches.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {regexMatches.matches.map((m, idx) => (
                    <span
                      key={`${m}-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 font-mono text-xs text-blue-700 dark:text-blue-300"
                    >
                      {m}
                    </span>
                  ))}
                  {regexMatches.matches.length === 0 && (
                    <span className="text-xs text-slate-500">Eşleşme bulunamadı.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. BASE64 & URL KODLAYICI */}
        {activeTool === 'encode' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Base64 & URL Dönüştürücü (UTF-8 Uyumlu)
            </h3>
            <textarea
              rows={4}
              value={encodeInput}
              onChange={(e) => setEncodeInput(e.target.value)}
              placeholder="Girdi metni..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    const bytes = new TextEncoder().encode(encodeInput);
                    const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
                    setEncodeOutput(btoa(bin));
                  } catch {
                    onNotify('Kodlama başarısız.', 'error');
                  }
                }}
                className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
              >
                Base64 Kodla
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const bin = atob(encodeInput.trim());
                    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
                    setEncodeOutput(new TextDecoder().decode(bytes));
                  } catch {
                    onNotify('Geçersiz Base64 verisi.', 'error');
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Base64 Çöz
              </button>
              <button
                type="button"
                onClick={() => setEncodeOutput(encodeURIComponent(encodeInput))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                URL Encode
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    setEncodeOutput(decodeURIComponent(encodeInput));
                  } catch {
                    onNotify('Geçersiz URL verisi.', 'error');
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                URL Decode
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sonuç</span>
                <button
                  type="button"
                  onClick={() => copyText(encodeOutput)}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Kopyala
                </button>
              </div>
              <textarea
                rows={4}
                readOnly
                value={encodeOutput}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* 7. ŞİFRE ÜRETİCİ */}
        {activeTool === 'password' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Kriptografik Güçlü Şifre Oluşturucu
            </h3>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
              <code className="text-base sm:text-lg font-mono font-bold text-blue-600 dark:text-blue-400 break-all">
                {generatedPw}
              </code>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Yenile
                </button>
                <button
                  type="button"
                  onClick={() => copyText(generatedPw)}
                  className="px-3 py-2 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Kopyala
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Uzunluk: <span className="font-mono">{pwLength}</span> karakter
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={48}
                value={pwLength}
                onChange={(e) => setPwLength(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pwUpper} onChange={(e) => setPwUpper(e.target.checked)} className="accent-blue-600" />
                  <span>Büyük Harfler (A-Z)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pwDigits} onChange={(e) => setPwDigits(e.target.checked)} className="accent-blue-600" />
                  <span>Rakamlar (0-9)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pwSymbols} onChange={(e) => setPwSymbols(e.target.checked)} className="accent-blue-600" />
                  <span>Özel Semboller (!@#$%)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 8. ODAK ZAMANLAYICI & METİN ANALİZİ */}
        {activeTool === 'focus' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Pomodoro Odak Zamanlayıcı
              </h3>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFocusRunning(false);
                    setFocusMode('work');
                    setFocusSeconds(25 * 60);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    focusMode === 'work'
                      ? 'sigma-accent-bg text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Çalışma (25 dk)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFocusRunning(false);
                    setFocusMode('break');
                    setFocusSeconds(5 * 60);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    focusMode === 'break'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Mola (5 dk)
                </button>
              </div>
              <div className="text-5xl font-bold font-mono tabular-nums text-slate-900 dark:text-white py-4">
                {formatTimer(focusSeconds)}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setFocusRunning((r) => !r)}
                  className="px-5 py-2.5 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  {focusRunning ? 'Duraklat' : 'Başlat'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFocusRunning(false);
                    setFocusSeconds(focusMode === 'work' ? 25 * 60 : 5 * 60);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Sıfırla
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Anlık Metin & Okuma Süresi Analizi
              </h3>
              <textarea
                rows={5}
                value={textStatInput}
                onChange={(e) => setTextStatInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { k: 'Kelime', v: textStats.words },
                  { k: 'Karakter', v: textStats.chars },
                  { k: 'Boşluksuz', v: textStats.charsNoSpaces },
                  { k: 'Okuma', v: `~${textStats.readMinutes} dk` }
                ].map((s) => (
                  <div
                    key={s.k}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-[11px] text-slate-500">{s.k}</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 9. RENK PALETİ & ASCII BANNER */}
        {activeTool === 'colors_ascii' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Harmonik 5’li Renk Paleti</h3>
                <button
                  type="button"
                  onClick={() => setBaseHue(Math.floor(Math.random() * 360))}
                  className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  Rastgele Palet
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0, 28, -28, 180, 150].map((offset, idx) => {
                  const h = (baseHue + offset + 360) % 360;
                  const l = idx === 3 ? 52 : 48 + idx * 4;
                  const hsl = `hsl(${h}, 76%, ${l}%)`;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyText(hsl)}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer text-left"
                    >
                      <div className="h-20" style={{ backgroundColor: hsl }} />
                      <div className="p-1.5 font-mono text-[10px] truncate text-slate-700 dark:text-slate-300">{hsl}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">ASCII Kutusu Oluşturucu</h3>
              <input
                type="text"
                value={asciiText}
                onChange={(e) => setAsciiText(e.target.value.slice(0, 32))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                placeholder="Metin girin..."
              />
              {(() => {
                const label = (asciiText || 'SIGMA AI').toUpperCase();
                const border = '+' + '-'.repeat(label.length + 6) + '+';
                const box = `${border}\n|   ${label}   |\n|  thesigmagames.github.io  |\n${border}`;
                return (
                  <div className="space-y-2">
                    <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto">{box}</pre>
                    <button
                      type="button"
                      onClick={() => copyText(box)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      ASCII Kopyala
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 10. BİRİM ÇEVİRİCİ & KRONOMETRE */}
        {activeTool === 'units_timer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">CSS PX ↔ REM & Veri Çevirici</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="font-semibold">Piksel (px)</span>
                  <input
                    type="number"
                    value={pxInput}
                    onChange={(e) => setPxInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                  <span className="text-slate-500">REM (16px baz)</span>
                  <span className="text-base font-bold font-mono tabular-nums">
                    {((Number(pxInput) || 0) / 16).toFixed(3)} rem
                  </span>
                </div>
                <label className="space-y-1">
                  <span className="font-semibold">Megabayt (MB)</span>
                  <input
                    type="number"
                    value={byteMbInput}
                    onChange={(e) => setByteMbInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                  <span className="text-slate-500">KB / GB</span>
                  <span className="text-xs font-bold font-mono tabular-nums">
                    {((Number(byteMbInput) || 0) * 1024).toFixed(0)} KB · {((Number(byteMbInput) || 0) / 1024).toFixed(3)} GB
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Turlu Kronometre</h3>
              <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 dark:text-white py-2">
                {`${Math.floor(swMs / 60000).toString().padStart(2, '0')}:${Math.floor((swMs % 60000) / 1000)
                  .toString()
                  .padStart(2, '0')}.${Math.floor((swMs % 1000) / 100)}`}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSwRunning((r) => !r)}
                  className="px-4 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                >
                  {swRunning ? 'Durdur' : 'Başlat'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const formatted = `${Math.floor(swMs / 60000).toString().padStart(2, '0')}:${Math.floor((swMs % 60000) / 1000)
                      .toString()
                      .padStart(2, '0')}.${Math.floor((swMs % 1000) / 100)}`;
                    setSwLaps((l) => [formatted, ...l.slice(0, 4)]);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Tur Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwRunning(false);
                    setSwMs(0);
                    setSwLaps([]);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Sıfırla
                </button>
              </div>
              {swLaps.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {swLaps.map((lap, idx) => (
                    <span key={idx} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs tabular-nums">
                      #{swLaps.length - idx}: {lap}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
