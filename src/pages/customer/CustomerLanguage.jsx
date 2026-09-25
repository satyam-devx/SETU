import React, { useState, useEffect } from 'react';
import { Check, Globe, Mic } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';

// ── Language definitions ────────────────────────────────────────
const LANGUAGES = [
  {
    code:    'hi',
    name:    'हिंदी',
    english: 'Hindi',
    region:  'Most common in Madhubani',
    sample:  'नमस्ते! SETU में आपका स्वागत है।',
    script:  'Devanagari',
    tts:     'hi-IN',
  },
  {
    code:    'mai',
    name:    'मैथिली',
    english: 'Maithili',
    region:  'Native language of Mithila region',
    sample:  'प्रणाम! SETU में अहाँक स्वागत अछि।',
    script:  'Devanagari / Mithilakshar',
    tts:     'hi-IN',
    infoCard: true,
  },
  {
    code:    'bh',
    name:    'भोजपुरी',
    english: 'Bhojpuri',
    region:  'Western Bihar districts',
    sample:  'नमस्कार! SETU में रउरा सुस्वागतम बा।',
    script:  'Devanagari',
    tts:     'hi-IN',
  },
  {
    code:    'en',
    name:    'English',
    english: 'English',
    region:  'Universal',
    sample:  'Hello! Welcome to SETU.',
    script:  'Latin',
    tts:     'en-IN',
  },
];

// Convert Western Arabic digits to Devanagari
function toHindiNumerals(str) {
  const map = ['०','१','२','३','४','५','६','७','८','९'];
  return String(str).replace(/[0-9]/g, d => map[parseInt(d)]);
}

// Speak text using Web Speech API
function speakText(text, ttsLang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = ttsLang;
  utt.rate   = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(ttsLang.split('-')[0]));
  if (match) utt.voice = match;
  window.speechSynthesis.speak(utt);
  return utt;
}

// ── Preference toggle row ───────────────────────────────────────
function PrefToggle({ label, description, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border shadow-sm">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={label}
        className="data-[state=checked]:bg-primary shrink-0"
      />
    </div>
  );
}

// ── Language card ───────────────────────────────────────────────
function LangCard({ lang, selected, onSelect, speaking, onListen }) {
  const isSelected = selected === lang.code;

  return (
    <div
      className={`w-full rounded-2xl border-2 p-4 transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(lang.code)}
        aria-pressed={isSelected}
        aria-label={`Select ${lang.english} language`}
        className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
      {/* Header row */}
      <span className="flex items-center justify-between mb-1">
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{lang.name}</span>
          <span className="text-sm text-muted-foreground">({lang.english})</span>
        </span>
        {isSelected && (
          <span className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center bg-card shrink-0" aria-hidden="true">
            <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
          </span>
        )}
      </span>

      <span className="block text-xs text-muted-foreground mb-3">{lang.region}</span>

      <span className="block bg-muted/50 rounded-xl px-3 py-2 mb-3">
        <span className="block text-sm italic text-foreground">{lang.sample}</span>
      </span>

      </button>

      {/* Listen + Script badge row */}
      <div
        className="flex items-center justify-between"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onListen(lang)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            speaking === lang.code
              ? 'border-primary/50 text-primary bg-primary/5'
              : 'border-border text-muted-foreground bg-card hover:bg-muted/50'
          }`}
        >
          {/* Speaker icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {speaking === lang.code ? 'Playing…' : 'Listen'}
        </button>

        <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
          {lang.script}
        </span>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────
export default function CustomerLanguage() {
  const { profile, updateProfile } = useAuth();

  // Initialise from saved profile
  const [language,      setLanguage]      = useState(profile?.language        ?? 'hi');
  const [voiceReadout,  setVoiceReadout]  = useState(profile?.voice_readout   ?? true);
  const [hindiNumerals, setHindiNumerals] = useState(profile?.hindi_numerals  ?? false);
  const [smsLang,       setSmsLang]       = useState(profile?.sms_lang        ?? true);
  const [whatsappLang,  setWhatsappLang]  = useState(profile?.whatsapp_lang   ?? true);
  const [autoTranslate, setAutoTranslate] = useState(profile?.auto_translate  ?? false);

  const [speaking, setSpeaking] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState(null);

  // Preload voices (some browsers load them async)
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const h = () => window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', h);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', h);
  }, []);

  // Sync when profile first loads
  useEffect(() => {
    if (!profile) return;
    setLanguage(profile.language        ?? 'hi');
    setVoiceReadout(profile.voice_readout   ?? true);
    setHindiNumerals(profile.hindi_numerals  ?? false);
    setSmsLang(profile.sms_lang        ?? true);
    setWhatsappLang(profile.whatsapp_lang   ?? true);
    setAutoTranslate(profile.auto_translate  ?? false);
  }, [profile?.id]);

  // Derived
  const selectedLang   = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];
  const demoPrice      = hindiNumerals ? `₹${toHindiNumerals('99')}` : '₹99';
  const smsLabel       = `SMS Alerts in ${selectedLang.english}`;
  const whatsappLabel  = `WhatsApp in ${selectedLang.english}`;

  // ── Listen handler ────────────────────────────────────────────
  const handleListen = (lang) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: 'Not supported',
        description: 'Text-to-speech is not supported on this browser.',
        variant: 'destructive',
      });
      return;
    }
    setSpeaking(lang.code);
    const utt = new SpeechSynthesisUtterance(lang.sample);
    utt.lang  = lang.tts;
    utt.rate  = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const match  = voices.find(v => v.lang.startsWith(lang.tts.split('-')[0]));
    if (match) utt.voice = match;
    utt.onend  = () => setSpeaking(null);
    utt.onerror = () => setSpeaking(null);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  // ── Voice Readout toggle — also demo-speaks the sample ───────
  const handleVoiceReadout = (val) => {
    setVoiceReadout(val);
    if (val) {
      speakText(selectedLang.sample, selectedLang.tts);
    } else {
      window.speechSynthesis?.cancel();
    }
  };

  // ── Save preferences ──────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return; // re-entry guard
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { error: err } = await updateProfile({
        language,
        voice_readout:  voiceReadout,
        hindi_numerals: hindiNumerals,
        sms_lang:       smsLang,
        whatsapp_lang:  whatsappLang,
        auto_translate: autoTranslate,
      });
      if (err) throw new Error(err.message ?? 'Failed to save preferences');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24 bg-muted/50 min-h-screen">
      <AppHeader title="Language & Voice" subtitle="भाषा एवं आवाज़ सेटिंग" showBack />

      <div className="px-4 pt-4 space-y-5">

        {/* ── App Language ──────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">App Language</h2>
          </div>

          <div className="space-y-3">
            {LANGUAGES.map(lang => (
              <LangCard
                key={lang.code}
                lang={lang}
                selected={language}
                onSelect={setLanguage}
                speaking={speaking}
                onListen={handleListen}
              />
            ))}
          </div>
        </div>

        {/* ── Language Preferences ──────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mic className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Language Preferences</h2>
          </div>

          <div className="space-y-2">
            <PrefToggle
              label="Voice Readout"
              description="Read prices & notifications aloud"
              checked={voiceReadout}
              onToggle={handleVoiceReadout}
            />

            <PrefToggle
              label={`Hindi Numerals (${toHindiNumerals('1')},${toHindiNumerals('2')},${toHindiNumerals('3')})`}
              description={`Show numbers in Hindi script  (e.g. ${demoPrice})`}
              checked={hindiNumerals}
              onToggle={setHindiNumerals}
            />

            <PrefToggle
              label={smsLabel}
              description="Receive order updates via SMS in your language"
              checked={smsLang}
              onToggle={setSmsLang}
            />

            <PrefToggle
              label={whatsappLabel}
              description={`Receive WhatsApp messages in ${selectedLang.english}`}
              checked={whatsappLang}
              onToggle={setWhatsappLang}
            />

            <PrefToggle
              label="Auto-translate Vendor Names"
              description="Show vendor names in your preferred script"
              checked={autoTranslate}
              onToggle={setAutoTranslate}
            />
          </div>
        </div>

        {/* ── Maithili info card (only when Maithili selected) ── */}
        {language === 'mai' && (
          <div className="rounded-2xl bg-muted p-4">
            <p className="text-sm font-bold text-foreground mb-2">About Maithili on SETU</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SETU is one of the few platforms with full Maithili language support. Maithili,
              spoken by over 34 million people in Bihar and Jharkhand, is recognized in Schedule 8
              of the Indian Constitution. We are committed to preserving and promoting it in digital
              commerce.
            </p>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* ── Save button ───────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl text-white text-sm font-semibold transition-all shadow-sm ${
            saved
              ? 'bg-green-500'
              : saving
              ? 'bg-primary/30 cursor-not-allowed'
              : 'bg-primary active:scale-[0.98]'
          }`}
        >
          {saving ? 'Saving…' : saved ? '✓ Preferences Saved' : 'Save Preferences'}
        </button>

      </div>
    </div>
  );
}
