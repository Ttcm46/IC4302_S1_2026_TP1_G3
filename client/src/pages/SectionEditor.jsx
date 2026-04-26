import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { courseService } from '../services/auth';
import '../styles/section-editor.css';

/**
 * SectionEditor.jsx - Editor de Detalle de Sección (Subsecciones + Recursos)
 * 
 * Propósito:
 * Panel para editar una sección específica y gestionar:
 * - Información de la sección (nombre, descripción)
 * - Subsecciones (subtemas anidados)
 * - Recursos de la sección (contenidos)
 * 
 * Arquitectura:
 * - Similar a CourseEditor pero enfocado en una sección única
 * - Carga la sección con getSectionById(courseId, sectionId)
 * - refreshKey fuerza actualizaciones
 * - Múltiples estados para edición inline de subtemas y recursos
 */

const initialResourceForm = {
  type: 'text',
  title: '',
  text: '',
  url: '',
  fileData: ''
};

/**
 * Función getResourceLabel(type)
 * 
 * Qué hace: Retorna una etiqueta legible para el tipo de recurso.
 * Cómo: Mapea type ('text', 'video', 'image', ...) a strings en español.
 * Por qué: Se usa para mostrar el tipo de contenido en la UI.
 */
function getResourceLabel(type) {
  if (type === 'text') return 'Texto';
  if (type === 'video') return 'Video';
  if (type === 'image') return 'Imagen';
  return 'Documento';
}

export default function ManageSectionDetail() {
  const { id, sectionId } = useParams();
  const navigate = useNavigate();
  
  // Manejo de estado
  const [refreshKey, setRefreshKey] = useState(0); // Para forzar refrescos desde el store
  
  // Formulario de edición de la sección actual
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });
  
  // Edición inline de subtemas
  const [editingSubtopicId, setEditingSubtopicId] = useState(null);
  const [editingSubtopicForm, setEditingSubtopicForm] = useState({ title: '', description: '' });
  
  // Edición inline de recursos
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [editingResourceForm, setEditingResourceForm] = useState(initialResourceForm);
  
  const [sectionError, setSectionError] = useState('');
  const [loading, setLoading] = useState(true);

  // Manejo de datos
  const [course, setCourse] = useState(null);

  const section = useMemo(() => {
    const findSection = (sections) => {
      for (const current of sections || []) {
        if (String(current.id) === String(sectionId)) return current;
        const found = findSection(current.children || []);
        if (found) return found;
      }
      return null;
    };

    return findSection(course?.sections || []);
  }, [course, sectionId]);

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      try {
        const response = await courseService.getCourse(id);
        setCourse(response.data?.course || null);
      } catch {
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id, refreshKey]);

  // Efecto para cargar los datos de la sección en el formulario cuando se carga
  useEffect(() => {
    if (!section) {
      return;
    }

    setSectionForm({
      title: section.title,
      description: section.description
    });
  }, [section]);

  if (loading) {
    return (
      <div className="manage-section-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver
        </button>
        <div className="manage-section-panel empty-manage-state">
          <h1>Cargando sección...</h1>
        </div>
      </div>
    );
  }

  if (!course || !section) {
    return (
      <div className="manage-section-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver
        </button>
        <div className="manage-section-panel empty-manage-state">
          <h1>Sección no encontrada</h1>
          <p>Esta sección no existe o fue eliminada.</p>
        </div>
      </div>
    );
  }

  // Funciones utilitarias

  /**
   * resetRefresh()
   * 
   * Qué hace: Incrementa refreshKey para forzar que useMemo() vuelva a ejecutarse.
   * Cómo: Suma 1 a refreshKey, lo cual lo incluye en las dependencias de useMemo.
   * Por qué: Los stores son mutables. Sin esto, los cambios no aparecerían en pantalla.
   */
  const resetRefresh = () => {
    setRefreshKey((value) => value + 1);
  };

  // Manejadores de eventos para operaciones relacionadas con la sección (guardar cambios, eliminar sección)

  /**
   * handleSectionSave(event)
   * 
   * Qué hace: Guarda cambios a la información de la sección actual (nombre, descripción).
   * Cómo:
   *   1. Valida que title y description no estén vacíos
   *   2. Llama a updateCourseSection(courseId, sectionId, formData)
   *   3. Incrementa refreshKey
   */
  const handleSectionSave = async (event) => {
    event.preventDefault();
    setSectionError('');

    if (!sectionForm.title.trim() || !sectionForm.description.trim()) {
      setSectionError('Debes completar el nombre y la descripción de la sección.');
      return;
    }

    try {
      await courseService.updateSection(section.id, {
        title: sectionForm.title,
        description: sectionForm.description,
        parentId: section.parentId || '',
        resources: section.resources || []
      });
      resetRefresh();
    } catch (err) {
      setSectionError(err.response?.data?.message || 'No fue posible actualizar la sección.');
    }
  };

  /**
   * handleSectionDelete()
   * 
   * Qué hace: Elimina la sección actual (con confirmación) y navega de vuelta al editor del curso.
   * Cómo: Pide confirmación con window.confirm(), luego llama deleteCourseSection().
   * Por qué: Es destrucción de datos, necesita confirmación.
   */
  const handleSectionDelete = async () => {
    const confirmDelete = window.confirm('¿Seguro que deseas eliminar esta sección y todos sus subtemas/materiales?');
    if (!confirmDelete) {
      return;
    }

    try {
      await courseService.deleteSection(section.id);
      navigate(`/courses/${id}/manage`);
    } catch {
      setSectionError('No fue posible eliminar la sección.');
    }
  };

  // Manejadores de eventos para operaciones relacionadas con subtemas (subsecciones)

  const startEditingSubtopic = (subtopic) => {
    setEditingSubtopicId(subtopic.id);
    setEditingSubtopicForm({
      title: subtopic.title,
      description: subtopic.description
    });
  };

  const saveSubtopicEdit = async (event) => {
    event.preventDefault();

    if (!editingSubtopicForm.title.trim() || !editingSubtopicForm.description.trim()) {
      return;
    }

    const parentSection = (section.children || []).find((child) => child.id === editingSubtopicId);

    try {
      await courseService.updateSection(editingSubtopicId, {
        title: editingSubtopicForm.title,
        description: editingSubtopicForm.description,
        parentId: parentSection?.parentId || section.id,
        resources: parentSection?.resources || []
      });
      setEditingSubtopicId(null);
      setEditingSubtopicForm({ title: '', description: '' });
      resetRefresh();
    } catch {
      setSectionError('No fue posible actualizar el subtema.');
    }
  };

  const removeSubtopic = async (subtopicId) => {
    const confirmDelete = window.confirm('¿Eliminar este subtema y su contenido asociado?');
    if (!confirmDelete) {
      return;
    }

    try {
      await courseService.deleteSection(subtopicId);
      resetRefresh();
    } catch {
      setSectionError('No fue posible eliminar el subtema.');
    }
  };

  // Manejadores de eventos para operaciones relacionadas con recursos (contenidos)

  /**
   * handleResourceFile(event)
   * 
   * Qué hace: Procesa la carga de un archivo para un recurso.
   * Cómo: Lee el archivo con FileReader y lo almacena como base64 en editingResourceForm.fileData.
   * Por qué: Sin backend, los archivos se persisten como base64.
   * Hay que cambiar esto cuando se implemente el backend.
   */
  const handleResourceFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = String(reader.result || '');
      setEditingResourceForm((previous) => ({ ...previous, fileData }));
    };
    reader.readAsDataURL(file);
  };

  const startEditingResource = (resource) => {
    setEditingResourceId(resource.id);
    setEditingResourceForm({
      type: resource.type,
      title: resource.title,
      text: resource.text || '',
      url: resource.url || '',
      fileData: resource.fileData || ''
    });
  };

  const saveResourceEdit = async (event) => {
    event.preventDefault();

    if (!editingResourceForm.title.trim()) {
      setSectionError('El material debe tener título.');
      return;
    }

    try {
      await courseService.updateSectionResource(section.id, editingResourceId, {
        type: editingResourceForm.type,
        title: editingResourceForm.title,
        text: editingResourceForm.text,
        url: editingResourceForm.url,
        fileData: editingResourceForm.fileData
      });
      setEditingResourceId(null);
      setEditingResourceForm(initialResourceForm);
      resetRefresh();
    } catch (err) {
      setSectionError(err.response?.data?.message || 'No fue posible actualizar el material.');
    }
  };

  const removeResource = async (resourceId) => {
    const confirmDelete = window.confirm('¿Eliminar este material?');
    if (!confirmDelete) {
      return;
    }

    try {
      await courseService.deleteSectionResource(section.id, resourceId);
      resetRefresh();
    } catch (err) {
      setSectionError(err.response?.data?.message || 'No fue posible eliminar el material.');
    }
  };

  /**
   * renderResourcePreview(resource)
   * 
   * Qué hace: Renderiza una vista previa del recurso según su tipo.
   * Cómo:
   *   - text: Muestra el texto directamente
   *   - video: Video embed si tiene fileData, o link si es URL
   *   - image: Etiqueta <img> con fileData
   *   - document: Link para descargar
   */
  const renderResourcePreview = (resource) => {
    if (resource.type === 'text') {
      return <p>{resource.text || 'Sin contenido de texto.'}</p>;
    }

    if (resource.type === 'video') {
      if (resource.fileData) {
        return <video src={resource.fileData} controls className="resource-video" />;
      }

      return (
        <a href={resource.url} target="_blank" rel="noreferrer" className="resource-link">
          Ver video
        </a>
      );
    }

    if (resource.type === 'image') {
      return <img src={resource.fileData} alt={resource.title} className="resource-image" />;
    }

    return (
      <a href={resource.fileData} target="_blank" rel="noreferrer" className="resource-link">
        Abrir documento
      </a>
    );
  };

  // Interfaz.
  
  return (
    <div className="manage-section-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
        ← Volver a secciones del curso
      </button>

      <section className="manage-section-hero">
        <div>
          <span className={`course-status-badge ${course.isFinished ? 'finished' : 'draft'}`}>
            {course.isFinished ? 'Curso terminado' : 'Detalle de sección'}
          </span>
          <h1>{section.title}</h1>
          <p>Curso: {course.name}</p>
          {course.isFinished ? <p className="finished-notice">Este curso ha terminado. El contenido no se puede modificar.</p> : null}
        </div>
      </section>

      <section className="manage-section-grid">
        <article className="manage-section-panel">
          <h2>Descripción del tema/subtema</h2>
          {course.isFinished ? (
            <>
              <div className="form-group">
                <label>Nombre</label>
                <p><strong>{sectionForm.title}</strong></p>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <p>{sectionForm.description || 'Sin descripción.'}</p>
              </div>
            </>
          ) : (
          <form className="section-form" onSubmit={handleSectionSave}>
            <div className="form-group">
              <label htmlFor="sectionTitle">Nombre</label>
              <input
                id="sectionTitle"
                value={sectionForm.title}
                onChange={(event) => setSectionForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="sectionDescription">Descripción</label>
              <textarea
                id="sectionDescription"
                value={sectionForm.description}
                onChange={(event) => setSectionForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            {sectionError ? <p className="error-text">{sectionError}</p> : null}
            <div className="inline-actions">
              <button type="submit" className="btn-primary">Guardar cambios</button>
              <button type="button" className="btn-danger" onClick={handleSectionDelete}>Eliminar sección</button>
            </div>
          </form>
          )}
        </article>

        <article className="manage-section-panel">
          <h2>Subtemas</h2>
          <div className="detail-list">
            {section.children.length === 0 ? (
              <p className="muted-copy">No hay subtemas aún.</p>
            ) : (
              section.children.map((subtopic) => (
                <div key={subtopic.id} className="detail-item">
                  {editingSubtopicId === subtopic.id ? (
                    <form className="section-form compact-form" onSubmit={saveSubtopicEdit}>
                      <div className="form-group">
                        <label>Nombre</label>
                        <input
                          value={editingSubtopicForm.title}
                          onChange={(event) => setEditingSubtopicForm((prev) => ({ ...prev, title: event.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Descripción</label>
                        <textarea
                          value={editingSubtopicForm.description}
                          onChange={(event) => setEditingSubtopicForm((prev) => ({ ...prev, description: event.target.value }))}
                        />
                      </div>
                      <div className="inline-actions">
                        <button type="submit" className="btn-primary">Guardar</button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingSubtopicId(null)}>Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3>{subtopic.title}</h3>
                      <p>{subtopic.description}</p>
                      {!course.isFinished ? (
                        <div className="inline-actions">
                          <button type="button" className="btn-secondary" onClick={() => startEditingSubtopic(subtopic)}>Modificar</button>
                          <button type="button" className="btn-danger" onClick={() => removeSubtopic(subtopic.id)}>Eliminar</button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </article>

        <article className="manage-section-panel">
          <h2>Materiales</h2>
          <div className="detail-list">
            {section.resources.length === 0 ? (
              <p className="muted-copy">No hay materiales en esta sección.</p>
            ) : (
              section.resources.map((resource) => (
                <div key={resource.id} className="detail-item">
                  {editingResourceId === resource.id ? (
                    <form className="section-form compact-form" onSubmit={saveResourceEdit}>
                      <div className="form-group">
                        <label>Título</label>
                        <input
                          value={editingResourceForm.title}
                          onChange={(event) => setEditingResourceForm((prev) => ({ ...prev, title: event.target.value }))}
                        />
                      </div>

                      {editingResourceForm.type === 'text' ? (
                        <div className="form-group">
                          <label>Texto</label>
                          <textarea
                            value={editingResourceForm.text}
                            onChange={(event) => setEditingResourceForm((prev) => ({ ...prev, text: event.target.value }))}
                          />
                        </div>
                      ) : null}

                      {editingResourceForm.type === 'video' ? (
                        <div className="form-group">
                          <label>Reemplazar video</label>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleResourceFile}
                          />
                        </div>
                      ) : null}

                      {editingResourceForm.type === 'document' || editingResourceForm.type === 'image' ? (
                        <div className="form-group">
                          <label>Reemplazar archivo</label>
                          <input
                            type="file"
                            accept={editingResourceForm.type === 'document' ? '.pdf,.doc,.docx,.txt' : 'image/*'}
                            onChange={handleResourceFile}
                          />
                        </div>
                      ) : null}

                      <div className="inline-actions">
                        <button type="submit" className="btn-primary">Guardar</button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingResourceId(null)}>Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="resource-chip">{getResourceLabel(resource.type)}</p>
                      <h3>{resource.title}</h3>
                      {renderResourcePreview(resource)}
                      {!course.isFinished ? (
                        <div className="inline-actions">
                          <button type="button" className="btn-secondary" onClick={() => startEditingResource(resource)}>Modificar</button>
                          <button type="button" className="btn-danger" onClick={() => removeResource(resource.id)}>Eliminar</button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
