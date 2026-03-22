/** Base origin for API (without trailing /api) — used for uploaded file URLs. */
export function getApiOrigin() {
  const u = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const trimmed = u.replace(/\/api\/?$/, '');
  return trimmed || 'http://localhost:5000';
}

export function resolveUploadedFileUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
