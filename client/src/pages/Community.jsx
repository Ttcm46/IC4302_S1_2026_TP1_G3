import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { userService, courseService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/community.css';

/**
 * Community.jsx - Sistema de Red Social y Conexiones entre Usuarios
 * 
 * Propósito:
 * Permitir que los usuarios descubran otros usuarios, envíen solicitudes de amistad,
 * administren sus amigos y visualicen los cursos en los que participan mutuamente.
 * 
 * Características:
 * - Búsqueda de usuarios por nombre de usuario o nombre completo
 * - Sistema de solicitudes de amistad (enviar, aceptar, rechazar)
 * - Panel de solicitudes pendientes con notificación de cantidad
 * - Visualización de cursos como estudiante y docente (solo para amigos)
 * - Carrusel horizontal de cursos con scroll y controles de navegación
 * - Polling automático cada 10 segundos para actualizar solicitudes de amistad
 * - Prevención de acceso: no mostrar cursos a usuarios que no son amigos
 * 
 * Flujo:
 * 1. Cargar lista de usuarios, amigos confirmados y solicitudes pendientes
 * 2. Usuario busca y selecciona a otro usuario
 * 3. Mostrar opciones: agregar amigo, aceptar solicitud o ya son amigos
 * 4. Si son amigos: cargar y mostrar cursos compartidos en carrusel horizontal
 * 5. Si no son amigos: mostrar aviso de que deben ser amigos para ver cursos
 * 6. Actualizar estado de solicitudes en segundo plano cada 10 segundos
 */


// Función mapUserRow(raw)
// Normaliza un usuario recibido del backend a la estructura interna del frontend.
// Extrae datos de la respuesta, usa fallbacks para campos faltantes (avatar, fullName).
// El backend puede devolver datos en diferentes formatos; esta función asegura consistencia.

function mapUserRow(raw) {
  const user = raw?.data || raw;
  if (!user) return null;
  return {
    id: String(user.id || user.username || ''),
    username: String(user.username || user.id || ''),
    fullName: String(user.name || user.fullName || user.username || user.id || 'Usuario'),
    avatar: user.picPath || user.avatar || ''
  };
}

/**
 * Componente HorizontalCarousel
 * 
 * Renderiza una lista de items en un contenedor scroll horizontal con botones de navegación.
 * Usa useRef para acceder al elemento track, ResizeObserver para detectar cambios de tamaño,
 * y administra visibilidad de botones según posición de scroll.
 * Reutilizable para mostrar cursos, listas de usuarios u otros items en carrusel.
 */
function HorizontalCarousel({
  items,
  getKey,
  renderItem,
  ariaLabel,
  trackClassName = '',
  itemClassName = ''
}) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!trackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const track = trackRef.current;
    if (!track) return;

    track.addEventListener('scroll', checkScroll);
    const observer = new ResizeObserver(checkScroll);
    observer.observe(track);
    window.addEventListener('resize', checkScroll);

    return () => {
      track.removeEventListener('scroll', checkScroll);
      observer.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (dir) => {
    if (!trackRef.current) return;
    const amount = 300;
    trackRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="carousel-shell">
      {canScrollLeft && (
        <button
          type="button"
          className="carousel-control carousel-control-left"
          onClick={() => scroll('left')}
          aria-label="Desplazar hacia la izquierda"
        >
          ‹
        </button>
      )}
      <div
        ref={trackRef}
        className={`carousel-track ${trackClassName}`}
        role="region"
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <div key={getKey(item)} className={`carousel-item ${itemClassName}`}>
            {renderItem(item)}
          </div>
        ))}
      </div>
      {canScrollRight && (
        <button
          type="button"
          className="carousel-control carousel-control-right"
          onClick={() => scroll('right')}
          aria-label="Desplazar hacia la derecha"
        >
          ›
        </button>
      )}
    </div>
  );
}

export default function Community() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [friendIds, setFriendIds] = useState(new Set());
  const [sentRequestIds, setSentRequestIds] = useState(new Set());
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [friendMsg, setFriendMsg] = useState('');
  const [selectedUserCourses, setSelectedUserCourses] = useState([]);
  const [selectedUserTeachedCourses, setSelectedUserTeachedCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const currentUser = getSessionUser() || {};
  const selectedId = searchParams.get('userId');
  
  /**
   * Función interna: filteredUsers
   * 
   * Filtra la lista de usuarios por búsqueda y excluye al usuario actual.
   * Usa useMemo para evitar cálculos innecesarios, busca en username y fullName.
   * Optimizar renderizado y asegurar que el usuario no se ve a sí mismo en la lista.
   */

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (String(u.id) === String(currentUser.id || currentUser.username || '')) return false;
      if (!q) return true;
      return `${u.username} ${u.fullName}`.toLowerCase().includes(q);
    });
  }, [users, query, currentUser]);

  const selectedUser = useMemo(() => {
    return filteredUsers.find((u) => String(u.id) === String(selectedId)) || filteredUsers[0] || null;
  }, [filteredUsers, selectedId]);

  /**
   * Función interna: loadData (dentro de useEffect)
   * 
   * Carga usuarios, amigos, solicitudes pendientes y solicitudes enviadas en paralelo.
   * Usa Promise.all para cargar datos simultáneamente, enriquece solicitudes pendientes
   *       con información del perfil del usuario.
   * Inicializa el estado completo sin bloquear la UI.
   */

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersResponse, friendsResponse, requestsResponse, sentResponse] = await Promise.all([
          userService.searchUsers(''),
          currentUser.id ? userService.getFriends(currentUser.id) : Promise.resolve(null),
          currentUser.id ? userService.getPendingRequests() : Promise.resolve(null),
          currentUser.id ? userService.getSentRequests() : Promise.resolve(null)
        ]);

        const responseData = usersResponse?.data?.data;
        const raw = Array.isArray(responseData)
          ? responseData
          : (Array.isArray(responseData?.data) ? responseData.data : []);
        const mappedUsers = raw.map(mapUserRow).filter(Boolean);
        setUsers(mappedUsers);

        const rawFriends = friendsResponse?.data?.friends;
        if (Array.isArray(rawFriends)) {
          setFriendIds(new Set(rawFriends.map((f) => String(f.id || f.userId || f))));
        }

        const rawSent = sentResponse?.data?.requests;
        if (Array.isArray(rawSent)) {
          setSentRequestIds(new Set(rawSent.map((id) => String(id))));
        }

        const rawRequests = requestsResponse?.data?.requests;
        if (Array.isArray(rawRequests) && rawRequests.length > 0) {
          const enriched = await Promise.all(
            rawRequests.map(async (fromUserId) => {
              const id = String(fromUserId);
              const found = mappedUsers.find((u) => u.id === id);
              if (found) return { fromUserId: id, fullName: found.fullName, username: found.username };
              try {
                const res = await userService.getProfile(id);
                const u = res.data?.user;
                return {
                  fromUserId: id,
                  fullName: u?.fullName || u?.username || id,
                  username: u?.username || id
                };
              } catch {
                return { fromUserId: id, fullName: id, username: id };
              }
            })
          );
          setPendingRequests(enriched);
        }
      } catch {
        setUsers([]);
        setError('No fue posible cargar usuarios desde backend.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

  /**
   * Función interna: pollRequests (dentro de useEffect)
   * 
   * Verifica periódicamente si hay nuevas solicitudes de amistad cada 10 segundos.
   * Hace polling del backend, compara IDs para detectar cambios, actualiza estado.
   * Mantiene el estado sincronizado sin recargar toda la página.
   */

    const pollRequests = async () => {
      if (!currentUser.id) return;
      try {
        const [requestsRes, sentRes] = await Promise.all([
          userService.getPendingRequests(),
          userService.getSentRequests()
        ]);

        const rawRequests = requestsRes?.data?.requests;
        if (Array.isArray(rawRequests)) {
          setPendingRequests((prev) => {
            const existingIds = new Set(prev.map((r) => r.fromUserId));
            const newIds = rawRequests.map(String);
            const hasChanges =
              newIds.length !== prev.length ||
              newIds.some((id) => !existingIds.has(id));

            if (!hasChanges) return prev;

            const enrichPromises = newIds.map(async (id) => {
              const already = prev.find((r) => r.fromUserId === id);
              if (already) return already;
              try {
                const res = await userService.getProfile(id);
                const u = res.data?.user;
                return {
                  fromUserId: id,
                  fullName: u?.fullName || u?.username || id,
                  username: u?.username || id
                };
              } catch {
                return { fromUserId: id, fullName: id, username: id };
              }
            });

            Promise.all(enrichPromises).then(setPendingRequests);
            return prev;
          });
        }

        const rawSent = sentRes?.data?.requests;
        if (Array.isArray(rawSent)) {
          setSentRequestIds(new Set(rawSent.map(String)));
        }
      } catch {
        // silently ignore poll errors
      }
    };

    const intervalId = setInterval(pollRequests, 10000);
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  /**
   * Función interna: loadUserCourses (dentro de useEffect)
   * 
   * Carga los cursos del usuario seleccionado pero solo si son amigos.
   * Verifica amistad primero, carga cursos, separa en estudiante/docente, filtra publicados.
   * No muestra cursos a usuarios que no son amigos.
   */

  useEffect(() => {
    const loadUserCourses = async () => {
      if (!selectedUser || !selectedUser.id) {
        setSelectedUserCourses([]);
        setSelectedUserTeachedCourses([]);
        return;
      }

      // Verificar si son amigos antes de cargar cursos
      const isFriend = friendIds.has(String(selectedUser.id));
      
      // Si no son amigos, no mostrar los cursos
      if (!isFriend) {
        setSelectedUserCourses([]);
        setSelectedUserTeachedCourses([]);
        return;
      }

      setCoursesLoading(true);
      try {
        const response = await userService.getUserCourses(selectedUser.id);
        const allCourses = response?.data?.courses || [];
        // Filtrar: mostrar solo cursos publicados o terminados (no ocultos)
        const visibleCourses = allCourses.filter((c) => c.isPublished || c.isFinished);
        
        // Separar en cursos como estudiante y como docente
        const studentCourses = visibleCourses.filter(
          (c) => String(c.ownerId || c.creatorId) !== String(selectedUser.id)
        );
        const teacherCourses = visibleCourses.filter(
          (c) => String(c.ownerId || c.creatorId) === String(selectedUser.id)
        );
        
        setSelectedUserCourses(studentCourses);
        setSelectedUserTeachedCourses(teacherCourses);
      } catch {
        setSelectedUserCourses([]);
        setSelectedUserTeachedCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    loadUserCourses();
  }, [selectedUser, friendIds]);

  // Función handleAccept(fromUserId)
  // Acepta una solicitud de amistad recibida.
  // Llama al servicio, elimina de solicitudes pendientes, agrega a amigos.
  // Permite al usuario confirmar una amistad solicitada.
  const handleAccept = async (fromUserId) => {
    try {
      await userService.acceptFriendRequest(fromUserId);
      setPendingRequests((prev) => prev.filter((r) => r.fromUserId !== fromUserId));
      setFriendIds((prev) => new Set([...prev, String(fromUserId)]));
    } catch {
      // silently ignore
    }
  };

  // Función handleReject(fromUserId)
  // Rechaza una solicitud de amistad recibida.
  // Llama al servicio, elimina de solicitudes pendientes.
  // Permite al usuario descartar una solicitud de amistad.
  const handleReject = async (fromUserId) => {
    try {
      await userService.rejectFriendRequest(fromUserId);
      setPendingRequests((prev) => prev.filter((r) => r.fromUserId !== fromUserId));
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="social-page">
      <section className="social-hero">
        <div>
          <span className="social-kicker">Comunidad</span>
          <h1>Usuarios del sistema</h1>
        </div>
        <div className="social-hero-actions">
          <Link to="/social/messages" className="btn-secondary social-inline-btn">Mensajes</Link>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {pendingRequests.length > 0 ? (
        <section className="social-requests-card">
          <h2>Solicitudes de amistad <span className="social-pill">{pendingRequests.length}</span></h2>
          <div className="social-requests-list">
            {pendingRequests.map((req) => (
              <div key={req.fromUserId} className="social-request-row">
                <div className="social-avatar social-avatar-fallback social-avatar-sm">
                  {req.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div className="social-request-info">
                  <strong>{req.fullName}</strong>
                  <span>@{req.username}</span>
                </div>
                <div className="social-request-actions">
                  <button
                    type="button"
                    className="btn-primary social-inline-btn"
                    onClick={() => handleAccept(req.fromUserId)}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary social-inline-btn"
                    onClick={() => handleReject(req.fromUserId)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="social-layout">
        <aside className="social-sidebar-card">
          <div className="social-sidebar-header">
            <h2>Buscar usuarios</h2>
            <span className="social-pill">{filteredUsers.length}</span>
          </div>
          <label className="social-search-box" htmlFor="community-search">
            <input
              id="community-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por username o nombre"
            />
          </label>

          <div className="social-user-list">
            {loading ? <p className="muted">Cargando...</p> : null}
            {!loading && filteredUsers.length === 0 ? <p className="muted">No hay usuarios para mostrar.</p> : null}
            {!loading && filteredUsers.map((user) => (
              <article key={user.id} className={`social-user-card ${selectedUser?.id === user.id ? 'active' : ''}`}>
                <Link className="social-user-card-main" to={`/social?userId=${encodeURIComponent(user.id)}`}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={`Avatar de ${user.username}`} className="social-avatar" />
                  ) : (
                    <div className="social-avatar social-avatar-fallback">{user.fullName.slice(0, 1).toUpperCase()}</div>
                  )}
                  <div>
                    <h3>{user.fullName}</h3>
                    <p>@{user.username}</p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </aside>

        <main className="social-detail-card">
          {!selectedUser ? (
            <p className="muted">Selecciona un usuario para ver su detalle.</p>
          ) : (
            <>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} alt={`Avatar de ${selectedUser.username}`} className="social-avatar social-avatar-large" />
              ) : (
                <div className="social-avatar social-avatar-large social-avatar-fallback">{selectedUser.fullName.slice(0, 1).toUpperCase()}</div>
              )}
              <h2>{selectedUser.fullName}</h2>
              <p>@{selectedUser.username}</p>

              {String(selectedUser.id) !== String(currentUser.id || currentUser.username || '') ? (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                  {(() => {
                    const sid = String(selectedUser.id);
                    const isReceived = pendingRequests.some((r) => r.fromUserId === sid);

                    if (friendIds.has(sid)) {
                      return (
                        <>
                          <span className="btn-secondary social-inline-btn friend-active" aria-label="Ya son amigos">✓ Amigos</span>
                          <button
                            type="button"
                            className="btn-secondary social-inline-btn"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={async () => {
                              setFriendMsg('');
                              try {
                                await userService.removeFriend(selectedUser.id);
                                setFriendIds((prev) => { const n = new Set(prev); n.delete(sid); return n; });
                                setFriendMsg('Amistad eliminada.');
                              } catch {
                                setFriendMsg('No se pudo eliminar la amistad.');
                              }
                            }}
                          >
                            Eliminar amistad
                          </button>
                        </>
                      );
                    }

                    if (isReceived) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                          <span className="btn-secondary social-inline-btn" style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}>Te envió una solicitud</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-primary social-inline-btn"
                              onClick={async () => {
                                setFriendMsg('');
                                try {
                                  await handleAccept(sid);
                                  setFriendMsg('¡Ahora son amigos!');
                                } catch {
                                  setFriendMsg('No se pudo aceptar la solicitud.');
                                }
                              }}
                            >
                              Aceptar
                            </button>
                            <button
                              type="button"
                              className="btn-secondary social-inline-btn"
                              onClick={async () => {
                                setFriendMsg('');
                                try {
                                  await handleReject(sid);
                                  setFriendMsg('Solicitud rechazada.');
                                } catch {
                                  setFriendMsg('No se pudo rechazar la solicitud.');
                                }
                              }}
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (sentRequestIds.has(sid)) {
                      return <span className="btn-secondary social-inline-btn" aria-label="Solicitud enviada">Solicitud enviada</span>;
                    }

                    return (
                      <button
                        type="button"
                        className="btn-primary social-inline-btn"
                        disabled={pendingId === selectedUser.id}
                        onClick={async () => {
                          setPendingId(selectedUser.id);
                          setFriendMsg('');
                          try {
                            await userService.sendFriendRequest(selectedUser.id);
                            setSentRequestIds((prev) => new Set([...prev, sid]));
                            setFriendMsg('¡Solicitud enviada!');
                          } catch {
                            setFriendMsg('No se pudo enviar la solicitud.');
                          } finally {
                            setPendingId(null);
                          }
                        }}
                      >
                        {pendingId === selectedUser.id ? 'Enviando...' : '+ Agregar amigo'}
                      </button>
                    );
                  })()}
                  {friendMsg ? <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{friendMsg}</p> : null}
                  <Link
                    to={`/social/messages?targetId=${encodeURIComponent(selectedUser.id)}&targetName=${encodeURIComponent(selectedUser.fullName)}`}
                    className="btn-secondary social-inline-btn"
                  >
                    Enviar mensaje
                  </Link>
                </div>
              ) : null}

              {/* Sección de cursos como estudiante */}
              <section style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Cursos como estudiante</h3>
                {!friendIds.has(String(selectedUser.id)) ? (
                  <p className="muted">Debes ser amigo de este usuario para ver sus cursos.</p>
                ) : coursesLoading ? (
                  <p className="muted">Cargando cursos...</p>
                ) : selectedUserCourses.length > 0 ? (
                  <HorizontalCarousel
                    items={selectedUserCourses}
                    getKey={(course) => course.id}
                    ariaLabel={`Cursos como estudiante de ${selectedUser.fullName}`}
                    trackClassName="courses-track"
                    itemClassName="course-item"
                    renderItem={(course) => {
                      const status = course.isFinished ? { label: 'Terminado', className: 'status-finished' }
                        : course.isPublished ? { label: 'Publicado', className: 'status-published' }
                        : { label: 'Oculto', className: 'status-hidden' };
                      return (
                        <article className="dashboard-course-card">
                          {course.coverImage ? (
                            <div className="dashboard-course-image">
                              <img src={course.coverImage} alt={course.name} />
                            </div>
                          ) : null}
                          <div className="course-content">
                            <div className="course-header-row">
                              <p className="course-code">{course.code}</p>
                              <span className={`course-status-badge ${status.className}`}>{status.label}</span>
                            </div>
                            <h4 style={{ margin: '0.15rem 0 0.3rem 0', fontSize: '0.95rem' }}>{course.name}</h4>
                            <p className="course-description" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              {course.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="course-link"
                            style={{ padding: '0 0.75rem 0.65rem', background: 'none', border: 'none', color: '#0b5ed7', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => navigate(`/courses/${course.id}`)}
                          >
                            Ver curso →
                          </button>
                        </article>
                      );
                    }}
                  />
                ) : (
                  <p className="muted">Aún no ha matriculado cursos.</p>
                )}
              </section>

              {/* Sección de cursos como docente */}
              <section style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Cursos como docente</h3>
                {!friendIds.has(String(selectedUser.id)) ? (
                  <p className="muted">Debes ser amigo de este usuario para ver sus cursos.</p>
                ) : coursesLoading ? (
                  <p className="muted">Cargando cursos...</p>
                ) : selectedUserTeachedCourses.length > 0 ? (
                  <HorizontalCarousel
                    items={selectedUserTeachedCourses}
                    getKey={(course) => course.id}
                    ariaLabel={`Cursos como docente de ${selectedUser.fullName}`}
                    trackClassName="courses-track"
                    itemClassName="course-item"
                    renderItem={(course) => {
                      const status = course.isFinished ? { label: 'Terminado', className: 'status-finished' }
                        : course.isPublished ? { label: 'Publicado', className: 'status-published' }
                        : { label: 'Oculto', className: 'status-hidden' };
                      return (
                        <article className="dashboard-course-card">
                          {course.coverImage ? (
                            <div className="dashboard-course-image">
                              <img src={course.coverImage} alt={course.name} />
                            </div>
                          ) : null}
                          <div className="course-content">
                            <div className="course-header-row">
                              <p className="course-code">{course.code}</p>
                              <span className={`course-status-badge ${status.className}`}>{status.label}</span>
                            </div>
                            <h4 style={{ margin: '0.15rem 0 0.3rem 0', fontSize: '0.95rem' }}>{course.name}</h4>
                            <p className="course-description" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              {course.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="course-link"
                            style={{ padding: '0 0.75rem 0.65rem', background: 'none', border: 'none', color: '#0b5ed7', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => navigate(`/courses/${course.id}`)}
                          >
                            Ver curso →
                          </button>
                        </article>
                      );
                    }}
                  />
                ) : (
                  <p className="muted">Aún no es docente en un curso.</p>
                )}
              </section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}

