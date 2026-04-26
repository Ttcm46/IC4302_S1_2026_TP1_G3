import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CourseCard from "../components/CourseCard";
import { courseService } from "../services/auth";
import "../styles/course-catalog.css";

/**
 * courseCatalog.jsx - Catálogo Público de Cursos
 *
 * Propósito:
 * Listado de todos los cursos publicados/terminados con:
 * - Búsqueda por nombre, código o descripción
 * - Grid de tarjetas de cursos
 * - Acceso para ver detalles y matricularse
 * - Botón para crear nuevo curso
 *
 * Acceso: Público
 */

export default function Courses() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // CARGA DE DATOS Y FILTRADO

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await courseService.getCourses();
        const backendCourses = Array.isArray(response.data?.courses) ? response.data.courses : [];
        setAllCourses(backendCourses.filter((course) => course.isPublished || course.isFinished));
      } catch (err) {
        setError(err.response?.data?.message || "No fue posible cargar cursos.");
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  /**
   * filteredCourses - Búsqueda en tiempo real
   *
   * Qué hace: Filtra cursos según searchTerm.
   * Cómo: Búsqueda case-insensitive en nombre, código y descripción.
   */
  const filteredCourses = allCourses.filter((course) => {
    const term = searchTerm.toLowerCase();
    return (
      course.name.toLowerCase().includes(term) ||
      course.code.toLowerCase().includes(term) ||
      course.description.toLowerCase().includes(term)
    );
  });

  // Interfaz.
  
  return (
    <div className="courses-page">
      <div className="courses-header">
        <h1>Explora Nuestros Cursos</h1>
        <p>Encuentra el curso perfecto para tu aprendizaje</p>
        <button className="btn-primary create-course-btn" onClick={() => navigate("/create-course")}>Crear curso</button>
      </div>

      <div className="courses-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por código, nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="courses-stats"><p>Mostrando {filteredCourses.length} de {allCourses.length} cursos</p></div>

      {error ? <div className="no-courses"><p>{error}</p></div> : null}
      {loading ? <div className="no-courses"><p>Cargando cursos...</p></div> : null}

      <div className="courses-grid">
        {!loading && filteredCourses.length > 0 ? filteredCourses.map(course => <CourseCard key={course.id} course={course} />) : null}
        {!loading && !error && filteredCourses.length === 0 ? <div className="no-courses"><p>No hay cursos</p></div> : null}
      </div>
    </div>
  );
}
