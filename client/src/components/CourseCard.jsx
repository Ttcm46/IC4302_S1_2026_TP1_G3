import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/course-card.css';

export default function CourseCard({ course }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/courses/${course.id}`);
  };

  return (
    <div className="course-card" onClick={handleClick}>
      <div className="course-image">
        <img src={course.coverImage} alt={course.name} />
      </div>
      <div className="course-content">
        <h3>{course.name}</h3>
        <p className="course-code">{course.code}</p>
        <p className="course-description">{course.description}</p>
        <div className="course-footer">
          <div className="course-teacher">{course.teacher}</div>
          <div className="course-students">{course.students} estudiantes</div>
        </div>
      </div>
    </div>
  );
}
