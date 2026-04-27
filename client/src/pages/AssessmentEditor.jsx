import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assessmentService, courseService } from '../services/auth';
import '../styles/assessment-editor.css';

/**
 * AssessmentEditor.jsx - Editor de Detalle de Evaluación
 * 
 * Propósito:
 * Panel para editar una evaluación existente, se editan:
 * - Metadatos: título, fechas y horas de inicio/fin
 * - Preguntas de múltiple opción
 * - Opciones por pregunta y respuesta correcta
 * 
 * Arquitectura:
 * - Carga evaluación por ID desde assessmentStore (no backend)
 * - Dos modos: lectura (vista previa) y edición (formularios)
 * - refreshKey fuerza actualizaciones desde el store
 * - Un useEffect sincroniza los datos cargados con los formularios
 */

/**
 * Funciones formatDate(value) & formatDateTime(dateValue, timeValue)
 * 
 * Qué hace: Convierten fechas/horas ISO a formato legible es-CR.
 * Cómo: parseDate ISO usando new Date(), luego toLocaleDateString() o combinada con hora.
 */
function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CR');
}

function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return 'Sin fecha';
  const dateText = new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CR');
  return timeValue ? `${dateText} ${timeValue}` : dateText;
}

export default function ManageAssessmentDetail() {
  const { id, assessmentId } = useParams();
  const navigate = useNavigate();
  
  // STATE MANAGEMENT
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Formulario de metadatos (título, fechas)
  const [metaForm, setMetaForm] = useState({ title: '', startDate: '', startTime: '', endDate: '', endTime: '' });
  
  // Array de preguntas siendo editadas
  const [questions, setQuestions] = useState([]);
  
  // Alterna entre modo lectura y edición
  const [isEditing, setIsEditing] = useState(false);
  
  const [formError, setFormError] = useState('');

  // DATA FETCHING
  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssessment = async () => {
      setLoading(true);
      const response = await courseService.getCourse(id);
      const loadedCourse = response.data?.course || null;
      setCourse(loadedCourse);

      const foundAssessment = (loadedCourse?.assessments || []).find(
        (item) => String(item.id) === String(assessmentId)
      ) || null;
      setAssessment(foundAssessment);
      setLoading(false);
    };

    loadAssessment();
  }, [id, assessmentId, refreshKey]);

  /**
   * Efecto de Sincronización:
   * Cuando se carga una evaluación, copia sus datos a los formularios locales.
   * Transforma la estructura del store en estructura editable (con _key para React keys).
   */
  useEffect(() => {
    if (!assessment) return;
    setMetaForm({
      title: assessment.title,
      startDate: assessment.startDate || '',
      startTime: assessment.startTime || '',
      endDate: assessment.endDate || '',
      endTime: assessment.endTime || ''
    });
    setQuestions(
      assessment.questions.map((q) => ({
        _key: String(q.id),
        id: q.id,
        text: q.text,
        options: q.options.map((o) => ({ _key: String(o.id), id: o.id, text: o.text })),
        correctOptionIndex: q.correctOptionIndex ?? 0
      }))
    );
  }, [assessment]);

  if (loading) {
    return (
      <div className="manage-assessment-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver
        </button>
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (!course || !assessment) {
    return (
      <div className="manage-assessment-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver
        </button>
        <div className="manage-assessment-panel empty-manage-state">
          <h1>Evaluación no encontrada</h1>
          <p>Esta evaluación no existe o fue eliminada.</p>
        </div>
      </div>
    );
  }

  // Función refresh()
  // Incrementa refreshKey para forzar que useMemo(getAssessmentById...) se re-ejecute.

  const refresh = () => setRefreshKey((v) => v + 1);

  
  // QUESTION MANIPULATION HELPERS
   
  // Función makeBlankQuestion() 
  // Qué hace: Retorna una pregunta nueva en blanco con 2 opciones iniciales.
  // Cómo: Se usa para agregar nuevas preguntas al formulario de edición.

  const makeBlankQuestion = () => ({
    _key: String(Date.now() + Math.random()),
    text: '',
    options: [
      { _key: String(Math.random()), text: '' },
      { _key: String(Math.random()), text: '' }
    ],
    correctOptionIndex: 0
  });

  // Handlers para agregar/remover preguntas y opciones

  const handleAddQuestion = () =>
    setQuestions((prev) => [...prev, makeBlankQuestion()]);

  const handleRemoveQuestion = (qi) =>
    setQuestions((prev) => prev.filter((_, i) => i !== qi));

  const handleQuestionText = (qi, text) =>
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, text } : q)));

  const handleAddOption = (qi) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: [...q.options, { _key: String(Math.random()), text: '' }] } : q
      )
    );

  const handleRemoveOption = (qi, oi) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const opts = q.options.filter((_, j) => j !== oi);
        return {
          ...q,
          options: opts,
          correctOptionIndex:
            q.correctOptionIndex >= opts.length ? Math.max(0, opts.length - 1) : q.correctOptionIndex
        };
      })
    );

  const handleOptionText = (qi, oi, text) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, text } : o)) }
          : q
      )
    );

  const handleCorrectOption = (qi, oi) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, correctOptionIndex: oi } : q))
    );

  // SAVE & DELETE OPERATIONS

  // Función handleSave()
  // Qué hace: Valida y guarda cambios a la evaluación.
  // Cómo: Valida metadatos y preguntas exhaustivamente, luego llama updateCourseAssessment().

  const handleSave = async () => {
    setFormError('');

    if (!metaForm.title.trim()) { setFormError('La evaluación debe tener un nombre.'); return; }
    if (!metaForm.startDate) { setFormError('La fecha de inicio es obligatoria.'); return; }
    if (!metaForm.startTime) { setFormError('La hora de inicio es obligatoria.'); return; }
    if (metaForm.endDate && !metaForm.endTime) { setFormError('Si defines fecha de fin, debes indicar la hora de fin.'); return; }
    if (metaForm.endDate && metaForm.endDate < metaForm.startDate) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio.'); return;
    }

    if (metaForm.endDate && metaForm.endTime) {
      const startDateTime = new Date(`${metaForm.startDate}T${metaForm.startTime}`);
      const endDateTime = new Date(`${metaForm.endDate}T${metaForm.endTime}`);

      if (endDateTime < startDateTime) {
        setFormError('La fecha y hora de fin no pueden ser anteriores al inicio.');
        return;
      }
    }
    if (questions.length === 0) { setFormError('Debe existir al menos una pregunta.'); return; }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setFormError(`La pregunta ${i + 1} no tiene texto.`); return; }
      if (q.options.length < 2) { setFormError(`La pregunta ${i + 1} debe tener al menos 2 opciones.`); return; }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim()) {
          setFormError(`La opción ${j + 1} de la pregunta ${i + 1} está vacía.`); return;
        }
      }
    }

    await assessmentService.updateAssessment(id, assessment.id, {
      ...metaForm,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correctOptionIndex: q.correctOptionIndex
      }))
    });

    setIsEditing(false);
    refresh();
  };

  // Función handleDelete()
  // Qué hace: Elimina la evaluación (con confirmación) y navega de vuelta.

  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar esta evaluación? Esta acción es irreversible.')) return;
    await assessmentService.deleteAssessment(id, assessment.id);
    navigate(`/courses/${id}/manage`);
  };

  /* ── render read-only ──────────────────────────────── */
  const renderReadOnly = () => (
    <>
      <section className="assessment-detail-meta-card">
        <div className="assessment-detail-meta-row">
          <div className="assessment-detail-meta-item">
            <span>Fecha de inicio</span>
            <strong>{formatDateTime(assessment.startDate, assessment.startTime)}</strong>
          </div>
          <div className="assessment-detail-meta-item">
            <span>Fecha de fin</span>
            <strong>{formatDateTime(assessment.endDate, assessment.endTime)}</strong>
          </div>
          <div className="assessment-detail-meta-item">
            <span>Preguntas</span>
            <strong>{assessment.questions.length}</strong>
          </div>
        </div>
      </section>

      <section className="assessment-detail-questions">
        {assessment.questions.map((q, qi) => (
          <article key={q.id} className="assessment-ro-question">
            <div className="assessment-ro-question-header">
              <span className="assessment-ro-number">{qi + 1}</span>
              <p className="assessment-ro-text">{q.text}</p>
            </div>
            <ol className="assessment-ro-options">
              {q.options.map((o, oi) => (
                <li
                  key={o.id}
                  className={`assessment-ro-option ${oi === q.correctOptionIndex ? 'correct' : ''}`}
                >
                  {oi === q.correctOptionIndex && <span className="correct-badge">✓</span>}
                  {o.text}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </>
  );

  /* ── render edit ───────────────────────────────────── */
  const renderEdit = () => (
    <section className="assessment-edit-form">
      <div className="assessment-edit-meta">
        <div className="form-group">
          <label htmlFor="editTitle">Nombre de la evaluación</label>
          <input
            id="editTitle"
            type="text"
            value={metaForm.title}
            onChange={(e) => setMetaForm((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className="assessment-edit-dates">
          <div className="form-group">
            <label htmlFor="editStart">Fecha de inicio</label>
            <input
              id="editStart"
              type="date"
              value={metaForm.startDate}
              onChange={(e) => setMetaForm((p) => ({ ...p, startDate: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editStartTime">Hora de inicio</label>
            <input
              id="editStartTime"
              type="time"
              value={metaForm.startTime}
              onChange={(e) => setMetaForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </div>
        </div>

        <div className="assessment-edit-dates">
          <div className="form-group">
            <label htmlFor="editEnd">Fecha de fin</label>
            <input
              id="editEnd"
              type="date"
              value={metaForm.endDate}
              onChange={(e) => setMetaForm((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editEndTime">Hora de fin</label>
            <input
              id="editEndTime"
              type="time"
              value={metaForm.endTime}
              onChange={(e) => setMetaForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <h3 className="edit-questions-heading">Preguntas</h3>

      <div className="assessment-edit-question-list">
        {questions.map((q, qi) => (
          <div key={q._key} className="assessment-edit-question-card">
            <div className="assessment-edit-question-header">
              <span className="assessment-question-label">Pregunta {qi + 1}</span>
              <button type="button" className="btn-danger btn-xs" onClick={() => handleRemoveQuestion(qi)}>
                Eliminar
              </button>
            </div>

            <div className="form-group">
              <input
                type="text"
                value={q.text}
                onChange={(e) => handleQuestionText(qi, e.target.value)}
                placeholder="Texto de la pregunta"
              />
            </div>

            <div className="assessment-options-list">
              {q.options.map((o, oi) => (
                <div key={o._key} className="assessment-option-row">
                  <input
                    type="radio"
                    name={`correct-edit-${q._key}`}
                    checked={q.correctOptionIndex === oi}
                    onChange={() => handleCorrectOption(qi, oi)}
                    title="Respuesta correcta"
                  />
                  <input
                    type="text"
                    value={o.text}
                    onChange={(e) => handleOptionText(qi, oi, e.target.value)}
                    placeholder={`Opción ${oi + 1}`}
                    className="option-text-input"
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      className="btn-icon-remove"
                      onClick={() => handleRemoveOption(qi, oi)}
                      title="Eliminar opción"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="btn-secondary btn-sm add-option-btn" onClick={() => handleAddOption(qi)}>
              + Agregar opción
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary add-question-btn" onClick={handleAddQuestion}>
        + Agregar pregunta
      </button>

      {formError && <p className="error-text">{formError}</p>}

      <div className="assessment-edit-actions">
        <button type="button" className="btn-primary" onClick={handleSave}>
          Guardar cambios
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setIsEditing(false); setFormError(''); }}>
          Cancelar
        </button>
      </div>
    </section>
  );

  return (
    <div className="manage-assessment-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
        ← Volver a gestión del curso
      </button>

      <header className="assessment-detail-hero">
        <div>
          <span className="assessment-detail-eyebrow">{course.code} · {course.name}</span>
          <h1>{assessment.title}</h1>
          {course.isFinished ? <p className="finished-notice">Este curso ha terminado. La evaluación no se puede modificar.</p> : null}
        </div>
      </header>

      {isEditing && !course.isFinished ? renderEdit() : renderReadOnly()}

      {!course.isFinished ? (
        <section className="assessment-actions-panel">
          {!isEditing ? (
            <div className="assessment-actions-row">
              <button type="button" className="btn-primary action-btn" onClick={() => setIsEditing(true)}>
                Modificar
              </button>
              <button type="button" className="btn-danger action-btn" onClick={handleDelete}>
                Eliminar evaluación
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
