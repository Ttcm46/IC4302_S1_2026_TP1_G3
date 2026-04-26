import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assessmentService, courseService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/assessment-result.css';

/**
 * AssessmentResult.jsx - Vista de Resultados de Evaluación para Estudiante
 * 
 * Propósito:
 * Muestra los detalles de una evaluación después de que el estudiante la haya resuelto. 
 * Incluye:
 * - Score final (porcentaje)
 * - Desglose por pregunta
 * - Respuesta correcta vs respuesta del estudiante
 * 
 * Flujo:
 * 1. Obtiene el resultado guardado de la evaluación
 * 2. Si no existe resultado: muestra "aún no resuelto" (está para evitar errores, realmente no debería pasar)
 * 3. Si existe: muestra score y análisis detallado
 */

// Función formatDateTime(dateValue, timeValue)
// Formato de fecha en español (reutilizado).

function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return 'Sin fecha';
  const dateText = new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CR');
  return timeValue ? `${dateText} ${timeValue}` : dateText;
}

/**
 * Función getAnswerClass(isSelected, isCorrect)
 * 
 * Qué hace: Determina la clase CSS para colorear la opción.
 * Retorna:
 * - 'correct': opción correcta (sea seleccionada o no, debe verse verde)
 * - 'selected-wrong': opción incorrecta que el estudiante seleccionó (roja)
 * - '': opción no seleccionada
 */
function getAnswerClass(isSelected, isCorrect) {
  if (isSelected && isCorrect) return 'correct';
  if (isSelected && !isCorrect) return 'selected-wrong';
  if (!isSelected && isCorrect) return 'correct';
  return '';
}

// Interfaz.

export default function EnrolledAssessmentResult() {
  const { id, assessmentId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [result, setResult] = useState(null);
  const currentUser = useMemo(() => getSessionUser() || {}, []);
  const currentUserId = String(currentUser.id || currentUser.username || 'anonymous-user');

  useEffect(() => {
    const loadData = async () => {
      const response = await courseService.getCourse(id);
      const loadedCourse = response.data?.course || null;
      setCourse(loadedCourse);
      const foundAssessment = (loadedCourse?.assessments || []).find(
        (item) => String(item.id) === String(assessmentId)
      ) || null;
      setAssessment(foundAssessment);

      const gradeResponse = await assessmentService.getAssessmentResult(id, assessmentId);
      setResult(gradeResponse.data?.result || null);
    };

    loadData();
  }, [id, assessmentId]);

  const isEnrolled = useMemo(() => {
    if (!course) return false;
    if (course.createdByCurrentUser) return true;
    return (course.enrolledStudentIds || []).includes(currentUserId);
  }, [course, currentUserId]);
  if (!course || !assessment) {
    return (
      <div className="assessment-result-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
          ← Volver
        </button>
        <section className="assessment-result-card">
          <h1>Resultado no encontrado</h1>
          <p>No se pudo cargar la evaluacion solicitada.</p>
        </section>
      </div>
    );
  }

  if (!isEnrolled && !course.createdByCurrentUser) {
    return (
      <div className="assessment-result-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
          ← Volver
        </button>
        <section className="assessment-result-card">
          <h1>Acceso restringido</h1>
          <p>Debes estar matriculado para ver este resultado.</p>
          <Link to={`/courses/${id}`} className="btn-primary">Ir al curso</Link>
        </section>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="assessment-result-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
          ← Volver
        </button>
        <section className="assessment-result-card">
          <h1>Sin intento registrado</h1>
          <p>Aun no has realizado esta evaluacion.</p>
          <Link to={`/courses/${id}/registered/assessments/${assessment.id}`} className="btn-primary">
            Realizar evaluacion
          </Link>
        </section>
      </div>
    );
  }

  const questionResults = Array.isArray(result.questionResults) ? result.questionResults : [];
  
  // Interfaz.
  
  return (
    <div className="assessment-result-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/registered?tab=assessments`)}>
        ← Volver al curso
      </button>

      <section className="assessment-result-card">
        <p className="assessment-result-path">{course.code} / Evaluaciones / Resultados</p>
        <h1>{result.assessmentTitle || assessment.title}</h1>

        <div className="assessment-result-meta-grid">
          <div className="assessment-result-meta-item">
            <span>Usuario participante</span>
            <strong>{result.username || result.userId || 'No definido'}</strong>
          </div>
          <div className="assessment-result-meta-item">
            <span>Nota</span>
            <strong>{result.score}%</strong>
          </div>
          <div className="assessment-result-meta-item">
            <span>Correctas</span>
            <strong>{result.correctAnswers} de {result.totalQuestions}</strong>
          </div>
          <div className="assessment-result-meta-item">
            <span>Inicio de la evaluacion</span>
            <strong>{formatDateTime(assessment.startDate, assessment.startTime)}</strong>
          </div>
          <div className="assessment-result-meta-item">
            <span>Fin de la evaluacion</span>
            <strong>{formatDateTime(assessment.endDate, assessment.endTime)}</strong>
          </div>
        </div>

        <p className="muted">Presentada: {new Date(result.submittedAt).toLocaleString('es-CR')}</p>

        {questionResults.length === 0 ? (
          <div className="assessment-result-warning">
            Este intento no tiene detalle de respuestas porque fue guardado antes de este cambio.
          </div>
        ) : (
          <div className="assessment-result-questions">
            {questionResults.map((question, index) => (
              <article key={`${question.questionId}-${index}`} className="assessment-result-question">
                <h3>Pregunta {index + 1}</h3>
                <p className="assessment-result-question-text">{question.questionText}</p>

                <div className="assessment-result-options">
                  {(question.options || []).map((optionText, optionIndex) => {
                    const isSelected = question.selectedOptionIndex === optionIndex;
                    const isCorrect = question.correctOptionIndex === optionIndex;
                    const extraClass = getAnswerClass(isSelected, isCorrect);

                    return (
                      <div key={`${optionIndex}-${optionText}`} className={`assessment-result-option ${extraClass}`}>
                        <span className="option-marker">{String.fromCharCode(65 + optionIndex)}.</span>
                        <span>{optionText}</span>
                        {isSelected || isCorrect ? (
                          <div className="option-tag-group">
                            {isSelected ? <strong className="option-tag user-tag">Tu respuesta</strong> : null}
                            {isCorrect ? <strong className="option-tag correct-tag">Correcta</strong> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
