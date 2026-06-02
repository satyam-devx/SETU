import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, ChevronRight, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी', sublabel: 'Hindi' },
  { code: 'mai', label: 'मैथिली', sublabel: 'Maithili' },
  { code: 'bho', label: 'भोजपुरी', sublabel: 'Bhojpuri' },
  { code: 'en', label: 'English', sublabel: 'English' },
];

const VOICE_COMMANDS = [
  { phrase: '"Chawal mangao"', translation: 'Order Rice', icon: '🌾', action: 'SEARCH: Rice' },
  { phrase: '"Mera order kahan hai"', translation: 'Track my order', icon: '📦', action: 'TRACK ORDER' },
  { phrase: '"Kul kitna paisa"', translation: 'My wallet balance', icon: '💰', action: 'OPEN WALLET' },
  { phrase: '"Nearest dukan"', translation: 'Nearest vendor', icon: '🏪', action: 'NEARBY VENDORS' },
  { phrase: '"Complaint karo"', translation: 'Raise complaint', icon: '📣', action: 'SUPPORT' },
  { phrase: '"Credit baaki hai kitna"', translation: 'Check credit balance', icon: '💳', action: 'CREDIT BALANCE' },
];

const RESPONSES = [
  { trigger: 'SEARCH: Rice', response: 'Chawal ke 12 products mile. Ramesh Kirana Store mein Basmati Rice ₹450 mein available hai. Order karein?' },
  { trigger: 'TRACK ORDER', response: 'Aapka order SETU-2025-0002 raste mein hai. Vikash 15 minute mein pohonchenge.' },
  { trigger: 'OPEN WALLET', response: 'Aapke SETU Wallet mein ₹1,250 hai. SETU Credit available: ₹3,800.' },
  { trigger: 'NEARBY VENDORS', response: 'Aapke paas 6 dukaan hain. Sabse paas Ramesh Kirana Store hai — sirf 0.3 km.' },
];

export default function CustomerVoice() {
  const [lang, setLang] = useState('hi');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!isListening) return;
    const iv = setInterval(() => setPulse(p => (p + 1) % 4), 400);
    return () => clearInterval(iv);
  }, [isListening]);

  const handleListen = () => {
    if (isListening) {
      setIsListening(false);
      setTranscript('Chawal mangao');
      setResponse('Chawal ke 12 products mile. Ramesh Kirana Store mein Basmati Rice ₹450 mein available hai. Order karein?');
    } else {
      setTranscript('');
      setResponse('');
      setIsListening(true);
    }
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(utt);
    }
  };

  return (
    <div className="pb-24">
      <AppHeader title="Voice Assistant" subtitle="Bolkar kharido · बोलकर खरीदो" showBack />

      {/* Language selector */}
      <div className="px-4 py-3">
        <div className="flex gap-2">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} className={`flex-1 py-2 text-center rounded-xl border text-sm font-medium transition-all ${lang === l.code ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
              <p>{l.label}</p>
              <p className="text-[9px] opacity-70">{l.sublabel}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main mic UI */}
      <div className="px-4 py-6 flex flex-col items-center">
        <div className="relative mb-6">
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1s' }} />
              <div className="absolute -inset-4 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="absolute -inset-8 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
            </>
          )}
          <button onClick={handleListen}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-xl ${isListening ? 'bg-destructive scale-110' : 'bg-primary hover:bg-primary/90 hover:scale-105'}`}>
            {isListening ? <MicOff className="w-12 h-12 text-white" /> : <Mic className="w-12 h-12 text-white" />}
          </button>
        </div>

        {isListening && (
          <div className="flex items-end gap-1 mb-4 h-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-1.5 bg-primary rounded-full transition-all" style={{ height: `${Math.random() * 28 + 4}px`, opacity: 0.7 + Math.random() * 0.3 }} />
            ))}
          </div>
        )}

        <p className="text-sm text-center text-muted-foreground mb-2">
          {isListening ? '🎙️ Bol rahe hain... (Speaking...)' : 'Mic dabao aur bolo (Tap mic and speak)'}
        </p>

        {transcript && (
          <Card className="p-3 border-border w-full mb-3">
            <p className="text-xs text-muted-foreground mb-1">Aapne kaha / You said:</p>
            <p className="text-sm font-medium">"{transcript}"</p>
          </Card>
        )}

        {response && (
          <Card className="p-4 border-primary/30 bg-primary/5 w-full">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{response}</p>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => speak(response)}>
                <Volume2 className="w-4 h-4 text-primary" />
              </Button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1 text-xs h-8">Haan / Yes</Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8">Nahi / No</Button>
            </div>
          </Card>
        )}
      </div>

      {/* Sample commands */}
      <div className="px-4">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Aap yeh bol sakte hain (You can say):</p>
        <div className="space-y-2">
          {VOICE_COMMANDS.map((cmd, i) => (
            <Card key={i} className="p-3 border-border flex items-center gap-3 cursor-pointer hover:border-primary transition-colors active:bg-muted" onClick={() => { setTranscript(cmd.phrase.replace(/"/g, '')); setResponse(RESPONSES.find(r => r.trigger === cmd.action)?.response || 'Processing...'); }}>
              <span className="text-xl">{cmd.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{cmd.phrase}</p>
                <p className="text-xs text-muted-foreground">{cmd.translation}</p>
              </div>
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
