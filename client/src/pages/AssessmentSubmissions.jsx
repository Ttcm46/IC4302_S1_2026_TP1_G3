import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assessmentService, courseService } from '../services/auth';
import '../styles/assessment-result.css';
import '../styles/assessment-submissions.css';

/**
 * AssessmentSubmissions.jsx - Vista de Evaluaciones (Profesor)
 *
 * Propósito:
 * Panel de profesor para revisar resultados de evaluaciones de los estudiantes. 
 * Características:
 * - Lista de estudiantes matriculados
 * - Selector de estudiante
 * - Vista del resultado del estudiante seleccionado
 * - Desglose pregunta/respuesta
 *
 * Flujo:
 * 1. Carga lista de estudiantes
 * 2. Selecciona primer estudiante por defecto
 * 3. Muestra resultado del estudiante seleccionado
 * 4. Profesor puede cambiar entre estudiantes
 *
 * Accesible solo para el creador del curso
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

export default function ManageAssessmentSubmissions() {
  const { id, assessmentId } = useParams();
  const navigate = useNavigate();

  // DATA LOADING
  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [students, setStudents] = useState([]);
  const [submissionResults, setSubmissionResults] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const response = await courseService.getCourse(id);
      const loadedCourse = response.data?.course || null;
      setCourse(loadedCourse);
      setStudents(Array.isArray(loadedCourse?.enrolledStudents) ? loadedCourse.enrolledStudents : []);
      const foundAssessment = (loadedCourse?.assessments || []).find(
        (item) => String(item.id) === String(assessmentId)
      ) || null;
      setAssessment(foundAssessment);

      const gradesResponse = await assessmentService.getAssessmentSubmissions(id, assessmentId);
      setSubmissionResults(Array.isArray(gradesResponse.data?.results) ? gradesResponse.data.results : []);
    };

    loadData();
  }, [id, assessmentId]);

  // SELECTION STATE
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (!selectedUserId && students[0]?.userId) {
      setSelectedUserId(students[0].userId);
    }
  }, [students, selectedUserId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.userId === selectedUserId) || null,
    [students, selectedUserId]
  );

  // Obtiene el resultado del estudiante seleccionado
  const selectedResult = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return submissionResults.find((result) => String(result.userId) === String(selectedUserId)) || null;
  }, [submissionResults, selectedUserId]);

  if (!course || !assessment) {
    return (
      <div className="manage-assessment-submissions-page">
        <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
          ← Volver
        </button>
        <section className="manage-assessment-submissions-layout">
          <article className="manage-course-panel empty-manage-state">
            <h1>Evaluación no encontrada</h1>
            <p>No se pudo cargar la evaluación seleccionada.</p>
          </article>
        </section>
      </div>
    );
  }

  const questionResults = Array.isArray(selectedResult?.questionResults)
    ? selectedResult.questionResults
    : [];

  // Interfaz.
  
  return (
    <div className="manage-assessment-submissions-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${id}/manage`)}>
        ← Volver a gestión del curso
      </button>

      <section className="manage-course-hero manage-assessment-submissions-hero">
        <div>
          <span className="course-status-badge published">Evaluaciones de estudiantes</span>
          <h1>{assessment.title}</h1>
          <p>{course.code} · {course.name}</p>
        </div>
      </section>

      <section className="manage-assessment-submissions-layout">
        <aside className="manage-course-panel submissions-students-panel">
          <div className="panel-header">
            <h2>Estudiantes matriculados</h2>
            <span className="section-count">{students.length}</span>
          </div>

          {students.length === 0 ? (
            <p className="muted">No hay estudiantes matriculados en este curso.</p>
          ) : (
            <div className="submissions-students-list">
              {students.map((student) => (
                <button
                  key={student.userId}
                  type="button"
                  className={`student-item-btn ${student.userId === selectedUserId ? 'active' : ''}`}
                  onClick={() => setSelectedUserId(student.userId)}
                >
                  <strong>{student.username}</strong>
                  <span className="muted">{student.userId}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <article className="manage-course-panel submissions-result-panel">
          {!selectedStudent ? (
            <div className="empty-manage-state">
              <h3>Selecciona un estudiante</h3>
              <p>Elige un estudiante para ver el detalle de su evaluación.</p>
            </div>
          ) : !selectedResult ? (
            <div className="empty-manage-state">
              <h3>Evaluación no realizada</h3>
              <p>{selectedStudent.username} aún no ha realizado esta evaluación.</p>
            </div>
          ) : (
            <section className="assessment-result-card teacher-assessment-result-card">
              <p className="assessment-result-path">{course.code} / Evaluaciones / Resultados</p>
              <h1>{selectedResult.assessmentTitle || assessment.title}</h1>

              <div className="assessment-result-meta-grid">
                <div className="assessment-result-meta-item">
                  <span>Usuario participante</span>
                  <strong>{selectedResult.username || selectedResult.userId || selectedStudent.username}</strong>
                </div>
                <div className="assessment-result-meta-item">
                  <span>Nota</span>
                  <strong>{selectedResult.score}%</strong>
                </div>
                <div className="assessment-result-meta-item">
                  <span>Correctas</span>
                  <strong>{selectedResult.correctAnswers} de {selectedResult.totalQuestions}</strong>
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

              <p className="muted">Presentada: {new Date(selectedResult.submittedAt).toLocaleString('es-CR')}</p>

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
          )}
        </article>
      </section>
    </div>
  );
}
