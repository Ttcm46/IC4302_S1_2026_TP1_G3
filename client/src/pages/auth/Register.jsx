import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import { validatePassword, getPasswordErrors } from '../../utils/passwordValidation';
import '../../styles/auth.css';

/**
 * Página de Registro - Creación de nueva cuenta
 * 
 * Flujo:
 * 1. Usuario ingresa username, email, contraseña y datos personales
 * 2. Opcionalmente carga un avatar
 * 3. Valida que las contraseñas coincidan
 * 4. Envía datos a authService.register()
 * 5. Registra usuario en el sistema social
 * 6. Redirige a /login después de 900ms
 */

const initialForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  dateOfBirth: '',
  avatar: ''
};

export default function Register() {
  const navigate = useNavigate();
  // Estado del formulario con todos los campos de registro
  const [formData, setFormData] = useState(initialForm);
  // Preview de la imagen del avatar antes de guardar
  const [preview, setPreview] = useState('');
  // Mensajes de error durante el registro
  const [error, setError] = useState('');
  // Mensaje de éxito cuando el registro es completado
  const [success, setSuccess] = useState('');
  // Spinner durante el envío al servidor
  const [loading, setLoading] = useState(false);
  // Errores de validación de contraseña (política de seguridad)
  const [passwordErrors, setPasswordErrors] = useState([]);

  // Actualiza el estado del formulario con los valores ingresados por el usuario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Validar contraseña en tiempo real si es el campo de password
    if (name === 'password') {
      const errors = getPasswordErrors(value);
      setPasswordErrors(errors);
    }
  };

  // Maneja la carga del avatar:
  // 1. Lee el archivo seleccionado
  // 2. Convierte a Data URL (base64)
  // 3. Guarda en preview para mostrar en la UI
  // 4. Guarda en formData para enviarlo al servidor
  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const avatarData = String(reader.result || '');
      setPreview(avatarData);
      setFormData((prev) => ({ ...prev, avatar: avatarData }));
    };
    reader.readAsDataURL(file);
  };

  // Maneja el envío del formulario:
  // 1. Valida que las contraseñas coincidan
  // 2. Valida que cumpla política de seguridad
  // 3. Envía datos a authService.register()
  // 4. Registra en el sistema social con rol 'student'
  // 5. Muestra mensaje de éxito y redirige a login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validar política de contraseña
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError('La contraseña no cumple con la política de seguridad. ' + passwordValidation.errors.join(', '));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      console.log('[Register] Intento de registro con username:', formData.username.trim(), 'email:', formData.email.trim());
      
      await authService.register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        dateOfBirth: formData.dateOfBirth,
        avatar: formData.avatar || null
      });

      setSuccess('Registro completado. Ahora puedes iniciar sesión.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      console.error('[Register] Error de registro:', err);
      
      // El backend retorna {error: "mensaje"}
      const errorMessage = err?.response?.data?.error || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'No fue posible registrarte.';
      
      console.log('[Register] Mostrando error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form auth-form-wide">
        <h2>Registro de Usuario</h2>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {success ? <div className="alert alert-success" role="status">{success}</div> : null}

        <form onSubmit={handleSubmit} aria-label="Formulario de registro">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required autoComplete="username" />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="email" />
          </div>

          <div className="form-group">
            <label htmlFor="fullName">Nombre completo</label>
            <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} required autoComplete="name" />
          </div>

          <div className="form-group">
            <label htmlFor="dateOfBirth">Fecha de nacimiento</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required autoComplete="new-password" />
            
            {/* Mostrar requisitos de contraseña con validación en tiempo real */}
            {formData.password && (
              <div className="password-requirements" role="status" aria-live="polite">
                <div className="requirements-title">Requisitos de contraseña:</div>
                {passwordErrors.length === 0 ? (
                  <div className="requirement requirement-valid">Contraseña válida</div>
                ) : (
                  passwordErrors.map((error, idx) => (
                    <div key={idx} className="requirement requirement-invalid">{error}</div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required autoComplete="new-password" />
          </div>

          <div className="form-group">
            <label htmlFor="avatar">Foto o avatar</label>
            <input id="avatar" name="avatar" type="file" accept="image/*" onChange={handleAvatar} />
            {preview ? <img src={preview} alt="Vista previa del avatar" className="avatar-preview" /> : null}
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <div className="auth-links">
          <p>¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
        </div>
      </div>
    </div>
  );
}
