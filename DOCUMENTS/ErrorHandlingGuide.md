# SETU — ErrorHandlingGuide.md

**Document Class:** Engineering · Living (new error codes added continuously as features ship)
**Owner:** Principal DevOps Engineer / Backend Lead
**Audience:** All engineers, AI coding assistants, on-call operations
**Status:** v1.0 — MVP Error Catalog
**Depends On:** APIContract.md, SecurityRequirements.md, SystemArchitecture.md

---

## 0. How to Use This Document

This document defines how every layer of SETU handles failure — what gets logged, what the user sees (in Hindi), what triggers a retry vs. an alert, and how errors map to operational severity levels.

**Three audiences, three sections:**
- **Backend engineers:** Sections 1–4 (taxonomy, logging, retry policy, severity mapping)
- **Frontend engineers:** Sections 5–6 (error code → Hindi message catalog, client-side handling patterns)
- **AI coding assistants:** Section 7 (self-verification checklist — every generated function must satisfy these requirements before being presented as complete)

**Living document policy:** When a new endpoint is added to `APIContract.md`, its error codes are added to Section 3's catalog in the same PR. A PR that adds an endpoint without updating this document is incomplete.

---

## 1. Error Classification Taxonomy

All errors in SETU are classified into five categories. The category determines retry policy (Section 4), logging level (Section 2), and severity mapping (Section 4).

### Category A — Validation Errors
**Definition:** The request is malformed or violates a business rule that the client should have prevented.
**HTTP status:** `400 Bad Request`
**Retry policy:** Never retry — the client must fix the request before retrying.
**Logging level:** `DEBUG` (expected, high-volume, not actionable by ops)
**Examples:** `INVALID_PHONE_FORMAT`, `EMPTY_CART`, `BELOW_MINIMUM_ORDER`

### Category B — Authentication / Authorization Errors
**Definition:** The caller is not who they claim to be, or does not have permission for the requested resource.
**HTTP status:** `401 Unauthorized` (authentication), `403 Forbidden` (authorization — never used; 404 is returned instead to avoid leaking resource existence), `404 Not Found` (resource doesn't exist OR caller lacks access — these are deliberately indistinguishable)
**Retry policy:** `401` → attempt token refresh once, then return to login screen. `404` → do not retry.
**Logging level:** `INFO` for routine 401s (expected on token expiry); `WARN` for repeated 401s from the same device (potential token theft); `ERROR` for any 403 (should not occur if RLS is correct — its presence indicates an application-layer bypass attempt)
**Examples:** `UNAUTHORIZED`, `VENDOR_NOT_FOUND` (which may be "unverified vendor" but we don't say that)

### Category C — Conflict / State Errors
**Definition:** The request is valid, but the current system state prevents fulfilling it.
**HTTP status:** `409 Conflict`
**Retry policy:** Do not automatically retry — show the current state to the user and let them decide.
**Logging level:** `INFO` (expected business events — out-of-stock at checkout, already-assigned order)
**Examples:** `ITEMS_UNAVAILABLE`, `ALREADY_ASSIGNED`, `ORDER_REASSIGNED`, `INVALID_STATE_TRANSITION`

### Category D — External Service Errors
**Definition:** SETU's own logic is correct but an external dependency (Razorpay, Twilio, Whisper, FCM) failed.
**HTTP status:** `503 Service Unavailable`
**Retry policy:** Exponential backoff — see Section 4.
**Logging level:** `ERROR` with full context (external service name, error code, duration)
**Examples:** `SMS_PROVIDER_UNAVAILABLE`, `PAYMENT_GATEWAY_ERROR`, `AI_SERVICE_UNAVAILABLE`, `UPLOAD_FAILED`

### Category E — System Errors
**Definition:** An unexpected error occurred inside SETU's own code — a bug, an uncaught exception, a database constraint violation that should not have been reachable.
**HTTP status:** `500 Internal Server Error`
**Retry policy:** Single retry after 2 seconds; if it fails again, surface to the user and log to Sentry.
**Logging level:** `ERROR` with full stack trace to Sentry — these are the errors that require engineering attention.
**Examples:** `INTERNAL_ERROR` (generic — system errors never expose internals to the client)

---

## 2. Logging Standards

### 2.1 What Must Always Be Logged

Every log line must include:

```typescript
interface LogEntry {
  timestamp: string          // ISO 8601 UTC
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  service: string            // 'order-service' | 'payment-service' | etc.
  request_id: string         // X-Request-ID header value (echoed from client or generated)
  user_id: string | null     // UUID from JWT — NEVER the phone number or name
  action: string             // The operation being performed, e.g., 'order.create'
  error_code?: string        // Structured error code if this is an error log
  duration_ms?: number       // For performance tracking
  details?: Record<string, unknown>  // Context-specific, PII-scrubbed
}
```

### 2.2 What Must Never Be Logged

Security requirements (Section 9 of `SecurityRequirements.md`) extend to logging:

- ❌ Phone numbers — log `user_id` (UUID) instead
- ❌ OTP values — never, under any circumstance
- ❌ JWT tokens or refresh tokens — log only the `user_id` extracted from them
- ❌ Razorpay payment IDs in full — log only the first 8 characters for correlation: `pay_Razorp...` (sufficient for debugging, not useful for fraud)
- ❌ Full street addresses or landmarks — log `address_id` (UUID) only
- ❌ Full request/response bodies unless specifically debugging a production incident (must be a time-limited DEBUG flag, not a permanent setting)

### 2.3 Logging Implementation (Edge Functions)

```typescript
// core/logger.ts — shared across all Edge Functions
export function log(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  service: string,
  action: string,
  context: {
    request_id?: string
    user_id?: string | null
    error_code?: string
    duration_ms?: number
    details?: Record<string, unknown>
    error?: Error
  }
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    action,
    request_id: context.request_id ?? 'unknown',
    user_id: context.user_id ?? null,
    ...(context.error_code && { error_code: context.error_code }),
    ...(context.duration_ms !== undefined && { duration_ms: context.duration_ms }),
    ...(context.details && { details: context.details }),
    ...(context.error && {
      error_message: context.error.message,
      // Stack trace only for ERROR level — not for INFO/WARN
      ...(level === 'ERROR' && { stack: context.error.stack }),
    }),
  }
  // Supabase Edge Functions: console.log goes to Supabase log drain
  console.log(JSON.stringify(entry))
}

// Usage pattern:
log('INFO', 'order-service', 'order.create.success', {
  request_id: requestId,
  user_id: userId,
  details: { order_id: newOrder.id, total_paise: newOrder.total }
})

log('ERROR', 'payment-service', 'webhook.signature_failed', {
  request_id: requestId,
  error_code: 'WEBHOOK_SIGNATURE_INVALID',
  details: { gateway: 'razorpay' }
  // Note: no payment IDs, no amounts logged here — security requirement
})
```

---

## 3. Error Code Catalog

The canonical list of all error codes in SETU. Frontend Hindi messages are derived from this catalog in Section 6.

### 3.1 Authentication Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `UNAUTHORIZED` | B | 401 | No valid JWT, or JWT expired and refresh failed |
| `INVALID_OTP` | A | 400 | OTP does not match |
| `OTP_EXPIRED` | C | 410 | OTP older than 10 minutes |
| `RATE_LIMITED` | A | 429 | Too many requests (auth or general) |
| `INVALID_REFRESH_TOKEN` | B | 401 | Refresh token expired, revoked, or replayed |
| `SESSION_EXPIRED` | B | 401 | Session lifetime exceeded (admin 8-hour limit) |
| `UPGRADE_REQUIRED` | — | 426 | App version too old (AppFlow §10.1) |

### 3.2 Validation Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `INVALID_PHONE_FORMAT` | A | 400 | Phone not a valid 10-digit Indian number |
| `EMPTY_CART` | A | 400 | Order submitted with no items |
| `MULTIPLE_VENDORS` | A | 400 | Items from more than one vendor in order |
| `MISSING_REQUIRED_FIELD` | A | 400 | A required request body field is absent |
| `INVALID_QUANTITY` | A | 400 | Item quantity is zero or negative |
| `BELOW_MINIMUM_ORDER` | A | 400 | Subtotal below vendor's min_order_value |
| `INVALID_PRICE` | A | 400 | Product price set to less than ₹1 (100 paise) |
| `AUDIO_TOO_LARGE` | A | 400 | Voice transcription audio exceeds 2MB |

### 3.3 Not Found Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `VENDOR_NOT_FOUND` | B | 404 | Vendor doesn't exist or not accessible to caller |
| `PRODUCT_NOT_FOUND` | B | 404 | Product doesn't exist or not accessible to caller |
| `ORDER_NOT_FOUND` | B | 404 | Order doesn't exist or not owned by caller |
| `ADDRESS_NOT_FOUND` | B | 404 | Address doesn't exist or not owned by caller |
| `DELIVERY_NOT_FOUND` | B | 404 | Delivery record doesn't exist or not accessible |

### 3.4 Conflict / State Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `ITEMS_UNAVAILABLE` | C | 409 | One or more products became unavailable between cart add and checkout (AppFlow §3.2) |
| `ALREADY_ASSIGNED` | C | 409 | Order already has a rider assigned (AppFlow §10.3) |
| `ORDER_REASSIGNED` | C | 409 | Delivery was reassigned while rider was offline (AppFlow §7.3) |
| `INVALID_STATE_TRANSITION` | C | 409 | Action is not valid for the order's current status (e.g., trying to deliver a cancelled order) |
| `DUPLICATE_REVIEW` | C | 409 | Review already exists for this order (Schema UNIQUE constraint) |
| `INVALID_RIDER` | A | 400 | Rider ID provided for assignment is not an active rider |

### 3.5 External Service Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `SMS_PROVIDER_UNAVAILABLE` | D | 503 | Twilio/Gupshup OTP send failed |
| `PAYMENT_GATEWAY_ERROR` | D | 503 | Razorpay order creation failed |
| `PAYMENT_VERIFICATION_FAILED` | D | 200* | Razorpay signature verification failed (*returns 200 per APIContract §6.1) |
| `TRANSCRIPTION_FAILED` | D | 422 | Whisper returned low-confidence or empty result |
| `AI_SERVICE_UNAVAILABLE` | D | 503 | AI service (Whisper or Claude) unreachable |
| `UPLOAD_FAILED` | D | 503 | Supabase Storage upload failed |
| `FCM_DELIVERY_FAILED` | D | — | Push notification failed (internal, not returned to client) |
| `WHATSAPP_DELIVERY_FAILED` | D | — | WhatsApp message failed (internal, not returned to client) |

### 3.6 System Errors

| Code | Category | HTTP | Description |
|---|---|---|---|
| `INTERNAL_ERROR` | E | 500 | Unexpected error — details logged to Sentry, not exposed to client |
| `DATABASE_ERROR` | E | 500 | Unexpected database error — Sentry-logged, never expose constraint details to client |
| `WEBHOOK_SIGNATURE_INVALID` | E | 200* | Razorpay webhook signature mismatch (*returns 200 per SecurityRequirements.md §4.1) |

---

## 4. Retry Policies

### 4.1 Client-Side Retry Policy (Flutter)

```dart
// core/errors/retry_policy.dart

enum RetryPolicy { never, singleRetry, exponentialBackoff }

RetryPolicy getRetryPolicy(String errorCode) {
  const neverRetry = {
    // Category A — fix the request, not retry it
    'INVALID_PHONE_FORMAT', 'EMPTY_CART', 'MULTIPLE_VENDORS',
    'MISSING_REQUIRED_FIELD', 'INVALID_QUANTITY', 'BELOW_MINIMUM_ORDER',
    'AUDIO_TOO_LARGE',
    // Category B — auth errors handled separately (token refresh flow)
    'VENDOR_NOT_FOUND', 'ORDER_NOT_FOUND', 'ADDRESS_NOT_FOUND',
    // Category C — show state, let user decide
    'ITEMS_UNAVAILABLE', 'ALREADY_ASSIGNED', 'INVALID_STATE_TRANSITION',
    'DUPLICATE_REVIEW',
  };

  const singleRetry = {
    // Category E — unexpected, worth one retry
    'INTERNAL_ERROR', 'DATABASE_ERROR',
  };

  const exponentialBackoff = {
    // Category D — external services may recover
    'SMS_PROVIDER_UNAVAILABLE', 'PAYMENT_GATEWAY_ERROR',
    'AI_SERVICE_UNAVAILABLE', 'UPLOAD_FAILED',
  };

  if (neverRetry.contains(errorCode)) return RetryPolicy.never;
  if (singleRetry.contains(errorCode)) return RetryPolicy.singleRetry;
  if (exponentialBackoff.contains(errorCode)) return RetryPolicy.exponentialBackoff;
  return RetryPolicy.never; // Default: don't retry unknown errors
}
```

### 4.2 Exponential Backoff Parameters

For Category D errors (external service failures):

```
Attempt 1: immediate
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
Maximum attempts: 4
Maximum total wait: 14 seconds
Jitter: ±20% on each delay (prevents thundering herd if many clients retry simultaneously)
```

For voice transcription (`TRANSCRIPTION_FAILED`): **No automatic retry.** Show the user the "couldn't understand" state (AppFlow §2.5) and offer manual text input — retrying the same audio through Whisper again rarely produces a better result.

### 4.3 Offline Action Queue vs. Retry

Rider App actions (pickup, deliver) that fail due to network unavailability are **not retried immediately** — they are added to the offline queue (TechSpec.md §6.2) and replayed once connectivity returns. This is distinct from the retry policy above, which applies to connected failures only.

```dart
// How to distinguish: network error vs. server error
try {
  await repository.markDelivered(orderId, ...);
} on SocketException {
  // Network unavailable — add to offline queue
  await actionQueue.enqueue(QueuedAction(orderId: orderId, type: deliver, ...));
} on AppException catch (e) {
  // Server returned an error — apply retry policy
  final policy = getRetryPolicy(e.errorCode);
  // ... handle per policy
}
```

---

## 5. Severity Mapping — Operational Alert Triggers

Errors that trigger operational alerts (Telegram bot per Technical Constitution Part 8):

| Error Code(s) | Trigger Condition | Severity | Alert Recipient |
|---|---|---|---|
| `INTERNAL_ERROR`, `DATABASE_ERROR` | Any single occurrence | P1 | CTO |
| `PAYMENT_VERIFICATION_FAILED` | Any single occurrence | P0 | CTO + Founder |
| `WEBHOOK_SIGNATURE_INVALID` | Any single occurrence | P0 | CTO + Founder (possible attack) |
| `PAYMENT_GATEWAY_ERROR` | 3 occurrences within 5 minutes | P1 | CTO |
| `SMS_PROVIDER_UNAVAILABLE` | 5 occurrences within 10 minutes | P2 | Ops Lead |
| `AI_SERVICE_UNAVAILABLE` | 10 occurrences within 5 minutes | P2 | CTO |
| `UPLOAD_FAILED` | 5 occurrences within 5 minutes | P2 | CTO |
| `ITEMS_UNAVAILABLE` | 20 occurrences within 1 hour | P3 (ops insight) | Ops Lead (vendor stock management issue) |

**P0 system-down alerts** (service-level, not per-error-code): If `GET /api/v1/discovery/vendors` returns non-200 for 3 consecutive UptimeRobot checks (5-minute interval) → P0 alert to all founders.

---

## 6. Frontend — Hindi Error Message Catalog

Per `APIContract.md §10` rationale: the API returns language-neutral error codes; the client translates them to user-facing Hindi messages. This catalog is the single source of truth for those translations.

**Implementation location:** `apps/customer/lib/core/constants/app_strings.dart`, `apps/vendor/lib/core/constants/app_strings.dart`, `apps/rider/lib/core/constants/app_strings.dart`

```dart
// core/constants/error_strings.dart
// Shared across all three Flutter apps via setu_shared package

const Map<String, String> errorMessages = {

  // ── AUTHENTICATION ──────────────────────────────────────────
  'UNAUTHORIZED':
    'कृपया दोबारा लॉगिन करें।',
    // "Please log in again."

  'INVALID_OTP':
    'गलत OTP। कृपया फिर से कोशिश करें।',
    // "Incorrect OTP. Please try again."

  'OTP_EXPIRED':
    'OTP की समय सीमा समाप्त हो गई। कृपया नया OTP मंगवाएं।',
    // "OTP has expired. Please request a new one."

  'RATE_LIMITED':
    'बहुत ज़्यादा कोशिशें हो गईं। कुछ मिनट बाद फिर कोशिश करें।',
    // "Too many attempts. Please try again in a few minutes."

  'INVALID_REFRESH_TOKEN':
    'आपका सत्र समाप्त हो गया। कृपया दोबारा लॉगिन करें।',
    // "Your session has ended. Please log in again."

  'SESSION_EXPIRED':
    'सुरक्षा के लिए आपका सत्र समाप्त हो गया। कृपया दोबारा लॉगिन करें।',
    // "Your session ended for security. Please log in again."

  'UPGRADE_REQUIRED':
    'कृपया SETU का नया वर्शन डाउनलोड करें।',
    // "Please download the new version of SETU."

  // ── VALIDATION ───────────────────────────────────────────────
  'INVALID_PHONE_FORMAT':
    'कृपया सही 10 अंकों का मोबाइल नंबर डालें।',
    // "Please enter a valid 10-digit mobile number."

  'EMPTY_CART':
    'आपका कार्ट खाली है। पहले कुछ जोड़ें।',
    // "Your cart is empty. Please add items first."

  'MULTIPLE_VENDORS':
    'एक ऑर्डर में केवल एक दुकान का सामान हो सकता है।',
    // "An order can only contain items from one shop."

  'MISSING_REQUIRED_FIELD':
    'कुछ जानकारी अधूरी है। कृपया दोबारा जांचें।',
    // "Some information is incomplete. Please check again."

  'INVALID_QUANTITY':
    'मात्रा सही नहीं है। कृपया दोबारा जांचें।',
    // "Quantity is invalid. Please check again."

  'BELOW_MINIMUM_ORDER':
    'न्यूनतम ऑर्डर राशि पूरी नहीं हुई।',
    // "Minimum order value not met."

  'AUDIO_TOO_LARGE':
    'आवाज़ की रिकॉर्डिंग बहुत लंबी है। कृपया दोबारा कोशिश करें।',
    // "Voice recording is too long. Please try again."

  // ── NOT FOUND ────────────────────────────────────────────────
  'VENDOR_NOT_FOUND':
    'यह दुकान अभी उपलब्ध नहीं है।',
    // "This shop is not currently available."

  'ORDER_NOT_FOUND':
    'ऑर्डर नहीं मिला।',
    // "Order not found."

  'ADDRESS_NOT_FOUND':
    'पता नहीं मिला। कृपया दोबारा जोड़ें।',
    // "Address not found. Please add it again."

  // ── CONFLICT / STATE ─────────────────────────────────────────
  'ITEMS_UNAVAILABLE':
    'माफ़ करें, कुछ सामान अभी उपलब्ध नहीं है।',
    // "Sorry, some items are no longer available."
    // Note: AppFlow §3.2 appends the specific product name(s) from the
    // `unavailable_items` response field — this is the base message

  'INVALID_STATE_TRANSITION':
    'यह कार्रवाई अभी संभव नहीं है।',
    // "This action is not possible right now."

  'DUPLICATE_REVIEW':
    'आपने पहले ही इस ऑर्डर की रेटिंग दे दी है।',
    // "You have already rated this order."

  'ORDER_REASSIGNED':
    'यह ऑर्डर किसी और को सौंपा गया है। कृपया एडमिन से बात करें।',
    // "This order has been reassigned. Please contact admin."

  // ── EXTERNAL SERVICES ────────────────────────────────────────
  'SMS_PROVIDER_UNAVAILABLE':
    'OTP भेजने में समस्या हुई। थोड़ी देर बाद फिर कोशिश करें।',
    // "Problem sending OTP. Please try again shortly."

  'PAYMENT_GATEWAY_ERROR':
    'भुगतान शुरू नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।',
    // "Payment could not be initiated. Please try again shortly."

  'TRANSCRIPTION_FAILED':
    'आवाज़ समझ नहीं पाए। फिर कोशिश करें या टाइप करें।',
    // "Couldn't understand the voice. Try again or type instead."

  'AI_SERVICE_UNAVAILABLE':
    'आवाज़ की सुविधा अभी उपलब्ध नहीं है। कृपया टाइप करें।',
    // "Voice feature is currently unavailable. Please type instead."

  'UPLOAD_FAILED':
    'फोटो अपलोड नहीं हो पाई। थोड़ी देर में फिर होगी।',
    // "Photo couldn't be uploaded. It will retry shortly."

  // ── SYSTEM ──────────────────────────────────────────────────
  'INTERNAL_ERROR':
    'कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद फिर कोशिश करें।',
    // "Something went wrong. Please try again shortly."

  // ── NETWORK (client-side, not from server) ───────────────────
  'NETWORK_UNAVAILABLE':
    'इंटरनेट कनेक्शन नहीं है।',
    // "No internet connection."

  'CONNECTION_TIMEOUT':
    'कनेक्शन में देरी हो रही है। फिर कोशिश करें।',
    // "Connection is taking too long. Please try again."

  // ── FALLBACK ─────────────────────────────────────────────────
  'UNKNOWN_ERROR':
    'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।',
    // "Something went wrong. Please try again."
};

// Lookup function — always returns a non-null string
String getErrorMessage(String? errorCode) {
  return errorMessages[errorCode] ?? errorMessages['UNKNOWN_ERROR']!;
}
```

---

## 7. Client-Side Error Handling Patterns

### 7.1 Standard API Error Handler (Flutter)

```dart
// core/errors/app_exception.dart
class AppException implements Exception {
  final String errorCode;
  final String? details;
  final int httpStatus;

  const AppException({
    required this.errorCode,
    required this.httpStatus,
    this.details,
  });

  String get userMessage => getErrorMessage(errorCode);

  @override
  String toString() => 'AppException($errorCode, HTTP $httpStatus)';
}

// core/errors/api_error_handler.dart
AppException parseApiError(http.Response response) {
  try {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return AppException(
      errorCode: body['error'] as String? ?? 'UNKNOWN_ERROR',
      httpStatus: response.statusCode,
      details: body['details']?.toString(),
    );
  } catch (_) {
    return AppException(
      errorCode: 'INTERNAL_ERROR',
      httpStatus: response.statusCode,
    );
  }
}
```

### 7.2 Displaying Errors to Users

```dart
// widgets/error_display.dart

// For non-blocking errors (snackbar style)
void showErrorSnackbar(BuildContext context, AppException error) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        error.userMessage,
        style: AppTextStyles.body,  // 16sp minimum, Noto Sans Devanagari
      ),
      backgroundColor: AppColors.error,
      action: _shouldShowRetry(error.errorCode)
        ? SnackBarAction(label: 'फिर कोशिश करें', onPressed: () { /* retry callback */ })
        : null,
      duration: const Duration(seconds: 4),
    ),
  );
}

// For blocking errors (full-screen)
// Used for: UPGRADE_REQUIRED, UNAUTHORIZED after failed refresh
class ErrorScreen extends StatelessWidget {
  final AppException error;
  final VoidCallback? onRetry;
  // ...
}

bool _shouldShowRetry(String errorCode) {
  return ['INTERNAL_ERROR', 'CONNECTION_TIMEOUT', 'SMS_PROVIDER_UNAVAILABLE',
          'PAYMENT_GATEWAY_ERROR'].contains(errorCode);
}
```

### 7.3 401 Handler — Token Refresh Flow

```dart
// data/repositories/base_repository.dart

Future<T> authenticatedRequest<T>(Future<T> Function() request) async {
  try {
    return await request();
  } on AppException catch (e) {
    if (e.httpStatus == 401) {
      // Attempt silent token refresh
      final refreshed = await authRepository.refreshToken();
      if (refreshed) {
        // Retry the original request once with the new token
        return await request();
      } else {
        // Refresh failed — session truly ended, return to login
        ref.read(authProvider.notifier).logout();
        throw AppException(errorCode: 'UNAUTHORIZED', httpStatus: 401);
      }
    }
    rethrow;
  }
}
```

### 7.4 Offline Error Handling (Rider App)

```dart
// When a network call fails in the Rider App:
try {
  await riderRepository.markPickedUp(orderId);
} on SocketException catch (_) {
  // Queue for offline sync — NOT an error from the user's perspective
  await actionQueue.enqueue(
    QueuedAction(orderId: orderId, type: QueuedActionType.pickup, ...)
  );
  // Show "saved, will sync" state — NOT an error message
  ref.read(syncStatusProvider.notifier).incrementPending();
} on AppException catch (e) {
  // Server returned a real error (connected but failed)
  showErrorSnackbar(context, e);
}
```

---

## 8. Error Handling in Edge Functions

### 8.1 Standard Response Builder

```typescript
// core/response.ts — shared across all Edge Functions

interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, unknown>
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: ErrorResponse = { error: code, message, ...(details && { details }) }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function successResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Usage:
// return errorResponse('ITEMS_UNAVAILABLE', 'One or more items are unavailable', 409,
//   { unavailable_items: [{ product_id: '...', name: 'Basmati Rice' }] })
```

### 8.2 Global Error Boundary (Edge Function wrapper)

```typescript
// core/handler.ts
export function withErrorBoundary(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const start = Date.now()
    try {
      return await handler(req)
    } catch (error) {
      const duration = Date.now() - start
      // Report to Sentry
      await Sentry.captureException(error)
      // Log structured error
      log('ERROR', 'unknown-service', 'unhandled_exception', {
        duration_ms: duration,
        error: error as Error,
        error_code: 'INTERNAL_ERROR',
      })
      // Never expose internals to client
      return errorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        500
      )
    }
  }
}

// Usage in index.ts:
serve(withErrorBoundary(async (req) => {
  // ... route handling
}))
```

---

## 9. AI Coding Assistant Self-Verification Checklist

Before presenting any code that includes error handling as complete, verify:

**Backend (Edge Functions):**
- [ ] Every handler is wrapped in `withErrorBoundary` or has an equivalent try/catch
- [ ] All client-facing errors use the `errorResponse()` helper — no raw `new Response()` with arbitrary error bodies
- [ ] Error codes used in `errorResponse()` calls exist in the catalog (Section 3) — if a new code is needed, add it to Section 3 in the same PR
- [ ] No PII in log calls — phone numbers, addresses, or full payment IDs never appear in `details` objects
- [ ] Monetary amounts in error details are in paise (integer), never rupees (float)
- [ ] External service calls are wrapped in try/catch with `EXTERNAL_SERVICE` category error codes, not allowed to propagate raw

**Frontend (Flutter):**
- [ ] Every `repository` call is inside a try/catch that produces an `AppException`
- [ ] `AppException.userMessage` is used for all user-facing error display — no inline Hindi strings in widget files
- [ ] `401` responses trigger the token refresh flow (Section 7.3), not just a "show error" response
- [ ] `SocketException` in the Rider App routes to the offline queue (Section 7.4), not to the error display
- [ ] Retry is offered only for error codes where `_shouldShowRetry()` returns `true`

---

*End of ErrorHandlingGuide.md — v1.0*
