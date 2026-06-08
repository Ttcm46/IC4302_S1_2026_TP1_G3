import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messageService, userService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/messaging.css';

/**
 * Messaging.jsx - Sistema de Mensajería Directa entre Usuarios
 * 
 * Propósito:
 * Permitir que los usuarios envíen y reciban mensajes privados, ver historial de conversaciones,
 * gestionar una lista de contactos con indicadores de mensajes no leídos y sincronizar en tiempo real.
 * 
 * Características:
 * - Vista de dos paneles: sidebar con lista de contactos e inbox principal con conversación
 * - Carga y enriquecimiento dinámico de contactos con perfiles de usuario (nombre, avatar)
 * - Envío y recepción de mensajes con timestamp e indicador de lectura
 * - Marca automática de mensajes como leídos al abrir conversación
 * - Polling cada 10 segundos para sincronizar inbox y conversación activa
 * - Contador de mensajes no leídos en cada contacto
 * - Auto-scroll automático al final de la conversación
 * - URL param targetId permite abrir conversación directa desde otra página
 * 
 * Flujo:
 * 1. Cargar inbox al montar componente (lista de conversaciones)
 * 2. Enriquecer cada contacto obteniendo nombre y avatar de su perfil
 * 3. Si hay targetId en URL, precargar esa conversación
 * 4. Usuario selecciona contacto: cargar mensajes y marcar como leídos
 * 5. Polling cada 10s: actualizar inbox y conversación activa en background
 * 6. Usuario escribe y envía mensaje: POST al backend, recargar conversación
 * 7. Auto-scroll mantiene vista en último mensaje
 */

export default function Messaging() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentUser = getSessionUser() || {};
  const currentUserId = currentUser.id || '';

  const initialTargetId = searchParams.get('targetId') || '';
  const initialTargetName = searchParams.get('targetName') || '';

  const [contacts, setContacts] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  const [activeContactId, setActiveContactId] = useState(initialTargetId);
  const [activeContactName, setActiveContactName] = useState(initialTargetName || initialTargetId);
  const activeContactIdRef = useRef(initialTargetId);

  const [conversation, setConversation] = useState([]);
  const [convLoading, setConvLoading] = useState(false);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const streamRef = useRef(null);

  // Sincroniza ref con estado para que el polling tenga acceso al contacto activo sin recrear closures.
  useEffect(() => {
    activeContactIdRef.current = activeContactId;
  }, [activeContactId]);

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [conversation]);

  // Obtiene el perfil de un usuario por ID y extrae nombre y avatar para enriquecer el contacto.
  // Si falla la llamada, usa el fallbackName y deja avatar vacío.
  // Necesario porque la lista de contactos del inbox no incluye nombre ni avatar.
  const enrichContact = async (id, fallbackName) => {
    try {
      const res = await userService.getProfile(id);
      const u = res.data?.user;
      return {
        id,
        name: u?.username || u?.fullName || fallbackName || id,
        avatar: u?.avatar || u?.picPath || '',
      };
    } catch {
      return { id, name: fallbackName || id, avatar: '' };
    }
  };

  // Construye lista de contactos a partir del array de mensajes del inbox.
  // Agrupa mensajes por usuario (identificando quién es "el otro"), elimina auto-conversaciones,
  // extrae último mensaje e identifica cuántos no han sido leídos.
  // Devuelve array de contactos con estructura: id, lastMessage, createdAt, unreadCount.
  const buildContactsFromInbox = (messages) => {
    const map = new Map();
    for (const msg of messages) {
      // Determinar quién es el "otro" usuario en la conversación
      const otherUserId = msg.fromUserId === currentUserId ? msg.toUserId : msg.fromUserId;
      
      // Filtrar: no mostrar conversación consigo mismo
      if (otherUserId === currentUserId) continue;
      
      if (!map.has(otherUserId)) {
        map.set(otherUserId, {
          id: otherUserId,
          lastMessage: msg.content,
          createdAt: msg.createdAt,
          unreadCount: 0
        });
      }
      
      // Contar mensajes no leídos: aquellos que me enviaron a mí y no han sido leídos
      if (msg.toUserId === currentUserId && !msg.isRead) {
        const contact = map.get(otherUserId);
        contact.unreadCount = (contact.unreadCount || 0) + 1;
      }
    }
    return [...map.values()];
  };

  // Carga el inbox del usuario actual desde el backend y enriquece cada contacto con su perfil.
  // Si se proporcionó initialTargetId en URL pero no está en inbox, lo agrega al inicio.
  // Maneja errores silenciosamente devolviendo lista vacía.
  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const response = await messageService.getInbox();
      const messages = Array.isArray(response?.data?.data) ? response.data.data : [];
      const raw = buildContactsFromInbox(messages);
      const enriched = await Promise.all(
        raw.map(async (c) => {
          const profile = await enrichContact(c.id, c.id);
          return { ...profile, lastMessage: c.lastMessage, createdAt: c.createdAt, unreadCount: c.unreadCount || 0 };
        })
      );

      // If initialTargetId is not in inbox yet, add it at the top
      if (initialTargetId && !enriched.find((c) => c.id === initialTargetId)) {
        const profile = await enrichContact(initialTargetId, initialTargetName);
        setContacts([{ ...profile, lastMessage: '', createdAt: null }, ...enriched]);
      } else {
        setContacts(enriched);
      }
    } catch {
      setContacts([]);
    } finally {
      setInboxLoading(false);
    }
  };

  // Carga los mensajes de una conversación específica y marca automáticamente como leídos.
  // Actualiza el estado de conversación y limpia el contador de no leídos del contacto.
  // Maneja errores capturando y registrando sin interrumpir la interfaz.
  const loadConversation = async (contactId) => {
    if (!contactId) return;
    setConvLoading(true);
    try {
      // Marcar como leído
      try {
        await messageService.markAsRead(contactId);
      } catch (err) {
        console.error('Error marking as read:', err);
      }
      
      const response = await messageService.getConversation(contactId);
      const msgs = Array.isArray(response?.data?.data) ? response.data.data : [];
      setConversation(msgs);
      
      // Limpiar unreadCount del contacto
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Error loading conversation:', err);
      setConversation([]);
    } finally {
      setConvLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadInbox();
    if (initialTargetId) loadConversation(initialTargetId);

    // Poll: refrescar inbox y conversación activa cada 10 segundos para mantener sincronización en tiempo real.
    const intervalId = setInterval(async () => {
      try {
        const response = await messageService.getInbox();
        const messages = Array.isArray(response?.data?.data) ? response.data.data : [];
        const raw = buildContactsFromInbox(messages);

        setContacts((prev) => {
          // Crear un mapa de contactos actuales para rápida búsqueda
          const prevMap = new Map(prev.map((c) => [c.id, c]));

          // Actualizar contactos del inbox con información ya enriquecida
          const updatedContacts = raw.map((c) => {
            const existing = prevMap.get(c.id);
            // Si existe, mantener nombre y avatar enriquecidos, actualizar lastMessage y unreadCount
            return existing
              ? { ...existing, lastMessage: c.lastMessage, createdAt: c.createdAt, unreadCount: c.unreadCount || 0 }
              : { id: c.id, name: c.id, avatar: '', lastMessage: c.lastMessage, createdAt: c.createdAt, unreadCount: c.unreadCount || 0 };
          });

          // Mantener contactos que no están en el inbox actual (como initialTargetId)
          // pero fueron agregados explícitamente y tienen información enriquecida
          const contactsToKeep = prev.filter(
            (c) => !raw.find((r) => r.id === c.id)
          );

          // Combinar: contactos del inbox + contactos explícitos que no están en inbox
          // Deduplicar por ID para evitar duplicados
          const combined = [...updatedContacts, ...contactsToKeep];
          const deduplicated = Array.from(new Map(combined.map((c) => [c.id, c])).values());
          
          return deduplicated;
        });
      } catch { /* silent */ }

      const cid = activeContactIdRef.current;
      if (cid) {
        try {
          const response = await messageService.getConversation(cid);
          const msgs = Array.isArray(response?.data?.data) ? response.data.data : [];
          setConversation(msgs);
        } catch { /* silent */ }
      }
    }, 10000);
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load conversation when active contact changes
  useEffect(() => {
    if (activeContactId) loadConversation(activeContactId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContactId]);

  // Sync active contact name when contacts list updates
  useEffect(() => {
    if (activeContactId && contacts.length > 0) {
      const contact = contacts.find((c) => c.id === activeContactId);
      if (contact && contact.name !== activeContactName) {
        setActiveContactName(contact.name);
      }
    }
  }, [contacts, activeContactId, activeContactName]);

  // Cambia el contacto activo cuando el usuario hace clic en la lista.
  // Limpia la conversación anterior y errores para que se cargue la nueva conversación.
  // Ignora clics redundantes si ya está seleccionado el mismo contacto.
  const handleSelectContact = (contact) => {
    if (contact.id === activeContactId) return;
    setActiveContactId(contact.id);
    setActiveContactName(contact.name);
    setConversation([]);
    setSendError('');
  };

  // Envía un mensaje al contacto activo después de validar que no esté vacío.
  // POST al backend, limpia el input, recarga conversación y actualiza último mensaje en sidebar.
  // Muestra mensaje de error si algo falla, pero permite reintentar sin perder el texto.
  const handleSend = async (event) => {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || !activeContactId) return;
    setSending(true);
    setSendError('');
    try {
      await messageService.sendMessage(activeContactId, content);
      setMessageText('');
      await loadConversation(activeContactId);
      // Update last message in sidebar
      setContacts((prev) =>
        prev.map((c) => (c.id === activeContactId ? { ...c, lastMessage: content } : c))
      );
    } catch {
      setSendError('No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const activeContact = contacts.find((c) => c.id === activeContactId);

  if (inboxLoading) {
    return (
      <div className="direct-page">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="direct-page">
      <button type="button" className="back-button" onClick={() => navigate('/social')}>
        ← Volver a comunidad
      </button>

      <section className="direct-layout">
        {/* Sidebar */}
        <aside className="direct-inbox-card">
          <h2>Conversaciones</h2>
          {contacts.length === 0 ? (
            <p className="muted">No hay conversaciones aún.</p>
          ) : (
            <div className="direct-contact-list">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className={`direct-contact-card${activeContactId === contact.id ? ' active' : ''}`}
                  onClick={() => handleSelectContact(contact)}
                  style={{ position: 'relative' }}
                >
                  <div
                    className="direct-avatar direct-avatar-fallback"
                    style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
                  >
                    {contact.avatar ? (
                      <img src={contact.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                    ) : (
                      (contact.name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="direct-contact-copy">
                    <p><strong>{contact.name}</strong></p>
                    {contact.lastMessage ? (
                      <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                        {contact.lastMessage}
                      </small>
                    ) : null}
                  </div>
                  {contact.unreadCount > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#007bff',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      border: '2px solid #007bff'
                    }}>
                      {contact.unreadCount}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Conversation */}
        <main className="direct-conversation-card">
          {activeContactId ? (
            <>
              <div className="direct-conversation-header">
                <div className="direct-conversation-title">
                  <div
                    className="direct-avatar direct-avatar-fallback"
                    style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
                  >
                    {activeContact?.avatar ? (
                      <img src={activeContact.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                    ) : (
                      (activeContactName || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 style={{ margin: 0 }}>{activeContactName || activeContactId}</h2>
                  </div>
                </div>
              </div>

              <div className="direct-message-stream" ref={streamRef}>
                {convLoading ? (
                  <div className="loading-screen-inline">
                    <div className="loading-spinner" />
                    <p>Cargando conversación...</p>
                  </div>
                ) : conversation.length === 0 ? (
                  <div className="conversation-empty">
                    <p className="muted">Sin mensajes aún. ¡Escribe el primero!</p>
                  </div>
                ) : (
                  conversation.map((msg, i) => {
                    const isMine = msg.fromUserId === currentUserId;
                    return (
                      <div key={msg._id || i} className={`direct-bubble ${isMine ? 'mine' : 'theirs'}`}>
                        <p className="direct-message-text">{msg.content}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {msg.createdAt ? (
                            <p className="direct-message-time">{new Date(msg.createdAt).toLocaleString('es-CR')}</p>
                          ) : null}
                          {isMine && (
                            <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="direct-compose">
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe un mensaje... (Enter para enviar)"
                  disabled={sending}
                  maxLength={2000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (messageText.trim()) handleSend(e);
                    }
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch' }}>
                  {sendError ? <p className="error-text" style={{ margin: 0, fontSize: '0.85rem' }}>{sendError}</p> : null}
                  <button type="submit" className="btn-primary" disabled={sending || !messageText.trim()}>
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="direct-empty" style={{ margin: 'auto', textAlign: 'center', padding: '2rem' }}>
              <h3>Selecciona una conversación</h3>
              <p className="muted">O inicia una desde la página de <a href="/social">Comunidad</a>.</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

