import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { courseService, enrollmentService } from "../services/auth";
import "../styles/course-detail.css";

/**
 * CourseDetail.jsx - Vista Pública del Curso (Catálogo)
 *
 * Propósito:
 * Muestra detalles públicos de un curso (vista previa antes de matricularse):
 * - Foto de portada
 * - Código, nombre, descripción
 * - Metadatos: docente, estudiantes, fechas
 * - Botón "Matricularme" (si no estás matriculado)
 * - Botón "Ir a mis cursos" (si ya estás matriculado)
 *
 */

// Función formatDate(value)
// Convierte fechas a formato legible en español.

function formatDate(value) {
  if (!value) return "Siempre disponible";
  return new Date(value + "T00:00:00").toLocaleDateString("es-CR");
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Estado y Datos
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCourse = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await courseService.getCourse(id);
        setCourse(response.data?.course || null);

        try {
          const myCoursesResponse = await enrollmentService.getMyCourses();
          const myCourses = Array.isArray(myCoursesResponse.data?.courses) ? myCoursesResponse.data.courses : [];
          setIsEnrolled(myCourses.some((courseItem) => String(courseItem.id) === String(id)));
        } catch {
          setIsEnrolled(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || "No fue posible cargar el curso.");
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id]);

  // Manejadores de eventos

  /**
   * handleEnroll()
   *
   * Qué hace: Registra al usuario actual en el curso.
   * Cómo: Llama a registerInCourse() y actualiza el estado.
   * Por qué: Permite que el usuario acceda a la vista de estudiante.
   */
  const handleEnroll = async () => {    if (course?.isFinished) {
      setError('No se puede matricular en un curso que ha terminado.');
      return;
    }    try {
      await enrollmentService.enrollCourse(id);
      setIsEnrolled(true);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible matricularse.");
    }
  };

  if (loading) {
    return <div className="course-detail-page"><p>Cargando curso...</p></div>;
  }

  if (error || !course) {
    return <div className="course-detail-page"><p>{error || "Curso no encontrado."}</p></div>;
  }

  // Interfaz.

  return (
    <div className="course-detail-page">
      <button className="back-button" onClick={() => navigate("/courses")}>← Volver</button>
      <div className="course-hero">
        <img src={course.coverImage} alt={course.name} className="hero-image" />
      </div>

      <div className="course-detail-container">
        <div className="course-main">
          <h1>{course.name}</h1>
          <p className="course-code">{course.code}</p>
          <h2>Descripción</h2>
          <p>{course.description}</p>

          <h2 className="course-info-heading">Información del Curso</h2>
          <div className="course-meta">
            <div className="meta-item"><span>Docente</span><strong>{course.teacher || "Docente no definido"}</strong></div>
            <div className="meta-item"><span>Estudiantes matriculados</span><strong>{course.students ?? 0}</strong></div>
            <div className="meta-item"><span>Fecha de inicio</span><strong>{formatDate(course.startDate)}</strong></div>
            <div className="meta-item"><span>Fecha de fin</span><strong>{course.endDate && course.endDate !== '00/00/0000' ? formatDate(course.endDate) : 'Siempre disponible'}</strong></div>
          </div>
        </div>

        <aside className="course-sidebar">
          <div className="enrollment-card">
            {course.isFinished ? (
              <>
                <div className="enrolled-badge finished-badge">Este curso ha terminado</div>
                <p className="finished-note">La fecha de finalización de este curso ya ha pasado. No se pueden aceptar nuevas matriculaciones.</p>
                {course.createdByCurrentUser ? (
                  <Link to={`/courses/${course.id}/manage`} className="btn-primary manage-course-btn">Ver gestión del curso</Link>
                ) : isEnrolled ? (
                  <Link to={`/courses/${course.id}/registered`} className="btn-primary manage-course-btn">Ver contenido del curso</Link>
                ) : null}
              </>
            ) : course.createdByCurrentUser ? (
              <>
                <div className="enrolled-badge">Eres el docente de este curso</div>
                {!course.isPublished ? <div className="draft-note">Este curso sigue en borrador y no es visible para estudiantes.</div> : null}
                <Link to={`/courses/${course.id}/manage`} className="btn-primary manage-course-btn">Editar secciones</Link>
              </>
            ) : isEnrolled ? (
              <>
                <div className="enrolled-badge">Matriculado</div>
                <Link to={`/courses/${course.id}/registered`} className="btn-primary manage-course-btn">Ir al curso</Link>
              </>
            ) : (
              <button className="btn-primary enroll-btn" onClick={handleEnroll}>Matricularse</button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
