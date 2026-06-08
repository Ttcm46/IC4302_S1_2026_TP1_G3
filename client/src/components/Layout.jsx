import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { clearSession, isAuthenticated, getSessionUser } from '../services/session';
import '../styles/layout.css';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasSession, setHasSession] = useState(isAuthenticated());
  // CAMBIO: Agregar estado para usuario (necesario para verificar si es admin)
  const [user, setUser] = useState(getSessionUser());

  // Actualizar hasSession cuando cambia la ruta o se detecta cambio en autenticación
  useEffect(() => {
    setHasSession(isAuthenticated());
    // CAMBIO: Actualizar usuario también
    setUser(getSessionUser());
  }, [location.pathname]);

  const homePath = hasSession ? '/dashboard' : '/';

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Continue with local cleanup even if backend logout fails.
    } finally {
      clearSession();
      setHasSession(false);
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
                {/* CAMBIO: Agregar link a Registros solo si usuario es admin */}
                {user?.role === 'admin' && (
                  <a href="/admin/logs" className="admin-link">Registros</a>
                )}
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
          <p>&copy; 2026 TEC Digitalito. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
