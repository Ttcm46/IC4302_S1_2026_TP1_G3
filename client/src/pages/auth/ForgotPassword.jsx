import React, { useState } from 'react';
import { authService } from '../../services/auth';
import '../../styles/auth.css';

/**
 * Página de Recuperación de Contraseña
 * 
 * Flujo:
 * 1. Usuario ingresa su email
 * 2. Sistema valida que el email exista
 * 3. Envía email con enlace de recuperación
 * 4. Muestra mensaje de confirmación (sin revelar si el email existe)
 * 5. Usuario hace clic en enlace del email para ResetPassword
 */
export default function ForgotPassword() {
  // Email ingresado por el usuario
  const [email, setEmail] = useState('');
  // Mensajes de error en caso de fallo
  const [error, setError] = useState('');
  // Mensaje de confirmación enviado al servidor
  const [message, setMessage] = useState('');
  // Spinner durante el envío
  const [loading, setLoading] = useState(false);

  // Maneja el envío del email para recuperación:
  // 1. Llama a authService.forgotPassword() con el email
  // 2. Si existe, envía un email con enlace de recuperación
  // 3. Muestra mensaje genérico (por seguridad)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email);
      setMessage(response.data?.message || 'Si el correo existe, se envio un enlace de recuperacion.');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Recuperar Contraseña</h2>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {message ? <div className="alert alert-success" role="status">{message}</div> : null}

        <form onSubmit={handleSubmit} aria-label="Formulario de recuperacion de contrasena">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      </div>
    </div>
  );
}
