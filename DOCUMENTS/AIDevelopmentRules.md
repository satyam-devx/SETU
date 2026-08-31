# SETU — AIDevelopmentRules.md

**Document Class:** AI Development · Living (refined continuously as AI-generated code reveals gaps)
**Owner:** CTO / Head of AI Systems
**Audience:** AI coding assistants (primary), engineers directing AI tools
**Status:** v1.0 — MVP Rules
**Depends On:** Schema.md, APIContract.md, SecurityRequirements.md, TechSpec.md, ErrorHandlingGuide.md

---

## 0. Purpose of This Document

This document is the operating manual for AI coding assistants (Claude Code, Cursor, GitHub Copilot, or any LLM-assisted development tool) working on the SETU codebase. It exists because AI tools that generate code without SETU-specific context will produce code that is technically correct in isolation but violates critical architectural, security, or operational constraints.

**This document must be loaded by any AI assistant before generating code in any SETU repository.** It is a synthesis and enforcement layer — it does not replace the other documents, it indexes them and tells the AI what to check before presenting code as complete.

---

## 1. Mandatory Document Loading Order

Before generating code for any part of the SETU system, an AI assistant must have access to (or have been provided the contents of) the following documents, in this priority order:

| Priority | Document | Why Required |
|---|---|---|
| 1 | `Constitution.md` | Defines the non-negotiable constraints that override all other decisions |
| 2 | `Schema.md` | Every entity, type, and relationship — code that references tables or columns must match this exactly |
| 3 | `APIContract.md` | Request/response shapes, error codes, and endpoint behaviors — never invent these |
| 4 | `SecurityRequirements.md` | RLS policies, auth patterns, secrets handling — security violations are unacceptable in any PR |
| 5 | `ErrorHandlingGuide.md` | Error codes, logging rules, retry policies — every function that can fail must handle failure |
| 6 | `TechSpec.md` | Package versions, folder structure, naming conventions, coding patterns |

**Partial loading rule:** If only certain documents are loaded, the AI must:
- State which documents are missing from context
- Refuse to generate code that touches areas covered by missing documents (e.g., refuse to generate RLS policies without `SecurityRequirements.md`, refuse to define API response shapes without `APIContract.md`)
- Ask the engineer to provide the missing document before proceeding

---

## 2. Absolute Prohibitions

These are the things an AI assistant must **never** do in SETU code, regardless of what the engineer requests. If asked to do any of these, the AI must explain the violation and offer a compliant alternative.

### 2.1 Security Prohibitions

```
❌ NEVER trust user_id or role from a request body
   → Always extract identity from the verified JWT via supabase.auth.getUser()

❌ NEVER write a monetary value as float or decimal
   → All monetary values are integers in paise. ₹10 = 1000, not 10.0 or "10"

❌ NEVER log a phone number, OTP, or payment credential
   → Log user_id (UUID) only. Phone = PII. Never in logs.

❌ NEVER hardcode a secret, API key, or credential
   → All secrets come from Deno.env.get() (Edge Functions) or flutter_dotenv/
     flutter_secure_storage (Flutter). Any string that looks like an API key
     in generated code is a blocker.

❌ NEVER create a database table without enabling RLS
   → Every CREATE TABLE must be immediately followed by:
     ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

❌ NEVER bypass RLS using the service role key in a client-accessible path
   → Service role key is for server-side Edge Functions only, never in Flutter

❌ NEVER accept payment amounts from the client
   → All totals are calculated server-side from database prices. Client sends
     item list; server calculates total.

❌ NEVER return internal error details to the client
   → System errors (category E per ErrorHandlingGuide.md) return only
     { "error": "INTERNAL_ERROR", "message": "..." } — no stack traces,
     no database error messages, no constraint names.
```

### 2.2 Architectural Prohibitions

```
❌ NEVER add microservices, message queues, or distributed infrastructure
   → SETU is Phase 1: Supabase modular monolith. See SystemArchitecture.md §1.
   → Kafka, Redis, separate Node.js services are Phase 2+, triggered by
     SystemArchitecture.md §6 scale gates.

❌ NEVER call Supabase directly from a Flutter Screen widget
   → Data access follows the Screen → Provider → Repository → Supabase
     pattern (TechSpec.md §6.1). Screens only call providers.

❌ NEVER write inline Hindi strings in widget files
   → All user-facing text comes from app_strings.dart / error_strings.dart
   → This is the single most important rule for Maithili support later.

❌ NEVER use SharedPreferences for sensitive data (tokens, user PII)
   → Use flutter_secure_storage (Android Keystore-backed)

❌ NEVER use floating-point math for monetary calculations
   → Even: double total = subtotal + deliveryFee is wrong.
   → Correct: int total = subtotal + deliveryFee (all paise, all integers)
```

### 2.3 Schema Prohibitions

```
❌ NEVER edit an existing migration file
   → Schema changes are new migration files only (0002_, 0003_, etc.)

❌ NEVER use a column name, table name, or relationship not defined in Schema.md
   → If a needed column doesn't exist in Schema.md, flag it for a schema
     discussion — don't invent columns silently.

❌ NEVER use 'numeric', 'decimal', or 'float' for monetary columns
   → ADR-002: all monetary columns are 'integer' in paise.

❌ NEVER hard-delete records that have financial or operational history
   → orders, transactions, reviews, audit_log are never hard-deleted.
   → Use is_available/is_active/is_verified flags per Schema.md §13.
```

---

## 3. Required Patterns — Always Follow These

### 3.1 Every New Endpoint

When generating a new Edge Function endpoint:

1. **Add it to `APIContract.md` first** (or confirm it already exists there) — the contract precedes the implementation
2. Follow the standard response builder from `ErrorHandlingGuide.md §8.1`
3. Wrap in `withErrorBoundary` per `ErrorHandlingGuide.md §8.2`
4. Extract user identity from JWT (never from request body)
5. All errors use codes from `ErrorHandlingGuide.md §3` — if a new code is needed, add it there first
6. Log with the structured logger from `ErrorHandlingGuide.md §2.3`
7. Add rate limiting comment per `APIContract.md §11`

**Template:**
```typescript
// CORRECT new endpoint pattern
export async function handleNewAction(
  req: Request,
  supabase: SupabaseClient,
  userId: string  // from verified JWT — never from req.json()
): Promise<Response> {
  const start = Date.now()

  try {
    // 1. Parse and validate request
    const body = await req.json() as NewActionRequest
    if (!body.required_field) {
      return errorResponse('MISSING_REQUIRED_FIELD', 'required_field is required', 400)
    }

    // 2. Business logic using supabase client (RLS enforces access)
    const { data, error } = await supabase
      .from('table_name')
      .insert({ ...body, user_id: userId })  // userId from JWT, not body
      .select()
      .single()

    if (error) {
      log('ERROR', 'service-name', 'action.failed', {
        user_id: userId,
        error: new Error(error.message),
        error_code: 'DATABASE_ERROR',
        duration_ms: Date.now() - start
      })
      return errorResponse('INTERNAL_ERROR', 'Database operation failed', 500)
    }

    // 3. Log success
    log('INFO', 'service-name', 'action.success', {
      user_id: userId,
      details: { result_id: data.id },
      duration_ms: Date.now() - start
    })

    return successResponse({ result: data }, 201)

  } catch (error) {
    // withErrorBoundary catches this, but explicit catch for known failure modes
    throw error  // re-throw to boundary
  }
}
```

### 3.2 Every New Flutter Screen

```dart
// CORRECT new screen pattern
class NewFeatureScreen extends ConsumerWidget {
  const NewFeatureScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Data via provider — never direct Supabase calls
    final dataAsync = ref.watch(newFeatureProvider);

    return Scaffold(
      appBar: AppBar(
        // Title from app_strings.dart — never inline string
        title: Text(AppStrings.newFeatureTitle),
      ),
      body: dataAsync.when(
        data: (data) => _buildContent(context, ref, data),
        loading: () => const SEETULoadingIndicator(),
        error: (error, _) => ErrorDisplayWidget(
          // AppException.userMessage looks up Hindi string from error_strings.dart
          message: (error as AppException).userMessage,
          onRetry: () => ref.refresh(newFeatureProvider),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, NewFeatureData data) {
    return Column(
      children: [
        // Prices always via CurrencyUtils — never inline arithmetic
        Text(CurrencyUtils.formatRupees(data.pricePaise)),
        // Buttons always use named components from widgets/
        PrimaryButton(
          // Label from app_strings.dart
          label: AppStrings.confirmAction,
          onPressed: () => _handleAction(context, ref),
        ),
      ],
    );
  }
}
```

### 3.3 Every New Database Migration

```sql
-- CORRECT migration template: NNNN_description.sql
-- Always: new file, never edit existing migrations

-- 1. Create table
CREATE TABLE new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  -- monetary columns: INTEGER only, with comment explaining paise
  amount integer NOT NULL,  -- in paise (₹1 = 100 paise)
  created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS immediately (same migration, no exceptions)
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- 3. Add indexes for expected query patterns
CREATE INDEX idx_new_table_user ON new_table(user_id);

-- 4. Add at least one RLS policy (deny-all is the default without explicit policies)
CREATE POLICY "new_table_read_own" ON new_table
  FOR SELECT USING (user_id = auth.uid());

-- 5. Comment on monetary columns
COMMENT ON COLUMN new_table.amount IS 'Amount in paise. ₹1 = 100 paise.';
```

### 3.4 Every New Riverpod Provider

```dart
// CORRECT provider pattern
// File: providers/new_feature_provider.dart

// Use typed AsyncNotifier, not ChangeNotifier or raw StateNotifier
final newFeatureProvider =
    AsyncNotifierProvider<NewFeatureNotifier, NewFeatureData>(
  NewFeatureNotifier.new,
);

class NewFeatureNotifier extends AsyncNotifier<NewFeatureData> {
  @override
  Future<NewFeatureData> build() {
    // Inject repository via ref — never instantiate directly
    return ref.watch(newFeatureRepositoryProvider).fetchData();
  }

  Future<void> performAction(String actionParam) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(newFeatureRepositoryProvider).doAction(actionParam),
    );
  }
}
```

---

## 4. Self-Verification Checklist

Before presenting any generated code as complete, the AI must run through this checklist. Code that fails any item must be revised before presentation — not presented with a caveat.

### 4.1 Security Checklist
- [ ] No user_id or role from request body — identity from JWT only
- [ ] No monetary float/decimal — integers in paise only
- [ ] No PII (phone, address) in log calls
- [ ] No hardcoded secrets or API keys
- [ ] Any new table has `ENABLE ROW LEVEL SECURITY` in same migration
- [ ] Any new migration has at least one RLS policy
- [ ] Payment totals calculated server-side from DB prices, not client-supplied
- [ ] Error responses use codes from ErrorHandlingGuide.md §3 only
- [ ] No internal error details (stack traces, DB errors) in client responses

### 4.2 Architecture Checklist
- [ ] No Phase 2+ infrastructure (Redis, Kafka, separate services) in Phase 1 code
- [ ] Flutter: no direct Supabase calls in Screen widgets (Screen → Provider → Repository)
- [ ] No inline Hindi strings in widget files (all from app_strings.dart)
- [ ] No SharedPreferences for sensitive data
- [ ] No floating-point monetary arithmetic

### 4.3 Schema Checklist
- [ ] All table/column names match Schema.md exactly (no invented columns)
- [ ] No monetary column as numeric/decimal/float
- [ ] No hard-delete of records with financial/operational history
- [ ] Any schema change is in a new migration file (not editing existing)

### 4.4 Contract Checklist
- [ ] Any new endpoint exists in APIContract.md (or is being added to it in same PR)
- [ ] Response shapes match APIContract.md schemas exactly
- [ ] Error codes used in responses exist in ErrorHandlingGuide.md §3
- [ ] Rate limiting noted in endpoint comments

### 4.5 Completeness Checklist
- [ ] Every function that makes a network/DB call has error handling
- [ ] Offline scenarios considered for Rider App code (SocketException → queue)
- [ ] Every new API call in Flutter has corresponding loading and error states in UI
- [ ] If new string added: is it in app_strings.dart / error_strings.dart?

---

## 5. Escalation Rules — When to Stop and Ask

An AI assistant must stop generating and ask the engineer for clarification or human review when:

1. **Schema change required:** The feature needs a column or table that doesn't exist in Schema.md. Stop. Don't invent schema. Propose the addition and wait for confirmation.

2. **Security-sensitive logic:** Any code touching: authentication flows, JWT handling, payment processing, RLS policy changes, or PII data handling. Generate with extra caution and explicitly call out security implications for human review.

3. **Phase 2+ architectural pattern:** The request would be naturally solved by Redis, a job queue, or a separate microservice. Stop. Propose a Phase 1-compatible alternative. Only proceed with Phase 2+ solution if the engineer confirms the scaling trigger has been met.

4. **Ambiguous error handling:** If it's unclear which error code applies to a failure scenario, or if the scenario isn't covered by ErrorHandlingGuide.md §3, stop and propose adding the new code to the catalog rather than inventing it inline.

5. **Constitution conflict:** If a requested feature appears to violate a Constitution commandment (e.g., "force UPI payment, disable COD" violates Commandment II), stop and quote the relevant commandment. Await explicit founder override before proceeding.

---

## 6. Context Clues for Common Operations

Quick-reference for the most common operations in the SETU codebase:

| Operation | Key Constraints |
|---|---|
| Get current user's orders | Query `orders WHERE customer_id = auth.uid()` — RLS enforces this, but be explicit |
| Create an order | Always via `OrderService` Edge Function, never direct PostgREST insert from client |
| Display a price | `CurrencyUtils.formatRupees(int paise)` — never divide by 100 inline |
| Calculate a total | `int total = subtotal + deliveryFee + platformFee - discountAmount` — all paise, all integers |
| Show an error to user | `AppException.userMessage` → looks up from `error_strings.dart` — never inline Hindi |
| Rider marks delivered | Must include photo upload; `cod_amount` if `is_cod=true`; idempotent (APIContract §8.3) |
| Admin assigns rider | Check `ALREADY_ASSIGNED` conflict (APIContract §9.2); log to audit_log |
| Any admin action | Must create an `audit_log` entry with actor_id, action, entity_type, entity_id |
| Vendor accepts order | Update `orders.status = 'confirmed'`; trigger notification to customer and admin |
| New notification | Create `notifications` row AND dispatch via FCM + WhatsApp per AppFlow §9 table |

---

*End of AIDevelopmentRules.md — v1.0*
