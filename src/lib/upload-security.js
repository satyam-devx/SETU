// SETU — client-side upload validation.
// Client validation improves UX and reduces accidental/malicious payloads,
// but Storage RLS/server-side validation remains the security boundary.

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
]);

const EXT_BY_TYPE = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'application/pdf': ['pdf'],
};

function extensionOf(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

export function validateUpload(file, {
  kind = 'image',
  maxBytes = 5 * 1024 * 1024,
  allowedTypes,
  allowedExtensions,
} = {}) {
  if (!(file instanceof File)) return { ok: false, error: 'A valid file is required.' };
  if (!file.size || file.size > maxBytes) {
    return { ok: false, error: `File must be smaller than ${(maxBytes / 1024 / 1024).toFixed(1)} MB.` };
  }

  const types = allowedTypes || (kind === 'document' ? DOCUMENT_TYPES : IMAGE_TYPES);
  if (!types.has(file.type)) return { ok: false, error: 'Unsupported file type.' };

  const ext = extensionOf(file.name);
  const extensions = allowedExtensions || EXT_BY_TYPE[file.type] || [];
  if (!extensions.includes(ext)) return { ok: false, error: 'File extension does not match its MIME type.' };

  return { ok: true, mimeType: file.type, extension: ext, size: file.size };
}

export async function validateDocumentSignature(file, options = {}) {
  const validation = validateUpload(file, { ...options, kind: 'document' });
  if (!validation.ok) return validation;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  if (file.type === 'application/pdf' && !hex.startsWith('255044462d')) return { ok: false, error: 'PDF contents do not match the declared type.' };
  // Forward the caller's maxBytes (e.g. VendorDocuments' 10 MB KYC limit) —
  // without this, a file that already passed the check above at a raised
  // limit was silently re-checked against validateImageSignature's own
  // 5 MB default and wrongly rejected.
  if (file.type.startsWith('image/')) return validateImageSignature(file, { maxBytes: options.maxBytes });
  return validation;
}

export async function validateImageSignature(file, options = {}) {
  const validation = validateUpload(file, options);
  if (!validation.ok) return validation;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const signatures = {
    'image/jpeg': hex.startsWith('ffd8ff'),
    'image/png': hex.startsWith('89504e470d0a1a0a'),
    'image/webp': hex.startsWith('52494646') && hex.slice(16, 24) === '57454250',
    'image/avif': hex.includes('6674797061766966'),
  };
  if (!signatures[file.type]) return { ok: false, error: 'Image contents do not match the declared type.' };
  return validation;
}
