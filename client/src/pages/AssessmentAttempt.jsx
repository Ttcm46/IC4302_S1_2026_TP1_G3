import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assessmentService, courseService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/assessment-attempt.css';

/**
 * AssessmentAttempt.jsx - Interfaz para Realizar Evaluaciones
 * 
 * Propósito:
 * Muestra una evaluación con preguntas de opción múltiple para que
 * el estudiante responda. 
 * 
 * Características:
 * - Validaciones de tiempo: upcoming/available/closed
 * - Prevención de duplicados: no permite repetir un intento si ya se realizó uno
 * - Almacenamiento automático de respuestas en localStorage al enviar (no backend)
 * - Cálculo automático de puntuación
 * 
 * Flujo:
 * 1. Mostrar estado de la evaluación (próxima/abierta/cerrada)
 * 2. Si abierta: mostrar botón "Comenzar"
 * 3. Después de comenzar: mostrar preguntas y opciones
 * 4. Validación: todas las preguntas deben tener respuesta
 * 5. Enviar: calcula score y guarda resultado
 * 6. Redirigir a resultado
 */


// Función formatDateTime(dateValue, timeValue) 
// Qué hace: formatea fecha y hora en español para mostrar. 
// (Reutilizado en otros components de evaluación)

function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return 'Sin fecha';
  const dateText = new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CR');
  return timeValue ? `${dateText} ${timeValue}` : dateText;
}

/**
 * Función getAssessmentStatus(assessment)
 * 
 * Qué hace: Determina si evaluación es upcoming/available/closed
 * Cómo:
 *   - upcoming: si 'ahora < startDate+startTime'
 *   - closed: si 'ahora > endDate+endTime'
 *   - available: si está entre esos rangos
 * Por qué: El estudiante no puede hacer la evaluación fuera de los tiempos establecidos.
 */
function getAssessmentStatus(assessment) {
  const now = new Date();
  const start = assessment.startDate
    ? new Date(`${assessment.startDate}T${assessment.startTime || '00:00'}`)
    : null;
  const end = assessment.endDate
    ? new Date(`${assessment.endDate}T${assessment.endTime || '23:59'}`)
    : null;

  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'closed';
  return 'available';
}

export default function EnrolledAssessmentAttempt() {
  const { id, assessmentId } = useParams();
  const navigate = useNavigate();
  
  // LOCAL STATE
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState({}); // { questionId: optionIndex }
  const [attemptError, setAttemptError] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);

  // DATA LOADING
  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [existingResult, setExistingResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useMemo(() => getSessionUser() || {}, []);
  const currentUserId = String(currentUser.id || currentUser.username || 'anonymous-user');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const response = await courseService.getCourse(id);
      const loadedCourse = response.data?.course || null;
      setCourse(loadedCourse);
      const foundAssessment = (loadedCourse?.assessments || []).find(
        (item) => String(item.id) === String(assessmentId)
      ) || null;
      setAssessment(foundAssessment);

      const gradeResponse = await assessmentService.getAssessmentResult(id, assessmentId);
      setExistingResult(gradeResponse.data?.result || null);
      setLoading(false);
    };

    loadData();
  }, [id, assessmentId, submittedResult]);

  const isEnrolled = useMemo(() => {
    if (!course) return false;
    if (course.createdByCurrentUser) return true;
    return (course.enrolledStudentIds || []).includes(currentUserId);
  }, [course, currentUserId]);

  if (loading) {
    return (
      <div className="assessment-attempt-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
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
      <div className="assessment-attempt-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
          ← Volver
        </button>
        <section className="assessment-attempt-card">
          <h1>Evaluación no encontrada</h1>
          <p>No se pudo cargar la evaluación solicitada.</p>
        </section>
      </div>
    );
  }

  if (!isEnrolled && !course.createdByCurrentUser) {
    return (
      <div className="assessment-attempt-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
          ← Volver
        </button>
        <section className="assessment-attempt-card">
          <h1>Acceso restringido</h1>
          <p>Debes estar matriculado para realizar esta evaluación.</p>
          <Link to={`/courses/${id}`} className="btn-primary">Ir al curso</Link>
        </section>
      </div>
    );
  }

  const status = getAssessmentStatus(assessment);

  const handleAnswerChange = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  // Con esto se validan errores comunes antes de calcular el resultado:
  // - Si ya existe un resultado previo, no se permite repetir
  // - Si falta respuesta a alguna pregunta, se muestra error

  const handleSubmit = async () => {
    if (existingResult) {
      setAttemptError('Esta evaluación ya fue realizada y no puede repetirse.');
      return;
    }

    setAttemptError('');

    for (const question of assessment.questions) {
      if (answers[question.id] === undefined) {
        setAttemptError('Debes responder todas las preguntas antes de enviar.');
        return;
      }
    }

    const totalQuestions = assessment.questions.length;
    const correctAnswers = assessment.questions.filter(
      (question) => answers[question.id] === question.correctOptionIndex
    ).length;
    const score = Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100);
    const questionResults = assessment.questions.map((question) => ({
      questionId: question.id,
      questionText: question.text,
      options: question.options.map((option) => option.text),
      correctOptionIndex: question.correctOptionIndex,
      selectedOptionIndex: answers[question.id]
    }));

    const response = await assessmentService.submitAssessment(course.id, assessment.id, {
      assessmentTitle: assessment.title,
      score,
      correctAnswers,
      totalQuestions,
      questionResults
    });
    const saved = response.data?.result;

    setSubmittedResult(saved);
    setHasStarted(false);
    setAnswers({});
  };

  const resultToShow = submittedResult || existingResult;

  // Aquí se muestra la interfaz de la evaluación.
  
  return (
    <div className="assessment-attempt-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
        ← Volver al curso
      </button>

      <section className="assessment-attempt-card">
        <p className="assessment-attempt-path">{course.code} / Evaluaciones</p>
        <h1>{assessment.title}</h1>
        <p className="muted">Inicio: {formatDateTime(assessment.startDate, assessment.startTime)}</p>
        <p className="muted">Fin: {formatDateTime(assessment.endDate, assessment.endTime)}</p>
        <p className="muted">Preguntas: {assessment.questions.length}</p>

        {resultToShow ? (
          <>
            <div className="result-banner">
              <strong>Resultado registrado:</strong> {resultToShow.correctAnswers} / {resultToShow.totalQuestions} correctas ({resultToShow.score}%).
              <div className="muted">Presentada: {new Date(resultToShow.submittedAt).toLocaleString('es-CR')}</div>
            </div>
            <div className="attempt-result-actions">
              <Link to={`/courses/${course.id}/registered/assessments/${assessment.id}/results`} className="btn-secondary">
                Ver resultados
              </Link>
            </div>
          </>
        ) : null}

        {!resultToShow && status === 'upcoming' ? (
          <div className="attempt-warning">La evaluación aún no está disponible.</div>
        ) : null}

        {!resultToShow && status === 'closed' ? (
          <div className="attempt-warning">La evaluación ya cerró y no puede realizarse.</div>
        ) : null}

        {!resultToShow && status === 'available' && !hasStarted ? (
          <div className="attempt-start-panel">
            <p>Al comenzar la evaluación debes completarla en este intento.</p>
            <button type="button" className="btn-primary" onClick={() => setHasStarted(true)}>
              Comenzar evaluación
            </button>
          </div>
        ) : null}

        {!resultToShow && status === 'available' && hasStarted ? (
          <div className="attempt-questions-panel">
            {assessment.questions.map((question, index) => (
              <div key={question.id} className="attempt-question">
                <p><strong>{index + 1}.</strong> {question.text}</p>
                <div className="attempt-options">
                  {question.options.map((option, optionIndex) => (
                    <label key={option.id} className="attempt-option">
                      <input
                        type="radio"
                        name={`attempt-${question.id}`}
                        checked={answers[question.id] === optionIndex}
                        onChange={() => handleAnswerChange(question.id, optionIndex)}
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {attemptError ? <p className="error-text">{attemptError}</p> : null}

            <div className="inline-panel-actions">
              <button type="button" className="btn-primary" onClick={handleSubmit}>
                Enviar evaluación
              </button>
              <button type="button" className="btn-secondary" onClick={() => setHasStarted(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}