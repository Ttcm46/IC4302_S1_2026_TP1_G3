import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

/**
 * Home.jsx - Página de Inicio (Landing Page)
 * 
 * Propósito:
 * Bienvenida pública de la aplicación. Muestra:
 * - Título y descripción de la plataforma
 * - Botones para "Iniciar Sesión" y "Crear Cuenta"
 * 
 * Acceso: Público (para usuarios no autenticados)
 * 
 * Nota: Si el usuario ya está autenticado, la ruta debería redirigir al dashboard
 */

export default function Home() {
  const nav = useNavigate();

  return (
    <div className="page-container">
      <section className="hero">
        <h1>Bienvenido a TEC Digitalito</h1>
        <p>Plataforma de clases virtuales para estudiantes y docentes</p>
        <div className="hero-buttons">
          <button className="btn-primary" onClick={() => nav("/login")}>Iniciar Sesión</button>
          <button className="btn-secondary" onClick={() => nav("/register")}>Crear Cuenta</button>
        </div>
      </section>
    </div>
  );
}
