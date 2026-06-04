import React, { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const LANGUAGES = [
  { code: 'hi',  name: 'हिंदी',        english: 'Hindi',     region: 'Most of India',          supported: true  },
  { code: 'mai', name: 'मैथिली',       english: 'Maithili',  region: 'Madhubani, Darbhanga',   supported: true  },
  { code: 'bh',  name: 'भोजपुरी',      english: 'Bhojpuri',  region: 'Western Bihar',          supported: true  },
  { code: 'en',  name: 'English',      english: 'English',   region: 'All regions',            supported: true  },
  { code: 'bn',  name: 'বাংলা',         english: 'Bengali',   region: 'Coming soon',            supported: false },
  { code: 'or',  name: 'ଓଡ଼ିଆ',        english: 'Odia',      region: 'Coming soon',            supported: false },
];

export default function CustomerLanguage() {
  const [selected, setSelected] = useState('hi');

  return (
    <div className="pb-6">
      <AppHeader title="Language" showBack />
      <div className="px-4 py-4 space-y-3">

        <p className="text-sm text-muted-foreground">
          Choose your preferred language. SETU will show product names, notifications, and support in your language.
        </p>

        <div className="space-y-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              disabled={!lang.supported}
              onClick={() => lang.supported && setSelected(lang.code)}
              className={`w-full text-left transition-colors ${!lang.supported ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Card className={`p-4 border transition-colors ${selected === lang.code ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold">{lang.name}</p>
                        <p className="text-xs text-muted-foreground">({lang.english})</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{lang.region}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {selected === lang.code
                      ? <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
                      : !lang.supported
                      ? <Badge className="text-[9px] bg-muted text-muted-foreground border-0">Soon</Badge>
                      : <div className="w-5 h-5 rounded-full border-2 border-border" />
                    }
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Voice search is available in Hindi and Maithili
        </p>
      </div>
    </div>
  );
}
