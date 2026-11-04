const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('vf_token');
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch { throw new Error('Cannot reach the server. Is the backend running?'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Fetch a protected file (e.g. a problem image) as an object URL; the token cannot be sent by a plain <img>.
export async function apiBlobUrl(path) {
  const token = localStorage.getItem('vf_token');
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Image not available');
  return URL.createObjectURL(await res.blob());
}
