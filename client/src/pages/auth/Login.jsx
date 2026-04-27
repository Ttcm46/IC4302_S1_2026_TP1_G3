import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import { setSession } from '../../services/session';
import '../../styles/auth.css';

/**
 * FALTANTES DE SEGURIDAD EN ESTA PÁGINA:
 * 
 * 1. CHECKBOX "RECORDARME" SIN EFECTO (línea 12):
 *    Existe en UI pero no afecta el almacenamiento. Requisito: aumentar duración
 *    de refresh token a 14 días si está marcado, usando httpOnly cookies.
 *    TODO: Pasar rememberMe al backend, devolver cookie con duración diferente.
 * 
 * 2. NO HAY BLOQUEO POR INTENTOS (línea 34):
 *    Usuario puede intentar login ilimitadamente. Requisito: bloquear tras 5 intentos
 *    fallidos durante 30 min, mostrar contador, notificar por email.
 *    TODO: Backend debe rechazar login si account está bloqueado, incrementar contador
 *    de intentos fallidos, guardar timestamp de último intento.
 * 
 * 3. NO HAY AUDITORÍA DE LOGIN (línea 34):
 *    No se registra fecha, hora, IP de login exitoso. Requisito: guardar en tabla
 *    de auditoría para que usuario vea historial de accesos.
 *    TODO: Servidor registra cada login exitoso con timestamp e IP del cliente.
 */

/**
 * Página de Login - Autenticación de usuario
 * 
 * Flujo:
 * 1. Usuario ingresa username y password
 * 2. Opcionalmente marca "Recuérdame"
 * 3. Valida credenciales con authService.login()
 * 4. Guarda tokens (access y refresh) en localStorage
 * 5. Registra usuario en el sistema social
 * 6. Redirige a /dashboard
 */
export default function Login() {
  const navigate = useNavigate();
  
  // Estado para el formulario de login
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  // Estado para mensajes de error
  const [error, setError] = useState('');
  // Estado para mostrar spinner durante el envío
  const [loading, setLoading] = useState(false);

  // Actualiza el estado del formulario cuando el usuario escribe
  // Para checkboxes usa el valor 'checked', para inputs usa 'value'
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Maneja el envío del formulario:
  // 1. Llama a authService.login() con credenciales
  // 2. Si es exitoso, guarda tokens en localStorage
  // 3. Registra el usuario en el sistema social
  // 4. Redirige a dashboard
  // 5. Si falla, muestra el error en la UI
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(
        formData.username,
        formData.password,
        formData.rememberMe
      );

      setSession({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: response.data.user,
        rememberMe: formData.rememberMe,
      });

      navigate('/dashboard');
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setError(status ? `Error ${status}: ${message}` : (message || 'Error al iniciar sesion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Iniciar Sesión</h2>

        {error && <div className="alert alert-error" id="login-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} aria-label="Formulario de inicio de sesion">
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              aria-label="Nombre de usuario"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              aria-label="Contraseña"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              aria-label="Recordarme"
            />
            <label htmlFor="rememberMe">Recordarme</label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-links">
          <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
          <p>¿No tiene cuenta? <a href="/register">Regístrese aquí</a></p>
        </div>
      </div>
    </div>
  );
}
