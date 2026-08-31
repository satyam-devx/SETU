# SETU — TechSpec.md

**Document Class:** Engineering · Evolving (updated when stack changes or conventions are refined)
**Owner:** CTO / Lead Engineers (Flutter + Backend)
**Audience:** All engineers, new hires (setup reference), AI coding assistants
**Status:** v1.0 — Phase 1 Stack
**Depends On:** SystemArchitecture.md, Schema.md

---

## 0. How to Use This Document

Where `SystemArchitecture.md` answers "what services exist and how do they communicate," this document answers "exactly how each service is built." It specifies pinned library versions, folder structures, coding conventions, and local setup steps for every part of the SETU codebase.

**AI coding assistants** must load this document alongside `Schema.md` and `APIContract.md` before generating code for any app layer. The conventions here are not suggestions — they are the standards all generated code must conform to, per `AIDevelopmentRules.md`.

---

## 1. Technology Stack — Pinned Versions

All versions are pinned. Updates require: (1) a brief rationale note in this document's changelog, (2) testing across the device matrix (Execution Bible §T9), and (3) CTO sign-off. Never update a dependency mid-sprint.

### 1.1 Flutter Apps (Customer, Vendor, Rider)

| Package | Version | Purpose |
|---|---|---|
| Flutter SDK | `3.22.x` | UI framework |
| Dart SDK | `3.4.x` | Language (ships with Flutter) |
| `supabase_flutter` | `2.5.x` | Supabase client (auth, DB, realtime, storage) |
| `riverpod` | `2.5.x` | State management |
| `flutter_riverpod` | `2.5.x` | Riverpod Flutter bindings |
| `go_router` | `14.x` | Declarative navigation |
| `hive_flutter` | `1.1.x` | Local offline storage (offline queue, cart) |
| `hive` | `2.2.x` | Hive core |
| `mapbox_maps_flutter` | `2.3.x` | Maps + offline tiles (Rider App) |
| `geolocator` | `12.x` | GPS location access |
| `image_picker` | `1.1.x` | Camera/gallery photo picker |
| `flutter_secure_storage` | `9.x` | Secure token storage |
| `http` | `1.2.x` | HTTP client (for non-Supabase calls: AI service, Whisper) |
| `razorpay_flutter` | `1.3.x` | Razorpay payment sheet |
| `firebase_messaging` | `15.x` | FCM push notifications |
| `firebase_core` | `3.x` | Firebase initialization |
| `sentry_flutter` | `8.x` | Crash monitoring |
| `cached_network_image` | `3.4.x` | Image loading + caching |
| `intl` | `0.19.x` | Date/number formatting |
| `permission_handler` | `11.x` | Runtime permissions (location, camera, mic) |
| `connectivity_plus` | `6.x` | Network status (offline detection) |
| `flutter_local_notifications` | `17.x` | Local notification display from FCM |
| `path_provider` | `2.1.x` | File system paths (offline data directory) |

**Minimum `compileSdkVersion`:** 34 (Android 14)
**Minimum `minSdkVersion`:** 21 (Android 5.0 — covers 99.9%+ of Bihar's active Android devices)
**Target `targetSdkVersion`:** 34

### 1.2 Admin Dashboard (Next.js)

| Package | Version | Purpose |
|---|---|---|
| Next.js | `14.x` (App Router) | Web framework |
| TypeScript | `5.x` | Language |
| `@supabase/supabase-js` | `2.x` | Supabase client |
| `@supabase/ssr` | `0.4.x` | SSR auth helpers |
| Tailwind CSS | `3.x` | Styling |
| `@tanstack/react-table` | `8.x` | Orders/vendor table UI |
| `recharts` | `2.x` | Analytics charts |
| `sentry/nextjs` | `8.x` | Error monitoring |

### 1.3 Supabase Backend

| Component | Version/Config |
|---|---|
| PostgreSQL (via Supabase) | `15.x` |
| Supabase Edge Functions runtime | Deno `1.44.x` |
| Supabase Realtime | Managed (Supabase Cloud) |
| Supabase Storage | Managed |
| `pg_trgm` extension | Enabled (full-text search) |
| `pg_cron` extension | Enabled (scheduled tasks) |
| `uuid-ossp` extension | Enabled (UUID generation) |

---

## 2. Project Structure

### 2.1 Repository Layout (Monorepo)

```
setu/
├── apps/
│   ├── customer/          # Flutter customer app
│   ├── vendor/            # Flutter vendor app
│   ├── rider/             # Flutter rider app
│   └── admin/             # Next.js admin dashboard
├── packages/
│   └── setu_shared/       # Shared Dart package: models, constants, utils
│                          # (not a full design-system package in MVP — just
│                          #  shared types and utilities)
├── supabase/
│   ├── migrations/        # SQL migration files (NNNN_description.sql)
│   ├── functions/         # Edge Function source files
│   │   ├── order-service/
│   │   │   └── index.ts
│   │   ├── vendor-service/
│   │   │   └── index.ts
│   │   ├── rider-service/
│   │   │   └── index.ts
│   │   ├── payment-service/
│   │   │   └── index.ts
│   │   └── notification-service/
│   │       └── index.ts
│   ├── seed/              # Seed SQL (villages, categories, test data)
│   └── config.toml        # Supabase project config
├── docs/                  # This documentation system lives here
│   ├── Constitution.md
│   ├── PRD.md
│   ├── Schema.md
│   └── ...
├── .github/
│   └── workflows/
│       └── deploy.yml     # CI/CD pipeline (Technical Constitution Part 8)
├── melos.yaml             # Monorepo tooling (Melos for Flutter workspaces)
└── README.md
```

### 2.2 Flutter App Structure (per app)

All three Flutter apps (`customer`, `vendor`, `rider`) follow the **same folder structure** — reducing cognitive overhead when working across apps. Only the screens and domain-specific logic differ.

```
apps/customer/
├── lib/
│   ├── main.dart                     # Entry point — Supabase init, Firebase init,
│   │                                 # ProviderScope, GoRouter
│   ├── core/
│   │   ├── constants/
│   │   │   ├── api_paths.dart        # All API endpoint path strings (DRY)
│   │   │   └── app_strings.dart      # All Hindi UI strings (DRY, no inline
│   │   │                             # strings in widget files)
│   │   ├── theme/
│   │   │   ├── app_theme.dart        # ThemeData: Designs.md tokens → Flutter
│   │   │   ├── app_colors.dart       # Color constants from Designs.md §1.1
│   │   │   └── app_text_styles.dart  # TextStyle constants from Designs.md §1.2
│   │   ├── errors/
│   │   │   └── app_exception.dart    # Typed exception hierarchy (→ ErrorHandlingGuide.md)
│   │   └── utils/
│   │       ├── currency.dart         # paise → ₹ formatting (ADR-002 enforcement)
│   │       └── date_format.dart      # Consistent timestamp formatting
│   ├── data/
│   │   ├── models/                   # Dart data classes matching APIContract response shapes
│   │   │   ├── order.dart
│   │   │   ├── vendor.dart
│   │   │   ├── product.dart
│   │   │   └── ...
│   │   ├── repositories/             # Data access layer — one per domain
│   │   │   ├── order_repository.dart
│   │   │   ├── vendor_repository.dart
│   │   │   └── auth_repository.dart
│   │   └── offline/
│   │       └── action_queue.dart     # Hive-backed offline action queue
│   │                                 # (used by Rider App primarily)
│   ├── providers/                    # Riverpod providers — one per domain
│   │   ├── auth_provider.dart
│   │   ├── cart_provider.dart        # Cart state (client-side only, per APIContract §5.1 note)
│   │   ├── order_provider.dart
│   │   └── ...
│   ├── screens/                      # One file per screen
│   │   ├── auth/
│   │   │   ├── phone_entry_screen.dart
│   │   │   └── otp_verify_screen.dart
│   │   ├── onboarding/
│   │   │   └── village_selection_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── vendor/
│   │   │   ├── vendor_list_screen.dart
│   │   │   └── vendor_detail_screen.dart
│   │   ├── cart/
│   │   │   └── cart_screen.dart
│   │   ├── checkout/
│   │   │   └── checkout_screen.dart
│   │   ├── order/
│   │   │   ├── order_confirmation_screen.dart
│   │   │   └── order_tracking_screen.dart
│   │   └── profile/
│   │       └── profile_screen.dart
│   ├── widgets/                      # Reusable components from Designs.md §2
│   │   ├── vendor_card.dart
│   │   ├── product_card.dart
│   │   ├── order_status_stepper.dart
│   │   ├── primary_button.dart
│   │   ├── secondary_button.dart
│   │   └── ...
│   └── router.dart                   # GoRouter configuration
├── test/
│   ├── unit/
│   │   ├── currency_test.dart        # Core utils always get unit tests
│   │   └── cart_provider_test.dart
│   └── integration/                  # Integration tests per TestingRequirements.md
├── android/
├── ios/                              # Present but not built in MVP
├── pubspec.yaml
└── analysis_options.yaml             # Linting rules (Section 5)
```

### 2.3 Supabase Edge Function Structure

Each Edge Function service (`order-service`, etc.) is a single `index.ts` that acts as an internal router — the URL path dispatches to handler functions within the same file. This keeps each service self-contained while Supabase deploys each as a single function.

```typescript
// supabase/functions/order-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { handleCreateOrder } from "./handlers/create_order.ts"
import { handleUpdateStatus } from "./handlers/update_status.ts"
import { handleCancelOrder } from "./handlers/cancel_order.ts"

serve(async (req: Request) => {
  const url = new URL(req.url)
  const path = url.pathname

  // Extract JWT and create scoped client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  )

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 })

  if (req.method === "POST" && path.endsWith("/orders")) {
    return handleCreateOrder(req, supabase)
  }
  if (req.method === "POST" && path.match(/\/orders\/[^/]+\/cancel/)) {
    return handleCancelOrder(req, supabase)
  }
  // ... other routes

  return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 })
})
```

Each handler lives in a `handlers/` subfolder of its service directory — keeping the router file readable and handlers individually testable.

---

## 3. Coding Conventions

### 3.1 Dart / Flutter Conventions

**Naming:**

| Entity | Convention | Example |
|---|---|---|
| Files | `snake_case.dart` | `order_repository.dart` |
| Classes | `PascalCase` | `OrderRepository` |
| Variables | `camelCase` | `orderId` |
| Constants | `camelCase` (const) | `const apiBasePath = '/api/v1'` |
| Providers (Riverpod) | `camelCase` + `Provider` suffix | `orderListProvider` |

**Key rules:**

- **No inline strings in widget files.** All user-facing text comes from `core/constants/app_strings.dart`. This is the single most important rule for Maithili support later (Constitution III) — adding Maithili requires only a new strings file, zero widget changes.
- **No raw monetary integers in UI.** Always use `CurrencyUtils.formatRupees(int paise)` from `core/utils/currency.dart` — never write `₹${price/100}` inline in a widget. This enforces ADR-002 uniformly and is checkable by `AIDevelopmentRules.md`.
- **No `BuildContext` across async gaps** without `mounted` check. Required by Flutter's design and especially important for offline-sync flows where actions complete after screen navigation.
- **Repository pattern strictly:** Screens → Providers → Repositories → Supabase client. Screens never call Supabase directly. This is the boundary that makes swapping data sources (e.g., offline cache vs live API) manageable.
- **One Riverpod provider per domain entity.** A `orderListProvider` and an `orderDetailProvider(orderId)` are fine; a monolithic `appStateProvider` is not.

**State management (Riverpod):**

```dart
// CORRECT — typed AsyncNotifier with explicit state
class OrderListNotifier extends AsyncNotifier<List<Order>> {
  @override
  Future<List<Order>> build() async {
    return ref.watch(orderRepositoryProvider).getOrders();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() =>
      ref.read(orderRepositoryProvider).getOrders()
    );
  }
}

// INCORRECT — avoid ChangeNotifier or setState for shared state
class OrderManager extends ChangeNotifier { ... }  // Don't do this
```

### 3.2 TypeScript / Edge Function Conventions

**Naming:** Same `camelCase` / `PascalCase` conventions as Dart. Files use `snake_case.ts`.

**Key rules:**

- **Always validate JWT claims before processing.** Every handler's first operation is extracting and validating the caller's user ID and role from the JWT — never trust client-supplied user IDs in request bodies.
- **All monetary values in paise as integers.** No `number` division or multiplication that introduces floating point in monetary calculations. Use integer arithmetic only.
- **Typed request/response objects.** No untyped `any`. Each handler defines explicit request and response types matching `APIContract.md` schemas.
- **Always check idempotency key before processing mutation endpoints** (POST /orders per APIContract §5.1 note).

```typescript
// CORRECT — typed, validated handler
interface CreateOrderRequest {
  vendor_id: string
  delivery_address_id: string
  items: Array<{ product_id: string; quantity: number }>
  payment_method: 'cod' | 'upi'
  special_instructions?: string
}

export async function handleCreateOrder(
  req: Request,
  supabase: SupabaseClient,
  userId: string  // extracted from validated JWT, not from body
): Promise<Response> {
  const body: CreateOrderRequest = await req.json()
  // ... validation, then business logic
}

// INCORRECT — trusting client-supplied userId
async function badHandler(req: Request) {
  const { userId, vendor_id } = await req.json()  // ← never trust this
  // ...
}
```

### 3.3 SQL / Migration Conventions

Per Schema.md §13, restated here for engineers:

- Migrations: `supabase/migrations/NNNN_description.sql` — sequential integers, never gaps or reuse
- Never edit a merged migration; write a new one that `ALTER`s
- Every new table must have RLS enabled (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`) in the same migration that creates it — never create a table without RLS, even temporarily
- Monetary columns: `integer` only, named with context that makes their paise nature obvious (e.g., column comments in SQL)

```sql
-- CORRECT migration example
-- 0003_add_delivery_fee_config.sql

ALTER TABLE blocks ADD COLUMN delivery_fee_paise integer NOT NULL DEFAULT 1000;
COMMENT ON COLUMN blocks.delivery_fee_paise IS 'Flat delivery fee for this block in paise (₹1 = 100 paise)';
```

---

## 4. Local Development Setup

### 4.1 Prerequisites

```bash
# Required tools — install in this order
1. Flutter 3.22.x        https://docs.flutter.dev/get-started/install
2. Supabase CLI          brew install supabase/tap/supabase
3. Node.js 20.x LTS      https://nodejs.org (for admin Next.js app)
4. Melos                 dart pub global activate melos
5. Android Studio        For Android emulator and SDK management
   - Install Android SDK Build-Tools 34
   - Install Android Emulator with API 33+ image
```

### 4.2 Environment Setup

```bash
# 1. Clone the repository
git clone https://github.com/setu-app/setu.git
cd setu

# 2. Copy environment template and fill in values
cp .env.example .env.local
# Open .env.local and fill in values per EnvironmentVariables.md

# 3. Install dependencies across all packages
melos bootstrap

# 4. Start local Supabase
supabase start
# This starts a local PostgreSQL instance + all Supabase services
# Local Studio UI: http://localhost:54323

# 5. Run migrations on local DB
supabase db push

# 6. Seed local data (villages, categories, test vendors)
supabase db reset --seed  # or: psql -f supabase/seed/seed.sql

# 7. Run a Flutter app
cd apps/customer
flutter run  # defaults to connected device/emulator

# 8. Run admin dashboard
cd apps/admin
npm install
npm run dev  # http://localhost:3000
```

### 4.3 Testing Against Local Supabase

When running `flutter run` locally, the app points to `http://localhost:54321` (local Supabase URL) — configured via `.env.local`. **Never point local development to the production Supabase URL** — this is enforced by `SecurityRequirements.md` and the environment variable separation in `EnvironmentVariables.md`.

### 4.4 Running Edge Functions Locally

```bash
# Start Edge Functions server locally (hot-reloads on file change)
supabase functions serve order-service --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/order-service/orders \
  -H "Authorization: Bearer <local-test-JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "vendor_id": "...", "items": [...], "payment_method": "cod" }'
```

---

## 5. Linting & Formatting Standards

### 5.1 Flutter (`analysis_options.yaml`)

```yaml
# apps/customer/analysis_options.yaml (identical across all Flutter apps)
include: package:flutter_lints/flutter.yaml

linter:
  rules:
    # Enforce const where possible
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
    # No direct string literals in widgets (enforce app_strings.dart usage
    # — this is a convention rule, not auto-enforced by lint, but encouraged)
    avoid_print: true           # Use logging service, not print
    always_use_package_imports: true   # No relative imports across packages
    prefer_single_quotes: true
    unawaited_futures: true     # Always await async calls

analyzer:
  errors:
    missing_required_param: error
    dead_code: warning
    unused_import: error
```

### 5.2 TypeScript (`tsconfig.json` for Edge Functions)

```json
{
  "compilerOptions": {
    "lib": ["esnext", "dom"],
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "node",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`strict: true` is non-negotiable — it enforces `noImplicitAny`, `strictNullChecks`, and `strictFunctionTypes`, eliminating entire classes of runtime errors in Edge Functions.

### 5.3 CI Lint Gate

CI pipeline (Technical Constitution Part 8) runs on every PR:
```
flutter analyze     # Zero warnings, zero errors required
dart format --check # Zero formatting deviations required
deno lint           # Zero issues on Edge Functions
```
A PR that fails any of these gates cannot be merged, regardless of test status — linting failures indicate potential code quality issues that test coverage may not catch.

---

## 6. Key Architectural Patterns (Flutter)

### 6.1 Data Flow: Screen → Provider → Repository → Supabase

```dart
// screens/home/home_screen.dart
class HomeScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // All data via providers — screen has no direct Supabase calls
    final vendorsAsync = ref.watch(vendorListProvider);
    return vendorsAsync.when(
      data: (vendors) => VendorListView(vendors: vendors),
      loading: () => const SETULoadingIndicator(),
      error: (e, _) => ErrorView(exception: e as AppException),
    );
  }
}

// providers/vendor_provider.dart
final vendorListProvider = AsyncNotifierProvider<VendorListNotifier, List<Vendor>>(
  VendorListNotifier.new
);

class VendorListNotifier extends AsyncNotifier<List<Vendor>> {
  @override
  Future<List<Vendor>> build() =>
    ref.watch(vendorRepositoryProvider).getVendorsNearby(
      villageId: ref.watch(currentUserProvider).villageId!,
    );
}

// data/repositories/vendor_repository.dart
class VendorRepository {
  final SupabaseClient _client;
  VendorRepository(this._client);

  Future<List<Vendor>> getVendorsNearby({ required String villageId }) async {
    final response = await _client
      .from('vendors')
      .select('id, business_name, category_id, rating, is_open, cover_image_url')
      .eq('village_id', villageId)
      .eq('is_verified', true)
      .order('rating', ascending: false);
    return (response as List).map((e) => Vendor.fromJson(e)).toList();
  }
}
```

### 6.2 Offline Action Queue (Rider App)

The offline queue is the most critical piece of Rider App infrastructure (Constitution IV). It must persist across app restarts (so a restart mid-offline doesn't lose actions) and replay idempotently (so reconnecting twice doesn't double-submit).

```dart
// data/offline/action_queue.dart
enum QueuedActionType { pickup, deliver }

@HiveType(typeId: 0)
class QueuedAction extends HiveObject {
  @HiveField(0) final String orderId;
  @HiveField(1) final QueuedActionType type;
  @HiveField(2) final Map<String, dynamic> payload; // cod_amount, photo path, etc.
  @HiveField(3) final DateTime queuedAt;
  @HiveField(4) bool isSynced = false;

  QueuedAction({
    required this.orderId,
    required this.type,
    required this.payload,
    required this.queuedAt,
  });
}

class ActionQueue {
  final Box<QueuedAction> _box;

  Future<void> enqueue(QueuedAction action) => _box.add(action);

  Future<void> syncPending(RiderRepository repository) async {
    final pending = _box.values.where((a) => !a.isSynced).toList()
      ..sort((a, b) => a.queuedAt.compareTo(b.queuedAt)); // FIFO

    for (final action in pending) {
      try {
        await repository.syncAction(action);  // idempotent API calls per APIContract
        action.isSynced = true;
        await action.save();
      } catch (e) {
        // Stop on first failure — maintain ordering, retry whole queue next time
        break;
      }
    }
  }
}
```

### 6.3 Currency Formatting (ADR-002 Enforcement)

```dart
// core/utils/currency.dart
class CurrencyUtils {
  /// Converts paise (integer) to formatted rupee string
  /// 2500 → "₹25"
  /// 17050 → "₹170.50"
  /// 0 → "₹0"
  static String formatRupees(int paise) {
    if (paise % 100 == 0) {
      return '₹${paise ~/ 100}';
    }
    final rupees = paise / 100;
    return '₹${rupees.toStringAsFixed(2)}';
  }

  /// NEVER use this for calculations — only for display
  /// All calculations must remain in paise as integers
  static double toRupees(int paise) => paise / 100;
}
```

The docstring on `toRupees` is intentional — `AIDevelopmentRules.md` will cite this method as an example of the display-only conversion that must never be used in arithmetic.

---

## 7. Dependency Management Policy

**Adding a new Flutter package:**
1. Confirm the package has >1,000 pub.dev likes OR is from a verified/official publisher (Supabase, Google, etc.)
2. Check `pub.dev` for last publish date — packages not updated in >18 months require CTO review
3. Check for null-safety support (all packages must be null-safe — no `!` workarounds)
4. Add to `pubspec.yaml` with a caret version constraint (`^x.y.z`) — allows patch updates but not minor/major
5. Pin the resolved version in `pubspec.lock` — commit `pubspec.lock` to the repository

**Never add a package that:**
- Does not support null safety
- Requires permissions beyond what SETU needs (e.g., a "convenience" package that requests contacts/calendar access)
- Has fewer than 10 GitHub stars AND is not from a verified publisher (quality signal)
- Duplicates functionality already provided by an existing dependency

---

## 8. Version Control Conventions

**Branch strategy (simplified Git Flow for MVP-scale team):**

| Branch | Purpose | Who pushes |
|---|---|---|
| `main` | Source of truth for staging deploys | Only via PR |
| `dev/<name>/<feature>` | Feature branches | Individual engineers |
| `fix/<name>/<issue>` | Bug fix branches | Individual engineers |

**Commit message format:** `<type>(<scope>): <summary>`

Types: `feat` | `fix` | `docs` | `refactor` | `test` | `chore`
Scope: `customer` | `vendor` | `rider` | `admin` | `supabase` | `schema` | `ci`

Examples:
```
feat(customer): add voice search to home screen
fix(rider): resolve offline queue FIFO ordering bug
docs(schema): add cash_reconciliation table discussion note
chore(ci): pin Flutter SDK version to 3.22.2
```

**PR requirements (enforced in `.github/PULL_REQUEST_TEMPLATE.md`):**
- [ ] `flutter analyze` passes (zero issues)
- [ ] Unit tests pass
- [ ] `APIContract.md` updated if a new endpoint was added
- [ ] `Schema.md` updated (or migration added) if schema changed
- [ ] `AIDevelopmentRules.md` self-verification checklist run (if AI-assisted)
- [ ] Tested on at least one physical device (not emulator-only)

---

## 9. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06 | Initial TechSpec — Phase 1 stack |

*New entries appended here when stack versions are updated or conventions are added/revised.*

---

*End of TechSpec.md — v1.0*
