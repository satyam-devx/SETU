import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DiffList from './DiffList';
import { Notice } from './ui';

export default function PublishDialog({ open, onOpenChange, studio, scopeLabel }) {
  const { changes, audit, note, setNote, busy, conflict, publish, reload, publishedRow, dirty } = studio;
  const [acknowledged, setAcknowledged] = useState(false);
  const failures = audit.summary.errors;

  useEffect(() => { if (open) setAcknowledged(false); }, [open]);

  const run = async (force = false) => {
    const result = await publish({ force });
    if (result.ok) onOpenChange(false);
  };
  const blocked = !dirty || (failures > 0 && !acknowledged);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish {scopeLabel} design</DialogTitle>
          <DialogDescription>
            This goes live for new sessions in this scope. Apps that are already open pick it up the next time they regain focus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!dirty ? (
            <Notice tone="info">Your editor matches the live design, so there is nothing to publish.</Notice>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {changes.length} change{changes.length === 1 ? '' : 's'} compared with {publishedRow ? `live v${publishedRow.version}` : 'the built-in defaults'}
              </p>
              <div className="max-h-56 overflow-auto pr-1"><DiffList changes={changes} limit={12} /></div>
            </div>
          )}

          {failures > 0 ? (
            <Notice tone="warning">
              <p>{failures} text color pair{failures === 1 ? '' : 's'} fail WCAG AA contrast, which can make text hard to read for some users.</p>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>Publish anyway. The failure count is recorded in the version note.</span>
              </label>
            </Notice>
          ) : (
            <Notice tone="success">Every text pair meets WCAG AA in both light and dark.</Notice>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ds-note" className="text-sm font-medium">Version note (optional)</label>
            <input
              id="ds-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={400}
              placeholder="e.g. Festival palette for Diwali campaign"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {conflict && (
            <Notice tone="warning">
              {conflict.latest === null ? 'A version was removed' : `v${conflict.latest} was published`} for this scope after you opened the Studio
              {conflict.yours === null ? '' : ` (you started from v${conflict.yours})`}. Publishing now will replace it.
            </Notice>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {conflict ? (
            <>
              <Button type="button" variant="outline" onClick={() => { reload(); onOpenChange(false); }}>Reload latest</Button>
              <Button type="button" onClick={() => run(true)} disabled={blocked || Boolean(busy)} className="gap-2">
                {busy === 'publish' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Publish anyway
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => run(false)} disabled={blocked || Boolean(busy)} className="gap-2">
              {busy === 'publish' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Publish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
