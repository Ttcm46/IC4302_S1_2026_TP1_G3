import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { courseService, userService } from '../services/auth';
import '../styles/course-members.css';

/**
 * COURSEMEMBERS.JSX - Gestión de Miembros del Curso (Profesor)
 * 
 * Propósito:
 * Mostrar lista de todos los miembros del curso:
 * - Docente (creador)
 * - Estudiantes matriculados
 * - Información de perfil de cada uno
 */

function getInitials(fullName, username) {
  const source = String(fullName || username || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MemberAvatar({ avatar, fullName, username }) {
  if (avatar) {
    return <img src={avatar} alt={`Avatar de ${username || fullName || 'usuario'}`} className="member-avatar" />;
  }

  return (
    <div className="member-avatar member-avatar-fallback" aria-hidden="true">
      {getInitials(fullName, username)}
    </div>
  );
}

export default function ManageCourseMembers() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [teacherUser, setTeacherUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      setError('');
      try {
        const [courseResponse, membersResponse] = await Promise.all([
          courseService.getCourse(id),
          courseService.getCourseMembers(id)
        ]);

        setCourse(courseResponse.data?.course || null);
        setTeacherUser(membersResponse.data?.teacher || null);

        const rawStudents = Array.isArray(membersResponse.data?.students) ? membersResponse.data.students : [];

        // Enriquecer con perfiles reales en paralelo
        const enriched = await Promise.all(
          rawStudents.map(async (student) => {
            if (student.username !== student.userId) return student;
            try {
              const res = await userService.getProfile(student.userId);
              const u = res.data?.user;
              if (u) {
                return { ...student, username: u.username || student.userId, fullName: u.fullName || u.username || student.userId, avatar: u.avatar || '' };
              }
            } catch { /* fallback */ }
            return student;
          })
        );
        setStudents(enriched);
      } catch (err) {
        setError(err.response?.data?.message || 'No fue posible cargar los miembros del curso.');
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [id]);

  if (loading) {
    return (
      <div className="manage-members-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Cargando miembros del curso...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="manage-members-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <section className="manage-members-panel empty-manage-state">
          <h1>Curso no encontrado</h1>
          <p>{error || 'No fue posible cargar los integrantes de este curso.'}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="manage-members-page">
      <button type="button" className="back-button" onClick={() => navigate(`/courses/${course.id}/manage`)}>
        ← Volver a gestión del curso
      </button>

      <section className="manage-members-hero">
        <span className="members-badge">Integrantes del curso</span>
        <h1>{course.name}</h1>
        <p>En esta pantalla se muestra el docente asignado y los estudiantes matriculados en el curso.</p>
      </section>

      <section className="manage-members-grid">
        <article className="manage-members-panel">
          <h2>Docente</h2>
          <div className="member-row teacher-row">
            <MemberAvatar
              avatar={teacherUser?.avatar || ''}
              fullName={teacherUser?.fullName || course.teacher}
              username={teacherUser?.username || course.teacher}
            />
            <div className="member-copy">
              <strong>{course.teacher || 'Docente no definido'}</strong>
              <span>Docente del curso</span>
            </div>
          </div>
        </article>

        <article className="manage-members-panel">
          <div className="members-header">
            <h2>Estudiantes matriculados</h2>
            <span className="members-count">{students.length}</span>
          </div>

          {students.length === 0 ? (
            <div className="empty-manage-state">
              <h3>Aún no hay estudiantes matriculados</h3>
              <p>Cuando haya matrículas, aparecerán listadas en este bloque.</p>
            </div>
          ) : (
            <div className="members-list">
              {students.map((student, index) => (
                <div key={`${student.userId}-${index}`} className="member-row student-row">
                  <MemberAvatar
                    avatar={student.avatar || ''}
                    fullName={student.fullName || student.username}
                    username={student.username}
                  />
                  <div className="member-copy">
                    <strong>{student.fullName || student.username}</strong>
                    <span>@{student.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
