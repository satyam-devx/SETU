import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Moon, Search, ShoppingCart, Smartphone, Sun, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { resolveDesignIcon } from '@/components/shared/designIconResolver';
import { computeCssVars, datasetToAttributes } from '@/lib/design/css';
import { SEMANTIC_ICON_KEYS } from '@/lib/design/schema';
import { cn } from '@/lib/utils';
import { Segmented } from './ui';

const DEVICES = [
  { value: 'phone', label: 'Phone', width: 390, icon: Smartphone },
  { value: 'tablet', label: 'Tablet', width: 768 },
  { value: 'desktop', label: 'Wide', width: 1100 },
];
const MODES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'both', label: 'Both', icon: Layers },
];

const PRODUCTS = [
  { name: 'Hybrid maize seed', price: '₹420', meta: 'Madhubani · 2 km' },
  { name: 'Organic urea 5 kg', price: '₹265', meta: 'Jhanjharpur · 6 km' },
  { name: 'Drip irrigation kit', price: '₹1,850', meta: 'Benipatti · 9 km' },
  { name: 'Mustard oil 1 L', price: '₹158', meta: 'Madhubani · 3 km' },
];
const STATUSES = [
  { label: 'Delivered', dot: 'bg-setu-success' },
  { label: 'Packed, awaiting rider', dot: 'bg-setu-warning' },
  { label: 'Cancelled by vendor', dot: 'bg-destructive' },
];

function Sample({ config }) {
  const mapped = SEMANTIC_ICON_KEYS.map((key) => resolveDesignIcon(config.icons.mappings[key])).filter(Boolean);
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">S</span>
        <h3 className="flex-1 truncate font-heading text-base">SETU Bazaar</h3>
        <Bell />
        <span className="relative">
          <ShoppingCart />
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">3</span>
        </span>
      </div>

      <div className="space-y-5 p-4">
        <div className="relative">
          <Input placeholder="Search seeds, tools, groceries" aria-label="Search" className="pl-9" tabIndex={-1} />
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="rounded-xl bg-primary p-4 text-primary-foreground">
          <h4 className="font-heading text-lg">Kharif season offers</h4>
          <p className="mt-1 text-sm opacity-90">Seeds, fertiliser and tools from verified vendors near you.</p>
          <Button variant="secondary" size="sm" className="mt-3" tabIndex={-1}>Shop now</Button>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}>
          {PRODUCTS.map((p) => (
            <div key={p.name} className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm">
              <div className="mb-2 h-16 rounded-md bg-muted" />
              <p className="text-sm font-medium leading-snug">{p.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.meta}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-heading text-base">{p.price}</span>
                <Button size="sm" tabIndex={-1}>Add</Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
          <h4 className="mb-2 font-heading text-sm">Recent orders</h4>
          <ul className="space-y-1.5">
            {STATUSES.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className={cn('h-2 w-2 rounded-full', s.dot)} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
          <label className="block text-sm font-medium" htmlFor="preview-name">Delivery name</label>
          <Input id="preview-name" defaultValue="Ramesh Kumar" tabIndex={-1} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Order updates by SMS</span>
            <Switch defaultChecked tabIndex={-1} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tabIndex={-1}>Place order</Button>
            <Button variant="secondary" tabIndex={-1}>Save</Button>
            <Button variant="outline" tabIndex={-1}>Cancel</Button>
            <Button variant="ghost" tabIndex={-1}>Skip</Button>
            <Button variant="destructive" tabIndex={-1}>Remove</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
          <h4 className="mb-2 font-heading text-sm">Weekly sales</h4>
          <div className="flex h-20 items-end gap-2" role="img" aria-label="Sample bar chart using the five chart colors">
            {[40, 65, 50, 80, 30].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `hsl(var(--chart-${i + 1}))` }} />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <h4 className="font-heading text-lg">Heading sample</h4>
          <p className="mt-1">Body text sets the reading rhythm for the whole app.</p>
          <p className="mt-1 text-muted-foreground">Muted text is used for hints and metadata.</p>
          <code className="mt-2 block font-mono text-xs">{"order_id = 'SETU-48213'"}</code>
          {mapped.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-foreground">
              {mapped.map((Icon, i) => <Icon key={i} />)}
            </div>
          )}
        </div>

        <div
          className="rounded-lg border p-3 text-sm"
          style={{ background: 'hsl(var(--sidebar))', color: 'hsl(var(--sidebar-foreground))', borderColor: 'hsl(var(--sidebar-border))' }}
        >
          <p className="mb-2 text-xs uppercase tracking-wide opacity-70">Admin sidebar</p>
          <p className="rounded-md px-2 py-1.5 font-medium" style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(var(--sidebar-foreground))' }}>Dashboard</p>
          <p className="px-2 py-1.5 opacity-80">Orders</p>
          <p className="px-2 py-1.5 opacity-80">Vendors</p>
        </div>
      </div>
    </div>
  );
}

function Surface({ config, mode, width, label }) {
  const { vars, dataset } = useMemo(() => computeCssVars(config, mode), [config, mode]);
  const ref = useRef(null);
  // The preview is purely visual. `inert` removes it from the tab order and the accessibility tree.
  useEffect(() => { ref.current?.setAttribute('inert', ''); }, []);
  return (
    <div className="mx-auto w-full" style={{ maxWidth: width }}>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div
        ref={ref}
        {...datasetToAttributes(dataset)}
        className={cn('overflow-hidden rounded-xl border border-border bg-background text-foreground', mode === 'dark' && 'dark')}
        style={{
          ...vars,
          fontFamily: 'var(--setu-font-body)',
          fontSize: 'var(--setu-base-font-size)',
          fontWeight: 'var(--setu-body-weight)',
          lineHeight: 'var(--setu-line-height)',
          letterSpacing: 'var(--setu-letter-spacing)',
        }}
      >
        <Sample config={config} />
      </div>
    </div>
  );
}

export default function PreviewPane({ config, mode, onModeChange }) {
  const [device, setDevice] = useState('phone');
  const width = DEVICES.find((d) => d.value === device).width;
  return (
    <section aria-label="Live preview" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Live preview</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Preview device" value={device} onChange={setDevice} options={DEVICES} />
          <Segmented label="Preview color mode" value={mode} onChange={onModeChange} options={MODES} />
        </div>
      </div>
      <div className="space-y-4">
        {(mode === 'light' || mode === 'both') && <Surface config={config} mode="light" width={width} label="Light" />}
        {(mode === 'dark' || mode === 'both') && <Surface config={config} mode="dark" width={width} label="Dark" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Rendered with the app&apos;s real Button, Input and Switch components in an isolated frame, so nothing else on this page changes until you publish. Frame width does not simulate responsive breakpoints.
      </p>
    </section>
  );
}
