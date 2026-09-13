import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, Send, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { getSupportTickets, createSupportTicket } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ── Helpers ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    open:        { label: 'Open',        cls: 'bg-amber-50  text-amber-600  border-amber-200'  },
    in_progress: { label: 'In Progress', cls: 'bg-blue-50   text-blue-600   border-blue-200'   },
    resolved:    { label: 'Resolved',    cls: 'bg-green-50  text-green-600  border-green-200'  },
    closed:      { label: 'Closed',      cls: 'bg-muted  text-muted-foreground   border-border'   },
  };
  const { label, cls } = cfg[status] ?? cfg.open;
  return (
    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${cls} shrink-0`}>
      {label}
    </span>
  );
}

// Append a customer reply to the ticket's messages jsonb
async function appendCustomerReply(ticketId, text) {
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('messages')
    .eq('id', ticketId)
    .single();

  const current = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const newMsg  = {
    from: 'customer',
    text,
    time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }),
  };
  return supabase
    .from('support_tickets')
    .update({ messages: [...current, newMsg] })
    .eq('id', ticketId)
    .select()
    .single();
}

// ── Ticket card ────────────────────────────────────────────────
function TicketCard({ ticket, onReplySubmit }) {
  const [reply,     setReply]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState(null);
  const [localMsgs, setLocalMsgs] = useState(ticket.messages ?? []);
  const inputRef = useRef(null);

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const orderLabel = ticket.order_number ?? ticket.order_id ?? null;

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || sending || isResolved) return;
    setSending(true);
    setSendError(null);
    const { data: updated, error } = await appendCustomerReply(ticket.id, text);
    setSending(false);
    if (!error && updated) {
      setLocalMsgs(updated.messages ?? []);
      if (onReplySubmit) onReplySubmit(ticket.id, updated);
      setReply('');
    } else {
      // Used to optimistically show the message as sent even when the
      // save failed — the customer would see their reply appear and
      // assume support received it, while nothing had actually reached
      // the server. Keep the draft in the input so it isn't lost, and
      // say plainly that it didn't go through.
      setSendError("Couldn't send — check your connection and try again.");
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-bold text-foreground leading-tight">{ticket.subject}</p>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Order reference */}
      {orderLabel && (
        <p className="text-xs text-muted-foreground mb-3">Order: {orderLabel}</p>
      )}

      {/* Messages */}
      {localMsgs.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-3 mb-3 space-y-2">
          {localMsgs.map((msg, i) => {
            const isCustomer = msg.from === 'customer';
            return (
              <p key={i} className="text-sm leading-relaxed">
                <span className={`font-semibold ${isCustomer ? 'text-foreground' : 'text-primary'}`}>
                  {isCustomer ? 'Customer: ' : 'Support: '}
                </span>
                <span className={isCustomer ? 'text-foreground' : 'text-primary'}>
                  {msg.text}
                </span>
              </p>
            );
          })}
        </div>
      )}

      {sendError && (
        <p className="text-xs text-red-500 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {sendError}
        </p>
      )}

      {/* Reply input — hidden when resolved */}
      {!isResolved && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            aria-label={`Reply to ${ticket.subject}`}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Reply..."
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-muted/50 text-sm outline-none focus:border-primary/50 focus:bg-card transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            aria-label="Send reply"
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-all"
          >
            {sending
              ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              : <Send className="w-4 h-4 text-primary-foreground" />
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Ticket Modal ───────────────────────────────────────────
function NewTicketModal({ onClose, onSubmit, submitting, error, initialSubject = '' }) {
  const [subject,     setSubject]     = useState(initialSubject);
  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!subject.trim() || !description.trim()) return;
    onSubmit({ subject: subject.trim(), orderNumber: orderNumber.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div
        className="relative bg-card rounded-t-3xl p-6 pb-10 z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 touch-target flex items-center justify-center text-muted-foreground hover:text-muted-foreground"
          aria-label="Close"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <h2 className="text-lg font-bold text-foreground text-center mb-5">
          Create Support Ticket
        </h2>

        <div className="space-y-3">
          <input
            autoFocus
            aria-label="Subject"
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-primary/50 bg-card text-sm outline-none placeholder:text-muted-foreground"
          />

          <input
            aria-label="Order number (optional)"
            placeholder="Order Number (optional)"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground"
          />

          <textarea
            aria-label="Describe your issue"
            placeholder="Describe your issue..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground resize-none"
          />

          {error && (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!subject.trim() || !description.trim() || submitting}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function CustomerSupport() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [tickets,     setTickets]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted,   setSubmitted]   = useState(false);

  // Account Management routes here for requests with no self-service
  // flow yet (delete account, export data, change phone) with a
  // subject pre-filled via navigation state — open straight to the
  // ticket form instead of leaving the customer to find "+ New Ticket"
  // and retype what they already told the previous screen.
  const prefillSubject = location.state?.prefillSubject ?? '';
  useEffect(() => {
    if (prefillSubject) {
      setShowModal(true);
      // Clear it from history state so navigating back here later
      // (or refreshing) doesn't keep forcing the modal back open.
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSubject]);

  // Load tickets
  const loadTickets = () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    getSupportTickets(user.id).then(({ data, error }) => {
      if (error) {
        // Used to fall through silently here, leaving `tickets` at its
        // empty default — a failed fetch and "you truly have no
        // tickets" looked identical, so a customer whose ticket load
        // failed just saw "No tickets yet" with no way to tell
        // something had gone wrong or to retry.
        setLoadError(error.message || 'Could not load your tickets.');
      } else {
        setTickets(data ?? []);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle ticket reply update (keep local state fresh)
  const handleReplySubmit = (ticketId, updatedTicket) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updatedTicket } : t));
  };

  // Submit new ticket
  const handleSubmitTicket = async ({ subject, orderNumber, description }) => {
    // Re-entry guard: the trigger button is already disabled while
    // submitting is true, but that disabled state only takes effect on
    // React's next render — a fast double-tap (common on the lower-end
    // Android hardware this app targets) can fire this handler twice
    // before that happens. Guard here too rather than rely on the
    // button alone.
    if (submitting) return;
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);

    // Build the first message from the description
    const firstMsg = {
      from: 'customer',
      text: description,
      time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }),
    };

    const payload = {
      user_id:  user.id,
      subject,
      messages: [firstMsg],
      status:   'open',
      priority: 'medium',
      ...(orderNumber ? { order_number: orderNumber } : {}),
    };

    const { data: newTicket, error } = await createSupportTicket(payload);
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message ?? 'Failed to submit ticket. Please try again.');
      return;
    }

    const row = newTicket ?? {
      id:         `temp-${Date.now()}`,
      subject,
      status:     'open',
      messages:   [firstMsg],
      created_at: new Date().toISOString(),
    };

    setTickets(prev => [row, ...prev]);
    setShowModal(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  // Call support — tel: link
  const handleCall = () => {
    window.location.href = 'tel:+918001234567';
  };

  // WhatsApp deep link
  const handleWhatsApp = () => {
    window.open('https://wa.me/918001234567?text=Hi%2C%20I%20need%20help%20with%20my%20SETU%20order.', '_blank');
  };

  return (
    <>
      <div className="pb-6 bg-muted/50 min-h-screen">
        <AppHeader
          title="Help & Support"
          showBack
          rightAction={
            <button
              onClick={() => { setShowModal(true); setSubmitError(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all"
            >
              <span className="text-base leading-none">+</span> New Ticket
            </button>
          }
        />

        <div className="px-4 pt-4 space-y-4">

          {/* Success banner */}
          {submitted && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-700 font-medium">
                Ticket submitted! We'll respond within 2–4 hours.
              </p>
            </div>
          )}

          {/* Quick contact cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCall}
              className="bg-card rounded-2xl border border-border shadow-sm py-5 flex flex-col items-center gap-2 active:scale-95 transition-all"
            >
              <Phone className="w-7 h-7 text-primary" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Call Support</p>
                <p className="text-xs text-muted-foreground mt-0.5">9am - 6pm</p>
              </div>
            </button>

            <button
              onClick={handleWhatsApp}
              className="bg-card rounded-2xl border border-border shadow-sm py-5 flex flex-col items-center gap-2 active:scale-95 transition-all"
            >
              <MessageSquare className="w-7 h-7 text-green-500" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground mt-0.5">24/7 support</p>
              </div>
            </button>
          </div>

          {/* Tickets section */}
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Your Tickets</h2>

            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && loadError && (
              <div className="bg-card rounded-2xl border border-red-100 p-6 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <button onClick={loadTickets} className="text-xs text-primary font-semibold underline">
                  Retry
                </button>
              </div>
            )}

            {!loading && !loadError && tickets.length === 0 && (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No tickets yet. Tap "+ New Ticket" if you need help.</p>
              </div>
            )}

            {!loading && !loadError && tickets.length > 0 && (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onReplySubmit={handleReplySubmit}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <NewTicketModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitTicket}
          submitting={submitting}
          error={submitError}
          initialSubject={prefillSubject}
        />
      )}
    </>
  );
}
