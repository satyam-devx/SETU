import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseImport, toCssVariables, toDtcg, toSetuJson } from '@/lib/design/exporters';
import { Notice, Panel, Segmented } from './ui';

const FORMATS = [
  { value: 'css', label: 'CSS variables' },
  { value: 'dtcg', label: 'Design tokens' },
  { value: 'json', label: 'Backup' },
];

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportPanel({ studio }) {
  const { draft, scope, replaceDraft } = studio;
  const [format, setFormat] = useState('css');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [importText, setImportText] = useState('');
  const [report, setReport] = useState(null);
  const fileRef = useRef(null);

  const output = useMemo(() => {
    if (format === 'css') return toCssVariables(draft);
    if (format === 'dtcg') return JSON.stringify(toDtcg(draft), null, 2);
    return toSetuJson(draft, { scope });
  }, [format, draft, scope]);
  const file = {
    css: [`setu-design-${scope}.css`, 'text/css'],
    dtcg: [`setu-design-tokens-${scope}.json`, 'application/json'],
    json: [`setu-design-backup-${scope}.json`, 'application/json'],
  }[format];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
    }
  };

  const runImport = (text) => {
    const result = parseImport(text);
    setReport(result);
    if (result.ok) {
      replaceDraft(result.config);
      setImportText('');
    }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    setImportText(text);
    runImport(text);
  };

  return (
    <Panel title="Export & import" description="Hand tokens to designers and tools, or back up and restore a design as JSON." icon={Download}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Export format" value={format} onChange={setFormat} options={FORMATS} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button type="button" size="sm" onClick={() => download(file[0], output, file[1])} className="gap-1.5">
              <Download className="h-4 w-4" aria-hidden="true" /> Download
            </Button>
          </div>
        </div>
        {copyFailed && <Notice tone="warning">Copy is blocked in this browser. Use Download instead.</Notice>}
        <textarea
          readOnly
          value={output}
          rows={12}
          spellCheck={false}
          aria-label={`Exported ${format} for the ${scope} design`}
          className="max-h-80 w-full resize-y rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">Exports your current editor state, including unsaved changes.</p>
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">Import a backup</h3>
        <label htmlFor="ds-import" className="sr-only">Paste backup JSON</label>
        <textarea
          id="ds-import"
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setReport(null); }}
          rows={5}
          spellCheck={false}
          placeholder='Paste JSON from a SETU design backup'
          className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => runImport(importText)} disabled={!importText.trim()}>Validate and load</Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-4 w-4" aria-hidden="true" /> Choose file
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" tabIndex={-1} aria-hidden="true" />
        </div>
        {report && !report.ok && (
          <Notice tone="error">
            <p className="font-medium">Nothing was loaded.</p>
            <ul className="mt-1 list-disc pl-5">{report.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </Notice>
        )}
        {report?.ok && (
          <Notice tone="success">
            Loaded into the editor. Review the preview, then save a draft.
            {report.warnings.map((w) => <span key={w} className="block">{w}</span>)}
          </Notice>
        )}
        <p className="text-xs text-muted-foreground">Imports are validated strictly: one invalid token rejects the whole file, so a design is never half-applied.</p>
      </div>
    </Panel>
  );
}
