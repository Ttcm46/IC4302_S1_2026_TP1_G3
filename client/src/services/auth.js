import api from './api';
import { getAccessToken, getSessionUser } from './session';

// auth.js
// Servicio de cliente para autenticación, gestión de usuarios, cursos,
// evaluaciones, sesiones y mensajería. Incluye helpers para cookies,
// almacenamiento local y mapeo de respuestas del backend.

// Lee una cookie por nombre y devuelve su valor decodificado.
function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

// Crea un Error consistente con la estructura de error esperada del API.
function createApiError(message, status = 400) {
  const err = new Error(message);
  err.response = { status, data: { error: message } };
  return err;
}

// Intenta parsear un valor JSON y devuelve un fallback si no es válido.
function parseJsonSafely(value, fallback = null) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// Normaliza un objeto de usuario recibido del backend a la forma usada por el frontend.
function mapBackendUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.name || user.fullName || user.username,
    dateOfBirth: user.dob || user.dateOfBirth || '',
    avatar: user.picPath || user.avatar || '',
    email: user.correo || user.email || '',
    role: user.typeofuser || user.role || 'student'
  };
}

// Devuelve el usuario actual almacenado en sesión o un objeto vacío si no existe.
function getCurrentUser() {
  return getSessionUser() || {};
}

const COURSE_VISIBILITY_KEY = 'tecdigitalito_course_visibility_v1';
const COURSE_OVERRIDES_KEY = 'tecdigitalito_course_overrides_v1';
const DELETED_COURSES_KEY = 'tecdigitalito_deleted_courses_v1';
const DELETED_ASSESSMENTS_KEY = 'tecdigitalito_deleted_assessments_v1';
const SECTION_COURSE_INDEX_KEY = 'tecdigitalito_section_course_index_v1';

// Lee un objeto JSON desde localStorage y devuelve un objeto vacío si falla.
function readStoredObject(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Guarda un objeto serializado en localStorage sin romper la aplicación si falla.
function writeStoredObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failures and keep runtime behavior.
  }
}

// Lee el mapa de visibilidad de cursos desde localStorage.
function readCourseVisibilityMap() {
  return readStoredObject(COURSE_VISIBILITY_KEY);
}

// Guarda el mapa de visibilidad de cursos en localStorage.
function writeCourseVisibilityMap(map) {
  writeStoredObject(COURSE_VISIBILITY_KEY, map);
}

// Devuelve el estado de publicación persistido de un curso, si existe.
function getPersistedCourseVisibility(courseCode) {
  if (!courseCode) return undefined;
  const visibilityMap = readCourseVisibilityMap();
  const value = visibilityMap[String(courseCode)];
  return typeof value === 'boolean' ? value : undefined;
}

// Guarda si un curso está publicado o no en el estado local.
function setPersistedCourseVisibility(courseCode, isPublished) {
  if (!courseCode) return;
  const visibilityMap = readCourseVisibilityMap();
  visibilityMap[String(courseCode)] = Boolean(isPublished);
  writeCourseVisibilityMap(visibilityMap);
}

// Lee la configuración local de overrides de curso desde el almacenamiento.
function readCourseOverrideMap() {
  return readStoredObject(COURSE_OVERRIDES_KEY);
}

// Devuelve los cambios de curso guardados localmente como override.
function getPersistedCourseOverride(courseCode) {
  if (!courseCode) return null;
  const overrideMap = readCourseOverrideMap();
  const value = overrideMap[String(courseCode)];
  return value && typeof value === 'object' ? value : null;
}

// Guarda los cambios locales de metadatos de un curso sin afectar el backend.
function setPersistedCourseOverride(courseCode, updates) {
  if (!courseCode || !updates || typeof updates !== 'object') return;
  const overrideMap = readCourseOverrideMap();
  overrideMap[String(courseCode)] = {
    ...(overrideMap[String(courseCode)] || {}),
    ...updates
  };
  writeStoredObject(COURSE_OVERRIDES_KEY, overrideMap);
}

// Lee el mapa de cursos eliminados guardado en localStorage.
function readDeletedCoursesMap() {
  return readStoredObject(DELETED_COURSES_KEY);
}

// Indica si un curso ha sido marcado como eliminado localmente.
function isCourseDeleted(courseCode) {
  if (!courseCode) return false;
  return readDeletedCoursesMap()[String(courseCode)] === true;
}

// Marca o desmarca un curso como eliminado en el estado local.
function setCourseDeleted(courseCode, deleted = true) {
  if (!courseCode) return;
  const deletedMap = readDeletedCoursesMap();
  deletedMap[String(courseCode)] = Boolean(deleted);
  writeStoredObject(DELETED_COURSES_KEY, deletedMap);
}

// Lee el mapa de evaluaciones eliminadas guardado en localStorage.
function readDeletedAssessmentsMap() {
  return readStoredObject(DELETED_ASSESSMENTS_KEY);
}

// Comprueba si una evaluación ha sido marcada como eliminada localmente para un curso.
function isAssessmentDeleted(courseCode, assessmentId) {
  if (!courseCode || !assessmentId) return false;
  const deletedMap = readDeletedAssessmentsMap();
  const courseDeleted = deletedMap[String(courseCode)];
  return Array.isArray(courseDeleted) && courseDeleted.includes(String(assessmentId));
}

// Marca o desmarca una evaluación como eliminada localmente para un curso.
function setAssessmentDeleted(courseCode, assessmentId, deleted = true) {
  if (!courseCode || !assessmentId) return;
  const deletedMap = readDeletedAssessmentsMap();
  const key = String(courseCode);
  const next = new Set(Array.isArray(deletedMap[key]) ? deletedMap[key].map(String) : []);
  if (deleted) {
    next.add(String(assessmentId));
  } else {
    next.delete(String(assessmentId));
  }
  deletedMap[key] = Array.from(next);
  writeStoredObject(DELETED_ASSESSMENTS_KEY, deletedMap);
}

// Lee el índice de sección a curso desde localStorage.
function readSectionCourseIndex() {
  return readStoredObject(SECTION_COURSE_INDEX_KEY);
}

// Registra el mapeo de todas las secciones de un curso a localStorage.
// Esto permite identificar el curso padre de una sección cuando se carga una sección aislada.
function registerCourseSections(courseCode, sections) {
  if (!courseCode || !Array.isArray(sections)) return;
  const sectionMap = readSectionCourseIndex();
  const visit = (nodes) => {
    nodes.forEach((node) => {
      if (!node?.id) return;
      sectionMap[String(node.id)] = String(courseCode);
      if (Array.isArray(node.children) && node.children.length > 0) {
        visit(node.children);
      }
    });
  };
  visit(sections);
  writeStoredObject(SECTION_COURSE_INDEX_KEY, sectionMap);
}

// Devuelve el ID de curso asociado a una sección mediante el índice local.
function getCourseIdForSection(sectionId) {
  if (!sectionId) return null;
  const sectionMap = readSectionCourseIndex();
  return sectionMap[String(sectionId)] || null;
}

// Normaliza un recurso de sección asegurando un id, tipo y título válidos.
function normalizeResource(resource, sectionId, index) {
  if (!resource || typeof resource !== 'object') {
    return {
      id: `${sectionId}-resource-${index + 1}`,
      type: 'text',
      title: '',
      text: typeof resource === 'string' ? resource : ''
    };
  }

  return {
    ...resource,
    id: resource.id || `${sectionId}-resource-${index + 1}`,
    type: resource.type || 'text',
    title: resource.title || `Material ${index + 1}`
  };
}

// Busca recursivamente una sección por su ID dentro de un árbol de secciones.
function findSectionById(sections, sectionId) {
  for (const section of sections || []) {
    if (section?.id === sectionId) {
      return section;
    }
    const nested = findSectionById(section?.children || [], sectionId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

// Carga un curso desde el backend y lo mapea al formato usado por el frontend.
async function loadMappedCourse(courseId) {
  const currentUser = getCurrentUser();
  const response = await api.get('/courses', { params: { classCode: courseId } });
  return mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username);
}

// Obtiene el contexto completo de un curso y sección dado el ID de sección.
// Esto es necesario cuando se edita o se muestra una sección independiente.
async function loadSectionContext(sectionId) {
  const courseId = getCourseIdForSection(sectionId);
  if (!courseId) {
    throw createApiError('No fue posible identificar el curso de esta seccion.', 404);
  }

  const course = await loadMappedCourse(courseId);
  const section = findSectionById(course?.sections || [], sectionId);
  if (!course || !section) {
    throw createApiError('No fue posible cargar la seccion solicitada.', 404);
  }

  return { course, section };
}

// Construye la descripción serializada de una sección para enviarla al backend.
function buildSectionDescription(sectionInput) {
  return JSON.stringify({
    title: sectionInput.title,
    description: sectionInput.description,
    resources: Array.isArray(sectionInput.resources) ? sectionInput.resources : [],
    parentId: sectionInput.parentId || '',
  });
}

// Persiste los cambios de una sección en el nodo correspondiente del backend.
async function persistSection(sectionId, sectionInput) {
  return api.put('/courses/section', {
    description: buildSectionDescription(sectionInput)
  }, {
    params: { classCode: sectionId }
  });
}

// Mapea errores de login del backend a mensajes de usuario legibles.
function mapLoginError(err) {
  const backendMessage = err?.response?.data?.error || err?.response?.data?.message || '';
  const status = err?.response?.status;

  if (String(backendMessage).toLowerCase().includes('account locked')) {
    return { message: 'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 1 hora.', status: 423 };
  }

  if (status === 401) {
    return { message: backendMessage || 'Credenciales incorrectas. Verifica usuario y contrasena.', status };
  }

  if (status === 400) {
    if (String(backendMessage).toLowerCase().includes('request invalido')) {
      return { message: 'Solicitud de login invalida. Revisa los datos e intenta de nuevo.', status };
    }
    return { message: backendMessage || 'Solicitud de login invalida.', status };
  }

  if (status >= 500) {
    return { message: 'Error interno del servidor al iniciar sesion. Intenta de nuevo en unos minutos.', status };
  }

  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return { message: 'Tiempo de espera agotado al conectar con el servidor.', status: 408 };
    }
    return { message: 'No se pudo conectar con el servidor. Verifica que el backend este corriendo.', status: 503 };
  }

  return { message: backendMessage || 'Error inesperado al iniciar sesion.', status: status || 500 };
}

// Mapea la estructura de curso recibida desde el backend al formato usado por el frontend.
function mapBackendCourse(course, currentUserId = null) {
  if (!course) return null;

  const details = course.class ? course : null;
  const classData = details ? details.class : course;
  const courseCode = classData.classCode;
  if (isCourseDeleted(courseCode)) {
    return null;
  }

  const courseOverride = getPersistedCourseOverride(courseCode) || {};
  const mergedClassData = { ...classData, ...courseOverride, classCode: courseCode };
  const backendStudents = Array.isArray(details?.students) ? details.students : [];
  const backendSections = Array.isArray(details?.sections) ? details.sections : [];
  const backendEvaluations = Array.isArray(details?.evaluations)
    ? details.evaluations.filter((evaluation) => !isAssessmentDeleted(courseCode, evaluation?.evalId))
    : [];

  const ownerId = mergedClassData.creatorId || null;
  const normalizedCurrentUserId =
    currentUserId === null || currentUserId === undefined ? null : String(currentUserId);
  const normalizedOwnerId =
    ownerId === null || ownerId === undefined ? null : String(ownerId);
  const persistedIsPublished = getPersistedCourseVisibility(courseCode);

  const ownerUsername = mergedClassData.creatorUsername || mergedClassData.teacherUsername || null;
  const enrolledStudentIds = [
    // Deduplicar estudiantes por ID usando Set para evitar duplicados en la lista.
    // Problema: Si backendStudents contiene múltiples copias del mismo estudiante (igual studentId),
    // la lista de estudiantes aparecería con duplicados en el conteo e interfaz.
    // Solución: Convertir a Set para mantener solo IDs únicos.
    ...new Set(
      backendStudents
        .map((student) => String(student?.studentId || ''))
        .filter(Boolean)
    )
  ];
  const enrolledStudents = enrolledStudentIds.map((studentId) => ({
    userId: studentId,
    username: studentId,
    fullName: studentId,
    avatar: ''
  }));

  // Deduplicar secciones por ID antes de reconstruir el árbol.
  // Problema: Si backendSections contiene múltiples copias de la misma sección (con igual sectionId),
  // la reconstrucción del árbol en sectionById.set() y sections.push() causaría nodos duplicados en la UI.
  // Solución: Filtrar para mantener solo la primera ocurrencia de cada ID único.
  const uniqueSections = backendSections.filter((section, index, self) =>
    index === self.findIndex(s => (s.sectionId || s.id) === (section.sectionId || section.id))
  );

  const sectionNodes = uniqueSections.map((section) => {
    const parsedDescription = parseJsonSafely(section?.description, null);
    const title = parsedDescription?.title || section?.title || section?.sectionId || 'Seccion';
    const readableDescription =
      parsedDescription?.description ||
      (Array.isArray(parsedDescription?.topics) ? parsedDescription.topics.join(', ') : '') ||
      (typeof section?.description === 'string' ? section.description : '');
    // Conexión CloneCourse: Soportar recursos en dos formatos:
    // 1. Antiguo: dentro de description (JSON serializado) -> parsedDescription.resources
    // 2. Nuevo: campo separado section.resources (estructura plana después de getClassDetails)
    const rawResources = Array.isArray(parsedDescription?.resources) 
      ? parsedDescription.resources 
      : (Array.isArray(section?.resources) ? section.resources : []);

    return {
      id: section?.sectionId || section?.id,
      parentId: section?.parentId || parsedDescription?.parentId || '',
      title,
      description: readableDescription,
      children: [],
      resources: rawResources.map((resource, index) => normalizeResource(resource, section?.sectionId || section?.id || 'section', index))
    };
  });

  const sectionById = new Map();
  sectionNodes.forEach((node) => {
    if (node?.id) sectionById.set(node.id, node);
  });

  const sections = [];
  sectionNodes.forEach((node) => {
    if (!node?.id) return;
    if (node.parentId && sectionById.has(node.parentId)) {
      sectionById.get(node.parentId).children.push(node);
    } else {
      sections.push(node);
    }
  });

  registerCourseSections(courseCode, sections);

  // Deduplicar evaluaciones por ID antes de mapear.
  // Problema: Si backendEvaluations contiene múltiples copias de la misma evaluación (con igual evalId),
  // causaría evaluaciones duplicadas en la lista de "Evaluaciones guardadas" en CourseEditor.
  // Solución: Filtrar para mantener solo la primera ocurrencia de cada ID único.
  const uniqueEvaluations = backendEvaluations.filter((evaluation, index, self) =>
    index === self.findIndex(e => e.evalId === evaluation.evalId)
  );

  const assessments = uniqueEvaluations.map((evaluation) => {
    const content = parseJsonSafely(evaluation?.content, {}) || {};
    const questions = Array.isArray(content?.questions)
      ? content.questions
          .filter((question) => question && Array.isArray(question.options))
          .map((question, index) => ({
            id: question.id || `${evaluation?.evalId}-q${index + 1}`,
            text: question.text || `Pregunta ${index + 1}`,
            options: question.options.map((opt, optIndex) => ({
              id: opt.id || `${evaluation?.evalId}-q${index + 1}-o${optIndex + 1}`,
              text: typeof opt === 'string' ? opt : opt.text || `Opcion ${optIndex + 1}`
            })),
            correctOptionIndex:
              typeof question.correctOptionIndex === 'number' ? question.correctOptionIndex : 0
          }))
      : [];

    return {
      id: evaluation?.evalId,
      title: evaluation?.name || evaluation?.evalId || 'Evaluacion',
      type: evaluation?.type || 'exam',
      startDate: content?.startDate || content?.date || '',
      endDate: content?.endDate || content?.date || '',
      startTime: content?.startTime || '',
      endTime: content?.endTime || '',
      questions
    };
  });

  return {
    id: courseCode,
    code: courseCode,
    name: mergedClassData.name || 'Curso sin nombre',
    description: mergedClassData.description || '',
    startDate: mergedClassData.startDate || '',
    endDate: mergedClassData.endDate || '',
    coverImage: mergedClassData.fotoPath || 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1200&q=80&auto=format&fit=crop',
    teacher: ownerUsername || ownerId || 'Docente',
    students: backendStudents.length || Number(classData.studentCount || 0),
    ownerId,
    ownerUsername,
    createdByCurrentUser: normalizedCurrentUserId ? normalizedOwnerId === normalizedCurrentUserId : false,
    isPublished:
      typeof persistedIsPublished === 'boolean'
        ? persistedIsPublished
        : (typeof classData.isPublished === 'boolean' ? classData.isPublished : false),
    isFinished: mergedClassData.endDate 
      ? new Date(mergedClassData.endDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0))
      : false,
    sections,
    assessments,
    enrolledStudentIds,
    enrolledStudents
  };
}

export const authService = {
  // Registra un nuevo usuario con los datos proporcionados.
  async register(data) {
    const payload = {
      name: String(data.fullName || '').trim(),
      username: String(data.username || '').trim(),
      password: String(data.password || ''),
      dob: data.dateOfBirth,
      picPath: data.avatar || '',
      typeofuser: 'student',
      correo: String(data.email || '').trim()
    };

    try {
      return await api.post('/users/create', payload);
    } catch (err) {
      // Lanzar el error tal cual viene del backend, sin transformaciones
      throw err;
    }
  },

  // Inicia sesión con usuario y contraseña, usando fallback de cookie si es necesario.
  async login(username, password, rememberMe = false) {
    try {
      const response = await api.post('/login', { username, password, rememberMe });
      if (response.data?.success === false) {
        throw createApiError(response.data.message || 'Credenciales invalidas', 401);
      }

      return {
        data: {
          accessToken: response.data?.token || '',
          refreshToken: response.data?.token || '',
          user: mapBackendUser(response.data?.user)
        }
      };
    } catch (err) {
      // [FRONTEND-ONLY] Fallback: Si el login falla pero la cookie se guardó,
      // significa que el backend procesó el login exitosamente pero luego tuvo
      // un error asíncrono (ej: createAccessLog). En este caso, usar la cookie
      // como prueba de que el login fue exitoso.
      const sessionUserCookie = readCookie('sessionUser');
      if (sessionUserCookie) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(sessionUserCookie));
          if (parsedUser && parsedUser.username === username) {
            // La cookie existe y pertenece al usuario que intentaba loguearse
            // Esto significa que el login fue exitoso en el backend
            console.log('[authService.login] Fallback: usando cookie de sesión guardada');
            return {
              data: {
                accessToken: '__cookie__',
                refreshToken: '__cookie__',
                user: parsedUser
              }
            };
          }
        } catch (cookieErr) {
          // Cookie no válida, proceder con el error normal
        }
      }
      
      const mapped = mapLoginError(err);
      throw createApiError(mapped.message, mapped.status);
    }
  },

  // Envía el correo al backend para verificar que exista y generar el token.
  // El backend responde con 404 si el correo no está registrado, o 200 si el enlace fue enviado.
  async forgotPassword(email) {
    return api.post('/users/reset', { email });
  },

  // Completa el flujo de restablecimiento de contraseña usando el token enviado por correo.
  async resetPassword(token, newPassword) {
    return api.post('/users/reset/confirm', { token, newPassword });
  },

  // Cambia la contraseña del usuario autenticado tras verificar la contraseña actual.
  async changePassword(currentPassword, newPassword) {
    const currentUser = getCurrentUser();
    if (!currentUser.username || !currentUser.id) {
      throw createApiError('No hay sesión activa.', 401);
    }

    const loginCheck = await api.post('/login', {
      username: currentUser.username,
      password: currentPassword
    });

    if (loginCheck.data?.success === false) {
      throw createApiError('La contraseña actual no es válida.', 401);
    }

    return api.put('/users/update/password', { newpassword: newPassword }, { params: { id: currentUser.id } });
  },

  // Cierra la sesión del usuario actual enviando el token de logout al backend.
  async logout() {
    const token = getAccessToken();
    return api.post('/logout', { token });
  },

  // Refresca el token de acceso en el frontend sin llamar al backend.
  async refreshToken(refreshToken) {
    return { data: { accessToken: refreshToken } };
  }
};

export const userService = {
  // Obtiene el perfil de un usuario por su ID.
  async getProfile(id) {
    const response = await api.get(`/users/details`, { params: { userId: id } });
    return { data: { user: mapBackendUser(response.data?.data) } };
  },

  // Actualiza los datos del perfil del usuario con los campos proporcionados.
  async updateProfile(id, data) {
    const payload = {
      username: data.username,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      avatar: data.avatar,
      email: data.email,
      role: data.role
    };
    const response = await api.put('/users/update', payload, { params: { id } });
    return { data: { user: mapBackendUser(response.data?.user) } };
  },

  // Busca usuarios por nombre de usuario.
  searchUsers: (query = '') => api.get('/users', { params: query ? { field: 'username', value: query } : {} }),

  // Envía una solicitud de amistad al usuario indicado.
  sendFriendRequest: (friendId) => {
    const userId = getCurrentUser().id;
    return api.post('/users/friends/request/', { userId, friendId });
  },
  // Obtiene la lista de amigos confirmados de un usuario.
  getFriends: (userId) => api.get('/users/friends/', { params: { id: userId } }),

  // Obtiene las solicitudes de amistad pendientes recibidas.
  getPendingRequests: () => {
    const userId = getCurrentUser().id;
    return api.get('/users/friends/requests/', { params: { id: userId } });
  },
  // Obtiene las solicitudes de amistad enviadas por el usuario actual.
  getSentRequests: () => {
    const userId = getCurrentUser().id;
    return api.get('/users/friends/sent/', { params: { id: userId } });
  },

  // Elimina una amistad existente.
  removeFriend: (friendId) => {
    const userId = getCurrentUser().id;
    return api.delete('/users/friends/', { data: { userId, friendId } });
  },
  // Acepta una solicitud de amistad recibida.
  acceptFriendRequest: (fromUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/users/friends/accept/', { userId, fromUserId });
  },

  // Rechaza una solicitud de amistad recibida.
  rejectFriendRequest: (fromUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/users/friends/reject/', { userId, fromUserId });
  },
  // Obtiene los cursos en los que un usuario está inscrito o los cursos que creó.
  async getUserCourses(userId) {
    const currentUser = getCurrentUser();
    try {
      // Obtener cursos donde el usuario está matriculado (como estudiante)
      const enrolledResponse = await api.get('/users/courses', { params: { id: userId } });
      const enrolledClasses = Array.isArray(enrolledResponse.data?.classes) ? enrolledResponse.data.classes : [];

      // Obtener cursos donde el usuario es docente (creador)
      const createdResponse = await api.get('/courses/mine', { params: { id: userId } });
      const createdClasses = Array.isArray(createdResponse.data?.classes) ? createdResponse.data.classes : [];

      // Combinar ambas listas
      const allClasses = [...enrolledClasses, ...createdClasses];

      return {
        data: {
          courses: allClasses
            .map((course) => mapBackendCourse(course, currentUser.id || currentUser.username))
            .filter(Boolean)
        }
      };
    } catch (error) {
      console.error('Error fetching user courses:', error);
      return {
        data: {
          courses: []
        }
      };
    }
  },
  // Obtiene los registros de acceso de un usuario.
  getAccessLogs: (userId) => api.get('/users/log/', { params: { id: userId } })
};

export const courseService = {
  // Crea un nuevo curso con los datos proporcionados por el usuario actual.
  async createCourse(data) {
    const currentUser = getCurrentUser();
    const creatorId = currentUser.id || currentUser.username || 'anonymous';
    const payload = {
      class: {
        classCode: data.code,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate || '',
        fotoPath: data.coverImage || '',
        isPublished: false,
        creatorUsername: currentUser.username || ''
      },
      id: creatorId,
      creatorId
    };

    const response = await api.post('/courses/create', payload);
    // Conexión CreateCourse->CourseEditor: El backend ahora retorna la estructura completa
    // { course: { class: {...}, evaluations: [...], students: [...], sections: [...] } }
    // como retorna getClassDetails(), para que mapBackendCourse() lo procese correctamente.
    const createdClassCode = response.data?.course?.class?.classCode || payload.class.classCode;
    setPersistedCourseVisibility(createdClassCode, false);
    return {
      data: {
        course: mapBackendCourse(response.data?.course || { class: payload.class, evaluations: [], students: [], sections: [] }, currentUser.id || currentUser.username)
      }
    };
  },

  // Obtiene todos los cursos disponibles y los mapea al formato del frontend.
  async getCourses() {
    const currentUser = getCurrentUser();
    const response = await api.get('/courses');
    const classes = Array.isArray(response.data?.classes) ? response.data.classes : [];
    return {
      data: {
        courses: classes
          .map((course) => mapBackendCourse(course, currentUser.id || currentUser.username))
          .filter(Boolean)
      }
    };
  },

  // Conexión CreateCourse: Valida que un código de curso no esté duplicado.
  // Usado en tiempo real en el formulario para mostrar advertencia al usuario.
  async checkCodeExists(code) {
    try {
      const response = await api.get('/courses/check-code', { params: { code } });
      return response.data?.exists || false;
    } catch (error) {
      console.error('Error checking course code:', error);
      return false;
    }
  },

  // Obtiene un curso por su ID y lo mapea al formato del frontend.
  async getCourse(id) {
    const currentUser = getCurrentUser();
    const response = await api.get('/courses', { params: { classCode: id } });
    return {
      data: {
        course: mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username)
      }
    };
  },

  // Obtiene el profesor y los estudiantes matriculados de un curso.
  async getCourseMembers(id) {
    const currentUser = getCurrentUser();
    const response = await api.get('/courses', { params: { classCode: id } });
    const mapped = mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username);
    return {
      data: {
        teacher: {
          userId: mapped?.ownerId || `course-${id}-teacher`,
          username: mapped?.teacher || 'Docente',
          fullName: mapped?.teacher || 'Docente',
          avatar: ''
        },
        students: mapped?.enrolledStudents || []
      }
    };
  },

  // Actualiza los metadatos de un curso y mantiene una copia local de los cambios.
  async updateCourse(id, data) {
    // Conexión CourseEditor: Llamar al backend para actualizar metadatos del curso
    // PUT /courses?classCode=ID persiste cambios en Neo4j
    try {
      await api.put('/courses', {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        fotoPath: data.coverImage,
      }, { params: { classCode: id } });
    } catch (error) {
      console.error('Error updating course in backend:', error);
    }

    // También guardar en localStorage como fallback
    setPersistedCourseOverride(id, {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      fotoPath: data.coverImage,
    });

    return {
      data: {
        course: await loadMappedCourse(id)
      }
    };
  },

  // Cambia el estado de publicación de un curso y lo persiste localmente.
  async publishCourse(id, isPublished) {
    // Conexión CourseEditor: Llamar al backend para actualizar estado de publicación
    // PUT /courses/status?id=CLASSCODE persiste cambios en Neo4j
    try {
      await api.put('/courses/status', { isPublished: !!isPublished }, { params: { id } });
    } catch (error) {
      console.error('Error updating course visibility in backend:', error);
    }
    
    // También guardar en localStorage como fallback
    setPersistedCourseVisibility(id, !!isPublished);
    return { data: { success: true, isPublished: !!isPublished } };
  },

  // Elimina un curso y lo marca como borrado en el estado local.
  async deleteCourse(id) {
    await api.delete('/courses', { params: { classCode: id } });
    setCourseDeleted(id, true);
    return { data: { success: true, id } };
  },

  // Crea una nueva sección en un curso, guardando su dependencia lógica en la descripción.
  async createSection(courseId, sectionInput) {
    const sectionId = sectionInput.sectionId || `sec_${Date.now()}`;

    // The backend only returns sections linked directly to the class.
    // To keep subtopics visible after reloads without backend changes,
    // persist them as class sections and encode the logical parent in description.parentId.
    return api.post('/courses/section', {
      sectionId,
      description: buildSectionDescription(sectionInput),
      isClassParent: true,
    }, {
      params: { id: courseId }
    });
  },

  // Actualiza los datos de una sección existente.
  async updateSection(sectionId, sectionInput) {
    return persistSection(sectionId, sectionInput);
  },

  // Conexión SectionEditor: Conecta al endpoint DELETE /courses/section del backend.
  // Antes: Lanzaba error 501 (no soportado).
  // Ahora: Llama al backend para eliminar la sección definitivamente en Neo4j.
  async deleteSection(sectionId) {
    return api.delete('/courses/section', {
      params: { sectionId }
    });
  },

  // Agrega un recurso a una sección y guarda los cambios en el backend.
  async addSectionResource(sectionId, resourceInput) {
    const { section } = await loadSectionContext(sectionId);
    const nextResources = [
      ...(Array.isArray(section.resources) ? section.resources : []),
      normalizeResource({
        ...resourceInput,
        id: resourceInput.id || `${sectionId}-resource-${Date.now()}`
      }, sectionId, Array.isArray(section.resources) ? section.resources.length : 0)
    ];

    return persistSection(sectionId, {
      title: section.title,
      description: section.description,
      parentId: section.parentId || '',
      resources: nextResources
    });
  },

  // Actualiza un recurso específico dentro de una sección.
  async updateSectionResource(sectionId, resourceId, resourceInput) {
    const { section } = await loadSectionContext(sectionId);
    const currentResources = Array.isArray(section.resources) ? section.resources : [];
    const nextResources = currentResources.map((resource, index) => (
      String(resource.id) === String(resourceId)
        ? normalizeResource({ ...resource, ...resourceInput, id: resource.id }, sectionId, index)
        : resource
    ));

    return persistSection(sectionId, {
      title: section.title,
      description: section.description,
      parentId: section.parentId || '',
      resources: nextResources
    });
  },

  // Elimina un recurso de una sección y persiste el cambio.
  async deleteSectionResource(sectionId, resourceId) {
    const { section } = await loadSectionContext(sectionId);
    const nextResources = (Array.isArray(section.resources) ? section.resources : [])
      .filter((resource) => String(resource.id) !== String(resourceId));

    return persistSection(sectionId, {
      title: section.title,
      description: section.description,
      parentId: section.parentId || '',
      resources: nextResources
    });
  },

  // Clona un curso existente creando uno nuevo con los datos proporcionados.
  async cloneCourse(id, data) {
    const currentUser = getCurrentUser();
    // Conexión CloneCourse: Envía metadatos del nuevo curso al backend
    // El backend copia todas las secciones y materiales del original
    // Mantiene descripción e imagen del original, crea nuevo nodo con datos proporcionados
    const payload = {
      newClassCode: data.code,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      fotoPath: data.coverImage,
      creatorUsername: currentUser.username || '',
      creatorId: currentUser.id || currentUser.username || null,
      id: currentUser.id || currentUser.username || null,
    };
    console.log('[cloneCourse] Sending payload with creatorId:', payload.creatorId, 'creatorUsername:', payload.creatorUsername);
    return api.post('/courses/clone', payload, {
      params: { sourceClassCode: id }
    });
  },

  // Obtiene los estudiantes matriculados en un curso.
  getStudents: (id) => api.get('/courses/students', { params: { classCode: id } })
};

// Crea preguntas normalizadas a partir de los datos de evaluación recibidos del formulario.
function createQuestionsFromAssessment(assessment, evalId) {
  return (assessment.questions || []).map((question, qIndex) => ({
    id: question.id || `${evalId}-q${qIndex + 1}`,
    text: question.text,
    options: (question.options || []).map((option, oIndex) => ({
      id: option.id || `${evalId}-q${qIndex + 1}-o${oIndex + 1}`,
      text: option.text
    })),
    correctOptionIndex: question.correctOptionIndex ?? 0
  }));
}

export const assessmentService = {
  // Crea una nueva evaluación para un curso dado.
  async createAssessment(courseId, assessmentInput) {
    const evalId = assessmentInput.id || `eval_${Date.now()}`;
    const content = {
      startDate: assessmentInput.startDate || '',
      startTime: assessmentInput.startTime || '',
      endDate: assessmentInput.endDate || '',
      endTime: assessmentInput.endTime || '',
      questions: createQuestionsFromAssessment(assessmentInput, evalId)
    };

    return api.post('/courses/evaluation', {
      evalId,
      name: assessmentInput.title,
      type: assessmentInput.type || 'exam',
      content
    }, {
      params: { classCode: courseId }
    });
  },

  // Actualiza una evaluación existente con los datos modificados.
  async updateAssessment(courseId, evalId, assessmentInput) {
    // Conexión AssessmentEditor: Conecta al endpoint PUT /courses/evaluation del backend.
    // Antes: Lanzaba error 501 (no soportado).
    // Ahora: Envía los cambios de la evaluación al backend (nombre, fechas, preguntas).
    const content = {
      startDate: assessmentInput.startDate || '',
      startTime: assessmentInput.startTime || '',
      endDate: assessmentInput.endDate || '',
      endTime: assessmentInput.endTime || '',
      questions: createQuestionsFromAssessment(assessmentInput, evalId)
    };

    return api.put('/courses/evaluation', {
      name: assessmentInput.title,
      type: assessmentInput.type || 'exam',
      content
    }, {
      params: { evalId }
    });
  },

  // Elimina una evaluación de un curso y marca la evaluación como borrada localmente.
  deleteAssessment: async (courseId, assessmentId) => {
    // Conexión AssessmentEditor: Llamar al backend para eliminar la evaluación completamente.
    // DELETE /courses/evaluation?evalId=ID elimina la evaluación de Neo4j.
    try {
      await api.delete('/courses/evaluation', { params: { evalId: assessmentId } });
    } catch (error) {
      console.error('Error deleting assessment from backend:', error);
    }
    
    // También eliminar del localStorage como fallback
    setAssessmentDeleted(courseId, assessmentId, true);
    return { data: { success: true, courseId, assessmentId } };
  },

  // Envía los resultados de una evaluación completada al backend.
  async submitAssessment(courseId, evalId, resultInput) {
    const currentUser = getCurrentUser();
    const userId = String(currentUser.id || currentUser.username || 'anonymous-user');
    const username = currentUser.username || userId;

    const result = {
      userId,
      username,
      courseId: String(courseId),
      evalId: String(evalId),
      assessmentTitle: resultInput.assessmentTitle,
      score: resultInput.score,
      correctAnswers: resultInput.correctAnswers,
      totalQuestions: resultInput.totalQuestions,
      questionResults: resultInput.questionResults || [],
      submittedAt: new Date().toISOString()
    };

    const response = await api.post('/courses/submit', result, { params: { classCode: courseId, evalId } });
    return { data: { result: response.data?.result || result } };
  },

  // Obtiene el resultado de una evaluación para un usuario específico.
  async getAssessmentResult(courseId, evalId, userId) {
    const currentUser = getCurrentUser();
    const effectiveUserId = String(userId || currentUser.id || currentUser.username || 'anonymous-user');

    const response = await api.get('/courses/grades', { params: { evalId, userId: effectiveUserId } });
    return { data: { result: response.data?.result || null } };
  },

  // Obtiene todas las entregas de una evaluación.
  async getAssessmentSubmissions(courseId, evalId) {
    const response = await api.get('/courses/grades', { params: { evalId } });
    return { data: { results: response.data?.results || [] } };
  },

  // Obtiene los resultados de un curso para un usuario determinado.
  async getCourseResultsForUser(courseId, userId) {
    const currentUser = getCurrentUser();
    const effectiveUserId = String(userId || currentUser.id || currentUser.username || 'anonymous-user');

    const response = await api.get('/courses/grades', { params: { classCode: courseId, userId: effectiveUserId } });
    return { data: { results: response.data?.results || [] } };
  },
};

export const enrollmentService = {
  // Matricula al usuario actual en un curso.
  async enrollCourse(courseId) {
    const currentUser = getCurrentUser();
    const studentId = currentUser.id || currentUser.username;
    const username = currentUser.username || '';

    if (!studentId && !username) {
      throw createApiError('Debes iniciar sesion para matricularte.', 401);
    }

    try {
      const response = await api.post('/courses/enroll', { studentId, username }, { params: { classCode: courseId } });
      return response;
    } catch (err) {
      throw err;
    }
  },
  // Obtiene los cursos en los que el usuario actual está matriculado.
  async getMyCourses() {
    const currentUser = getCurrentUser();
    const id = currentUser.id || currentUser.username || '';
    if (!id) {
      return { data: { courses: [] } };
    }
    const response = await api.get('/courses/enrolled', {
      params: { id }
    });
    const courses = Array.isArray(response.data?.courses) ? response.data.courses : [];
    return { data: { courses: courses.map((course) => mapBackendCourse(course, id)).filter(Boolean) } };
  },

  // Obtiene los cursos que el usuario actual imparte.
  async getTeachingCourses() {
    const currentUser = getCurrentUser();
    const id = currentUser.id || currentUser.username || '';
    if (!id) {
      return { data: { courses: [] } };
    }
    const response = await api.get(`/courses/mine?id=${id}`);
    const courses = Array.isArray(response.data?.classes) ? response.data.classes : [];
    return { data: { courses: courses.map((course) => mapBackendCourse(course, id)).filter(Boolean) } };
  }
};

export const messageService = {
  // Envía un mensaje a otro usuario.
  sendMessage: (toUserId, content) => {
    const fromUserId = getCurrentUser().id;
    return api.post('/messages/send/', { fromUserId, toUserId, content });
  },

  // Obtiene los mensajes recibidos del buzón del usuario actual.
  getInbox: () => {
    const user = getCurrentUser();
    const userId = user.id || user.username;
    return api.get('/messages/inbox/', { params: { id: userId } });
  },

  // Obtiene la conversación entre el usuario actual y otro usuario.
  getConversation: (otherUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/messages/conversation/', { userId, otherUserId });
  },

  // Marca como leídos los mensajes de una conversación con otro usuario.
  markAsRead: (otherUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/messages/mark-as-read', { userId, otherUserId });
  },

  // Obtiene el conteo de mensajes no leídos contra otro usuario.
  getUnreadCount: (otherUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/messages/unread-count', { userId, otherUserId });
  }
};
