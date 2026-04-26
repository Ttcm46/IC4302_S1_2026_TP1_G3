import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth';
import '../../styles/auth.css';

/**
 * FALTANTES DE SEGURIDAD EN RESTABLECIMIENTO DE CONTRASEÑA:
 * 
 * 1. TOKEN DE RECUPERACIÓN SIN VALIDACIÓN REAL:
 *    El token se pasa en URL sin expiración real ni invalidación tras uso.
 *    Requisito: Token debe expirar en 1 hora, ser válido solo una vez,
 *    invalidarse inmediatamente después de reestablecimiento exitoso.
 *    TODO: Servidor valida token (existencia, expiración, single-use),
 *    rechaza si ya fue usado o expiró, invalida tras cambio exitoso.
 */

/**
 * Página de Restablecimiento de Contraseña
 * 
 * Flujo:
 * 1. Usuario recibe email con enlace que incluye token
 * 2. Token se extrae de la URL (?token=xxx)
 * 3. Usuario ingresa nueva contraseña (2 veces para confirmar)
 * 4. Valida que las contraseñas coincidan
 * 5. Envía token + nueva contraseña a authService.resetPassword()
 * 6. Sistema valida token y actualiza contraseña
 * 7. Redirige a login después de 900ms
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Extrae el token de la URL (?token=xxx)
  const tokenFromUrl = useMemo(() => searchParams.get('token') || '', [searchParams]);

  // Token de recuperación de la URL o ingresado manualmente
  const [token, setToken] = useState(tokenFromUrl);
  // Nueva contraseña ingresada por el usuario
  const [newPassword, setNewPassword] = useState('');
  // Confirmación de la nueva contraseña
  const [confirmPassword, setConfirmPassword] = useState('');
  // Mensajes de error
  const [error, setError] = useState('');
  // Mensaje de éxito
  const [message, setMessage] = useState('');
  // Spinner durante el restablecimiento
  const [loading, setLoading] = useState(false);

  // Maneja el restablecimiento de contraseña:
  // 1. Valida que el token no esté vacío
  // 2. Valida que las contraseñas coincidan
  // 3. Envía token + nueva contraseña al servidor
  // 4. Si es exitoso, redirige a login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token.trim()) {
      setError('El token de recuperación es requerido.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.resetPassword(token.trim(), newPassword);
      setMessage(response.data?.message || 'Contraseña restablecida correctamente.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Restablecer Contraseña</h2>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {message ? <div className="alert alert-success" role="status">{message}</div> : null}

        <form onSubmit={handleSubmit} aria-label="Formulario de restablecimiento de contrasena">
          <div className="form-group">
            <label htmlFor="token">Token de recuperación</label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega aquí el token del enlace"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">Nueva contraseña</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </form>

        <div className="auth-links">
          <p>¿Recordaste tu contraseña? <a href="/login">Iniciar sesión</a></p>
        </div>
      </div>
    </div>
  );
}
