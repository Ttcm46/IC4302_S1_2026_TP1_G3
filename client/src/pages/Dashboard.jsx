import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { enrollmentService, messageService, userService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/dashboard.css';

/**
 * ============================================
 * DASHBOARD.JSX - Panel de Control Principal
 * ============================================
 * 
 * Propósito General:
 * Página de inicio para usuarios autenticados. Muestra un resumen personalizado:
 * - Estadísticas: cursos creados, matriculados, amigos, mensajes sin leer
 * - Carrusel de amigos con acceso rápido a perfiles
 * - Carrusel de cursos creados para gestión rápida
 * - Carrusel de cursos matriculados para acceso rápido al contenido
 * 
 * Estructura:
 * 1. Helpers: Funciones de utilidad para formateo de datos
 * 2. HorizontalCarousel: Componente reutilizable de carrusel horizontal
 * 3. Componente principal: Ensambla datos y renderiza secciones
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * getCurrentUser()
 * 
 * Qué hace: Extrae el usuario actual del localStorage.
 * Cómo: Lee 'user' del localStorage, lo parsea como JSON. Si falla o no existe, retorna {}.
 * Por qué: Necesitamos el usuario para personalizar el dashboard y hacer queries a los stores.
 */
function getCurrentUser() {
  return getSessionUser() || {};
}

/**
 * getInitials(friend)
 * 
 * Qué hace: Genera 1-2 iniciales a partir del nombre completo o username.
 * Cómo: 
 *   - Toma fullName || username como fuente
 *   - Divide en palabras, filtra vacías
 *   - Si 1 palabra: retorna 1 inicial; si 2+ palabras: retorna 2 iniciales (primera de c/palabra)
 * Por qué: Se usa como fallback visual para avatares cuando no hay imagen. Es un patrón UX estándar.
 */
function getInitials(friend) {
  const source = friend.fullName || friend.username || 'U';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * HorizontalCarousel({ items, getKey, renderItem, ariaLabel, trackClassName, itemClassName })
 * 
 * Qué hace: 
 * Un carrusel horizontal reutilizable que permite desplazarse por items. Muestra flechas de 
 * navegación cuando hay contenido que scroll y las oculta cuando todo cabe en pantalla.
 * 
 * Cómo funciona:
 * - Gestiona estado de botones (canScrollLeft, canScrollRight) basado en posición del scroll
 * - Usa ResizeObserver para detectar cambios de tamaño del contenedor
 * - scrollByStep() desplaza suavemente (85% del ancho del contenedor o 240px, lo que sea mayor)
 * - Suscriptores: eventos de scroll, resize del contenedor, resize de ventana
 * 
 * Props:
 *   items: Array de elementos a renderizar
 *   getKey: Función que retorna la clave única de cada item (ej: (item) => item.id)
 *   renderItem: Función que retorna el JSX para cada item
 *   ariaLabel: Texto descriptivo para accesibilidad
 *   trackClassName, itemClassName: Classes CSS opcionales
 * 
 * Por qué es así: Reutilizable en múltiples lugares (amigos, cursos creados, cursos matriculados).
 *                 ResizeObserver + evento resize = responde a cambios de tamaño de la ventana.
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

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return undefined;
    }

    // Función auxiliar que recalcula si podemos scroll hacia cada lado
    // Se ejecuta al montar, al hacer scroll, al cambiar tamaño del contenedor, o al cambiar ventana
    const updateControls = () => {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      setCanScrollLeft(track.scrollLeft > 4); // Pequeño offset (4px) para evitar parpadeos
      setCanScrollRight(track.scrollLeft < maxScroll - 4);
    };

    updateControls();
    track.addEventListener('scroll', updateControls, { passive: true });

    const resizeObserver = new ResizeObserver(updateControls);
    resizeObserver.observe(track);
    window.addEventListener('resize', updateControls);

    // Cleanup: remover listeners y observadores
    return () => {
      track.removeEventListener('scroll', updateControls);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateControls);
    };
  }, [items.length]);

  /**
   * scrollByStep(direction)
   * 
   * Qué hace: Desplaza el carrusel hacia la izquierda (-1) o derecha (1).
   * Cómo: Calcula un "step" (85% del ancho o 240px) y usa scrollBy() con behavior: 'smooth'.
   * Por qué: Permite que el usuario vea múltiples items de una vez, no item-por-item.
   */
  const scrollByStep = (direction) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const step = Math.max(track.clientWidth * 0.85, 240);
    track.scrollBy({
      left: direction * step,
      behavior: 'smooth'
    });
  };

  const showControls = canScrollLeft || canScrollRight;

  return (
    <div className={`carousel-shell ${showControls ? '' : 'no-controls'}`}>
      {showControls ? (
        <button
          type="button"
          className="carousel-control"
          onClick={() => scrollByStep(-1)}
          disabled={!canScrollLeft}
          aria-label="Mover elementos hacia la izquierda"
        >
          ‹
        </button>
      ) : null}

      <div
        ref={trackRef}
        className={`carousel-track ${trackClassName}`.trim()}
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <div key={getKey(item)} className={`carousel-item ${itemClassName}`.trim()}>
            {renderItem(item)}
          </div>
        ))}
      </div>

      {showControls ? (
        <button
          type="button"
          className="carousel-control"
          onClick={() => scrollByStep(1)}
          disabled={!canScrollRight}
          aria-label="Mover elementos hacia la derecha"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

/**
 * getCourseStatus(course)
 * 
 * Qué hace: Retorna un objeto con etiqueta visual del curso basado en su estado.
 * Cómo: 
 *   - Si isFinished: retorna "Terminado" con clase "status-finished"
 *   - Si isPublished: retorna "Publicado" con clase "status-published"  
 *   - Si no: retorna "Oculto" con clase "status-hidden"
 * 
 * Por qué: Los carrusos de cursos muestran estas etiquetas. Centralizar la lógica evita duplicar.
 */
function getCourseStatus(course) {
  if (course.isFinished) return { label: 'Terminado', className: 'status-finished' };
  if (course.isPublished) return { label: 'Publicado', className: 'status-published' };
  return { label: 'Oculto', className: 'status-hidden' };
}

/**
 * Dashboard Component
 * 
 * Qué hace: Renderiza el panel de control personalizado del usuario autenticado.
 * 
 * Flujo de datos:
 * 1. Se obtiene el usuario del localStorage
 * 2. Se cargan datos de varios stores: cursos, amigos, mensajes no leídos
 * 3. Se filtran y organizan:
 *    - Cursos creados por el usuario actual
 *    - Cursos en los que está matriculado
 *    - Lista de amigos
 * 4. Todo se renderiza con carruseles horizontales para UX fluida
 * 
 * Nota sobre useMemo: 
 * - Varias computaciones se cacheyan para evitar recálculos innecesarios
 * - El componente no tiene estado mutable ni re-renders frecuentes esperados
 */
export default function Dashboard() {
  // Obtiene el usuario autenticado actual
  const user = useMemo(() => getCurrentUser(), []);
  // Normaliza el ID a string (algunos usuarios usan 'id', otros 'username')
  const currentUserId = String(user.id || user.username || 'anonymous-user');
  
  const [createdCourses, setCreatedCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [friends, setFriends] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  useEffect(() => {
    const loadDashboard = async () => {
      const [createdResult, enrolledResult, friendsResult, inboxResult] = await Promise.allSettled([
        enrollmentService.getTeachingCourses(),
        enrollmentService.getMyCourses(),
        currentUserId !== 'anonymous-user' ? userService.getFriends(currentUserId) : Promise.resolve(null),
        currentUserId !== 'anonymous-user' ? messageService.getInbox() : Promise.resolve(null)
      ]);

      const createdResponse = createdResult.status === 'fulfilled' ? createdResult.value : null;
      const enrolledResponse = enrolledResult.status === 'fulfilled' ? enrolledResult.value : null;
      const friendsResponse = friendsResult.status === 'fulfilled' ? friendsResult.value : null;
      const inboxResponse = inboxResult.status === 'fulfilled' ? inboxResult.value : null;

      setCreatedCourses(Array.isArray(createdResponse?.data?.courses) ? createdResponse.data.courses : []);
      setEnrolledCourses(Array.isArray(enrolledResponse?.data?.courses) ? enrolledResponse.data.courses : []);

      const rawFriends = friendsResponse?.data?.friends;
      if (Array.isArray(rawFriends)) {
        setFriends(rawFriends.map((f) => ({
          id: String(f.id || f.userId || f),
          username: String(f.username || f.id || f.userId || f),
          fullName: String(f.name || f.fullName || f.username || f.id || f.userId || f),
          avatar: f.picPath || f.avatar || ''
        })));
      } else {
        setFriends([]);
      }

      const inboxMessages =
        (Array.isArray(inboxResponse?.data?.data) && inboxResponse.data.data)
        || (Array.isArray(inboxResponse?.data?.messages) && inboxResponse.data.messages)
        || [];
      setUnreadMessages(inboxMessages.filter((message) => message?.read !== true).length);
    };

    loadDashboard();
  }, [currentUserId]);

  return (
    <div className="dashboard-page">
      <section className="dashboard-header">
        <h1>Bienvenido {user.fullName || user.username || 'Usuario'}</h1>
      </section>

      <section className="dashboard-top-widgets">
        <article className="dashboard-section summary-section">
          <div className="section-title-row">
            <h2>Resumen</h2>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Cursos creados</span>
              <strong>{createdCourses.length}</strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">Cursos matriculados</span>
              <strong>{enrolledCourses.length}</strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">Amigos</span>
              <strong>{friends.length}</strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">Mensajes sin leer</span>
              <strong>{unreadMessages}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-section friends-section">
          <div className="section-title-row">
            <h2>Amigos</h2>
            <span className="count-pill">{friends.length}</span>
          </div>

          <HorizontalCarousel
            items={friends}
            getKey={(friend) => friend.id}
            ariaLabel="Carrusel de amigos"
            trackClassName="friends-track"
            itemClassName="friend-item"
            renderItem={(friend) => (
              <Link to={`/social?userId=${encodeURIComponent(friend.id)}`} className="friend-card friend-card-link">
                {friend.avatar ? (
                  <img src={friend.avatar} alt={`Avatar de ${friend.username}`} className="friend-avatar" />
                ) : (
                  <div className="friend-avatar friend-avatar-fallback">{getInitials(friend)}</div>
                )}
                <p className="friend-username">{friend.username}</p>
              </Link>
            )}
          />

          <div className="section-footer-actions social-dashboard-actions">
            <Link to="/social" className="btn-secondary">Ir a comunidad</Link>
            <Link to="/social/messages" className="btn-primary">Abrir mensajes</Link>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <h2>Cursos creados</h2>
          <span className="count-pill">{createdCourses.length}</span>
        </div>

        {createdCourses.length === 0 ? (
          <p className="empty-state">Aun no has creado cursos.</p>
        ) : (
          <HorizontalCarousel
            items={createdCourses}
            getKey={(course) => course.id}
            ariaLabel="Carrusel de cursos creados"
            trackClassName="courses-track"
            itemClassName="course-item"
            renderItem={(course) => {
              const status = getCourseStatus(course);
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
                    <h3>{course.name}</h3>
                    <p className="course-description">{course.description}</p>
                  </div>
                  <Link to={`/courses/${course.id}/manage`} className="course-link">Ver curso</Link>
                </article>
              );
            }}
          />
        )}

        <div className="section-footer-actions">
          <Link to="/create-course" className="btn-primary create-course-btn">Crear curso</Link>
        </div>
      </section>

      <section className="dashboard-section enrolled-section">
        <div className="section-title-row">
          <h2>Cursos matriculados</h2>
          <span className="count-pill">{enrolledCourses.length}</span>
        </div>

        {enrolledCourses.length === 0 ? (
          <p className="empty-state">Aun no estas matriculado en cursos.</p>
        ) : (
          <HorizontalCarousel
            items={enrolledCourses}
            getKey={(course) => course.id}
            ariaLabel="Carrusel de cursos matriculados"
            trackClassName="courses-track"
            itemClassName="course-item"
            renderItem={(course) => {
              const status = getCourseStatus(course);
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
                    <h3>{course.name}</h3>
                    <p className="course-description">{course.description}</p>
                  </div>
                  <Link to={`/courses/${course.id}/registered`} className="course-link">Ver curso</Link>
                </article>
              );
            }}
          />
        )}
        
        <div className="section-footer-actions">
          <Link to="/courses" className="btn-primary create-course-btn">Matricular curso</Link>
        </div>
      </section>
    </div>
  );
}
