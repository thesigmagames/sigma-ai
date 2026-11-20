import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  analyzeDocumentHybrid,
  generateHybridAiReply,
  LOCAL_MODELS
} from '../services/localAiEngine';
import type { AiEngineMode, AppLanguage, CustomApiConfig } from '../types/chat';

interface VoiceDocStudioProps {
  engineMode: AiEngineMode;
  selectedModelId: string;
  customApi: CustomApiConfig;
  language: AppLanguage;
  onSendToChat: (prompt: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface VoiceTurn {
  id: string;
  speaker: 'Sen' | 'Sigma AI';
  text: string;
  time: string;
}

export const VoiceDocStudio: React.FC<VoiceDocStudioProps> = ({
  engineMode,
  selectedModelId,
  customApi,
  language,
  onSendToChat,
  onNotify
}) => {
  const [subTab, setSubTab] = useState<'voice' | 'doc' | 'music'>('voice');

  // --- Müzik & Beat Stüdyosu (16-Adımlı Web Audio Sequencer) State ---
  const [bpm, setBpm] = useState(112);
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [musicScale, setMusicScale] = useState<'minor' | 'pentatonic' | 'hicaz'>('pentatonic');
  const [kickSteps, setKickSteps] = useState<boolean[]>([
    true, false, false, false, true, false, false, true, true, false, false, false, true, false, false, false
  ]);
  const [snareSteps, setSnareSteps] = useState<boolean[]>([
    false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false
  ]);
  const [hatSteps, setHatSteps] = useState<boolean[]>([
    true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true
  ]);
  const [synthSteps, setSynthSteps] = useState<number[]>([
    0, -1, 2, -1, 4, -1, 2, 1, 0, -1, 3, -1, 4, 2, -1, 1
  ]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beatDataRef = useRef({ kickSteps, snareSteps, hatSteps, synthSteps, musicScale });

  useEffect(() => {
    beatDataRef.current = { kickSteps, snareSteps, hatSteps, synthSteps, musicScale };
  }, [kickSteps, snareSteps, hatSteps, synthSteps, musicScale]);

  // --- Gerçek Zamanlı Sesli Asistan State ---
  const [voiceActive, setVoiceActive] = useState(false);
  const [autoReplyVoice, setAutoReplyVoice] = useState(true);
  const [continuousLoop, setContinuousLoop] = useState(true);
  const [voiceLang, setVoiceLang] = useState<'tr-TR' | 'en-US'>(language === 'en' ? 'en-US' : 'tr-TR');
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [manualSpeechText, setManualSpeechText] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recRef = useRef<any>(null);
  const activeFlagRef = useRef(false);
  const voiceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    voiceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [voiceTurns.length]);

  useEffect(() => {
    return () => {
      activeFlagRef.current = false;
      try {
        recRef.current?.stop();
      } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      try {
        audioCtxRef.current?.close();
      } catch {}
    };
  }, []);

  const activeModel = LOCAL_MODELS.find((m) => m.id === selectedModelId) || LOCAL_MODELS[0];

  const speakText = (text: string, onDone?: () => void) => {
    if (!autoReplyVoice || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const cleaned = text.replace(/```[\s\S]*?```/g, ' Kod örneği. ').replace(/[*_#>`]/g, '');
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = voiceLang;
    utter.rate = 1.02;
    setIsSpeaking(true);
    utter.onend = () => {
      setIsSpeaking(false);
      onDone?.();
    };
    utter.onerror = () => {
      setIsSpeaking(false);
      onDone?.();
    };
    window.speechSynthesis.speak(utter);
  };

  const handleVoiceUtterance = async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) return;

    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    setVoiceTurns((prev) => [...prev, { id: `v_${Date.now()}_u`, speaker: 'Sen', text: clean, time: nowTime }]);
    setIsProcessingVoice(true);

    try {
      const res = await generateHybridAiReply({
        userInput: clean,
        history: [],
        systemPrompt: 'Sesli sohbet modundasın. Yanıtların net, doğal konuşma diline uygun ve akıcı olsun.',
        persona: 'general',
        language: voiceLang === 'en-US' ? 'en' : 'tr',
        deepThinking: false,
        webSearch: false,
        responseLength: 'short',
        engineMode,
        model: activeModel,
        customApi
      });

      const aiTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setVoiceTurns((prev) => [
        ...prev,
        { id: `v_${Date.now()}_a`, speaker: 'Sigma AI', text: res.text, time: aiTime }
      ]);

      speakText(res.text, () => {
        if (activeFlagRef.current && continuousLoop) {
          startRecognitionLoop();
        }
      });
    } catch {
      onNotify('Sesli yanıt işlenirken hata oluştu.', 'error');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const startRecognitionLoop = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onNotify('Tarayıcınız Web Speech API desteklemiyor. Alttaki yazılı test alanını kullanabilirsiniz.', 'error');
      activeFlagRef.current = false;
      setVoiceActive(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = voiceLang;
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (ev: any) => {
        const transcript = ev?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          void handleVoiceUtterance(transcript);
        } else if (activeFlagRef.current && continuousLoop) {
          startRecognitionLoop();
        }
      };

      rec.onerror = (ev: any) => {
        if (ev?.error === 'not-allowed') {
          activeFlagRef.current = false;
          setVoiceActive(false);
          onNotify('Mikrofon izni reddedildi.', 'error');
        }
      };

      rec.onend = () => {
        // Konuşma bekleme durumunda otomatik döngü
      };

      recRef.current = rec;
      rec.start();
    } catch {
      activeFlagRef.current = false;
      setVoiceActive(false);
    }
  };

  const toggleVoiceAssistant = () => {
    if (voiceActive) {
      activeFlagRef.current = false;
      setVoiceActive(false);
      try {
        recRef.current?.stop();
      } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      onNotify('Sesli asistan durduruldu.', 'info');
    } else {
      activeFlagRef.current = true;
      setVoiceActive(true);
      startRecognitionLoop();
      onNotify('Sesli asistan dinliyor — konuşmaya başlayabilirsiniz.', 'success');
    }
  };

  // --- Belge & PDF Analizcisi State ---
  const [docName, setDocName] = useState('');
  const [docMime, setDocMime] = useState('text/plain');
  const [docText, setDocText] = useState('');
  const [docBase64, setDocBase64] = useState('');
  const [docQuestion, setDocQuestion] = useState('');
  const [docResult, setDocResult] = useState('');
  const [docEngineUsed, setDocEngineUsed] = useState('');
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  const docInputRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      onNotify('Dosya boyutu en fazla 6 MB olabilir.', 'error');
      e.target.value = '';
      return;
    }

    setDocName(file.name);
    setDocMime(file.type || 'text/plain');
    setDocResult('');

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const bReader = new FileReader();
      bReader.onload = () => {
        setDocBase64(typeof bReader.result === 'string' ? bReader.result : '');
      };
      bReader.readAsDataURL(file);

      const tReader = new FileReader();
      tReader.onload = () => {
        const raw = typeof tReader.result === 'string' ? tReader.result : '';
        // Basit PDF metin akışı çıkarımı (parantez içi okunabilir metinler)
        const extracted = (raw.match(/\(([^()]{3,160})\)/g) || [])
          .map((m) => m.slice(1, -1))
          .filter((s) => /[a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/.test(s))
          .join(' ');
        setDocText(extracted);
      };
      tReader.readAsBinaryString(file);
      onNotify(`"${file.name}" PDF belgesi yüklendi.`, 'success');
    } else {
      setDocBase64('');
      const reader = new FileReader();
      reader.onload = () => {
        setDocText(typeof reader.result === 'string' ? reader.result : '');
        onNotify(`"${file.name}" analize hazır.`, 'success');
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const runDocAnalysis = async (task: 'summary' | 'bullets' | 'qa') => {
    if (!docText.trim() && !docBase64) {
      onNotify('Lütfen önce bir belge yükleyin veya metin yapıştırın.', 'error');
      return;
    }
    if (task === 'qa' && !docQuestion.trim()) {
      onNotify('Lütfen belge hakkında sormak istediğiniz soruyu yazın.', 'error');
      return;
    }

    setIsAnalyzingDoc(true);
    try {
      const res = await analyzeDocumentHybrid({
        fileName: docName || 'metin-belgesi.txt',
        mimeType: docMime,
        textContent: docText,
        base64Data: docBase64 || undefined,
        task,
        question: docQuestion
      });
      setDocResult(res.reply);
      setDocEngineUsed(res.engineUsed);
      onNotify('Belge analizi tamamlandı.', 'success');
    } catch {
      onNotify('Belge analizi başarısız oldu.', 'error');
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  const triggerBeatStepAudio = (ctx: BaseAudioContext, when: number, stepIdx: number) => {
    const { kickSteps: k, snareSteps: s, hatSteps: h, synthSteps: sy, musicScale: sc } = beatDataRef.current;
    const scaleNotes: Record<'minor' | 'pentatonic' | 'hicaz', number[]> = {
      pentatonic: [220, 261.63, 293.66, 329.63, 392.0],
      minor: [220, 246.94, 261.63, 329.63, 349.23],
      hicaz: [220, 233.08, 277.18, 293.66, 329.63]
    };

    if (k[stepIdx]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.14);
      gain.gain.setValueAtTime(0.65, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.19);
    }

    if (s[stepIdx]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, when);
      osc.frequency.exponentialRampToValueAtTime(95, when + 0.1);
      gain.gain.setValueAtTime(0.35, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.13);
    }

    if (h[stepIdx]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(6400, when);
      gain.gain.setValueAtTime(0.09, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.05);
    }

    const noteIdx = sy[stepIdx];
    if (noteIdx >= 0) {
      const freq = scaleNotes[sc][noteIdx % 5] * (stepIdx % 8 === 4 ? 1.5 : 1);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, when);
      gain.gain.setValueAtTime(0.12, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.24);
    }
  };

  useEffect(() => {
    if (!beatPlaying) {
      setCurrentStep(-1);
      return;
    }
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current && AudioCtx) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    let step = 0;
    const stepMs = (60 / bpm / 4) * 1000;
    const interval = setInterval(() => {
      setCurrentStep(step);
      if (audioCtxRef.current) {
        triggerBeatStepAudio(audioCtxRef.current, audioCtxRef.current.currentTime, step);
      }
      step = (step + 1) % 16;
    }, stepMs);
    return () => clearInterval(interval);
  }, [beatPlaying, bpm]);

  const applyBeatPreset = (preset: 'trap' | 'synthwave' | 'lofi') => {
    if (preset === 'trap') {
      setBpm(136);
      setMusicScale('minor');
      setKickSteps([true, false, false, false, false, false, true, false, true, false, false, true, false, false, false, false]);
      setSnareSteps([false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]);
      setHatSteps([true, true, true, true, true, false, true, true, true, true, true, false, true, true, true, true]);
      setSynthSteps([0, -1, 1, -1, 0, -1, 3, -1, 2, -1, 0, -1, 4, -1, 1, -1]);
    } else if (preset === 'synthwave') {
      setBpm(120);
      setMusicScale('pentatonic');
      setKickSteps([true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]);
      setSnareSteps([false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]);
      setHatSteps([false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true]);
      setSynthSteps([0, 2, 4, 2, 0, 2, 4, 2, 1, 3, 4, 3, 1, 3, 4, 2]);
    } else {
      setBpm(84);
      setMusicScale('hicaz');
      setKickSteps([true, false, false, false, false, false, false, true, false, false, true, false, false, false, false, false]);
      setSnareSteps([false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]);
      setHatSteps([true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]);
      setSynthSteps([0, -1, -1, 2, -1, 4, -1, -1, 3, -1, 1, -1, 0, -1, 2, -1]);
    }
    onNotify(`"${preset.toUpperCase()}" ritim şablonu yüklendi.`, 'info');
  };

  const handleDownloadWav = async () => {
    try {
      const sampleRate = 44100;
      const stepSec = 60 / bpm / 4;
      const totalSteps = 32; // 2 döngü
      const totalDuration = totalSteps * stepSec + 0.5;
      const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * totalDuration), sampleRate);
      for (let i = 0; i < totalSteps; i++) {
        triggerBeatStepAudio(offline, i * stepSec + 0.05, i % 16);
      }
      const rendered = await offline.startRendering();
      const samples = rendered.getChannelData(0);
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const writeStr = (off: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      let offset = 44;
      for (let i = 0; i < samples.length; i++) {
        const val = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, val < 0 ? val * 0x8000 : val * 0x7fff, true);
        offset += 2;
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sigma-beat-${bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('WAV müzik dosyası oluşturuldu ve indirildi.', 'success');
    } catch {
      onNotify('WAV oluşturma sırasında hata oluştu.', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Alt Mod Seçici */}
        <div className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSubTab('voice')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'voice'
                  ? 'sigma-accent-bg text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <i className="fa-solid fa-headset" />
              <span>Sesli Asistan</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('doc')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'doc'
                  ? 'sigma-accent-bg text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <i className="fa-solid fa-file-pdf" />
              <span>Belge & PDF Analizcisi</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('music')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                subTab === 'music'
                  ? 'sigma-accent-bg text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <i className="fa-solid fa-music" />
              <span>Müzik & Beat Stüdyosu</span>
            </button>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2">
            Eller Serbest · PDF · 16-Adım Synth
          </span>
        </div>

        {subTab === 'music' ? (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tarayıcı İçi Müzik & Beat Sequencer
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  API gerektirmeden Web Audio synth ile ritim ve melodi besteleyin, WAV olarak indirin.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBeatPlaying((p) => !p)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5 ${
                    beatPlaying ? 'bg-rose-600 hover:bg-rose-700' : 'sigma-accent-bg'
                  }`}
                >
                  <i className={`fa-solid ${beatPlaying ? 'fa-stop' : 'fa-play'}`} />
                  <span>{beatPlaying ? 'Durdur' : 'Çal'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadWav()}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <i className="fa-solid fa-download mr-1.5" />
                  WAV İndir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSynthSteps(Array.from({ length: 16 }, () => (Math.random() > 0.35 ? Math.floor(Math.random() * 5) : -1)));
                    onNotify('Rastgele melodi dizilimi üretildi.', 'info');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  <i className="fa-solid fa-shuffle mr-1" />
                  Melodi Üret
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs items-center">
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Tempo (BPM)</span>
                  <span className="font-mono tabular-nums">{bpm} BPM</span>
                </div>
                <input
                  type="range"
                  min={75}
                  max={165}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0">Makam / Gam:</span>
                <select
                  value={musicScale}
                  onChange={(e) => setMusicScale(e.target.value as any)}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                >
                  <option value="pentatonic">Pentatonik</option>
                  <option value="minor">Doğal Minör</option>
                  <option value="hicaz">Hicaz / Oryantal</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => applyBeatPreset('trap')} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                  Trap
                </button>
                <button type="button" onClick={() => applyBeatPreset('synthwave')} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                  Synthwave
                </button>
                <button type="button" onClick={() => applyBeatPreset('lofi')} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                  Lo-Fi
                </button>
              </div>
            </div>

            <div className="space-y-2.5 overflow-x-auto">
              {[
                { label: 'Kick', steps: kickSteps, toggle: (i: number) => setKickSteps((p) => p.map((v, idx) => (idx === i ? !v : v))), color: 'bg-blue-600' },
                { label: 'Snare', steps: snareSteps, toggle: (i: number) => setSnareSteps((p) => p.map((v, idx) => (idx === i ? !v : v))), color: 'bg-emerald-600' },
                { label: 'Hi-Hat', steps: hatSteps, toggle: (i: number) => setHatSteps((p) => p.map((v, idx) => (idx === i ? !v : v))), color: 'bg-amber-500' }
              ].map((track) => (
                <div key={track.label} className="flex items-center gap-2 min-w-[640px]">
                  <span className="w-16 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{track.label}</span>
                  <div className="grid grid-cols-16 gap-1 flex-1">
                    {track.steps.map((active, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => track.toggle(i)}
                        className={`h-8 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${
                          active
                            ? `${track.color} text-white border-transparent`
                            : i % 4 === 0
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                        } ${currentStep === i ? 'ring-2 ring-rose-500' : ''}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 min-w-[640px]">
                <span className="w-16 text-xs font-mono font-bold text-purple-600 dark:text-purple-400">Synth</span>
                <div className="grid grid-cols-16 gap-1 flex-1">
                  {synthSteps.map((val, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setSynthSteps((p) => p.map((v, idx) => (idx === i ? (v >= 4 ? -1 : v + 1) : v)))
                      }
                      title="Tıklayarak nota seçin"
                      className={`h-8 rounded-md border text-[10px] font-mono font-bold cursor-pointer ${
                        val >= 0
                          ? 'bg-purple-600 text-white border-transparent'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                      } ${currentStep === i ? 'ring-2 ring-rose-500' : ''}`}
                    >
                      {val >= 0 ? `N${val + 1}` : '·'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : subTab === 'voice' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sol: Ses Kontrol Merkezi */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Canlı Sesli Diyalog
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Konuşarak soru sorun; Sigma AI yanıtı üretip sesli olarak geri okusun.
                  </p>
                </div>

                {/* Dalga Görselleştirici */}
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={toggleVoiceAssistant}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
                      voiceActive ? 'bg-rose-600 hover:bg-rose-700' : 'sigma-accent-bg'
                    }`}
                    aria-label={voiceActive ? 'Sesli asistanı durdur' : 'Sesli asistanı başlat'}
                  >
                    <i className={`fa-solid ${voiceActive ? 'fa-stop' : 'fa-microphone'}`} />
                  </button>

                  <div className="flex items-end gap-1 h-7">
                    {[12, 22, 16, 26, 18, 24, 14].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full transition-all duration-300 ${
                          voiceActive || isSpeaking
                            ? 'sigma-accent-bg opacity-90'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        style={{
                          height: voiceActive || isSpeaking ? `${(h + ((i * 7) % 10))}px` : '6px'
                        }}
                      />
                    ))}
                  </div>

                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isProcessingVoice
                      ? 'Yanıt düşünülüyor...'
                      : isSpeaking
                      ? 'Sigma AI konuşuyor...'
                      : voiceActive
                      ? 'Dinleniyor... Konuşabilirsiniz'
                      : 'Başlatmak için mikrofona basın'}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Konuşma Dili</span>
                    <select
                      value={voiceLang}
                      onChange={(e) => setVoiceLang(e.target.value as 'tr-TR' | 'en-US')}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-medium"
                    >
                      <option value="tr-TR">Türkçe (TR)</option>
                      <option value="en-US">English (US)</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-600 dark:text-slate-400">Yanıtları Sesli Oku</span>
                    <input
                      type="checkbox"
                      checked={autoReplyVoice}
                      onChange={(e) => setAutoReplyVoice(e.target.checked)}
                      className="accent-blue-600 w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-600 dark:text-slate-400">Sürekli Konuşma Döngüsü</span>
                    <input
                      type="checkbox"
                      checked={continuousLoop}
                      onChange={(e) => setContinuousLoop(e.target.checked)}
                      className="accent-blue-600 w-4 h-4"
                    />
                  </label>
                </div>
              </div>

              {voiceTurns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVoiceTurns([])}
                  className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Konuşma Dökümünü Temizle
                </button>
              )}
            </div>

            {/* Sağ: Canlı Ses Dökümü + Metin Testi */}
            <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[440px]">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px]">
                {voiceTurns.length === 0 ? (
                  <div className="py-16 text-center space-y-2 text-slate-500 dark:text-slate-400">
                    <i className="fa-solid fa-waveform-lines text-2xl" />
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Sesli Asistan Hazır
                    </div>
                    <p className="text-xs max-w-sm mx-auto">
                      Mikrofonu başlatın veya alttaki kutudan hızlı sesli test mesajı gönderip yanıtı dinleyin.
                    </p>
                  </div>
                ) : (
                  voiceTurns.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        t.speaker === 'Sen'
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 ml-8'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className={t.speaker === 'Sen' ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-600 dark:text-emerald-400'}>
                          {t.speaker}
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">{t.time}</span>
                      </div>
                      <MarkdownRenderer content={t.text} />
                    </div>
                  ))
                )}
                <div ref={voiceEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualSpeechText.trim() || isProcessingVoice) return;
                  const txt = manualSpeechText;
                  setManualSpeechText('');
                  void handleVoiceUtterance(txt);
                }}
                className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2"
              >
                <input
                  type="text"
                  value={manualSpeechText}
                  onChange={(e) => setManualSpeechText(e.target.value)}
                  placeholder="Mikrofon yoksa buradan yazın (yanıtı sesli okur)..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={isProcessingVoice || !manualSpeechText.trim()}
                  className="px-4 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  Sor & Dinle
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* BELGE & PDF ANALİZCİSİ */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Belge / PDF Yükle & Metin Gir
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    .pdf, .txt, .md, .csv, .json veya kod dosyalarını özetleyin.
                  </p>
                </div>
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.css"
                  onChange={handleDocUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-upload mr-1.5" />
                  Dosya Seç
                </button>
              </div>

              {docName && (
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold truncate">{docName}</span>
                  <span className="text-slate-500">{docMime}</span>
                </div>
              )}

              <textarea
                rows={9}
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder="Veya incelemek istediğiniz uzun makale, ders notu, sözleşme ya da kod metnini doğrudan buraya yapıştırın..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isAnalyzingDoc}
                  onClick={() => void runDocAnalysis('summary')}
                  className="px-3.5 py-2 rounded-xl sigma-accent-bg text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-compress mr-1.5" />
                  Özet Çıkar
                </button>
                <button
                  type="button"
                  disabled={isAnalyzingDoc}
                  onClick={() => void runDocAnalysis('bullets')}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-list-check mr-1.5" />
                  Ana Maddeler
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={docQuestion}
                  onChange={(e) => setDocQuestion(e.target.value)}
                  placeholder="Belge hakkında özel soru sor..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={isAnalyzingDoc}
                  onClick={() => void runDocAnalysis('qa')}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Sor
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[420px]">
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Analiz Sonucu
                  </span>
                  {docEngineUsed && (
                    <span className="text-[11px] font-mono text-slate-500">{docEngineUsed}</span>
                  )}
                </div>

                {isAnalyzingDoc ? (
                  <div className="py-16 text-center space-y-2 text-xs text-slate-500">
                    <i className="fa-solid fa-spinner fa-spin text-xl text-blue-600" />
                    <div>Belge okunuyor ve analiz ediliyor...</div>
                  </div>
                ) : docResult ? (
                  <div className="text-sm">
                    <MarkdownRenderer content={docResult} />
                  </div>
                ) : (
                  <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <i className="fa-regular fa-file-lines text-2xl" />
                    <div>Belge yükleyip bir işlem seçtiğinizde sonuç burada görünecektir.</div>
                  </div>
                )}
              </div>

              {docResult && (
                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(docResult);
                      onNotify('Analiz panoya kopyalandı.', 'success');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToChat(`"${docName || 'Belge'}" inceleme sonucu:\n\n${docResult}`)}
                    className="px-3 py-1.5 rounded-lg sigma-accent-bg text-white text-xs font-semibold cursor-pointer"
                  >
                    Sohbete Aktar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
