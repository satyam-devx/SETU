import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { AIAPI } from '@/lib/api';

// PASS 5 FIX (FUNC-02): CustomerVoice previously called the non-existent
// AIAPI had no voice-transcription method (only `AIAPI.voiceQuery(text, context)` exists,
// which forwards to the real `ai-assistant` Edge Function — a TEXT chat
// endpoint, not an audio-transcription endpoint; see supabase/functions/
// ai-assistant/index.ts, which reads `{ message, context }` from the
// request body). There was also no real microphone capture — the previous
// "recording" was a fake 2.5s setTimeout.
//
// Correct architecture for a text-based backend: capture speech with the
// browser's native SpeechRecognition API (Web Speech API), get a real
// transcript, then send that transcript to the real AIAPI.voiceQuery.
// Suggested phrases now go through the SAME real call — they are no
// longer represented as fake, pre-canned "AI output".

const SUGGESTED_PHRASES = [
  { hi: 'चावल और तेल चाहिए', en: 'Rice and oil' },
  { hi: 'मखाना कितने का है', en: 'Price of makhana' },
  { hi: 'दूध मिलेगा', en: 'Is milk available' },
  { hi: 'ताजी सब्जी चाहिए', en: 'Need fresh vegetables' },
  { hi: 'मेरा ऑर्डर कहाँ है', en: 'Where is my order' },
];

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function CustomerVoice() {
  const navigate = useNavigate();
  // idle | listening | processing | result | unsupported | denied | error
  const [state, setState]           = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult]         = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [pulseSize, setPulseSize]   = useState(1);
  const animRef        = useRef(null);
  const recognitionRef = useRef(null);
  const mountedRef      = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!getSpeechRecognitionCtor()) {
      setState('unsupported');
    }
    return () => {
      mountedRef.current = false;
      stopPulse();
      // Cleanup: make sure we never leave a live recognition session
      // running after the component unmounts.
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* already stopped */ }
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPulse = () => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    setPulseSize(1);
  };

  const runAssistant = useCallback((spokenText) => {
    setState('processing');
    setTranscript(spokenText);
    AIAPI.voiceQuery(spokenText).then(({ data, error }) => {
      if (!mountedRef.current) return;
      if (error || !data) {
        setErrorMsg('Could not reach the assistant. Please try again.');
        setState('error');
        return;
      }
      setResult({
        transcript: spokenText,
        response: data.response || data.reply || '',
        suggestedActions: data.suggestedActions || [],
      });
      setState('result');
    });
  }, []);

  const startListening = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setState('unsupported');
      return;
    }
    // Prevent starting a second, overlapping recording session.
    if (state === 'listening' || recognitionRef.current) return;

    setErrorMsg('');
    setResult(null);
    setTranscript('');
    setState('listening');

    let growing = true;
    animRef.current = setInterval(() => {
      setPulseSize(p => {
        if (p >= 1.3) growing = false;
        if (p <= 1.0) growing = true;
        return growing ? p + 0.02 : p - 0.02;
      });
    }, 50);

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      recognitionRef.current = null;
      stopPulse();
      if (!mountedRef.current) return;
      if (!spoken.trim()) {
        setErrorMsg('Sorry, I did not catch that. Please try again.');
        setState('error');
        return;
      }
      runAssistant(spoken.trim());
    };

    recognition.onerror = (event) => {
      recognitionRef.current = null;
      stopPulse();
      if (!mountedRef.current) return;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setState('denied');
      } else if (event.error === 'no-speech') {
        setErrorMsg('No speech detected. Please try again.');
        setState('error');
      } else {
        setErrorMsg('Something went wrong while listening. Please try again.');
        setState('error');
      }
    };

    recognition.onend = () => {
      // If onresult/onerror already handled this session, recognitionRef
      // has been cleared and state has already moved on — nothing to do.
      recognitionRef.current = null;
      if (mountedRef.current && state === 'listening') {
        stopPulse();
        setState('idle');
      }
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      stopPulse();
      setErrorMsg('Could not start the microphone. Please try again.');
      setState('error');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* no-op */ }
    }
  };

  const handleSearch = () => {
    if (result?.transcript) navigate(`/customer/search?q=${encodeURIComponent(result.transcript)}`);
  };

  // Suggested phrases now go through the real assistant call — no fake
  // canned "AI result" is shown.
  const handlePhrase = (phrase) => {
    runAssistant(phrase.hi);
  };

  return (
    <div className="pb-6 min-h-screen bg-gradient-to-b from-background to-primary/5">
      <AppHeader title="Voice Search" showBack />
      <div className="px-6 py-8 flex flex-col items-center">

        {state === 'unsupported' && (
          <Card className="w-full p-4 border-border mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Voice search isn't supported on this browser</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can still try one of the phrases below, or type your search instead.
              </p>
            </div>
          </Card>
        )}

        {state === 'denied' && (
          <Card className="w-full p-4 border-border mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Microphone access was denied</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please allow microphone access in your browser settings to use voice search, or try one of the phrases below.
              </p>
            </div>
          </Card>
        )}

        {/* Mic button */}
        <div className="relative mb-8">
          {state === 'listening' && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-primary/10" style={{ transform: `scale(${pulseSize})`, transition: 'transform 0.05s' }} />
            </>
          )}
          <button
            onClick={state === 'listening' ? stopListening : startListening}
            disabled={state === 'processing' || state === 'unsupported'}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 ${
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
          {state === 'idle'        && <p className="text-lg font-semibold">Tap to speak</p>}
          {state === 'listening'   && <p className="text-lg font-semibold text-primary animate-pulse">Listening...</p>}
          {state === 'processing'  && <p className="text-lg font-semibold text-muted-foreground">Understanding...</p>}
          {state === 'result'      && <p className="text-lg font-semibold text-green-600">Got it!</p>}
          {state === 'error'       && <p className="text-lg font-semibold text-destructive">{errorMsg}</p>}
          {state !== 'unsupported' && state !== 'denied' && (
            <p className="text-sm text-muted-foreground mt-1">बोलिए हिंदी या मैथिली में</p>
          )}
        </div>

        {/* Transcript & result — only ever shows a REAL assistant response */}
        {(transcript || state === 'result') && (
          <Card className="w-full p-4 border-border mb-4">
            {transcript && (
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Volume2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{transcript}</p>
                  {result?.response && <p className="text-xs text-muted-foreground mt-0.5">{result.response}</p>}
                </div>
              </div>
            )}
            {state === 'result' && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className="text-[9px] bg-green-100 text-green-700 border-0">SETU Assistant</Badge>
              </div>
            )}
            {state === 'result' && (
              <Button className="w-full mt-1 gap-2" onClick={handleSearch}>
                <Search className="w-4 h-4" /> Search for "{transcript}"
              </Button>
            )}
          </Card>
        )}

        {/* Suggested phrases — routed through the real assistant, not faked */}
        {(state === 'idle' || state === 'result' || state === 'unsupported' || state === 'denied' || state === 'error') && (
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
