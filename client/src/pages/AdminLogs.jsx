import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/admin-logs.css';

/**
 * PÁGINA: AdminLogs
 * 
 * Propósito: Panel de administración para visualizar registros de auditoría
 * Requiere: Usuario con rol "admin"
 * 
 * Funcionalidades:
 * - Tabla de todos los logins/logouts del sistema
 * - Filtros: usuario, acción, estado (exitoso/fallido)
 * - Paginación
 * - Ordenamiento por fecha (más reciente primero)
 * 
 * Columnas mostradas:
 * 1. IP - Dirección IP de acceso
 * 2. Usuario - ID del usuario que intentó acceso
 * 3. Dispositivo - Tipo de dispositivo, navegador
 * 4. Acción - "login" o "logout"
 * 5. Estado - Verde (exitoso) o Rojo (fallido)
 * 6. Fecha/Hora - Timestamp del evento
 */

const AdminLogs = () => {
  // Estado: Array de logs traidos del backend
  const [logs, setLogs] = useState([]);
  
  // Estado: Información de paginación
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    pages: 0
  });

  // Estado: Cargando datos
  const [loading, setLoading] = useState(true);
  
  // Estado: Mensaje de error
  const [error, setError] = useState('');

  // Estado: Filtros aplicados por el usuario
  const [filters, setFilters] = useState({
    userId: '',
    action: '', // '' para todos, 'login', 'logout'
    successful: '' // '' para todos, 'true', 'false'
  });

  /**
   * FUNCIÓN: fetchLogs
   * 
   * Propósito: Traer logs del backend con filtros y paginación
   * 
   * Cambios vs antes:
   * - NUEVO: Esta función no existía
   * - Llama a GET /admin/logs
   * - Construye query string con filtros
   * - Maneja errores y muestra mensajes
   */
  const fetchLogs = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError('');

      // Construir query string con filtros
      const queryParams = new URLSearchParams({
        page: pageNum,
        limit: pagination.limit
      });

      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.action) queryParams.append('action', filters.action);
      if (filters.successful) queryParams.append('successful', filters.successful);

      // Llamar al endpoint backend
      const response = await api.get(`/admin/logs?${queryParams.toString()}`);

      if (response.data.success) {
        setLogs(response.data.data.logs);
        setPagination(response.data.data.pagination);
      } else {
        setError(response.data.message || 'Error al cargar los registros');
      }
    } catch (err) {
      console.error('[AdminLogs] Error:', err);
      const errorMsg = err?.response?.data?.message || 
                      err?.message || 
                      'Error al conectar con el servidor';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * EFECTO: Cargar logs al montar el componente
   * 
   * Cambios vs antes:
   * - NUEVO: Este efecto no existía
   * - Se ejecuta una sola vez al montar
   */
  useEffect(() => {
    fetchLogs(1);
  }, []);

  /**
   * FUNCIÓN: handleFilterChange
   * 
   * Propósito: Actualizar filtros y recargar logs
   * 
   * Cambios vs antes:
   * - NUEVO: Esta función no existía
   * - Actualiza estado de filtros
   * - Reinicia a página 1
   * - Recargas logs con nuevos filtros
   */
  const handleFilterChange = async (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    
    // Usar setTimeout para permitir que React actualice el estado antes de fetchear
    setTimeout(() => {
      fetchLogsWithFilters(newFilters, 1);
    }, 50);
  };

  /**
   * FUNCIÓN: fetchLogsWithFilters
   * 
   * Propósito: Traer logs con filtros específicos
   * 
   * Recibe los filtros como parámetro en lugar de usar el estado
   * Esto evita problemas de sincronización del estado
   */
  const fetchLogsWithFilters = async (filtersToUse, pageNum = 1) => {
    try {
      setLoading(true);
      setError('');

      // Construir query string con filtros
      const queryParams = new URLSearchParams({
        page: pageNum,
        limit: pagination.limit
      });

      if (filtersToUse.userId) queryParams.append('userId', filtersToUse.userId);
      if (filtersToUse.action) queryParams.append('action', filtersToUse.action);
      if (filtersToUse.successful) queryParams.append('successful', filtersToUse.successful);

      // Llamar al endpoint backend
      const response = await api.get(`/admin/logs?${queryParams.toString()}`);

      if (response.data.success) {
        setLogs(response.data.data.logs);
        setPagination(response.data.data.pagination);
      } else {
        setError(response.data.message || 'Error al cargar los registros');
      }
    } catch (err) {
      console.error('[AdminLogs] Error:', err);
      const errorMsg = err?.response?.data?.message || 
                      err?.message || 
                      'Error al conectar con el servidor';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * FUNCIÓN: formatDevice
   * 
   * Propósito: Convertir objeto device a string legible
   * 
   * Cambios vs antes:
   * - NUEVO: Esta función no existía
   * - Formatea: "Desktop - Google Chrome"
   * - Mejorado: Maneja valores undefined o vacíos correctamente
   */
  const formatDevice = (device) => {
    if (!device) return '-';
    const { type, vendor, model } = device;
    
    // Construir partes no-vacías
    const parts = [];
    
    if (type) parts.push(type);
    if (vendor && vendor !== 'Unknown') parts.push(vendor);
    if (model) parts.push(model);
    
    // Si no hay partes, retornar guión
    if (parts.length === 0) return '-';
    
    // Retornar unidas por " - "
    return parts.join(' - ');
  };

  /**
   * FUNCIÓN: formatDate
   * 
   * Propósito: Formatear timestamp a fecha legible
   * 
   * Cambios vs antes:
   * - NUEVO: Esta función no existía
   * - Convierte ISO a formato local
   */
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="admin-logs-container">
      <h1>Registros de Auditoría del Sistema</h1>

      {/* SECCIÓN: Filtros */}
      <div className="filters-section">
        <h2>Filtros</h2>
        
        <div className="filter-group">
          <label htmlFor="userId">Usuario ID:</label>
          <input
            id="userId"
            type="text"
            name="userId"
            placeholder="Ej: user/123"
            value={filters.userId}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="action">Acción:</label>
          <select
            id="action"
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
          >
            <option value="">Todas</option>
            <option value="login">Inicios de Sesión</option>
            <option value="logout">Cierres de Sesión</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="successful">Estado:</label>
          <select
            id="successful"
            name="successful"
            value={filters.successful}
            onChange={handleFilterChange}
          >
            <option value="">Todos</option>
            <option value="true">Exitosos</option>
            <option value="false">Fallidos</option>
          </select>
        </div>
      </div>

      {/* SECCIÓN: Mensaje de error */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* SECCIÓN: Tabla de logs */}
      {loading ? (
        <div className="loading">Cargando registros...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p>No hay registros que coincidan con los filtros</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Usuario</th>
                  <th>Dispositivo</th>
                  <th>Acción</th>
                  <th>Estado</th>
                  <th>Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="ip">{log.ip}</td>
                    <td className="user-id">{log.userId || '-'}</td>
                    <td className="device">{formatDevice(log.device)}</td>
                    <td className="action">
                      {log.action === 'login' ? 'Login' : 'Logout'}
                    </td>
                    <td className={`status status-${log.successful ? 'success' : 'failed'}`}>
                      {log.successful ? 'Exitoso' : 'Fallido'}
                    </td>
                    <td className="timestamp">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECCIÓN: Paginación */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                disabled={pagination.page === 1}
                onClick={() => fetchLogsWithFilters(filters, pagination.page - 1)}
              >
                ← Anterior
              </button>

              <span className="page-info">
                Página {pagination.page} de {pagination.pages} 
                ({pagination.total} registros totales)
              </span>

              <button
                disabled={pagination.page === pagination.pages}
                onClick={() => fetchLogsWithFilters(filters, pagination.page + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminLogs;
