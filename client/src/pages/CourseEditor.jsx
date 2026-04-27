import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { assessmentService, courseService } from '../services/auth';
import '../styles/course-editor.css';

/**
 * CourseEditor.jsx - Editor Principal del Curso
 * 
 * Propósito:
 * Panel central donde el docente construye todo el contenido de un curso:
 * - Información general del curso (nombre, código, fechas)
 * - Estructura de secciones (árbol jerárquico)
 * - Recursos por sección (texto, video, imagen, documentos)
 * - Evaluaciones con preguntas de múltiple opción
 * - También permite publicar/ocultar el curso y eliminarlo completamente
 * - Permite ver lista de estudiantes
 * - Permite ver respuestas de evaluaciones hechas por estudiantes
 * 
 * Arquitectura:
 * 1. Cargas iniciales: getCourseById(id) con useMemo para datos actualizables
 * 2. Estado local para formularios: form (secciones), resourceForm (recursos), 
 *    assessmentMeta + assessmentQuestions (evaluaciones), courseForm (info general)
 * 3. refreshKey: Contador que fuerza recálculos en useMemo/useMemos para leer cambios del store
 * 4. Dos diseños condicionales basados en la etapa del ciclo de vida del curso (activo vs terminado)
 */

const initialSectionForm = {
  title: '',
  description: '',
  parentId: ''
};

const initialResourceForm = {
  sectionId: '',
  type: 'text',
  title: '',
  text: '',
  fileData: ''
};

// Funciones auxiliares para formatos

/**
 * Función formatDate(value)
 * 
 * Qué hace: Convierte una fecha ISO a formato legible en es-CR.
 * Cómo: Si no hay valor, retorna "Siempre disponible". Si hay, parsea y usa toLocaleDateString().
 * Por qué: Las fechas de fin de curso son opcionales (cursos sin fecha de fin = indefinido).
 */
function formatDate(value) {
  if (!value) {
    return 'Siempre disponible';
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CR');
}

/**
 * Función formatDateTime(dateValue, timeValue)
 * 
 * Qué hace: Combina una fecha y una hora en un solo string legible.
 * Cómo: Formatea la fecha, luego agrega la hora si existe (ej: "18/04/2026 14:30").
 * Por qué: Las evaluaciones tienen fecha Y hora de inicio/fin, necesitamos mostrar ambas.
 */
function formatDateTime(dateValue, timeValue) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const dateText = new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CR');
  return timeValue ? `${dateText} ${timeValue}` : dateText;
}

export default function ManageCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const coverImageInputRef = useRef(null);
  
  // Tres formularios independientes
  
  // 1. Formulario de NUEVA SECCIÓN
  const [form, setForm] = useState(initialSectionForm);
  
  // 2. Formulario de NUEVO RECURSO (en una sección)
  const [resourceForm, setResourceForm] = useState(initialResourceForm);
  
  // 3. Formulario de EDICIÓN DE INFORMACIÓN GENERAL del curso
  const [courseForm, setCourseForm] = useState({ name: '', startDate: '', endDate: '' });
  
  // Mensajes de error por formulario

  const [error, setError] = useState(''); // Para secciones
  const [resourceError, setResourceError] = useState(''); // Para recursos
  const [courseError, setCourseError] = useState(''); // Para info general
  
  // UI FLAGS
  const [isEditingCourse, setIsEditingCourse] = useState(false); // Alterna entre modo lectura y edición info general
  
  // Esto se debe cambiar con backend real y llamadas API, pero igual allí va la explicación:
  // REFRESH MECHANISM: El "truco" para forzar actualizaciones desde el store
  // Los stores son estado global mutable. Al cambiar algo en courseStore, el componente no lo sabe.
  // Es por eso que debe incrementar refreshKey, que es incluido en la dependencia de useMemo de 'course',
  // forzando que getCourseById() se ejecute de nuevo y el componente vea los cambios.
  const [refreshKey, setRefreshKey] = useState(0);
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(true);

  // estados de evaluación
  const [assessmentMeta, setAssessmentMeta] = useState({
    title: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: ''
  });
  // Array de preguntas. Cada pregunta tiene: texto, opciones[], correctOptionIndex
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [assessmentError, setAssessmentError] = useState('');
  const [backendAssessments, setBackendAssessments] = useState([]);

  // CARGA DE DATOS Y MEMOIZACIÓN (memoización para evitar recálculos innecesarios al cambiar estado de búsqueda o solicitudes)
  // cómo: useMemo funciona como caché: solo recalcula si las dependencias cambian (ej. query, currentUserId, refreshKey).
  
  useEffect(() => {
    const loadCourse = async () => {
      setLoadingCourse(true);
      try {
        const response = await courseService.getCourse(id);
        setCourse(response.data?.course || null);
      } catch {
        setCourse(null);
      } finally {
        setLoadingCourse(false);
      }
    };

    loadCourse();
  }, [id, refreshKey]);

  /**
   * sectionOptions - Lista plana del árbol de secciones para <select>
   * 
   * Qué hace: Aplana el árbol jerárquico de secciones en una lista con profundidad.
   * Cómo:
   *   - La función interna flatten(sections, depth) recorre recursivamente
   *   - Retorna un array plano: [{id, title, depth}, {id, title, depth}, ...]
   *   - Los <select> posteriores usan `'—'.repeat(depth)` para mostrar indentación visual
   * 
   * Por qué: Los <select> HTML no soportan opciones anidadas o estructuras jerárquicas.
   *          Necesitamos simular la jerarquía con indentación de texto.
   */
  const sectionOptions = useMemo(() => {
    const flatten = (sections, depth = 0) => {
      return sections.flatMap((section) => {
        const current = {
          id: section.id,
          title: section.title,
          depth
        };

        return [current, ...flatten(section.children, depth + 1)];
      });
    };

    return flatten(course?.sections || []);
  }, [course]);

  useEffect(() => {
    const loadBackendAssessments = async () => {
      try {
        const response = await courseService.getCourse(id);
        const loadedAssessments = Array.isArray(response.data?.course?.assessments)
          ? response.data.course.assessments
          : [];
        setBackendAssessments(loadedAssessments);
      } catch {
        setBackendAssessments([]);
      }
    };

    loadBackendAssessments();
  }, [id, refreshKey]);

  if (loadingCourse) {
    return (
      <div className="manage-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="manage-course-panel empty-manage-state">
          <h1>Cargando curso...</h1>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="manage-course-page">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className="manage-course-panel empty-manage-state">
          <h1>Curso no encontrado</h1>
          <p>No se pudo cargar el curso que intentas administrar.</p>
        </div>
      </div>
    );
  }

  // Manejadores de Eventos

  /**
   * startEditingCourse()
   * 
   * Qué hace: Activa el modo edición de información general del curso.
   * Cómo: Copia los valores actuales del curso a courseForm y activa isEditingCourse.
   * Por qué: Antes de editar, necesitamos mostrar los valores actuales en los inputs.
   */
  const startEditingCourse = () => {
    setCourseError('');
    setCourseForm({
      code: course.code || '',
      name: course.name || '',
      startDate: course.startDate || '',
      endDate: course.endDate || ''
    });
    setIsEditingCourse(true);
  };

  /**
   * handleChange(event)
   * 
   * Qué hace: Manejador genérico para inputs del formulario de NUEVA SECCIÓN.
   * Cómo: Usa event.target.name para identificar qué campo del estado cambió.
   * Por qué: Un solo handler evita crear uno por cada campo (title, description, parentId).
   */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  /**
   * handleResourceChange(event)
   * 
   * Qué hace: Manejador genérico para inputs del formulario de NUEVO RECURSO.
   * Cómo: Similar a handleChange, pero actúa sobre resourceForm.
   * Por qué: Los campos son sectionId, type, title, text — un handler cubre todos.
   */
  const handleResourceChange = (event) => {
    const { name, value } = event.target;
    setResourceForm((previous) => ({ ...previous, [name]: value }));
  };

  /**
   * handleResourceFile(event)
   * 
   * Qué hace: Procesa la carga de archivos para recursos de tipo video, imagen o documento.
   * Cómo: Lee el archivo con FileReader.readAsDataURL() y almacena el base64 en resourceForm.fileData.
   * Por qué: Sin backend de almacenamiento, los archivos se persisten como base64 en localStorage.
   * Hay que cambiar esto a backend después.
   */
  const handleResourceFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = String(reader.result || '');
      setResourceForm((previous) => ({ ...previous, fileData }));
    };
    reader.readAsDataURL(file);
  };

  /**
   * handleAddSection(event)
   * 
   * Qué hace: Valida y agrega una nueva sección al curso.
   * Cómo:
   *   1. Previene envío del formulario por defecto
   *   2. Valida que title y description no estén vacíos
   *   3. Llama a addCourseSection(courseId, data, parentId)
   *   4. Limpia el formulario y incrementa refreshKey para ver cambios
   * 
   * Por qué: Las secciones forman el esqueleto del curso. Validar evita datos inválidos.
   *          refreshKey fuerza que useMemo(getCourseById...) se re-ejecute.
   */
  const handleAddSection = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim() || !form.description.trim()) {
      setError('Debes indicar el nombre y una descripción breve de la sección.');
      return;
    }

    try {
      await courseService.createSection(course.id, {
        title: form.title,
        description: form.description,
        parentId: form.parentId || ''
      });
      setForm(initialSectionForm);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible guardar la sección.');
    }
  };

  /**
   * handleAddResource(event)
   * 
   * Qué hace: Valida y agrega un nuevo recurso a una sección.
   * Cómo:
   *   1. Valida campos obligatorios por tipo (texto debe tener content, video/doc/image debe tener file)
   *   2. Llama a addSectionResource(courseId, sectionId, resourceData)
   *   3. Mantiene sectionId en el formulario para agregar más recursos en la misma sección
   *   4. Incrementa refreshKey
   * 
   * Por qué: Los recursos son el contenido real del curso. Cada tipo tiene validaciones diferentes.
   *          El UX mantiene sectionId para permitir agregar varios recursos a la misma sección.
   */
  const handleAddResource = async (event) => {
    event.preventDefault();
    setResourceError('');

    if (!resourceForm.sectionId) {
      setResourceError('Debes seleccionar una sección o subtema para agregar el contenido.');
      return;
    }

    if (!resourceForm.title.trim()) {
      setResourceError('El contenido debe tener un título.');
      return;
    }

    if (resourceForm.type === 'text' && !resourceForm.text.trim()) {
      setResourceError('Debes escribir el texto del contenido.');
      return;
    }

    if ((resourceForm.type === 'video' || resourceForm.type === 'image' || resourceForm.type === 'document') && !resourceForm.fileData) {
      setResourceError('Debes subir un archivo para este tipo de contenido.');
      return;
    }

    try {
      await courseService.addSectionResource(resourceForm.sectionId, {
        type: resourceForm.type,
        title: resourceForm.title,
        text: resourceForm.text,
        fileData: resourceForm.fileData
      });

      setResourceForm((previous) => ({
        ...initialResourceForm,
        sectionId: previous.sectionId
      }));
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setResourceError(err.response?.data?.message || 'No fue posible agregar el material.');
    }
  };

  /**
   * handleSaveCourse(event)
   * 
   * Qué hace: Valida y guarda cambios a la información general del curso.
   * Cómo:
   *   1. Valida obligatorios: code, name, startDate
   *   2. Valida que endDate no sea menor que startDate (si existe)
   *   3. Llama a updateCourseMetadata(courseId, courseForm)
   *   4. Salida de modo edición e incrementa refreshKey
   */
  const handleSaveCourse = async (event) => {
    event.preventDefault();
    setCourseError('');

    if (!courseForm.name.trim() || !courseForm.startDate) {
      setCourseError('Nombre y fecha de inicio son obligatorios.');
      return;
    }

    if (courseForm.endDate && courseForm.endDate < courseForm.startDate) {
      setCourseError('La fecha de fin no puede ser menor que la fecha de inicio.');
      return;
    }

    try {
      await courseService.updateCourse(course.id, {
        name: courseForm.name,
        description: course.description,
        startDate: courseForm.startDate,
        endDate: courseForm.endDate || null,
        coverImage: course.coverImage
      });
      setIsEditingCourse(false);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setCourseError(err.response?.data?.message || 'No fue posible actualizar el curso.');
    }
  };

  /**
   * handleCoverImageClick()
   * 
   * Qué hace: Abre el diálogo de selección de archivo para cambiar la portada del curso.
   * Cómo: Hace click en el <input type="file" hidden> referenciado por coverImageInputRef.
   * Por qué: Los inputs de tipo file no se pueden estilizar directamente, así que los ocultamos y 
   *          hacemos click simulado desde un botón visible.
   */
  const handleCoverImageClick = () => {
    coverImageInputRef.current?.click();
  };

  /**
   * compressImageToBase64(file, maxWidth, maxHeight, quality)
   * 
   * Qué hace: Comprime una imagen redimensionándola y ajustando calidad.
   * Conexión CourseEditor: Reduce el tamaño de base64 de imágenes antes de enviar al backend.
   * Sin esto, imágenes grandes podrían exceder el límite de payload.
   * Cómo: Usa Canvas para redimensionar, luego convierte a base64 con calidad ajustada.
   */
  const compressImageToBase64 = (file, maxWidth = 800, maxHeight = 600, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones manteniendo aspecto
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir a base64 con calidad ajustada
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.src = e.target?.result;
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  /**
   * handleCoverImageChange(event)
   * 
   * Qué hace: Procesa la nueva imagen de portada seleccionada por el usuario.
   * Cómo: Comprime la imagen usando Canvas, la convierte a base64, llama updateCourseMetadata, 
   *       e incrementa refreshKey para mostrar la nueva imagen inmediatamente.
   * Por qué: Mejora de calidad de vida del usuario y reduce tamaño de payload.
   */
  const handleCoverImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    compressImageToBase64(file)
      .then(async (imageData) => {
        try {
          await courseService.updateCourse(course.id, {
            name: course.name,
            description: course.description,
            startDate: course.startDate,
            endDate: course.endDate,
            coverImage: imageData
          });
          setRefreshKey((value) => value + 1);
        } catch {
          setCourseError('No fue posible actualizar la portada del curso.');
        }
      })
      .catch((error) => {
        console.error('Error comprimiendo imagen:', error);
        setCourseError('No se pudo procesar la imagen. Intenta con otro archivo.');
      });
  };

  /**
   * handleTogglePublished()
   * 
   * Qué hace: Cambia el estado del curso entre publicado (visible en catálogo) y oculto.
   * Cómo:
   *   1. Calcula nextPublishedState (!course.isPublished)
   *   2. Muestra confirmación al usuario (¿Deseas publicar/ocultar?)
   *   3. Si confirma, llama setCoursePublishedState(courseId, newState)
   *   4. Incrementa refreshKey
   */
  const handleTogglePublished = async () => {
    const nextPublishedState = !course.isPublished;
    const confirmMessage = nextPublishedState
      ? '¿Deseas publicar este curso? Los estudiantes podrán verlo en el catálogo.'
      : '¿Deseas ocultar este curso? Dejará de aparecer en el catálogo público.';

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    try {
      await courseService.publishCourse(course.id, nextPublishedState);
      setRefreshKey((value) => value + 1);
    } catch {
      setCourseError('No fue posible actualizar la visibilidad del curso.');
    }
  };

  /**
   * handleDeleteCourse()
   * 
   * Qué hace: Elimina el curso completamente (con confirmación).
   * Cómo:
   *   1. Pide confirmación (para evitar borrados accidentales)
   *   2. Llama deleteCourse(courseId)
   *   3. Navega de vuelta a /dashboard
   * 
   */
  const handleDeleteCourse = async () => {
    const confirmed = window.confirm('¿Seguro que deseas eliminar este curso? Esta acción borrará secciones y materiales.');
    if (!confirmed) {
      return;
    }

    try {
      await courseService.deleteCourse(course.id);
      navigate('/dashboard');
    } catch {
      setCourseError('No fue posible eliminar el curso.');
    }
  };

  // manejadores de evaluación

  /**
   * makeBlankQuestion()
   * 
   * Qué hace: Crea una nueva pregunta de múltiple opción en blanco.
   * Cómo: Retorna un objeto con texto vacío, 2 opciones iniciales vacías y la primera opción como correcta.
   * Por qué: Permite reutilizar esta estructura cada vez que se agrega una pregunta nueva.
   */
  const makeBlankQuestion = () => ({
    _key: String(Date.now() + Math.random()), // Clave única para React keys (no es ID de BD)
    text: '',
    options: [
      { _key: String(Math.random()), text: '' },
      { _key: String(Math.random()), text: '' }
    ],
    correctOptionIndex: 0 // Por defecto, la primera opción es correcta
  });

  /**
   * handleAddQuestion()
   * 
   * Qué hace: Agrega una nueva pregunta en blanco al array de preguntas.
   * Cómo: Utiliza makeBlankQuestion() y lo añade al final del array.
   */
  const handleAddQuestion = () => {
    setAssessmentQuestions((previous) => [...previous, makeBlankQuestion()]);
  };

  /**
   * handleRemoveQuestion(index)
   * 
   * Qué hace: Elimina una pregunta del array por su índice.
   * Cómo: Filtra el array excluyendo el elemento en la posición 'index'.
   */
  const handleRemoveQuestion = (index) => {
    setAssessmentQuestions((previous) => previous.filter((_, i) => i !== index));
  };

  /**
   * handleQuestionTextChange(index, text)
   * 
   * Qué hace: Actualiza el texto de una pregunta específica.
   * Cómo: Mapea el array reemplazando el texto de la pregunta en la posición 'index'.
   */
  const handleQuestionTextChange = (index, text) => {
    setAssessmentQuestions((previous) =>
      previous.map((q, i) => (i === index ? { ...q, text } : q))
    );
  };

  /**
   * handleAddOption(questionIndex)
   * 
   * Qué hace: Agrega una nueva opción (respuesta alternativa) a una pregunta.
   * Cómo: Encuentra la pregunta por índice y agrega un nuevo objeto de opción al array de opciones.
   * Por qué: Las preguntas pueden tener más de 2 opciones; este handler permite agregar flexiblemente.
   */
  const handleAddOption = (questionIndex) => {
    setAssessmentQuestions((previous) =>
      previous.map((q, i) => {
        if (i !== questionIndex) return q;
        return { ...q, options: [...q.options, { _key: String(Math.random()), text: '' }] };
      })
    );
  };

  /**
   * handleRemoveOption(questionIndex, optionIndex)
   * 
   * Qué hace: Elimina una opción de una pregunta y ajusta el índice de opción correcta si es necesario.
   * Cómo: 
   *   1. Filtra la opción por índice
   *   2. Si la opción eliminada era la correcta o estaba después, ajusta correctOptionIndex
   *   3. Si todas las opciones se eliminarían, establece 0 como correcto
   * 
   * Por qué: Si eliminamos la opción correcta, no podemos dejar correctOptionIndex apuntando a un 
   *          índice inválido (causaría error o comportamiento inesperado).
   */
  const handleRemoveOption = (questionIndex, optionIndex) => {
    setAssessmentQuestions((previous) =>
      previous.map((q, i) => {
        if (i !== questionIndex) return q;
        const newOptions = q.options.filter((_, j) => j !== optionIndex);
        return {
          ...q,
          options: newOptions,
          correctOptionIndex:
            q.correctOptionIndex >= newOptions.length
              ? Math.max(0, newOptions.length - 1)
              : q.correctOptionIndex
        };
      })
    );
  };

  /**
   * handleOptionTextChange(questionIndex, optionIndex, text)
   * 
   * Qué hace: Actualiza el texto de una opción específica de una pregunta.
   * Cómo: Mapea por pregunta, luego por opción, reemplazando solo la opción objetivo.
   */
  const handleOptionTextChange = (questionIndex, optionIndex, text) => {
    setAssessmentQuestions((previous) =>
      previous.map((q, i) => {
        if (i !== questionIndex) return q;
        return {
          ...q,
          options: q.options.map((o, j) => (j === optionIndex ? { ...o, text } : o))
        };
      })
    );
  };

  /**
   * handleCorrectOptionChange(questionIndex, optionIndex)
   * 
   * Qué hace: Marca una opción específica como la respuesta correcta de una pregunta.
   * Cómo: Actualiza correctOptionIndex de la pregunta al índice de la nueva opción correcta.
   */
  const handleCorrectOptionChange = (questionIndex, optionIndex) => {
    setAssessmentQuestions((previous) =>
      previous.map((q, i) => (i === questionIndex ? { ...q, correctOptionIndex: optionIndex } : q))
    );
  };

  /**
   * handleSaveAssessment()
   * 
   * Qué hace: Valida y guarda una nueva evaluación (test) para el curso.
   * Cómo:
   *   1. Valida todos los campos obligatorios de meta (title, startDate, startTime, endDate, endTime)
   *   2. Valida que fecha de fin ≥ fecha de inicio
   *   3. Valida que todas las preguntas tengan texto
   *   4. Valida que todas las preguntas tengan al menos 2 opciones
   *   5. Valida que todas las opciones de todas las preguntas tengan texto
   *   6. Llama a addCourseAssessment() y limpia los formularios
   *   7. Incrementa refreshKey
   * 
   * Por qué: Las evaluaciones son estructuras complejas. Validación exhaustiva evita guarniciones 
   *          incompletas y previene errores después cuando los estudiantes intenten resolverlas.
   */
  const handleSaveAssessment = async () => {
    setAssessmentError('');

    if (!assessmentMeta.title.trim()) {
      setAssessmentError('Debes darle un nombre a la evaluación.');
      return;
    }

    if (!assessmentMeta.startDate) {
      setAssessmentError('Debes indicar la fecha de inicio de la evaluación.');
      return;
    }

    if (!assessmentMeta.endDate) {
      setAssessmentError('Debes indicar la fecha de fin de la evaluación.');
      return;
    }

    if (!assessmentMeta.startTime) {
      setAssessmentError('Debes indicar la hora de inicio de la evaluación.');
      return;
    }

    if (!assessmentMeta.endTime) {
      setAssessmentError('Debes indicar la hora de fin de la evaluación.');
      return;
    }

    if (assessmentMeta.endDate < assessmentMeta.startDate) {
      setAssessmentError('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }

    const startDateTime = new Date(`${assessmentMeta.startDate}T${assessmentMeta.startTime}`);
    const endDateTime = new Date(`${assessmentMeta.endDate}T${assessmentMeta.endTime}`);

    if (endDateTime < startDateTime) {
      setAssessmentError('La fecha y hora de fin no pueden ser anteriores al inicio.');
      return;
    }

    if (assessmentQuestions.length === 0) {
      setAssessmentError('Debes agregar al menos una pregunta.');
      return;
    }

    for (let i = 0; i < assessmentQuestions.length; i++) {
      const question = assessmentQuestions[i];

      if (!question.text.trim()) {
        setAssessmentError(`La pregunta ${i + 1} no tiene texto.`);
        return;
      }

      if (question.options.length < 2) {
        setAssessmentError(`La pregunta ${i + 1} debe tener al menos 2 opciones.`);
        return;
      }

      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].text.trim()) {
          setAssessmentError(`La opción ${j + 1} de la pregunta ${i + 1} está vacía.`);
          return;
        }
      }
    }

    try {
      await assessmentService.createAssessment(course.id, {
        title: assessmentMeta.title,
        startDate: assessmentMeta.startDate,
        startTime: assessmentMeta.startTime,
        endDate: assessmentMeta.endDate,
        endTime: assessmentMeta.endTime,
        questions: assessmentQuestions.map((q) => ({
          text: q.text,
          options: q.options.map((o) => ({ text: o.text })),
          correctOptionIndex: q.correctOptionIndex
        }))
      });

      setAssessmentMeta({ title: '', startDate: '', startTime: '', endDate: '', endTime: '' });
      setAssessmentQuestions([]);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setAssessmentError(err.response?.data?.message || 'No fue posible guardar la evaluación.');
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta evaluación? Se perderá permanentemente.')) {
      return;
    }

    try {
      await assessmentService.deleteAssessment(course.id, assessmentId);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setAssessmentError(err.response?.data?.message || 'No fue posible eliminar la evaluación.');
    }
  };

  const renderSectionNode = (section, depth = 0) => {
    return (
      <article key={section.id} className="section-outline-node" style={{ marginLeft: `${depth * 16}px` }}>
        <div className="section-outline-header">
          <h3>{section.title}</h3>
          <div className="node-meta">
            <span>{section.children.length} subtemas</span>
            <span>{section.resources.length} contenidos</span>
          </div>
          <Link to={`/courses/${course.id}/manage/sections/${section.id}`} className="btn-secondary section-detail-btn">
            Ver detalle
          </Link>
        </div>

        <p className="section-outline-description">{section.description || 'Sin descripción'}</p>

        {section.children.length > 0 ? (
          <div className="section-tree-children">
            {section.children.map((childSection) => renderSectionNode(childSection, depth + 1))}
          </div>
        ) : null}
      </article>
    );
  };

  // Interfaz.

  return (
    <div className="manage-course-page">
      <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
        ← Volver a cursos creados
      </button>

      <section className="manage-course-hero">
        <div>
          <span className={`course-status-badge ${course.isFinished ? 'finished' : course.isPublished ? 'published' : 'hidden'}`}>
            {course.isFinished ? 'Terminado' : course.isPublished ? 'Publicado' : 'Oculto'}
          </span>
          <h1>{course.name}</h1>
          <p>
            {course.isFinished
              ? 'Este curso ha terminado porque su fecha de fin ya pasó. No se pueden modificar secciones, contenidos ni evaluaciones. Puedes eliminarlo, ocultarlo o clonarlo.'
              : course.isPublished
              ? 'Este curso está publicado y visible para estudiantes en el catálogo. Desde aquí puedes gestionar su estructura y contenido.'
              : 'Este curso está oculto y no aparece en el catálogo público ya sea porque decidiste ocultarlo o acabas de crearlo. Desde aquí puedes construir o modificar sus secciones y contenido antes de publicarlo.'}
          </p>
        </div>

        {course.isFinished ? (
          <div className="course-cover-button" aria-label="Imagen del curso">
            <img src={course.coverImage} alt={course.name} className="manage-course-cover" />
          </div>
        ) : (
          <button
            type="button"
            className="course-cover-button"
            onClick={handleCoverImageClick}
            aria-label="Cambiar imagen del curso"
          >
            <img src={course.coverImage} alt={course.name} className="manage-course-cover" />
            <span className="course-cover-hint">Haz clic para cambiar imagen</span>
          </button>
        )}
        <input
          ref={coverImageInputRef}
          type="file"
          accept="image/*"
          className="cover-image-input"
          onChange={handleCoverImageChange}
        />
      </section>

      <section className="manage-course-layout">
        <article className="manage-course-panel info-panel">
          <div className="panel-header">
            <h2>Información general</h2>
            <Link to={`/courses/${course.id}/registered`} className="btn-secondary">
              Ver Curso
            </Link>
          </div>

          {isEditingCourse ? (
            <form className="section-form info-edit-form" onSubmit={handleSaveCourse}>
              <div className="form-group">
                <label htmlFor="courseName">Nombre del curso</label>
                <input
                  id="courseName"
                  type="text"
                  value={courseForm.name}
                  onChange={(event) => setCourseForm((previous) => ({ ...previous, name: event.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="courseStartDate">Fecha de inicio</label>
                <input
                  id="courseStartDate"
                  type="date"
                  value={courseForm.startDate}
                  onChange={(event) => setCourseForm((previous) => ({ ...previous, startDate: event.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="courseEndDate">Fecha de fin (opcional - dejar vacío para siempre disponible)</label>
                <input
                  id="courseEndDate"
                  type="date"
                  value={courseForm.endDate}
                  onChange={(event) => setCourseForm((previous) => ({ ...previous, endDate: event.target.value }))}
                />
              </div>

              {courseError ? <p className="error-text">{courseError}</p> : null}

              <div className="inline-panel-actions">
                <button type="submit" className="btn-primary">Guardar cambios</button>
                <button type="button" className="btn-secondary" onClick={() => setIsEditingCourse(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="manage-course-meta-grid">
                <div className="manage-meta-item">
                  <span>Código</span>
                  <strong>{course.code}</strong>
                </div>
                <div className="manage-meta-item">
                  <span>Nombre del curso</span>
                  <strong>{course.name}</strong>
                </div>
                <div className="manage-meta-item">
                  <span>Inicio</span>
                  <strong>{formatDate(course.startDate)}</strong>
                </div>
                <div className="manage-meta-item">
                  <span>Fin</span>
                  <strong>{course.endDate && course.endDate !== '00/00/0000' ? formatDate(course.endDate) : 'Siempre disponible'}</strong>
                </div>
              </div>

              <p className="manage-course-description">{course.description}</p>

              <Link to={`/courses/${course.id}/manage/members`} className="course-members-link">
                Integrantes del curso
              </Link>

              <button type="button" className="btn-primary info-edit-btn" onClick={startEditingCourse}>
                Modificar
              </button>
            </>
          )}
        </article>

        {!course.isFinished ? (
          <aside className="manage-course-panel manage-course-aside">
            <h2>Crear Sección</h2>
          <p className="aside-copy">
            Puedes crear una sección como una sección raíz o escoger una sección existente como padre para crear sub-secciones.
          </p>

          <form className="section-form" onSubmit={handleAddSection}>
            <div className="form-group">
              <label htmlFor="parentId">Sección padre</label>
              <select id="parentId" name="parentId" value={form.parentId} onChange={handleChange}>
                <option value="">Sin padre (raíz)</option>
                {sectionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${'— '.repeat(option.depth)}${option.title}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="title">Nombre de la sección</label>
              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="Ej: Introducción al curso"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Descripción breve</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Explica qué se trabajará en esta sección"
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <button type="submit" className="btn-primary add-section-btn">
              Guardar sección
            </button>
          </form>
        </aside>
        ) : null}

        {!course.isFinished ? (
        <aside className="manage-course-panel manage-course-content-panel">
          <h2>Agregar contenido</h2>
          <p className="aside-copy">
            Cada tema o subtema puede tener múltiples recursos combinados: texto, documentos,
            videos e imágenes.
          </p>

          <form className="section-form" onSubmit={handleAddResource}>
            <div className="form-group">
              <label htmlFor="sectionId">Sección destino</label>
              <select
                id="sectionId"
                name="sectionId"
                value={resourceForm.sectionId}
                onChange={handleResourceChange}
              >
                <option value="">Selecciona una sección</option>
                {sectionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {`${'— '.repeat(option.depth)}${option.title}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="type">Tipo de contenido</label>
              <select id="type" name="type" value={resourceForm.type} onChange={handleResourceChange}>
                <option value="text">Texto</option>
                <option value="document">Documento</option>
                <option value="video">Video</option>
                <option value="image">Imagen</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="resourceTitle">Título del contenido</label>
              <input
                id="resourceTitle"
                name="title"
                type="text"
                value={resourceForm.title}
                onChange={handleResourceChange}
                placeholder="Ej: Guía de lectura semana 1"
              />
            </div>

            {resourceForm.type === 'text' ? (
              <div className="form-group">
                <label htmlFor="text">Texto</label>
                <textarea
                  id="text"
                  name="text"
                  value={resourceForm.text}
                  onChange={handleResourceChange}
                  placeholder="Escribe aquí el contenido textual"
                />
              </div>
            ) : null}

            {resourceForm.type === 'video' ? (
              <div className="form-group">
                <label htmlFor="fileUploadVideo">Archivo de video</label>
                <input
                  id="fileUploadVideo"
                  name="fileUploadVideo"
                  type="file"
                  accept="video/*"
                  onChange={handleResourceFile}
                />
              </div>
            ) : null}

            {resourceForm.type === 'document' || resourceForm.type === 'image' ? (
              <div className="form-group">
                <label htmlFor="fileUpload">Archivo</label>
                <input
                  id="fileUpload"
                  name="fileUpload"
                  type="file"
                  accept={resourceForm.type === 'document' ? '.pdf,.doc,.docx,.txt' : 'image/*'}
                  onChange={handleResourceFile}
                />
              </div>
            ) : null}

            {resourceError ? <p className="error-text">{resourceError}</p> : null}

            <button type="submit" className="btn-primary add-section-btn">
              Agregar contenido
            </button>
          </form>
        </aside>
        ) : null}
      </section>

      <section className="manage-course-panel sections-panel">
        <div className="panel-header">
          <h2>Secciones del curso</h2>
          <span className="section-count">{course.sections.length}</span>
        </div>

        <p className="sections-helper-copy">
          Este bloque solo muestra el mapa de temas y subtemas. En “Ver detalle” puedes revisar y
          editar descripción, materiales y subtemas.
        </p>

        {course.sections.length === 0 ? (
          <div className="empty-manage-state">
            <h3>Este curso aún no tiene secciones</h3>
            <p>
              Crea el primer tema raíz y luego agrega subtemas para construir el árbol del curso.
            </p>
          </div>
        ) : (
          <div className="section-stack">
            {course.sections.map((section) => renderSectionNode(section))}
          </div>
        )}
      </section>

      {/* ── Evaluations ─────────────────────────────── */}
      <section className="manage-course-layout assessments-creation-layout">
        {/* Left: merged creation panel (meta + questions) */}
        {!course.isFinished ? (
        <aside className="manage-course-panel assessment-questions-panel">
          <h2>Nueva evaluación</h2>
          <p className="aside-copy">
            Cree una nueva evaluación para este curso.
          </p>

          <div className="assessment-meta-inline">
            <div className="form-group">
              <label htmlFor="assessmentTitle">Nombre de la evaluación</label>
              <input
                id="assessmentTitle"
                type="text"
                value={assessmentMeta.title}
                onChange={(event) =>
                  setAssessmentMeta((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="Ej: Examen parcial 1"
              />
            </div>

            <div className="assessment-dates-row">
              <div className="form-group">
                <label htmlFor="assessmentStart">Fecha de inicio</label>
                <input
                  id="assessmentStart"
                  type="date"
                  required
                  value={assessmentMeta.startDate}
                  onChange={(event) =>
                    setAssessmentMeta((previous) => ({ ...previous, startDate: event.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="assessmentStartTime">Hora de inicio</label>
                <input
                  id="assessmentStartTime"
                  type="time"
                  required
                  value={assessmentMeta.startTime}
                  onChange={(event) =>
                    setAssessmentMeta((previous) => ({ ...previous, startTime: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="assessment-dates-row">

              <div className="form-group">
                <label htmlFor="assessmentEnd">Fecha de fin</label>
                <input
                  id="assessmentEnd"
                  type="date"
                  required
                  value={assessmentMeta.endDate}
                  onChange={(event) =>
                    setAssessmentMeta((previous) => ({ ...previous, endDate: event.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="assessmentEndTime">Hora de fin</label>
                <input
                  id="assessmentEndTime"
                  type="time"
                  required
                  value={assessmentMeta.endTime}
                  onChange={(event) =>
                    setAssessmentMeta((previous) => ({ ...previous, endTime: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <h3 className="questions-subheading">Preguntas</h3>

          <div className="assessment-question-list">
            {assessmentQuestions.length === 0 ? (
              <p className="assessment-empty-hint">Aún no hay preguntas. Haz clic en "+ Agregar pregunta" para empezar.</p>
            ) : null}

            {assessmentQuestions.map((question, qi) => (
              <div key={question._key} className="assessment-question-card">
                <div className="assessment-question-header">
                  <span className="assessment-question-label">Pregunta {qi + 1}</span>
                  <button
                    type="button"
                    className="btn-danger btn-xs"
                    onClick={() => handleRemoveQuestion(qi)}
                  >
                    Eliminar
                  </button>
                </div>

                <div className="form-group">
                  <input
                    type="text"
                    value={question.text}
                    onChange={(event) => handleQuestionTextChange(qi, event.target.value)}
                    placeholder="Escribe la pregunta aquí"
                  />
                </div>

                <div className="assessment-options-list">
                  {question.options.map((option, oi) => (
                    <div key={option._key} className="assessment-option-row">
                      <input
                        type="radio"
                        name={`correct-${question._key}`}
                        checked={question.correctOptionIndex === oi}
                        onChange={() => handleCorrectOptionChange(qi, oi)}
                        title="Marcar como respuesta correcta"
                      />
                      <input
                        type="text"
                        value={option.text}
                        onChange={(event) => handleOptionTextChange(qi, oi, event.target.value)}
                        placeholder={`Opción ${oi + 1}`}
                        className="option-text-input"
                      />
                      {question.options.length > 2 ? (
                        <button
                          type="button"
                          className="btn-icon-remove"
                          onClick={() => handleRemoveOption(qi, oi)}
                          title="Eliminar opción"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-secondary btn-sm add-option-btn"
                  onClick={() => handleAddOption(qi)}
                >
                  + Agregar opción
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-secondary add-question-btn"
            onClick={handleAddQuestion}
          >
            + Agregar pregunta
          </button>

          {assessmentError ? <p className="error-text">{assessmentError}</p> : null}

          <button
            type="button"
            className="btn-primary add-section-btn"
            onClick={handleSaveAssessment}
          >
            Guardar evaluación
          </button>
        </aside>
        ) : null}

        {/* Right: saved assessments list */}
        <aside className="manage-course-panel assessment-list-panel">
          <div className="panel-header">
            <h2>Evaluaciones guardadas</h2>
            <span className="section-count">{backendAssessments.length}</span>
          </div>

          <p className="sections-helper-copy">
            Lista de evaluaciones creadas para este curso. Haz clic en "Ver detalle" para revisarlas o editarlas.
          </p>

          {backendAssessments.length === 0 ? (
            <div className="empty-manage-state">
              <h3>Sin evaluaciones aún</h3>
              <p>Crea la primera evaluación con el formulario a la izquierda.</p>
            </div>
          ) : (
            <div className="section-stack">
              {backendAssessments.map((assessment) => (
                <article key={assessment.id} className="assessment-card">
                  <div className="assessment-card-header">
                    <h3>{assessment.title}</h3>
                  </div>
                  <div className="assessment-card-meta">
                    <span>{assessment.questions.length} pregunta{assessment.questions.length !== 1 ? 's' : ''}</span>
                    <span>Inicio: {formatDateTime(assessment.startDate, assessment.startTime)}</span>
                    {assessment.endDate ? <span>Fin: {formatDateTime(assessment.endDate, assessment.endTime)}</span> : null}
                  </div>
                  <div className="assessment-card-actions">
                    <Link
                      to={`/courses/${course.id}/manage/assessments/${assessment.id}`}
                      className="btn-secondary section-detail-btn"
                    >
                      Ver detalle
                    </Link>
                    <Link
                      to={`/courses/${course.id}/manage/assessments/${assessment.id}/submissions`}
                      className="btn-primary section-detail-btn"
                    >
                      Respuestas Estudiantes
                    </Link>
                    {!course.isFinished ? (
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        onClick={() => handleDeleteAssessment(assessment.id)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="manage-course-panel course-actions-panel">
        <div className="course-actions-row">
          <button type="button" className="btn-danger action-btn" onClick={handleDeleteCourse}>
            Eliminar curso
          </button>
          <button type="button" className="btn-secondary action-btn" onClick={() => navigate(`/courses/${course.id}/clone`)}>
            Clonar curso
          </button>
          <button type="button" className="btn-primary action-btn" onClick={handleTogglePublished}>
            {course.isPublished ? 'Ocultar curso' : 'Publicar curso'}
          </button>
        </div>
      </section>
    </div>
  );
}