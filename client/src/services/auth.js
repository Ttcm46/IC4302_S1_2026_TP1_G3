import api from './api';
import { getAccessToken, getSessionUser } from './session';

function createApiError(message, status = 400) {
  const err = new Error(message);
  err.response = { status, data: { error: message } };
  return err;
}

function parseJsonSafely(value, fallback = null) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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

function getCurrentUser() {
  return getSessionUser() || {};
}

const COURSE_VISIBILITY_KEY = 'tecdigitalito_course_visibility_v1';
const COURSE_OVERRIDES_KEY = 'tecdigitalito_course_overrides_v1';
const DELETED_COURSES_KEY = 'tecdigitalito_deleted_courses_v1';
const DELETED_ASSESSMENTS_KEY = 'tecdigitalito_deleted_assessments_v1';
const SECTION_COURSE_INDEX_KEY = 'tecdigitalito_section_course_index_v1';

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

function writeStoredObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failures and keep runtime behavior.
  }
}

function readCourseVisibilityMap() {
  return readStoredObject(COURSE_VISIBILITY_KEY);
}

function writeCourseVisibilityMap(map) {
  writeStoredObject(COURSE_VISIBILITY_KEY, map);
}

function getPersistedCourseVisibility(courseCode) {
  if (!courseCode) return undefined;
  const visibilityMap = readCourseVisibilityMap();
  const value = visibilityMap[String(courseCode)];
  return typeof value === 'boolean' ? value : undefined;
}

function setPersistedCourseVisibility(courseCode, isPublished) {
  if (!courseCode) return;
  const visibilityMap = readCourseVisibilityMap();
  visibilityMap[String(courseCode)] = Boolean(isPublished);
  writeCourseVisibilityMap(visibilityMap);
}

function readCourseOverrideMap() {
  return readStoredObject(COURSE_OVERRIDES_KEY);
}

function getPersistedCourseOverride(courseCode) {
  if (!courseCode) return null;
  const overrideMap = readCourseOverrideMap();
  const value = overrideMap[String(courseCode)];
  return value && typeof value === 'object' ? value : null;
}

function setPersistedCourseOverride(courseCode, updates) {
  if (!courseCode || !updates || typeof updates !== 'object') return;
  const overrideMap = readCourseOverrideMap();
  overrideMap[String(courseCode)] = {
    ...(overrideMap[String(courseCode)] || {}),
    ...updates
  };
  writeStoredObject(COURSE_OVERRIDES_KEY, overrideMap);
}

function readDeletedCoursesMap() {
  return readStoredObject(DELETED_COURSES_KEY);
}

function isCourseDeleted(courseCode) {
  if (!courseCode) return false;
  return readDeletedCoursesMap()[String(courseCode)] === true;
}

function setCourseDeleted(courseCode, deleted = true) {
  if (!courseCode) return;
  const deletedMap = readDeletedCoursesMap();
  deletedMap[String(courseCode)] = Boolean(deleted);
  writeStoredObject(DELETED_COURSES_KEY, deletedMap);
}

function readDeletedAssessmentsMap() {
  return readStoredObject(DELETED_ASSESSMENTS_KEY);
}

function isAssessmentDeleted(courseCode, assessmentId) {
  if (!courseCode || !assessmentId) return false;
  const deletedMap = readDeletedAssessmentsMap();
  const courseDeleted = deletedMap[String(courseCode)];
  return Array.isArray(courseDeleted) && courseDeleted.includes(String(assessmentId));
}

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

function readSectionCourseIndex() {
  return readStoredObject(SECTION_COURSE_INDEX_KEY);
}

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

function getCourseIdForSection(sectionId) {
  if (!sectionId) return null;
  const sectionMap = readSectionCourseIndex();
  return sectionMap[String(sectionId)] || null;
}

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

async function loadMappedCourse(courseId) {
  const currentUser = getCurrentUser();
  const response = await api.get('/courses', { params: { classCode: courseId } });
  return mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username);
}

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

function buildSectionDescription(sectionInput) {
  return JSON.stringify({
    title: sectionInput.title,
    description: sectionInput.description,
    resources: Array.isArray(sectionInput.resources) ? sectionInput.resources : [],
    parentId: sectionInput.parentId || '',
  });
}

async function persistSection(sectionId, sectionInput) {
  return api.put('/courses/section', {
    description: buildSectionDescription(sectionInput)
  }, {
    params: { classCode: sectionId }
  });
}

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
    isFinished: false,
    sections,
    assessments,
    enrolledStudentIds,
    enrolledStudents
  };
}

export const authService = {
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
      const backendMessage = err?.response?.data?.error || err?.response?.data?.message || '';
      if (!err?.response) {
        throw createApiError('No se pudo conectar con el servidor. Verifica que el backend este corriendo.', 503);
      }
      throw createApiError(backendMessage || 'No fue posible completar el registro.', err?.response?.status || 500);
    }
  },

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
      const mapped = mapLoginError(err);
      throw createApiError(mapped.message, mapped.status);
    }
  },

  async forgotPassword(email) {
    const username = String(email || '').split('@')[0];
    return api.post('/users/reset', { username });
  },

  async resetPassword() {
    throw createApiError('Reset por token no implementado aún en backend.', 501);
  },

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

    return api.put(`/users/update/password/${currentUser.id}`, {
      newpassword: newPassword
    });
  },

  async logout() {
    const token = getAccessToken();
    return api.post('/logout', { token });
  },

  async refreshToken(refreshToken) {
    return { data: { accessToken: refreshToken } };
  }
};

export const userService = {
  async getProfile(id) {
    const response = await api.get(`/users/${id}`);
    return { data: { user: mapBackendUser(response.data?.user) } };
  },

  async updateProfile(id, data) {
    const payload = {
      username: data.username,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      avatar: data.avatar,
      email: data.email,
      role: data.role
    };
    const response = await api.put(`/users/${id}`, payload);
    return { data: { user: mapBackendUser(response.data?.user) } };
  },

  searchUsers: (query = '') => api.get('/users', { params: query ? { field: 'username', value: query } : {} }),
  sendFriendRequest: (friendId) => {
    const userId = getCurrentUser().id;
    return api.post('/users/friends/request/', { userId, friendId });
  },
  getFriends: (userId) => api.get('/users/friends/', { params: { id: userId } }),
  getAccessLogs: (userId) => api.get('/users/log/', { params: { id: userId } })
};

export const courseService = {
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

  // Conexión CreateCourse: Valida que un código de curso no esté duplicado
  // Usado en tiempo real en el formulario para mostrar advertencia al usuario
  async checkCodeExists(code) {
    try {
      const response = await api.get('/courses/check-code', { params: { code } });
      return response.data?.exists || false;
    } catch (error) {
      console.error('Error checking course code:', error);
      return false;
    }
  },

  async getCourse(id) {
    const currentUser = getCurrentUser();
    const response = await api.get('/courses', { params: { classCode: id } });
    return {
      data: {
        course: mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username)
      }
    };
  },

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

  async deleteCourse(id) {
    // Conexión DeleteCourse: Llamar al backend para eliminar el curso completamente.
    // DELETE /courses?classCode=ID elimina el curso de Neo4j y todas sus relaciones.
    try {
      await api.delete('/courses', { params: { classCode: id } });
    } catch (error) {
      console.error('Error deleting course from backend:', error);
    }
    // También eliminar del localStorage como fallback
    setCourseDeleted(id, true);
    return { data: { success: true, id } };
  },

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

  getStudents: (id) => api.get('/courses/students', { params: { classCode: id } })
};

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

  async submitAssessment(courseId, evalId, resultInput) {
    const currentUser = getCurrentUser();
    const userId = String(currentUser.id || currentUser.username || 'anonymous-user');
    const username = currentUser.username || userId;

    const payload = {
      userId,
      username,
      assessmentTitle: resultInput.assessmentTitle,
      score: resultInput.score,
      correctAnswers: resultInput.correctAnswers,
      totalQuestions: resultInput.totalQuestions,
      questionResults: resultInput.questionResults || []
    };

    return api.post(`/courses/submit/${courseId}/${evalId}`, payload);
  },

  async getAssessmentResult(courseId, evalId, userId) {
    const currentUser = getCurrentUser();
    const effectiveUserId = String(userId || currentUser.id || currentUser.username || 'anonymous-user');
    const response = await api.get(`/courses/grades/${courseId}/${evalId}?userId=${encodeURIComponent(effectiveUserId)}`);
    return { data: { result: response.data?.result || null } };
  },

  async getAssessmentSubmissions(courseId, evalId) {
    const response = await api.get(`/courses/grades/${courseId}/${evalId}`);
    return { data: { results: Array.isArray(response.data?.results) ? response.data.results : [] } };
  },

  async getCourseResultsForUser(courseId, userId) {
    const currentUser = getCurrentUser();
    const effectiveUserId = String(userId || currentUser.id || currentUser.username || 'anonymous-user');
    const response = await api.get(`/courses/grades/${courseId}?userId=${encodeURIComponent(effectiveUserId)}`);
    return { data: { results: Array.isArray(response.data?.results) ? response.data.results : [] } };
  },
};

export const enrollmentService = {
  async enrollCourse(courseId) {
    const currentUser = getCurrentUser();
    const studentId = currentUser.id || currentUser.username;
    const username = currentUser.username || '';

    if (!studentId && !username) {
      throw createApiError('Debes iniciar sesion para matricularte.', 401);
    }

    return api.post('/courses/enroll', { studentId, username }, { params: { classCode: courseId } });
  },
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
  sendMessage: (toUserId, content) =>
    api.post('/messages/send/', { toUserId, content }),

  getInbox: () => {
    const user = getCurrentUser();
    const userId = user.id || user.username;
    return api.get('/messages/inbox/', { params: { id: userId } });
  },

  getConversation: (otherUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/messages/conversation/', { userId, otherUserId });
  }
};
