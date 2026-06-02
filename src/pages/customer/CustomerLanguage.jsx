import React, { useState } from 'react';
import { CheckCircle, Globe, Volume2, Mic } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';

const LANGUAGES = [
  { code: 'hi', name: 'हिंदी', english: 'Hindi', region: 'Most common in Madhubani', sample: 'नमस्ते! SETU में आपका स्वागत है।', script: 'Devanagari' },
  { code: 'mai', name: 'मैथिली', english: 'Maithili', region: 'Native language of Mithila region', sample: 'प्रणाम! SETU में अहाँक स्वागत अछि।', script: 'Devanagari / Mithilakshar' },
  { code: 'bho', name: 'भोजपुरी', english: 'Bhojpuri', region: 'Western Bihar districts', sample: 'नमस्कार! SETU में रउरा सुस्वागतम बा।', script: 'Devanagari' },
  { code: 'en', name: 'English', english: 'English', region: 'Universal', sample: 'Hello! Welcome to SETU.', script: 'Latin' },
];

const PREFERENCES = [
  { key: 'voiceReadout', label: 'Voice Readout', desc: 'Read prices & notifications aloud', default: true },
  { key: 'hindiNumerals', label: 'Hindi Numerals (१,२,३)', desc: 'Show numbers in Hindi script', default: false },
  { key: 'smsAlerts', label: 'SMS Alerts in Hindi', desc: 'Receive order updates via SMS in your language', default: true },
  { key: 'whatsappHindi', label: 'WhatsApp in Hindi', desc: 'Receive WhatsApp messages in Hindi', default: true },
  { key: 'autoTranslate', label: 'Auto-translate Vendor Names', desc: 'Show vendor names in your preferred script', default: false },
];

export default function CustomerLanguage() {
  const [selectedLang, setSelectedLang] = useState('hi');
  const [prefs, setPrefs] = useState({ voiceReadout: true, hindiNumerals: false, smsAlerts: true, whatsappHindi: true, autoTranslate: false });

  const speak = (text, lang) => {
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
      window.speechSynthesis.speak(utt);
    }
  };

  return (
    <div className="pb-24">
      <AppHeader title="Language & Voice" subtitle="भाषा एवं आवाज़ सेटिंग" showBack />

      <div className="px-4 py-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> App Language</h3>
          <div className="space-y-2">
            {LANGUAGES.map(lang => (
              <Card key={lang.code} onClick={() => setSelectedLang(lang.code)} className={`p-4 border-2 cursor-pointer transition-all ${selectedLang === lang.code ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xl font-bold">{lang.name}</span>
                      <span className="text-xs text-muted-foreground">({lang.english})</span>
                      {selectedLang === lang.code && <CheckCircle className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{lang.region}</p>
                    <p className="text-sm italic bg-muted/50 px-3 py-2 rounded-lg">{lang.sample}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={e => { e.stopPropagation(); speak(lang.sample, lang.code); }}>
                    <Volume2 className="w-3 h-3 mr-1" /> Listen
                  </Button>
                  <Badge variant="outline" className="text-[9px] ml-auto">{lang.script}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Mic className="w-4 h-4 text-primary" /> Language Preferences</h3>
          <div className="space-y-3">
            {PREFERENCES.map(pref => (
              <Card key={pref.key} className="p-3 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="text-sm font-medium">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch checked={prefs[pref.key]} onCheckedChange={v => setPrefs(p => ({ ...p, [pref.key]: v }))} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="p-4 border-border bg-accent/5">
          <h3 className="font-semibold text-sm mb-2">About Maithili on SETU</h3>
          <p className="text-xs text-muted-foreground">SETU is one of the few platforms with full Maithili language support. Maithili, spoken by over 34 million people in Bihar and Jharkhand, is recognized in Schedule 8 of the Indian Constitution. We are committed to preserving and promoting it in digital commerce.</p>
        </Card>

        <Button className="w-full">Save Preferences</Button>
      </div>
    </div>
  );
}
