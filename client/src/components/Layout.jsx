import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { clearSession, isAuthenticated } from '../services/session';
import '../styles/layout.css';

/**
 * FALTANTES DE SEGURIDAD EN CIERRE DE SESIÓN:
 * 
 * 1. CIERRE PARCIAL (línea 10-14):
 *    La app limpia localStorage y redirige a '/', pero no invalida tokens
 *    de forma autoritativa en el servidor. Requisito: logout debe revocar
 *    tokens en backend para que no puedan usarse luego.
 *    TODO: Enviar solicitud POST /auth/logout al servidor para blacklist del token.
 * 
 * 2. REDIRECCIÓN INCORRECTA:
 *    Redirige a '/' (página de bienvenida) pero requisito pide redirigir a /login.
 *    TODO: Cambiar redirección a '/login' después de logout exitoso.
 */

export default function Layout({ children }) {
  const navigate = useNavigate();
  const hasSession = isAuthenticated();
  const homePath = hasSession ? '/dashboard' : '/';

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Continue with local cleanup even if backend logout fails.
    } finally {
      clearSession();
      window.location.href = '/login';
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-container">
          <div className="logo" onClick={() => navigate(homePath)}>
            <h1>TEC Digitalito</h1>
          </div>
          <nav className="navbar">
            <a href={homePath}>Inicio</a>
            {hasSession && <a href="/courses">Cursos</a>}
            {hasSession ? (
              <>
                <a href="/social">Comunidad</a>
                <a href="/profile">Ver Perfil</a>
                <button onClick={handleLogout} className="btn-secondary">
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="btn-primary">Iniciar Sesión</a>
                <a href="/register" className="btn-secondary">Registrarse</a>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2024 TEC Digitalito. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
