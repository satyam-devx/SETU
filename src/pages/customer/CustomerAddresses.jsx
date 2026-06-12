// ═══════════════════════════════════════════════════════════
// SETU — CustomerAddresses (v2)
// Real persisted address book backed by `customer_addresses`.
// Add / edit / delete / set-default, with loading, empty,
// and error states. Matches PDF "My Addresses" design with
// Home/Work/Farm/Other labels, default badge, and inline form.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle, Loader2, AlertCircle, Home, Briefcase, Wheat, MapPinned } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { getAddresses, createAddress, updateAddress, setDefaultAddress, deleteAddress } from '@/lib/api';

const LABEL_ICONS = { Home, Work: Briefcase, Farm: Wheat, Other: MapPinned };

const EMPTY_FORM = { label: 'Home', address: '', landmark: '' };

export default function CustomerAddresses() {
  const { user } = useAuth();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // form state — null when hidden, 'new' for add, or address id for edit
  const [formMode, setFormMode]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving]       = useState(false);

  // per-row action state
  const [busyId, setBusyId]       = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await getAddresses(user.id);
    if (err) {
      setError(err.message || 'Could not load addresses');
    } else {
      setAddresses((data || []).map(a => ({
        id: a.id,
        label: a.label,
        address: a.address,
        landmark: a.landmark || '',
        isDefault: a.is_default,
      })));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

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

  const handleSave = async () => {
    if (!form.address.trim()) {
      setFormError('Full address is required');
      return;
    }
    if (!user?.id) {
      setFormError('You must be signed in to save an address');
      return;
    }
    setSaving(true);
    setFormError(null);

    if (formMode === 'new') {
      const { data, error: err } = await createAddress(user.id, {
        label: form.label,
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        isDefault: addresses.length === 0, // first address becomes default automatically
      });
      if (err) {
        setFormError(err.message || 'Could not save address');
      } else if (data) {
        setAddresses(prev => [
          ...prev,
          { id: data.id, label: data.label, address: data.address, landmark: data.landmark || '', isDefault: data.is_default },
        ]);
        closeForm();
      }
    } else {
      const { data, error: err } = await updateAddress(formMode, {
        label: form.label,
        address: form.address.trim(),
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

  const handleSetDefault = async (id) => {
    setBusyId(id);
    const { error: err } = await setDefaultAddress(id);
    if (!err) {
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    } else {
      setError(err.message || 'Could not set default address');
    }
    setBusyId(null);
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    const wasDefault = addresses.find(a => a.id === id)?.isDefault;
    const { error: err } = await deleteAddress(id);
    if (!err) {
      setAddresses(prev => {
        const remaining = prev.filter(a => a.id !== id);
        // mirror the DB trigger that promotes the oldest remaining
        // address to default when the default one is removed
        if (wasDefault && remaining.length > 0 && !remaining.some(a => a.isDefault)) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        return remaining;
      });
      setDeleteConfirmId(null);
    } else {
      setError(err.message || 'Could not delete address');
    }
    setBusyId(null);
  };

  return (
    <div className="pb-6">
      <AppHeader title="My Addresses" showBack />
      <div className="px-4 py-4 space-y-3">

        {error && (
          <Card className="p-3 border-destructive/30 bg-destructive/5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">{error}</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={load}>Retry</Button>
          </Card>
        )}

        {loading ? (
          <>
            {[0, 1].map(i => (
              <Card key={i} className="p-4 border-border animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-20 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : addresses.length === 0 && formMode !== 'new' ? (
          <EmptyState
            icon={MapPin}
            title="No saved addresses"
            description="Add a delivery address so vendors and riders know where to find you."
            action={openAdd}
            actionLabel="Add New Address"
          />
        ) : (
          addresses.map(addr => {
            const Icon = LABEL_ICONS[addr.label] || MapPin;
            const isBusy = busyId === addr.id;
            return (
              <Card key={addr.id} className={`p-4 border transition-colors ${addr.isDefault ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                {formMode === addr.id ? (
                  <AddressForm
                    form={form}
                    setForm={setForm}
                    onCancel={closeForm}
                    onSave={handleSave}
                    saving={saving}
                    error={formError}
                    saveLabel="Save Changes"
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{addr.label}</p>
                          {addr.isDefault && <Badge className="text-[9px] bg-primary/10 text-primary border-0">Default</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{addr.address}</p>
                        {addr.landmark && <p className="text-[10px] text-muted-foreground">Near: {addr.landmark}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(addr)} aria-label={`Edit ${addr.label} address`}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setDeleteConfirmId(addr.id)}
                          aria-label={`Delete ${addr.label} address`}
                          disabled={isBusy}
                        >
                          {isBusy && deleteConfirmId !== addr.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                        </Button>
                      </div>
                    </div>

                    {deleteConfirmId === addr.id && (
                      <div className="mt-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                        <p className="text-xs font-medium mb-2">Delete this address?</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            onClick={() => handleDelete(addr.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {!addr.isDefault && (
                      <Button
                        variant="outline" size="sm" className="mt-2 text-xs w-full h-7 gap-1"
                        onClick={() => handleSetDefault(addr.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Set as Default
                      </Button>
                    )}
                  </>
                )}
              </Card>
            );
          })
        )}

        {!loading && (
          formMode === 'new' ? (
            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3">New Address</h3>
              <AddressForm
                form={form}
                setForm={setForm}
                onCancel={closeForm}
                onSave={handleSave}
                saving={saving}
                error={formError}
                saveLabel="Save Address"
              />
            </Card>
          ) : addresses.length > 0 && formMode === null ? (
            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={openAdd}>
              <Plus className="w-4 h-4" /> Add New Address
            </Button>
          ) : null
        )}
      </div>
    </div>
  );
}

function AddressForm({ form, setForm, onCancel, onSave, saving, error, saveLabel }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {['Home', 'Work', 'Farm', 'Other'].map(label => (
          <button
            key={label}
            type="button"
            onClick={() => setForm(f => ({ ...f, label }))}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.label === label ? 'bg-primary text-white border-primary' : 'border-border'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <Label className="text-xs mb-1 block">Full Address *</Label>
        <Input
          placeholder="House no., street, area"
          value={form.address}
          maxLength={250}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Landmark</Label>
        <Input
          placeholder="e.g. Near temple"
          value={form.landmark}
          maxLength={120}
          onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button className="flex-1" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}
