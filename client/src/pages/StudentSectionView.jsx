import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { courseService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/student-section-view.css';

/**
 * =====================================================================
 * STUDENTSECTIONVIEW.JSX - Vista de Detalle de Sección para Estudiantes
 * =====================================================================
 * 
 * Propósito:
 * Muestra una sección/tema específico dentro de un curso matriculado,
 * incluyendo:
 * - Contenido: recursos (texto, video, imagen, documentos)
 * - Subsecciones: navegación jerárquica
 * - Breadcrumbs: ruta de navegación (Curso > Tema > Subtema)
 * - Botón de navegación contextual (volver a padre o al curso)
 * 
 * Flujo de Navegación:
 * - Si es subsección: volver va al tema padre
 * - Si es tema raíz: volver va a la vista del curso
 */

function PdfToggle({ src, title, onPdfClick }) {
  return (
    <div className="enrolled-resource-pdf-wrapper">
      <button type="button" className="btn-primary" onClick={() => onPdfClick(src, title)}>
        Ver PDF
      </button>
      <a href={src} download={title} className="btn-secondary">
        Descargar PDF
      </a>
    </div>
  );
}

/**
 * renderResourcePreview(resource, onImageClick)
 * 
 * Qué hace: Renderiza vista previa del recurso según su tipo.
 * Cambios: Imágenes son clickeables para fullscreen, documentos muestran solo nombre.
 */
function renderResourcePreview(resource, onImageClick) {
  if (resource.type === 'text') {
    return <p className="enrolled-resource-text">{resource.text || 'Sin contenido de texto.'}</p>;
  }

  if (resource.type === 'video' && resource.fileData) {
    return <video src={resource.fileData} controls className="enrolled-resource-media" />;
  }

  if (resource.type === 'image') {
    return (
      <img
        src={resource.fileData}
        alt={resource.title}
        className="enrolled-resource-media enrolled-resource-clickable"
        onClick={() => onImageClick(resource.fileData)}
        style={{ cursor: 'pointer' }}
      />
    );
  }

  if (resource.fileData) {
    const isPdf = resource.fileData.startsWith('data:application/pdf');
    if (isPdf) {
      return <PdfToggle src={resource.fileData} title={resource.title} onPdfClick={onImageClick} />;
    }
    return (
      <a href={resource.fileData} download={resource.title} className="enrolled-resource-link">
        Descargar documento
      </a>
    );
  }

  return <p className="enrolled-resource-text">Recurso sin vista previa.</p>;
}

/**
 * getResourceTypeLabel(type)
 * 
 * Qué hace: Convierte el type técnico a etiqueta visual en español.
 * Por qué: Para mostrar "Documento" en lugar de "document" en la UI.
 */
function getResourceTypeLabel(type) {
  if (type === 'text') return 'Texto';
  if (type === 'video') return 'Video';
  if (type === 'image') return 'Imagen';
  return 'Documento';
}

/**
 * findSectionById(nodes, targetId)
 * 
 * Qué hace: Busca recursivamente una sección por su ID en todo el árbol.
 * Por qué: Las subsecciones están anidadas en children, no solo en nivel raíz.
 */
function findSectionById(nodes, targetId) {
  for (const node of nodes) {
    if (String(node.id) === String(targetId)) {
      return node;
    }

    if (node.children && node.children.length > 0) {
      const found = findSectionById(node.children, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * findParentSectionId(nodes, targetId, parentId)
 * 
 * Qué hace: Busca el ID del padre de una sección dentro del árbol.
 * Cómo: Recorre recursivamente el árbol de secciones. Cuando encuentra targetId,
 *       retorna el parentId (que es el id del nodo actual en recursión anterior).
 * 
 * Por qué: Necesitamos saber el padre de una sección para implementar la navegación
 *          "volver al padre" de forma correcta (si estamos en subsección, volver al tema padre).
 */
function findParentSectionId(nodes, targetId, parentId = null) {
  for (const node of nodes) {
    if (String(node.id) === String(targetId)) {
      return parentId;
    }

    if (node.children.length > 0) {
      const nestedResult = findParentSectionId(node.children, targetId, node.id);
      if (nestedResult !== null) {
        return nestedResult;
      }
    }
  }

  return null;
}

/**
 * findSectionPath(nodes, targetId, currentPath)
 * 
 * Qué hace: Encuentra la ruta completa desde la raíz hasta una sección (para breadcrumbs).
 * Cómo: Recorre recursivamente el árbol construyendo un array de secciones desde raíz a objetivo.
 * 
 * Por qué: Los breadcrumbs necesitan mostrar toda la cadena jerárquica para que el usuario
 *          sepa dónde está. Ej: Curso > Tema 1 > Subtema 1.2
 */
function findSectionPath(nodes, targetId, currentPath = []) {
  for (const node of nodes) {
    const nextPath = [...currentPath, node];

    if (String(node.id) === String(targetId)) {
      return nextPath;
    }

    if (node.children.length > 0) {
      const nestedPath = findSectionPath(node.children, targetId, nextPath);
      if (nestedPath.length > 0) {
        return nestedPath;
      }
    }
  }

  return [];
}

export default function EnrolledSectionDetail() {
  const { id, sectionId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [pdfModal, setPdfModal] = useState({ open: false, src: null, title: null });

  // ============================================
  // DATA LOADING
  // ============================================
  useEffect(() => {
    const loadCourse = async () => {
      setLoadingCourse(true);
      setCourseError('');
      try {
        const response = await courseService.getCourse(id);
        setCourse(response.data?.course || null);
      } catch (err) {
        setCourseError(err.response?.data?.message || 'No se pudo cargar el curso.');
      } finally {
        setLoadingCourse(false);
      }
    };

    loadCourse();
  }, [id]);

  const section = useMemo(() => {
    if (!course) {
      return null;
    }

    return findSectionById(course.sections || [], sectionId);
  }, [course, sectionId]);

  const currentUser = useMemo(() => getSessionUser() || {}, []);

  const currentUserId = String(currentUser.id || currentUser.username || 'anonymous-user');
  const enrolled = useMemo(() => {
    if (!course) return false;
    if (course.createdByCurrentUser) return true;
    return (course.enrolledStudentIds || []).includes(currentUserId);
  }, [course, currentUserId]);
  
  // Encuentra el ID del padre de esta sección (para "volver" correctamente)
  const parentSectionId = useMemo(() => {
    if (!course) {
      return null;
    }

    return findParentSectionId(course.sections || [], sectionId);
  }, [course, sectionId]);
  
  // Encuentra la ruta completa desde raíz hasta esta sección (para breadcrumbs)
  const sectionPath = useMemo(() => {
    if (!course) {
      return [];
    }

    return findSectionPath(course.sections || [], sectionId);
  }, [course, sectionId]);

  if (loadingCourse) {
    return (
      <div className="enrolled-section-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered`)}>
          ← Volver
        </button>
        <section className="enrolled-section-card empty-manage-state">
          <h1>Cargando tema</h1>
          <p>Espera mientras se cargan los datos del curso.</p>
        </section>
      </div>
    );
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * handleBack()
   * 
   * Qué hace: Navega de vuelta de forma contextual.
   * Cómo:
   *   - Si hay padre (es subsección): va al padre
   *   - Si no hay padre (es tema raíz): va a la vista del curso
   */
  const handleBack = () => {
    if (parentSectionId) {
      navigate(`/courses/${id}/registered/sections/${parentSectionId}`);
      return;
    }

    navigate(`/courses/${id}/registered`);
  };

  if (!course || !section) {
    return (
      <div className="enrolled-section-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered`)}>
          ← Volver
        </button>
        <section className="enrolled-section-card empty-manage-state">
          <h1>Tema no encontrado</h1>
          <p>{courseError || 'El tema solicitado no existe o fue eliminado.'}</p>
        </section>
      </div>
    );
  }

  if (!enrolled && !course.createdByCurrentUser) {
    return (
      <div className="enrolled-section-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <section className="enrolled-section-card empty-manage-state">
          <h1>No estás matriculado</h1>
          <p>Debes matricularte para ver el contenido del tema.</p>
          <Link to={`/courses/${course.id}`} className="btn-primary">Ir a matricularme</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="enrolled-section-page">
      <button type="button" className="back-button" onClick={handleBack}>
        ← Volver
      </button>

      <section className="enrolled-section-hero">
        <div>
          <span className="enrolled-section-badge">Tema</span>
          <div className="section-breadcrumbs" aria-label="Ruta jerárquica del tema">
            <Link to={`/courses/${course.id}/registered`} className="breadcrumb-link">Curso matriculado</Link>
            {sectionPath.map((pathSection, index) => (
              <React.Fragment key={pathSection.id}>
                <span className="breadcrumb-separator">/</span>
                {index < sectionPath.length - 1 ? (
                  <Link
                    to={`/courses/${course.id}/registered/sections/${pathSection.id}`}
                    className="breadcrumb-link"
                  >
                    {pathSection.title}
                  </Link>
                ) : (
                  <span className="breadcrumb-current">{pathSection.title}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <h1>{section.title}</h1>
          <p>{course.code} · {course.name} · Nivel {Math.max(sectionPath.length, 1)}</p>
        </div>
      </section>

      <section className="enrolled-section-card">
        <h2>Información del tema</h2>
        <p className="enrolled-section-description">{section.description || 'Sin descripción.'}</p>
      </section>

      <section className="enrolled-section-card">
        <h2>Archivos y recursos</h2>
        {section.resources.length === 0 ? (
          <p className="muted">Este tema no tiene recursos cargados.</p>
        ) : (
          <div className="enrolled-resource-list">
            {section.resources.map((resource) => (
              <article key={resource.id} className="enrolled-resource-card">
                <div className="enrolled-resource-header">
                  <strong>{resource.title}</strong>
                  <span className="resource-chip">{getResourceTypeLabel(resource.type)}</span>
                </div>
                {renderResourcePreview(resource, (src, title) => {
                  const isPdf = src && src.startsWith('data:application/pdf');
                  if (isPdf) {
                    setPdfModal({ open: true, src, title });
                  } else {
                    setFullscreenImage(src);
                  }
                })}
              </article>
            ))}
          </div>
        )}

        {fullscreenImage && (
          <div className="image-fullscreen-modal" onClick={() => setFullscreenImage(null)}>
            <div className="image-fullscreen-container" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="image-fullscreen-close" onClick={() => setFullscreenImage(null)}>×</button>
              <img src={fullscreenImage} alt="Fullscreen view" className="image-fullscreen" />
            </div>
          </div>
        )}

        {pdfModal.open && (
          <div className="pdf-modal" onClick={() => setPdfModal({ open: false, src: null, title: null })}>
            <div className="pdf-modal-container" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="pdf-modal-close" onClick={() => setPdfModal({ open: false, src: null, title: null })}>×</button>
              <iframe src={pdfModal.src} title={pdfModal.title} className="pdf-modal-iframe" />
            </div>
          </div>
        )}
      </section>

      <section className="enrolled-section-card">
        <h2>Subtemas</h2>
        {section.children.length === 0 ? (
          <p className="muted">Este tema no tiene subtemas.</p>
        ) : (
          <div className="subtopic-grid">
            {section.children.map((child) => (
              <Link
                key={child.id}
                to={`/courses/${course.id}/registered/sections/${child.id}`}
                className="subtopic-card"
              >
                <h3>{child.title}</h3>
                <p>{child.description || 'Sin descripción'}</p>
                <div className="subtopic-meta">
                  <span>{child.children.length} subtemas</span>
                  <span>{child.resources.length} recursos</span>
                </div>
                <span className="subtopic-link">Ver subtema</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
