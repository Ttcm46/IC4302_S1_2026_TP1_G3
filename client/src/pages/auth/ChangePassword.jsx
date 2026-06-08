import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import { validatePassword } from '../../utils/passwordValidation';
import '../../styles/auth.css';

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
  // CAMBIO: Errores de validación de contraseña
  const [passwordErrors, setPasswordErrors] = useState([]);

  // Maneja el cambio de contraseña:
  // 1. Valida que las nuevas contraseñas coincidan
  // 2. CAMBIO: Valida que la contraseña cumpla la política de seguridad
  // 3. Envía contraseña actual + nueva al servidor
  // 4. Si es exitoso, limpia inputs y redirige a dashboard
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setPasswordErrors([]);

    // CAMBIO: Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    // CAMBIO: Validar política de contraseña ANTES de enviar
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      setError('La contraseña no cumple con la política de seguridad.');
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

          {/* CAMBIO: Mostrar requisitos de contraseña */}
          {newPassword && (
            <div className="password-requirements">
              <p className="requirements-title">Requisitos de contraseña:</p>
              <div className={`requirement ${newPassword.length >= 8 ? 'requirement-valid' : 'requirement-invalid'}`}>
                ✓ Mínimo 8 caracteres
              </div>
              <div className={`requirement ${/[A-Z]/.test(newPassword) ? 'requirement-valid' : 'requirement-invalid'}`}>
                ✓ Al menos una mayúscula
              </div>
              <div className={`requirement ${/[a-z]/.test(newPassword) ? 'requirement-valid' : 'requirement-invalid'}`}>
                ✓ Al menos una minúscula
              </div>
              <div className={`requirement ${/[0-9]/.test(newPassword) ? 'requirement-valid' : 'requirement-invalid'}`}>
                ✓ Al menos un número
              </div>
              <div className={`requirement ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'requirement-valid' : 'requirement-invalid'}`}>
                ✓ Al menos un símbolo especial
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </form>
      </div>
    </div>
  );
}
