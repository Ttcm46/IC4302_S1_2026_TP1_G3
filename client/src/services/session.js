let accessToken = '';
let refreshToken = '';
let user = null;

function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

// Bootstrap session from cookies set by the backend on login.
// `accessToken` is httpOnly (sent automatically by browser), so we only
// need to read the readable `sessionUser` cookie to restore the user object.
function mapRawUser(raw) {
  if (!raw) return null;
  // If already mapped (has fullName), return as-is
  if (raw.fullName) return raw;
  return {
    id: raw.id,
    username: raw.username,
    fullName: raw.name || raw.fullName || raw.username,
    dateOfBirth: raw.dob || raw.dateOfBirth || '',
    avatar: raw.picPath || raw.avatar || '',
    email: raw.correo || raw.email || '',
    role: raw.typeofuser || raw.role || 'student'
  };
}

function writeCookie(name, value, maxAgeMs) {
  const maxAge = Math.floor(maxAgeMs / 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function bootstrapFromCookies() {
  const raw = readCookie('sessionUser');
  if (raw) {
    try {
      user = mapRawUser(JSON.parse(raw));
      // Mark as authenticated — the actual token travels as an httpOnly cookie
      accessToken = '__cookie__';
    } catch {
      // malformed cookie; leave session empty
    }
  }
}

bootstrapFromCookies();

export function setSession(data = {}) {
  accessToken = data.accessToken || '__cookie__';
  refreshToken = data.refreshToken || '';
  user = data.user || null;
  // Keep the sessionUser cookie in sync with the mapped user
  if (user) {
    writeCookie('sessionUser', JSON.stringify(user), 3600000);
  }
}

export function clearSession() {
  accessToken = '';
  refreshToken = '';
  user = null;
  document.cookie = 'sessionUser=; path=/; max-age=0; SameSite=Strict';
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function getSessionUser() {
  return user;
}

export function isAuthenticated() {
  // Authenticated if we have a user object; token travels as httpOnly cookie
  return Boolean(user);
}
