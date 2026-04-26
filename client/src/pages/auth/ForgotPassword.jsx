import React, { useState } from 'react';
import { authService } from '../../services/auth';
import '../../styles/auth.css';

/**
 * FALTANTES DE SEGURIDAD EN RECUPERACIÓN DE CONTRASEÑA:
 * 
 * 1. RECUPERACIÓN SIMULADA SIN VALIDACIÓN REAL (authStore.js:152, 156, 158):
 *    Muestra mensajes de éxito pero no genera token de un solo uso,
 *    no hay expiración corta, no se invalida tras usar.
 *    Requisito: Token único, criptográficamente aleatorio, con expiración (1 hora),
 *    válido solo una vez, generado al solicitar recuperación.
 *    TODO: Servidor genera token criptográfico, lo asocia a email con expiration,
 *    envía link con token, invalida tras primer uso exitoso.
 */

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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setTempPassword('');
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email);
      setMessage('Contraseña temporal generada correctamente. Úsala para iniciar sesión y luego cámbiala.');
      if (response.data?.temporaryPassword) {
        setTempPassword(response.data.temporaryPassword);
      }
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
        {tempPassword ? (
          <div className="alert alert-success" role="status" style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
            Contraseña temporal: <strong>{tempPassword}</strong>
          </div>
        ) : null}

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
