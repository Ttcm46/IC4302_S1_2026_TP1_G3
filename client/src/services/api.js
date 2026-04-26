import axios from 'axios';
import { clearSession } from './session';

/**
 * FALTANTE DE SEGURIDAD - ALMACENAMIENTO DE TOKENS (línea 16):
 * 
 * PROBLEMA: Los tokens se guardan en localStorage en lugar de httpOnly cookies.
 * localStorage es accesible a cualquier script JavaScript, vulnerable a XSS.
 * Requisito: Tokens (access y refresh) deben almacenarse en httpOnly cookies
 * con flags Secure (solo HTTPS) y SameSite=Strict (solo same-site requests).
 * TODO: Backend envía tokens en Set-Cookie con HttpOnly, Secure, SameSite=Strict.
 * Frontend lee cookies automáticamente en requests, no accede desde localStorage.
 */

// API en frontend para manejar autenticación y refresco de tokens. 
// Hay que conectar al backend para obtener datos de cursos, usuarios, etc.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Request interceptor — auth is handled by the httpOnly `accessToken` cookie
// sent automatically by the browser with every request (withCredentials: true).
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
