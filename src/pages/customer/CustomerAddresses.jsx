import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Pencil, Trash2, CheckCircle, Loader2, AlertCircle, Plus } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { getAddresses } from '@/lib/api';
import { useAddressMutations } from '@/hooks/mutations/useAddressMutations';

const LABELS = ['Home', 'Work', 'Farm', 'Other'];
const EMPTY_FORM = { label: 'Home', address: '', landmark: '' };

// ── Address form (inline, shown below existing cards) ───────────
function AddressForm({ form, setForm, onCancel, onSave, saving, error, title = 'New Address' }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
      <p className="text-sm font-bold text-foreground mb-4">{title}</p>

      {/* Label chips */}
      <p id="address-label-group" className="sr-only">Address label</p>
      <div className="flex gap-2 mb-4" role="group" aria-labelledby="address-label-group">
        {LABELS.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setForm(f => ({ ...f, label: l }))}
            aria-pressed={form.label === l}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              form.label === l
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Full address */}
      <label htmlFor="address-full" className="block text-xs font-semibold text-foreground mb-1.5">
        Full Address <span className="text-primary">*</span>
      </label>
      <input
        id="address-full"
        placeholder="House no., street, area"
        value={form.address}
        maxLength={250}
        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground mb-3"
      />

      {/* Landmark */}
      <label htmlFor="address-landmark" className="block text-xs font-semibold text-foreground mb-1.5">Landmark</label>
      <input
        id="address-landmark"
        placeholder="e.g. Near temple"
        value={form.landmark}
        maxLength={120}
        onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
        className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground mb-4"
      />

      {error && (
        <div className="flex items-center gap-1.5 text-destructive mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-foreground bg-card active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.address.trim()}
          className="flex-[2] py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            : title === 'New Address' ? 'Save Address' : 'Save Changes'
          }
        </button>
      </div>
    </div>
  );
}

// ── Address card ────────────────────────────────────────────────
function AddressCard({ addr, onEdit, onDelete, onSetDefault, busy }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${
      addr.isDefault
        ? 'border-primary/30 bg-primary/5'
        : 'border-border bg-card shadow-sm'
    }`}>
      <div className="flex items-start gap-3">
        {/* Pin icon */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          addr.isDefault ? 'bg-primary/15' : 'bg-primary/5'
        }`}>
          <MapPin className="w-5 h-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground">{addr.label}</p>
            {addr.isDefault && (
              <span className="text-xs font-semibold text-primary bg-primary/15 px-2.5 py-0.5 rounded-full">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{addr.address}</p>
          {addr.landmark && (
            <p className="text-xs text-muted-foreground mt-0.5">Near: {addr.landmark}</p>
          )}
          {addr.zoneName && (
            <p className="text-[11px] text-muted-foreground mt-1">Service zone: {addr.zoneName}</p>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onEdit(addr)}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Edit ${addr.label}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="w-8 h-8 flex items-center justify-center text-destructive/70 hover:text-destructive transition-colors disabled:opacity-40"
            aria-label={`Delete ${addr.label}`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="mt-3 p-3 rounded-xl border border-destructive/20 bg-destructive/10">
          <p className="text-xs font-medium text-foreground mb-2">Delete this address?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 rounded-xl border border-border text-xs font-medium bg-card"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmDelete(false); onDelete(addr.id); }}
              className="flex-1 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Set as Default button */}
      {!addr.isDefault && !confirmDelete && (
        <button
          onClick={() => onSetDefault(addr.id)}
          disabled={busy}
          className="mt-3 w-full py-2.5 rounded-2xl border border-border bg-card text-sm font-medium text-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <CheckCircle className="w-4 h-4 text-muted-foreground" />
          }
          Set as Default
        </button>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export default function CustomerAddresses() {
  const { user } = useAuth();
  const { add, update, setDefault, remove } = useAddressMutations();

  const [addresses, setAddresses] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // form: null = hidden | 'new' = add form | addr.id = edit form
  const [formMode,  setFormMode]  = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [busyId,    setBusyId]    = useState(null);

  // ── Load ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await getAddresses(user.id);
    if (err) {
      setError(err.message || 'Could not load addresses');
    } else {
      setAddresses((data || []).map(a => ({
        id:        a.id,
        label:     a.label,
        address:   a.address,
        landmark:  a.landmark || '',
        isDefault: a.is_default,
        zoneName: a.zone_name || '',
      })));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Form helpers ───────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormMode('new');
  };

  const openEdit = (addr) => {
    setForm({ label: addr.label, address: addr.address, landmark: addr.landmark });
    setFormError(null);
    setFormMode(addr.id);
  };

  const closeForm = () => {
    setFormMode(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  // ── Save ───────────────────────────────────────────────────
  const handleSave = async () => {
    // Re-entry guard: the trigger button is already disabled while
    // saving is true, but that disabled state only takes effect on
    // React's next render — a fast double-tap (common on the lower-end
    // Android hardware this app targets) can fire this handler twice
    // before that happens. Guard here too rather than rely on the
    // button alone.
    if (saving) return;
    if (!form.address.trim()) { setFormError('Full address is required'); return; }
    if (!user?.id) { setFormError('You must be signed in'); return; }
    setSaving(true);
    setFormError(null);

    if (formMode === 'new') {
      const { data, error: err } = await add(user.id, {
        label:     form.label,
        address:   form.address.trim(),
        landmark:  form.landmark.trim(),
        isDefault: addresses.length === 0,
      });
      if (err) {
        setFormError(err.message || 'Could not save address');
      } else if (data) {
        setAddresses(prev => [
          ...prev,
          { id: data.id, label: data.label, address: data.address, landmark: data.landmark || '', isDefault: data.is_default, zoneName: data.zone_name || '' },
        ]);
        closeForm();
      }
    } else {
      const { data, error: err } = await update(formMode, {
        label:    form.label,
        address:  form.address.trim(),
        landmark: form.landmark.trim(),
      });
      if (err) {
        setFormError(err.message || 'Could not update address');
      } else if (data) {
        setAddresses(prev => prev.map(a => a.id === formMode
          ? { ...a, label: data.label, address: data.address, landmark: data.landmark || '' }
          : a
        ));
        closeForm();
      }
    }
    setSaving(false);
  };

  // ── Set default ────────────────────────────────────────────
  const handleSetDefault = async (id) => {
    setBusyId(id);
    const { error: err } = await setDefault(id, user?.id);
    if (!err) {
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    } else {
      setError(err.message || 'Could not set default');
    }
    setBusyId(null);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setBusyId(id);
    const wasDefault = addresses.find(a => a.id === id)?.isDefault;
    const { error: err } = await remove(id, user?.id);
    if (!err) {
      setAddresses(prev => {
        const remaining = prev.filter(a => a.id !== id);
        if (wasDefault && remaining.length > 0 && !remaining.some(a => a.isDefault)) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        return remaining;
      });
    } else {
      setError(err.message || 'Could not delete address');
    }
    setBusyId(null);
  };

  return (
    <div className="pb-6 bg-muted/50 min-h-screen">
      <AppHeader title="My Addresses" showBack />

      <div className="px-4 pt-4 space-y-3">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">{error}</p>
            <button onClick={load} className="text-xs text-destructive font-medium underline">Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <>
            {[0, 1].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 w-16 bg-muted rounded-full" />
                    <div className="h-3 w-40 bg-muted rounded-full" />
                    <div className="h-3 w-28 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && addresses.length === 0 && formMode !== 'new' && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-7 h-7 text-primary/70" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No saved addresses</p>
            <p className="text-xs text-muted-foreground mb-4">Add a delivery address so vendors know where to deliver.</p>
            <button
              onClick={openAdd}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              + Add Address
            </button>
          </div>
        )}

        {/* Address cards */}
        {!loading && addresses.map(addr => (
          formMode === addr.id ? (
            <AddressForm
              key={addr.id}
              form={form}
              setForm={setForm}
              onCancel={closeForm}
              onSave={handleSave}
              saving={saving}
              error={formError}
              title="Edit Address"
            />
          ) : (
            <AddressCard
              key={addr.id}
              addr={addr}
              busy={busyId === addr.id}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          )
        ))}

        {/* Add new address form / button */}
        {!loading && formMode === 'new' && (
          <AddressForm
            form={form}
            setForm={setForm}
            onCancel={closeForm}
            onSave={handleSave}
            saving={saving}
            error={formError}
            title="New Address"
          />
        )}

        {!loading && formMode === null && addresses.length > 0 && (
          <button
            onClick={openAdd}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-border bg-card text-sm font-semibold text-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        )}

      </div>
    </div>
  );
}
