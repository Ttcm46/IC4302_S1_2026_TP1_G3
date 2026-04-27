import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/auth';
import { getSessionUser, setSession, getAccessToken, getRefreshToken } from '../services/session';
import '../styles/profile.css';

function toInputDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(value) {
  if (!value) return 'No definida';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No definida';
  return parsed.toLocaleDateString('es-CR');
}

function getInitials(fullName, username) {
  const source = fullName || username || 'U';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Profile() {
  const navigate = useNavigate();
  const initialUser = getSessionUser() || {};

  const [user, setUser] = useState(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: initialUser.username || '',
    fullName: initialUser.fullName || '',
    dateOfBirth: toInputDate(initialUser.dateOfBirth),
    avatar: initialUser.avatar || ''
  });

  const initials = getInitials(user.fullName, user.username);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const avatarData = String(reader.result || '');
      setFormData((prev) => ({ ...prev, avatar: avatarData }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError('');

    try {
      const response = await userService.updateProfile(user.id, {
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        dateOfBirth: formData.dateOfBirth,
        avatar: formData.avatar || '',
        email: user.email || '',
        role: user.role || 'student'
      });

      const updatedUser = {
        ...user,
        ...response.data.user
      };

      setSession({
        accessToken: getAccessToken(),
        refreshToken: getRefreshToken(),
        user: updatedUser,
      });
      setUser(updatedUser);
      setFormData({
        username: updatedUser.username || '',
        fullName: updatedUser.fullName || '',
        dateOfBirth: toInputDate(updatedUser.dateOfBirth),
        avatar: updatedUser.avatar || ''
      });
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible actualizar el perfil.');
    }
  };

  const handleCancel = () => {
    setError('');
    setFormData({
      username: user.username || '',
      fullName: user.fullName || '',
      dateOfBirth: toInputDate(user.dateOfBirth),
      avatar: user.avatar || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1>Ver Perfil</h1>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

        <div className="profile-avatar-wrap">
          {isEditing ? (
            <label className="profile-avatar-button" htmlFor="avatar-upload">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Avatar del usuario" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder" aria-hidden="true">{initials}</div>
              )}
              <span className="avatar-overlay">Cambiar foto</span>
            </label>
          ) : formData.avatar ? (
            <img src={formData.avatar} alt="Avatar del usuario" className="profile-avatar" />
          ) : (
            <div className="profile-avatar placeholder" aria-hidden="true">{initials}</div>
          )}
        </div>

        {isEditing ? (
          <div className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="username">User name</label>
              <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Nombre Completo</label>
              <input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="dateOfBirth">Fecha de Nacimiento</label>
              <input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} />
            </div>

            <input
              id="avatar-upload"
              name="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatar}
              className="hidden-avatar-input"
            />

            <div className="profile-actions edit-actions">
              <button className="btn-secondary" type="button" onClick={handleCancel}>
                Cancelar
              </button>
              <button className="btn-primary" type="button" onClick={handleSave}>
                Guardar cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <div className="profile-row">
              <span className="label">ID de usuario</span>
              <strong className="muted" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{user.id || 'No disponible'}</strong>
            </div>

            <div className="profile-row">
              <span className="label">User name</span>
              <strong>{user.username || 'No definido'}</strong>
            </div>

            <div className="profile-row">
              <span className="label">Nombre Completo</span>
              <strong>{user.fullName || 'No definido'}</strong>
            </div>

            <div className="profile-row">
              <span className="label">Fecha de Nacimiento</span>
              <strong>{formatDate(user.dateOfBirth)}</strong>
            </div>
          </div>
        )}

        <div className="profile-actions bottom-actions">
          {!isEditing ? (
            <button className="btn-secondary" type="button" onClick={() => navigate('/change-password')}>
              Cambiar contraseña
            </button>
          ) : null}

          {!isEditing ? (
            <button className="btn-primary" type="button" onClick={() => setIsEditing(true)}>
              Modificar perfil
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
