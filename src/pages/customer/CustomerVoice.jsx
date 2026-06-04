import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Search, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { AIAPI } from '@/lib/api';

const SUGGESTED_PHRASES = [
  { hi: 'चावल और तेल चाहिए', en: 'Rice and oil' },
  { hi: 'मखाना कितने का है', en: 'Price of makhana' },
  { hi: 'दूध मिलेगा', en: 'Is milk available' },
  { hi: 'ताजी सब्जी चाहिए', en: 'Need fresh vegetables' },
  { hi: 'मेरा ऑर्डर कहाँ है', en: 'Where is my order' },
];

export default function CustomerVoice() {
  const navigate = useNavigate();
  const [state, setState]           = useState('idle'); // idle | listening | processing | result
  const [transcript, setTranscript] = useState('');
  const [result, setResult]         = useState(null);
  const [pulseSize, setPulseSize]   = useState(1);
  const animRef = useRef(null);

  const startListening = () => {
    setState('listening');
    // Animate pulse
    let growing = true;
    animRef.current = setInterval(() => {
      setPulseSize(p => {
        if (p >= 1.3) growing = false;
        if (p <= 1.0) growing = true;
        return growing ? p + 0.02 : p - 0.02;
      });
    }, 50);

    // Simulate 2.5s recording then process
    setTimeout(stopListening, 2500);
  };

  const stopListening = () => {
    clearInterval(animRef.current);
    setPulseSize(1);
    setState('processing');
    AIAPI.transcribeVoice(null).then(({ data }) => {
      if (data) {
        setTranscript(data.transcript);
        setResult(data);
        setState('result');
      }
    });
  };

  const handleSearch = () => {
    if (result) navigate(`/customer/search?q=${encodeURIComponent(result.query || result.transcript)}`);
  };

  const handlePhrase = (phrase) => {
    setState('processing');
    setTranscript(phrase.hi);
    setTimeout(() => {
      setResult({ transcript: phrase.hi, query: phrase.en, intent: 'search', confidence: 0.99 });
      setState('result');
    }, 800);
  };

  return (
    <div className="pb-6 min-h-screen bg-gradient-to-b from-background to-primary/5">
      <AppHeader title="Voice Search" showBack />
      <div className="px-6 py-8 flex flex-col items-center">

        {/* Mic button */}
        <div className="relative mb-8">
          {state === 'listening' && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-primary/10" style={{ transform: `scale(${pulseSize})`, transition: 'transform 0.05s' }} />
            </>
          )}
          <button
            onClick={state === 'idle' || state === 'result' ? startListening : stopListening}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg ${
              state === 'listening'
                ? 'bg-destructive text-white scale-110'
                : 'bg-primary text-white hover:scale-105'
            }`}
          >
            {state === 'processing'
              ? <Loader2 className="w-12 h-12 animate-spin" />
              : state === 'listening'
              ? <MicOff className="w-12 h-12" />
              : <Mic className="w-12 h-12" />
            }
          </button>
        </div>

        {/* Status text */}
        <div className="text-center mb-8">
          {state === 'idle'       && <p className="text-lg font-semibold">Tap to speak</p>}
          {state === 'listening'  && <p className="text-lg font-semibold text-primary animate-pulse">Listening...</p>}
          {state === 'processing' && <p className="text-lg font-semibold text-muted-foreground">Understanding...</p>}
          {state === 'result'     && <p className="text-lg font-semibold text-green-600">Got it!</p>}
          <p className="text-sm text-muted-foreground mt-1">बोलिए हिंदी या मैथिली में</p>
        </div>

        {/* Transcript & result */}
        {(transcript || state === 'result') && (
          <Card className="w-full p-4 border-border mb-4">
            {transcript && (
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Volume2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{transcript}</p>
                  {result?.query && <p className="text-xs text-muted-foreground mt-0.5">Searching: "{result.query}"</p>}
                </div>
              </div>
            )}
            {result && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[9px] bg-green-100 text-green-700 border-0">
                  {Math.round((result.confidence || 0.9) * 100)}% confidence
                </Badge>
                <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">
                  {result.detectedLanguage || 'hi'} detected
                </Badge>
              </div>
            )}
            {state === 'result' && (
              <Button className="w-full mt-3 gap-2" onClick={handleSearch}>
                <Search className="w-4 h-4" /> Search Products
              </Button>
            )}
          </Card>
        )}

        {/* Suggested phrases */}
        {(state === 'idle' || state === 'result') && (
          <div className="w-full">
            <p className="text-xs text-muted-foreground text-center mb-3">Try saying...</p>
            <div className="space-y-2">
              {SUGGESTED_PHRASES.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => handlePhrase(phrase)}
                  className="w-full text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors flex items-center gap-3"
                >
                  <Mic className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{phrase.hi}</p>
                    <p className="text-xs text-muted-foreground">{phrase.en}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
