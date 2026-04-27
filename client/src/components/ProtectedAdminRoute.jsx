import React from 'react';
import { Navigate } from 'react-router-dom';
import { getSessionUser, isAuthenticated } from '../services/session';

/**
 * COMPONENTE: ProtectedAdminRoute
 * 
 * Propósito: Proteger rutas que solo pueden acceder administradores
 * 
 * Funcionalidades:
 * 1. Verifica que usuario esté autenticado
 * 2. Verifica que usuario tenga rol === "admin"
 * 3. Si no cumple, redirige a /dashboard
 * 
 * Cambios vs código anterior:
 * - NUEVO: Este componente no existía
 * - Similar a ProtectedRoute pero con validación de rol admin
 * 
 * Uso en App.jsx:
 * <Route path="/admin/logs" element={
 *   <ProtectedAdminRoute>
 *     <Layout><AdminLogs /></Layout>
 *   </ProtectedAdminRoute>
 * } />
 */
function ProtectedAdminRoute({ children }) {
  // Verificar autenticación
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Obtener usuario de la sesión
  const user = getSessionUser();

  // Verificar que sea admin
  // El campo role viene del backend como typeofuser
  if (!user || user.role !== 'admin') {
    // Usuario no es admin, redirigir a dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Usuario está autenticado y es admin, mostrar contenido
  return children;
}

export default ProtectedAdminRoute;
