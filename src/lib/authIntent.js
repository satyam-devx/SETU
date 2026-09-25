// SETU — authentication role intent
// The role selected on RoleSelect is transient UI intent, not authorization.
// It survives the Google OAuth browser round-trip via sessionStorage.
// Server-side profile/RLS rules remain the source of truth for permissions.

const KEY = 'setu_auth_role_intent';
const TTL_MS = 15 * 60 * 1000;

const ALLOWED_ROLES = new Set(['customer', 'vendor', 'rider', 'seva_provider']);

export function setAuthRoleIntent(role) {
  if (!ALLOWED_ROLES.has(role)) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      role,
      createdAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function getAuthRoleIntent() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!ALLOWED_ROLES.has(parsed?.role)) return null;
    if (!Number.isFinite(parsed?.createdAt) || Date.now() - parsed.createdAt > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed.role;
  } catch {
    return null;
  }
}

export function consumeAuthRoleIntent() {
  const role = getAuthRoleIntent();
  try { sessionStorage.removeItem(KEY); } catch {}
  return role;
}

export function clearAuthRoleIntent() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

export function getRoleEntryPath(role) {
  return {
    customer: '/onboarding/register',
    vendor: '/onboarding/vendor',
    rider: '/onboarding/rider',
    seva_provider: '/onboarding/seva',
  }[role] || '/onboarding/register';
}

export function getRolePortalPath(role) {
  return {
    customer: '/customer',
    vendor: '/vendor',
    rider: '/rider',
    seva_provider: '/seva',
  }[role] || '/role-error';
}
