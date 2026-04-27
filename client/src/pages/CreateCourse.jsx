import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { courseService } from "../services/auth";
import "../styles/create-course.css";

/**
 * =====================================================================
 * CREATECOURSE.JSX - Formulario para Crear Nuevo Curso
 * =====================================================================
 * 
 * Propósito:
 * Interfaz para que un profesor cree un nuevo curso con:
 * - Metadatos: código, nombre, descripción
 * - Fechas: inicio y fin (opcional)
 * - Foto de portada (upload de archivo)
 * 
 * Flujo:
 * 1. Llenar formulario
 * 2. Cargar imagen
 * 3. Validar campos
 * 4. Crear curso (se guarda como borrador)
 * 5. Redirigir a editor del curso para agregar contenido
 */

const initialForm = {
  code: "",
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  coverImage: ""
};

export default function CreateCourse() {
  const navigate = useNavigate();
  
  // ============================================
  // LOCAL STATE
  // ============================================
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState(""); // Validación de código duplicado
  const [loading, setLoading] = useState(false);

  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  /**
   * handleChange(event)
   * 
   * Qué hace: Actualiza un campo del formulario.
   * Cómo: Destructura name/value del input y actualiza form[name].
   *       Si es el código, valida en tiempo real si ya existe.
   */
  const handleChange = async (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Conexión CreateCourse: Validar código en tiempo real
    // Si el usuario escribe un código, verificar con el backend si ya existe
    if (name === 'code' && value.trim()) {
      const exists = await courseService.checkCodeExists(value.trim());
      if (exists) {
        setCodeError(`El código "${value.trim()}" ya está en uso. Por favor, usa otro.`);
      } else {
        setCodeError("");
      }
    } else if (name === 'code') {
      setCodeError("");
    }
  };

  /**
   * handleImage(event)
   * 
   * Qué hace: Procesa la carga de archivo de imagen.
   * Cómo:
   *   1. Obtiene el archivo del input
   *   2. Crea FileReader para convertir a data URL
   *   3. Guarda en form.coverImage (para almacenamiento)
   *   4. Guarda en preview (para mostrar vista previa)
   */
  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || "");
      setForm((prev) => ({ ...prev, coverImage: imageData }));
      setPreview(imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.code || !form.name || !form.description || !form.startDate || !form.coverImage) {
      setError("Completa todos los campos obligatorios, incluida la foto del curso.");
      return;
    }

    if (codeError) {
      setError(codeError);
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setError("La fecha de fin no puede ser menor a la fecha de inicio.");
      return;
    }

    setLoading(true);
    try {
      const response = await courseService.createCourse(form);
      const newCourse = response.data?.course;
      navigate(`/courses/${newCourse?.id || form.code}/manage`);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible crear el curso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-course-page">
      <div className="create-course-header">
        <h1>Crear Curso</h1>
        <p>Al crear este curso, serás el docente principal y quedará guardado como borrador hasta que le agregues contenido.</p>
      </div>

      <form className="create-course-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="code">Código del Curso *</label>
            <input id="code" name="code" type="text" value={form.code} onChange={handleChange} placeholder="Ej: IC4302" required />
            {codeError ? <p className="error-text" style={{marginTop: '0.5rem'}}>{codeError}</p> : null}
          </div>

          <div className="form-group">
            <label htmlFor="name">Nombre del Curso *</label>
            <input id="name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Ej: Programación Avanzada" required />
          </div>

          <div className="form-group full">
            <label htmlFor="description">Descripción del Curso *</label>
            <textarea id="description" name="description" value={form.description} onChange={handleChange} placeholder="Describe el contenido y objetivo del curso" required />
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Fecha de Inicio del Curso *</label>
            <input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">Fecha de Fin del Curso (opcional)</label>
            <input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} />
            <span className="field-help">Déjalo vacío si el curso siempre estará disponible.</span>
          </div>

          <div className="form-group full">
            <label htmlFor="coverImage">Foto del Curso *</label>
            <input id="coverImage" name="coverImage" type="file" accept="image/*" onChange={handleImage} required />
            {preview ? <img src={preview} alt="Vista previa del curso" className="image-preview" /> : null}
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/courses")}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creando..." : "Crear Curso"}</button>
        </div>
      </form>
    </div>
  );
}
