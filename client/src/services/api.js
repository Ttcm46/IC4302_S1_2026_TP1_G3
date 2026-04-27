import axios from 'axios';
import { clearSession } from './session';

// API en frontend para manejar autenticación y refresco de tokens. 
// Hay que conectar al backend para obtener datos de cursos, usuarios, etc.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Request interceptor — el token de autenticación viaja como cookie httpOnly,
// el navegador la adjunta automáticamente gracias a withCredentials: true.
// No se envía header Authorization manual para no exponer el token en JS.
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
