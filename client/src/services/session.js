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
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function bootstrapFromCookies() {
  // Intentar restaurar desde sessionStorage primero (sesión sin rememberMe)
  const rawSession = sessionStorage.getItem('sessionUser');
  const savedToken = sessionStorage.getItem('sessionToken');
  if (rawSession) {
    try {
      user = mapRawUser(JSON.parse(rawSession));
      accessToken = savedToken || '__cookie__';
      return;
    } catch {
      sessionStorage.removeItem('sessionUser');
      sessionStorage.removeItem('sessionToken');
    }
  }

  // Intentar restaurar desde localStorage (sesión con rememberMe)
  const rawSessionLS = localStorage.getItem('sessionUser');
  const savedTokenLS = localStorage.getItem('sessionToken');
  if (rawSessionLS) {
    try {
      user = mapRawUser(JSON.parse(rawSessionLS));
      accessToken = savedTokenLS || '__cookie__';
      return;
    } catch {
      localStorage.removeItem('sessionUser');
      localStorage.removeItem('sessionToken');
    }
  }
  
  // Fallback: intentar desde cookies (por compatibilidad con backend)
  const raw = readCookie('sessionUser');
  if (raw) {
    try {
      user = mapRawUser(JSON.parse(raw));
      accessToken = '__cookie__';
      sessionStorage.setItem('sessionUser', JSON.stringify(user));
    } catch {
      // Cookie inválida, ignorar
    }
  }
}

bootstrapFromCookies();

export function setSession(data = {}) {
  // El token de acceso ahora vive en la cookie httpOnly enviada por el backend.
  // No lo almacenamos en JS para proteger contra XSS.
  accessToken = '__cookie__';
  refreshToken = data.refreshToken || '';
  user = data.user || null;

  // Si rememberMe es true, guardar el usuario en localStorage (persiste tras cerrar el navegador).
  // Si no, guardar en sessionStorage (se borra al cerrar la pestaña).
  // El token NO se guarda aquí; viene y va como cookie httpOnly.
  const storage = data.rememberMe ? localStorage : sessionStorage;
  if (user) {
    storage.setItem('sessionUser', JSON.stringify(user));
  }
}

export function clearSession() {
  accessToken = '';
  refreshToken = '';
  user = null;
  sessionStorage.removeItem('sessionUser');
  sessionStorage.removeItem('sessionToken');
  localStorage.removeItem('sessionUser');
  localStorage.removeItem('sessionToken');
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function getSessionUser() {
  // [FRONTEND-ONLY] Leer desde sessionStorage para persistir sesión entre rutas
  const raw = sessionStorage.getItem('sessionUser');
  if (raw) {
    try {
      const mapped = mapRawUser(JSON.parse(raw));
      user = mapped;
      accessToken = '__cookie__';
      return mapped;
    } catch {
      sessionStorage.removeItem('sessionUser');
      return null;
    }
  }
  return user;
}

export function isAuthenticated() {
  // [FRONTEND-ONLY] Sincronizar desde cookie cada vez que se verifica autenticación
  const sessionUser = getSessionUser();
  return Boolean(sessionUser);
}
