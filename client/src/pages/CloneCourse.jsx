import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { courseService } from '../services/auth';
import '../styles/clone-course.css';

/**
 * CloneCourse.jsx - Duplicar un Curso Existente
 * 
 * Propósito:
 * Interfaz para que un profesor duplique un curso existente.
 * Incluye:
 * - Vista previa de toda la estructura del curso a clonar
 * - Desglose de secciones, subsecciones y recursos
 * - Formulario para cambiar metadatos del nuevo curso
 * - Botón para crear la copia
 * 
 * Características:
 * - Árbol jerárquico de secciones/subsecciones
 * - Contador de recursos por sección
 * - Vista de lectura del contenido a copiar
 */

/**
 * Función countSectionResources(section)
 * 
 * Qué hace: Cuenta todos los recursos en una sección (incluyendo hijos recursivamente).
 * Cómo: Suma recursos propios + suma recursiva de recursos en hijos.
 * Por qué: Para mostrar estadística de "X materiales" en la previa.
 */
function countSectionResources(section) {
  const own = (section.resources || []).length;
  const children = (section.children || []).reduce(
    (sum, child) => sum + countSectionResources(child),
    0
  );
  return own + children;
}

/**
 * Función SectionSummaryNode({ section, depth })
 * 
 * Qué hace: Componente recursivo para renderizar árbol jerárquico de secciones.
 * Muestra: Título, contador de subsecciones, contador de recursos, lista de archivos.
 */
function SectionSummaryNode({ section, depth = 0 }) {
  const totalResources = countSectionResources(section);

  return (
    <div className="clone-section-node" style={{ marginLeft: `${depth * 16}px` }}>
      <div className="clone-section-row">
        <span className="clone-section-title">{section.title}</span>
        <span className="clone-section-stats">
          {section.children.length > 0 && (
            <span>{section.children.length} subtema{section.children.length !== 1 ? 's' : ''}</span>
          )}
          <span>{totalResources} material{totalResources !== 1 ? 'es' : ''}</span>
        </span>
      </div>
      {section.description && (
        <p className="clone-section-desc">{section.description}</p>
      )}
      {(section.resources || []).length > 0 && (
        <ul className="clone-resource-list">
          {section.resources.map((resource) => (
            <li key={resource.id} className="clone-resource-item">
              <span className={`clone-resource-badge clone-resource-badge--${resource.type}`}>
                {resource.type === 'text' ? 'Texto'
                  : resource.type === 'video' ? 'Video'
                  : resource.type === 'image' ? 'Imagen'
                  : 'Documento'}
              </span>
              {resource.title}
            </li>
          ))}
        </ul>
      )}
      {(section.children || []).map((child) => (
        <SectionSummaryNode key={child.id} section={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function CloneCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: source?.description || '',
    startDate: '',
    endDate: '',
    coverImage: source?.coverImage || ''
  });
  const [preview, setPreview] = useState(source?.coverImage || '');
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState(''); // Validación de código duplicado
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado de carga durante clonación

  useEffect(() => {
    const loadSource = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await courseService.getCourse(id);
        const course = response.data?.course || null;
        setSource(course);
        setForm((prev) => ({
          ...prev,
          description: course?.description || '',
          coverImage: course?.coverImage || ''
        }));
        setPreview(course?.coverImage || '');
      } catch (err) {
        setSource(null);
        setError(err.response?.data?.message || 'No fue posible cargar el curso a clonar.');
      } finally {
        setLoading(false);
      }
    };

    loadSource();
  }, [id]);

  if (loading) {
    return (
      <div className="clone-course-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver a gestión del curso
        </button>
        <div className="clone-course-panel empty-manage-state">
          <h1>Cargando curso...</h1>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="clone-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="clone-course-panel empty-manage-state">
          <h1>Curso no encontrado</h1>
          <p>{error || 'El curso de origen no existe o fue eliminado.'}</p>
        </div>
      </div>
    );
  }

  // Estadísticas del curso original para mostrar en la previa.
  
  const totalSections = source.sections.length;
  const totalResources = source.sections.reduce(
    (sum, section) => sum + countSectionResources(section), 0
  );

  // Se manejan cambios en el formulario y la imagen, con validación básica al enviar.

  const handleChange = async (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Conexión CloneCourse: Validar código en tiempo real
    if (name === 'code' && value.trim()) {
      const exists = await courseService.checkCodeExists(value.trim());
      if (exists) {
        setCodeError(`El código "${value.trim()}" ya está en uso. Por favor, usa otro.`);
      } else {
        setCodeError("");
      }
    } else if (name === 'code') {
      setCodeError("");
    }
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || '');
      setForm((prev) => ({ ...prev, coverImage: imageData }));
      setPreview(imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.code.trim() || !form.name.trim() || !form.description.trim() || !form.startDate) {
      setError('Código, nombre, descripción y fecha de inicio son obligatorios.');
      return;
    }

    if (codeError) {
      setError(codeError);
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setError('La fecha de fin no puede ser menor a la de inicio.');
      return;
    }

    // Conexión CloneCourse: Mostrar estado de carga y esperar a que se clone completamente
    setIsSubmitting(true);
    try {
      const response = await courseService.cloneCourse(id, form);
      const newCourseCode = response.data?.course?.class?.classCode;
      if (!newCourseCode) {
        setError('No se pudo crear la copia del curso. Inténtalo de nuevo.');
        setIsSubmitting(false);
        return;
      }

      // Navegación exitosa tras clonar completamente
      navigate(`/courses/${newCourseCode}/manage`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear la copia del curso. Inténtalo de nuevo.');
      setIsSubmitting(false);
      return;
    }
  };

  // interfaz.
  
  return (
    <div className="clone-course-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
        ← Volver a gestión del curso
      </button>

      <div className="clone-course-header">
        <span className="clone-course-badge">Clonar curso</span>
        <h1>Copia de: {source.name}</h1>
        <p>
          Define el nuevo código, nombre y fechas del curso copia. La descripción, secciones y
          materiales del curso original se transferirán automáticamente. Las evaluaciones no se copian.
        </p>
      </div>

      <div className="clone-course-layout">
        <section className="clone-form-panel">
          <h2>Datos del nuevo curso</h2>
          <form className="clone-course-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="clone-code">Código del curso *</label>
                <input
                  id="clone-code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  required
                />
                {codeError && <p className="error-text">{codeError}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="clone-name">Nombre del curso *</label>
                <input
                  id="clone-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full">
                <label htmlFor="clone-description">Descripción *</label>
                <textarea
                  id="clone-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Descripción del nuevo curso"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="clone-startDate">Fecha de inicio *</label>
                <input
                  id="clone-startDate"
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="clone-endDate">Fecha de fin (opcional)</label>
                <input
                  id="clone-endDate"
                  name="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={handleChange}
                />
                <span className="field-help">Déjalo vacío si el curso siempre estará disponible.</span>
              </div>

              <div className="form-group full">
                <label htmlFor="clone-coverImage">Foto del curso</label>
                <input
                  id="clone-coverImage"
                  name="coverImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                />
                <span className="field-help">
                  Si no subes imagen, se usará la portada del curso original.
                </span>
                {preview && (
                  <img src={preview} alt="Vista previa del curso" className="image-preview" />
                )}
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            {isSubmitting && (
              <div className="clone-submitting-message">
                <p>⏳ Clonando curso... Por favor espera a que se complete.</p>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/courses/${id}/manage`)}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Clonando...' : 'Crear copia del curso'}
              </button>
            </div>
          </form>
        </section>

        <aside className="clone-summary-panel">
          <div className="clone-summary-header">
            <h2>Contenido que se copiará</h2>
            <div className="clone-summary-stats">
              <span className="clone-stat-pill">{totalSections} sección{totalSections !== 1 ? 'es' : ''}</span>
              <span className="clone-stat-pill">{totalResources} material{totalResources !== 1 ? 'es' : ''}</span>
            </div>
          </div>

          <p className="clone-summary-note">
            Las evaluaciones <strong>no</strong> se copian.
          </p>

          {source.sections.length === 0 ? (
            <div className="clone-empty-content">
              <p>Este curso aún no tiene secciones ni materiales.</p>
            </div>
          ) : (
            <div className="clone-section-tree">
              {source.sections.map((section) => (
                <SectionSummaryNode key={section.id} section={section} depth={0} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
