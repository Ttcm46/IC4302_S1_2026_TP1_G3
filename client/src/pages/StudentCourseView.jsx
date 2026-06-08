import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { assessmentService, courseService, userService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/student-course-view.css';

/**
 * STUDENTCOURSEVIEW.JSX - Vista de Curso para Estudiantes Matriculados
 * 
 * Propósito:
 * Pantalla principal para estudiantes que ya están matriculados en un curso.
 * Muestra:
 * - Contenido: secciones y recursos disponibles
 * - Participantes: docente y otros estudiantes
 * - Evaluaciones: lista de tests con estados (próximo, disponible, cerrado)
 * - Información general del curso
 * 
 * Arquitectura:
 * - Sistema de tabs (content, participants, assessments, info) con URL query params
 * - useSearchParams permite que la pestaña activa sea recuperable desde bookmarks
 * - Múltiples helpers para formateo, cálculo de estados, y renderizado
 */

/**
 * ChatIcon()
 * 
 * Qué hace: SVG inline para icono de chat (usado en participantes para enviar mensajes).
 * Por qué inline: Evita una importación o archivo adicional. Es simple y reutilizable.
 */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="participant-chat-icon" aria-hidden="true" focusable="false">
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 3.3A1 1 0 0 1 3 18.5V6a1 1 0 0 1 1-1zm1 2v9.51L8.35 14H19V7H5z" fill="currentColor" />
    </svg>
  );
}

/**
 * getCurrentUser()
 * 
 * Qué hace: Extrae el usuario actual desde localStorage.
 * Cómo: Lee 'user', lo parsea. Si falla, retorna {}.
 */
function getCurrentUser() {
  return getSessionUser() || {};
}

/**
 * formatDateTime(dateValue, timeValue) & formatDate(value)
 * 
 * Qué hace: Convierten fechas ISO a formato legible es-CR.
 * Cómo: Parsean con new Date(), usan toLocaleDateString().
 * Por qué: Las evaluaciones tienen fecha y hora. Los cursos tienen fecha de fin opcional.
 */
function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return 'Sin fecha';
  const dateText = new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CR');
  return timeValue ? `${dateText} ${timeValue}` : dateText;
}

function formatDate(value) {
  if (!value) return 'Siempre disponible';
  // Soportar tanto 'YYYY-MM-DD' como ISO completo 'YYYY-MM-DDTHH:mm:ss.sssZ'
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (isNaN(d.getTime())) return 'Siempre Disponible';
  return d.toLocaleDateString('es-CR');
}

/**
 * getAssessmentStatus(assessment)
 * 
 * Qué hace: Determina el estado de una evaluación basado en fecha/hora actual.
 * Cómo:
 *   - 'upcoming': Si ahora < fecha de inicio
 *   - 'closed': Si ahora > fecha de fin
 *   - 'available': En cualquier otro caso
 * 
 * Por qué: Los estudiantes necesitan saber si pueden hacer el test ahora, o si deben esperar/es tarde.
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

/**
 * renderResourcePreview(resource)
 * 
 * Qué hace: Renderiza una vista previa del recurso según su tipo.
 * Cómo:
 *   - text: <p> con el contenido
 *   - video: <video> embed con controles
 *   - image: <img> embed
 *   - document: <a> para descargar/abrir
 * 
 * Por qué: Diferentes tipos de contenido necesitan renderizado diferente.
 *          Reutilizable en múltiples lugares (sección, etc.).
 */
function renderResourcePreview(resource) {
  if (resource.type === 'text') {
    return <p className="enrolled-resource-text">{resource.text || 'Sin contenido de texto.'}</p>;
  }

  if (resource.type === 'video' && resource.fileData) {
    return <video src={resource.fileData} controls className="enrolled-resource-media" />;
  }

  if (resource.type === 'image') {
    return <img src={resource.fileData} alt={resource.title} className="enrolled-resource-media" />;
  }

  if (resource.fileData) {
    return (
      <a href={resource.fileData} target="_blank" rel="noreferrer" className="enrolled-resource-link">
        Abrir archivo
      </a>
    );
  }

  return <p className="enrolled-resource-text">Recurso sin vista previa.</p>;
}

/**
 * buildParticipants(course, currentUser, enrolledUsers)
 * 
 * Qué hace: Construye un objeto con datos formateados de docente, estudiantes y count.
 * Cómo:
 *   1. Crea objeto "teacher" con ownerId del curso como userId
 *   2. Mapea enrolledUsers a array de "students" con userId, displayName (username), roleLabel
 *   3. Marca "Tu cuenta" para el usuario actual
 *   4. Retorna { teacher, students, hiddenCount }
 * 
 * Por qué: La sección de participantes necesita estos datos formateados de forma específica.
 *          Centralizar evita lógica duplicada o errores en múltiples lugares.
 */
function buildParticipants(course, currentUser, studentProfiles = {}) {
  const teacher = {
    userId: course.ownerId || `course-${course.id}-teacher`,
    displayName: course.teacher || 'Docente no definido',
    roleLabel: 'Docente del curso'
  };
  const currentUserId = String(currentUser.id || currentUser.username || 'current-student');

  const students = (course.enrolledStudentIds || []).map((studentId) => ({
    userId: String(studentId),
    displayName: studentProfiles[studentId] || String(studentId),
    roleLabel: String(studentId) === currentUserId ? 'Tu cuenta' : 'Estudiante matriculado'
  }));

  return {
    teacher,
    students,
    hiddenCount: 0
  };
}

export default function EnrolledCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // TAB NAVIGATION WITH QUERY PARAMS
  // Los tabs están soportados por query params (?tab=content, ?tab=assessments, etc.)
  // Esto permite que los usuarios puedan bookmarkear/compartir URLs con tab específico
  const allowedTabs = ['content', 'participants', 'assessments', 'info'];
  const requestedTab = searchParams.get('tab');
  const initialTab = allowedTabs.includes(requestedTab) ? requestedTab : 'content';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [results, setResults] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [studentProfiles, setStudentProfiles] = useState(() => {
    // Pre-cargar el usuario actual desde la sesión para no necesitar request HTTP
    const u = getSessionUser();
    if (!u) return {};
    const id = String(u.id || u.username || '');
    return id ? { [id]: u.username || u.fullName || id } : {};
  });

  // Efecto para sincronizar tab con query params (si cambian desde URL)
  useEffect(() => {
    if (allowedTabs.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  // DATA LOADING
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentUserId = String(currentUser.id || currentUser.username || 'anonymous-user');

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

    // Poll course data every 15 seconds so new sections, content and assessments appear without refreshing
    const pollCourse = async () => {
      try {
        const response = await courseService.getCourse(id);
        const updated = response.data?.course || null;
        if (updated) setCourse(updated);
      } catch {
        // silently ignore poll errors
      }
    };
    const intervalId = setInterval(pollCourse, 15000);
    return () => clearInterval(intervalId);
  }, [id]);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const response = await assessmentService.getCourseResultsForUser(id, currentUserId);
        setResults(Array.isArray(response.data?.results) ? response.data.results : []);
      } catch {
        setResults([]);
      }
    };

    loadResults();

    // Poll own results every 15 seconds so new grades appear without refreshing
    const pollResults = async () => {
      try {
        const response = await assessmentService.getCourseResultsForUser(id, currentUserId);
        setResults(Array.isArray(response.data?.results) ? response.data.results : []);
      } catch {
        // silently ignore poll errors
      }
    };
    const intervalId = setInterval(pollResults, 15000);
    return () => clearInterval(intervalId);
  }, [id, currentUserId]);

  // Cargar perfiles de estudiantes cuando se abre el tab de participantes
  useEffect(() => {
    if (activeTab !== 'participants' || !course) return;
    const ids = course.enrolledStudentIds || [];
    const missing = ids.filter((sid) => !studentProfiles[sid]);
    if (missing.length === 0) return;

    setLoadingParticipants(true);
    Promise.all(
      missing.map(async (sid) => {
        try {
          const response = await userService.getProfile(sid);
          const u = response.data?.user;
          return [sid, u ? (u.username || u.fullName || sid) : sid];
        } catch {
          return [sid, sid];
        }
      })
    ).then((entries) => {
      setStudentProfiles((prev) => ({
        ...prev,
        ...Object.fromEntries(entries)
      }));
      setLoadingParticipants(false);
    });
  }, [activeTab, course]);

  const isEnrolled = useMemo(() => {
    if (!course) return false;
    if (course.createdByCurrentUser) return true;
    return (course.enrolledStudentIds || []).includes(currentUserId);
  }, [course, currentUserId]);

  const resultsByAssessmentId = useMemo(() => {
    const map = new Map();
    for (const result of results) {
      const key = result.evalId || result.assessmentId;
      if (key && !map.has(key)) {
        map.set(key, result);
      }
    }
    return map;
  }, [results]);

  // VALIDATIONS & ACCESS CONTROL
  
  if (loadingCourse) {
    return (
      <div className="enrolled-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="enrolled-card empty-manage-state">
          <h1>Cargando curso</h1>
          <p>Espera un momento mientras se cargan los datos.</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="enrolled-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="enrolled-card empty-manage-state">
          <h1>Curso no encontrado</h1>
          <p>{courseError || 'No se pudo cargar el curso solicitado.'}</p>
        </div>
      </div>
    );
  }

  // Validación: ¿Tiene acceso? Sí si está matriculado O si es el creador
  if (!isEnrolled && !course.createdByCurrentUser) {
    return (
      <div className="enrolled-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="enrolled-card empty-manage-state">
          <h1>No estás matriculado</h1>
          <p>Para acceder al curso como estudiante, primero debes matricularte desde la vista del curso.</p>
          <Link to={`/courses/${course.id}`} className="btn-primary">Ir a matricularme</Link>
        </div>
      </div>
    );
  }

  const participants = buildParticipants(course, currentUser, studentProfiles);

  return (
    <div className="enrolled-course-page">
      <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
        ← Volver al dashboard
      </button>

      <section className="enrolled-course-hero">
        <div>
          <span className="enrolled-badge">Curso matriculado</span>
          <h1>{course.name}</h1>
          <p>{course.code}</p>
        </div>
      </section>

      <section className="enrolled-tab-row">
        <button type="button" className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
          Contenido
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`} onClick={() => setActiveTab('participants')}>
          Participantes
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'assessments' ? 'active' : ''}`} onClick={() => setActiveTab('assessments')}>
          Evaluaciones
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
          Informacion del curso
        </button>
      </section>

      {activeTab === 'content' ? (
        <section className="enrolled-card">
          <h2>Temas del curso</h2>
          <p className="muted">Selecciona un tema raíz para ver su información, archivos y subtemas.</p>
          {course.sections.length === 0 ? (
            <p className="muted">Este curso aún no tiene contenido disponible.</p>
          ) : (
            <div className="root-topic-grid">
              {course.sections.map((section) => (
                <Link
                  key={section.id}
                  to={`/courses/${course.id}/registered/sections/${section.id}`}
                  className="root-topic-card"
                >
                  <h3>{section.title}</h3>
                  <p>{section.description || 'Sin descripción'}</p>
                  <div className="root-topic-meta">
                    <span>{section.children.length} subtemas</span>
                    <span>{section.resources.length} recursos</span>
                  </div>
                  <span className="root-topic-link">Ver tema</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'participants' ? (
        loadingParticipants ? (
          <section className="enrolled-card">
            <div className="loading-screen loading-screen-inline">
              <div className="loading-spinner" />
              <p>Cargando participantes...</p>
            </div>
          </section>
        ) : (
        <section className="enrolled-card enrolled-grid">
          <article>
            <h2>Docente</h2>
            <div className="participant-row">
              <div>
                <strong>{participants.teacher.displayName}</strong>
                <span>{participants.teacher.roleLabel}</span>
              </div>
              {participants.teacher.userId !== currentUserId ? (
                <Link
                  to={`/social/messages?targetId=${encodeURIComponent(participants.teacher.userId)}&targetName=${encodeURIComponent(participants.teacher.displayName)}&targetRole=${encodeURIComponent(participants.teacher.roleLabel)}&fromCourseId=${encodeURIComponent(course.id)}&fromCourseName=${encodeURIComponent(course.name)}`}
                  className="participant-chat-btn"
                  aria-label={`Abrir chat con ${participants.teacher.displayName}`}
                  title={`Abrir chat con ${participants.teacher.displayName}`}
                >
                  <ChatIcon />
                </Link>
              ) : null}
            </div>
          </article>

          <article>
            <h2>Estudiantes matriculados</h2>
            <div className="participant-list">
              {participants.students.map((student, index) => (
                <div key={`${student.userId}-${index}`} className="participant-row">
                  <div>
                    <strong>{student.displayName}</strong>
                    <span>{student.roleLabel}</span>
                  </div>
                  {student.userId !== currentUserId ? (
                    <Link
                      to={`/social/messages?targetId=${encodeURIComponent(student.userId)}&targetName=${encodeURIComponent(student.displayName)}&targetRole=${encodeURIComponent(student.roleLabel)}&fromCourseId=${encodeURIComponent(course.id)}&fromCourseName=${encodeURIComponent(course.name)}`}
                      className="participant-chat-btn"
                      aria-label={`Abrir chat con ${student.displayName}`}
                      title={`Abrir chat con ${student.displayName}`}
                    >
                      <ChatIcon />
                    </Link>
                  ) : null}
                </div>
              ))}
              {participants.hiddenCount > 0 ? (
                <p className="muted">+ {participants.hiddenCount} estudiantes adicionales</p>
              ) : null}
            </div>
          </article>
        </section>
        )
      ) : null}

      {activeTab === 'assessments' ? (
        <section className="enrolled-card">
          <h2>Evaluaciones del curso</h2>

          {(course.assessments || []).length === 0 ? (
            <p className="muted">Aún no hay evaluaciones publicadas en este curso.</p>
          ) : (
            <div className="assessment-list-student">
              {(course.assessments || []).map((assessment) => {
                const status = getAssessmentStatus(assessment);
                const savedResult = resultsByAssessmentId.get(assessment.id) || null;
                return (
                  <article key={assessment.id} className="assessment-student-card">
                    <h3>{assessment.title}</h3>
                    <p className="muted">Inicio: {formatDateTime(assessment.startDate, assessment.startTime)}</p>
                    <p className="muted">Fin: {formatDateTime(assessment.endDate, assessment.endTime)}</p>
                    <p className="muted">Preguntas: {assessment.questions.length}</p>
                    {savedResult ? (
                      <p className="muted"><strong>Resultado:</strong> {savedResult.score}%</p>
                    ) : null}
                    <div className="assessment-card-actions">
                      {savedResult ? (
                        <button type="button" className="btn-secondary assessment-done-btn" disabled>
                          Evaluacion ya realizada
                        </button>
                      ) : status === 'available' && assessment.questions.length > 0 ? (
                        <Link to={`/courses/${course.id}/registered/assessments/${assessment.id}`} className="btn-primary">
                          Realizar evaluación
                        </Link>
                      ) : status === 'available' && assessment.questions.length === 0 ? (
                        <button type="button" className="btn-secondary" disabled>
                          Evaluación sin preguntas
                        </button>
                      ) : status === 'upcoming' ? (
                        <button type="button" className="btn-secondary" disabled>
                          Aún no disponible
                        </button>
                      ) : (
                        <button type="button" className="btn-secondary" disabled>
                          Evaluación cerrada
                        </button>
                      )}

                      {savedResult ? (
                        <Link to={`/courses/${course.id}/registered/assessments/${assessment.id}/results`} className="btn-secondary">
                          Ver resultados
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'info' ? (
        <section className="enrolled-card">
          <h2>Informacion del curso</h2>

          <h3 className="enrolled-info-subtitle">Descripcion</h3>
          <p className="enrolled-course-description">{course.description || 'Sin descripcion disponible.'}</p>

          <h3 className="enrolled-info-subtitle">Datos generales</h3>
          <div className="enrolled-course-meta-grid">
            <div className="enrolled-meta-item">
              <span>Docente</span>
              <strong>{course.teacher || 'Docente no definido'}</strong>
            </div>
            <div className="enrolled-meta-item">
              <span>Estudiantes matriculados</span>
              <strong>{course.students ?? 0}</strong>
            </div>
            <div className="enrolled-meta-item">
              <span>Fecha de inicio</span>
              <strong>{formatDate(course.startDate)}</strong>
            </div>
            <div className="enrolled-meta-item">
              <span>Fecha de fin</span>
              <strong>{formatDate(course.endDate)}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
