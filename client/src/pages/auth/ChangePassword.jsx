import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import '../../styles/auth.css';

/**
 * FALTANTES DE SEGURIDAD EN ESTA PÁGINA:
 * 
 * 1. CAMBIO DE CONTRASEÑA SIN POLÍTICA (línea 20):
 *    Solo valida que la confirmación coincida y contraseña actual sea correcta.
 *    Requisito faltante: Aplicar política de contraseña fuerte:
 *    - Mínimo 8 caracteres
 *    - Incluir mayúscula, minúscula, número, símbolo
 *    - No puede ser igual a contraseña anterior
 *    - No puede contener username
 *    TODO: Validar en cliente y servidor con regex/librería de policy.
 * 
 * 2. NO HAY NOTIFICACIÓN DE CAMBIO:
 *    No se envía email de confirmación al usuario. Requisito: notificar cambio
 *    exitoso para que detecte si fue por tercero malicioso.
 *    TODO: Servidor envía email de confirmación con IP/timestamp del cambio.
 */

/**
 * Página de Cambio de Contraseña
 * 
 * Flujo:
 * 1. Usuario ingresa contraseña actual (verificación de identidad)
 * 2. Ingresa nueva contraseña (2 veces para confirmar)
 * 3. Valida que las nuevas coincidan
 * 4. Envía a authService.changePassword()
 * 5. Si es exitoso, limpia los inputs
 * 6. Redirige a /dashboard después de 900ms
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  // Contraseña actual para verificar identidad
  const [currentPassword, setCurrentPassword] = useState('');
  // Nueva contraseña a establecer
  const [newPassword, setNewPassword] = useState('');
  // Confirmación de la nueva contraseña
  const [confirmPassword, setConfirmPassword] = useState('');
  // Mensajes de error
  const [error, setError] = useState('');
  // Mensaje de éxito
  const [message, setMessage] = useState('');
  // Spinner durante el cambio
  const [loading, setLoading] = useState(false);

  // Maneja el cambio de contraseña:
  // 1. Valida que las nuevas contraseñas coincidan
  // 2. Envía contraseña actual + nueva al servidor
  // 3. Si es exitoso, limpia inputs y redirige a dashboard
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.changePassword(currentPassword, newPassword);
      setMessage(response.data?.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate(`/profile`)}
      >
        {'← Volver al perfil'}
      </button>
      
      <div className="auth-form">
        <h2>Cambio de Contraseña</h2>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {message ? <div className="alert alert-success" role="status">{message}</div> : null}

        <form onSubmit={handleSubmit} aria-label="Formulario de cambio de contrasena">
          <div className="form-group">
            <label htmlFor="currentPassword">Contraseña actual</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
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
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </form>
      </div>
    </div>
  );
}
