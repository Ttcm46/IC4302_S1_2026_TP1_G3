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
  const backendStudents = Array.isArray(details?.students) ? details.students : [];
  const backendSections = Array.isArray(details?.sections) ? details.sections : [];
  const backendEvaluations = Array.isArray(details?.evaluations) ? details.evaluations : [];

  const ownerId = classData.creatorId || null;
  const ownerUsername = classData.creatorUsername || classData.teacherUsername || null;
  const enrolledStudentIds = backendStudents
    .map((student) => String(student?.studentId || ''))
    .filter(Boolean);
  const enrolledStudents = enrolledStudentIds.map((studentId) => ({
    userId: studentId,
    username: studentId,
    fullName: studentId,
    avatar: ''
  }));

  const sectionNodes = backendSections.map((section) => {
    const parsedDescription = parseJsonSafely(section?.description, null);
    const title = parsedDescription?.title || section?.title || section?.sectionId || 'Seccion';
    const readableDescription =
      parsedDescription?.description ||
      (Array.isArray(parsedDescription?.topics) ? parsedDescription.topics.join(', ') : '') ||
      (typeof section?.description === 'string' ? section.description : '');

    return {
      id: section?.sectionId || section?.id,
      parentId: section?.parentId || parsedDescription?.parentId || '',
      title,
      description: readableDescription,
      children: [],
      resources: Array.isArray(parsedDescription?.resources) ? parsedDescription.resources : []
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

  const assessments = backendEvaluations.map((evaluation) => {
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
    id: classData.classCode,
    code: classData.classCode,
    name: classData.name || 'Curso sin nombre',
    description: classData.description || '',
    startDate: classData.startDate || '',
    endDate: classData.endDate || '',
    coverImage: classData.fotoPath || 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1200&q=80&auto=format&fit=crop',
    teacher: ownerUsername || ownerId || 'Docente',
    students: backendStudents.length || Number(classData.studentCount || 0),
    ownerId,
    ownerUsername,
    createdByCurrentUser: currentUserId ? ownerId === currentUserId : false,
    isPublished: typeof classData.isPublished === 'boolean' ? classData.isPublished : true,
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
      name: data.fullName,
      username: data.username,
      password: data.password,
      dob: data.dateOfBirth,
      picPath: data.avatar || '',
      typeofuser: 'student',
      correo: data.email
    };
    return api.post('/users/create', payload);
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

  async resetPassword(_token, _newPassword) {
    throw createApiError('Restablecimiento por token no está disponible. Usa "Recuperar contraseña" para obtener una contraseña temporal.', 501);
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

  async searchUsers(query = '') {
    const response = await api.get('/users', { params: query ? { field: 'username', value: query } : {} });
    const backendData = response.data?.data || response.data;
    const users = backendData?.data || backendData || [];
    const userArray = Array.isArray(users) ? users : [];
    return { data: { data: userArray } };
  },

  async sendFriendRequest(targetUserId) {
    const userId = getCurrentUser().id || getCurrentUser().username;
    return api.post('/users/friends/request/', { id: targetUserId });
  },

  async acceptFriendRequest(fromUserId, toUserId) {
    return api.post('/users/friends/accept/', { from: fromUserId, to: toUserId });
  },

  async rejectFriendRequest(fromUserId, toUserId) {
    return api.post('/users/friends/reject/', { from: fromUserId, to: toUserId });
  },

  async getFriendRequestStatus(userId, targetUserId) {
    try {
      const friends = await this.getFriends(userId);
      const isFriend = friends.data?.friends?.some(f => String(f.id || f) === String(targetUserId));
      if (isFriend) return 'friends';
      return 'none';
    } catch {
      return 'none';
    }
  },

  async getUserCourseActivity(userId) {
    try {
      const createdResponse = await api.get('/courses/mine', { params: { creatorId: userId } });
      const enrolledResponse = await api.get('/courses/enrolled', { params: { id: userId } });
      return {
        data: {
          teachingCourses: createdResponse.data?.classes || [],
          enrolledCourses: enrolledResponse.data?.courses || []
        }
      };
    } catch {
      return { data: { teachingCourses: [], enrolledCourses: [] } };
    }
  },

  async getFriends(userId) {
    return api.get('/users/friends/', { params: { id: userId } });
  },

  async getAccessLogs(userId) {
    return api.get('/users/log/', { params: { id: userId } });
  }
};

export const courseService = {
  async createCourse(data) {
    const currentUser = getCurrentUser();
    const payload = {
      class: {
        classCode: data.code,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate || '',
        fotoPath: data.coverImage || '',
        creatorUsername: currentUser.username || ''
      },
      creatorId: currentUser.id || currentUser.username || 'anonymous'
    };

    const response = await api.post('/courses/create', payload);
    return {
      data: {
        course: mapBackendCourse(response.data?.course || payload.class, currentUser.id || currentUser.username)
      }
    };
  },

  async getCourses() {
    const currentUser = getCurrentUser();
    const response = await api.get('/courses');
    const classes = Array.isArray(response.data?.classes) ? response.data.classes : [];
    return {
      data: {
        courses: classes.map((course) => mapBackendCourse(course, currentUser.id || currentUser.username))
      }
    };
  },

  async getCourse(id) {
    const currentUser = getCurrentUser();
    const response = await api.get(`/courses/${id}`);
    return {
      data: {
        course: mapBackendCourse(response.data?.details || null, currentUser.id || currentUser.username)
      }
    };
  },

  async getCourseMembers(id) {
    const currentUser = getCurrentUser();
    const response = await api.get(`/courses/${id}`);
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
    const payload = {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      fotoPath: data.coverImage,
    };
    return api.put(`/courses/${id}`, payload);
  },

  async publishCourse(id, isPublished) {
    return api.put(`/courses/status/${id}`, { isPublished: !!isPublished });
  },

  async deleteCourse(id) {
    return api.delete(`/courses/${id}`);
  },

  async createSection(courseId, sectionInput) {
    const sectionId = sectionInput.sectionId || `sec_${Date.now()}`;
    const description = JSON.stringify({
      title: sectionInput.title,
      description: sectionInput.description,
      resources: Array.isArray(sectionInput.resources) ? sectionInput.resources : [],
      parentId: sectionInput.parentId || '',
    });

    return api.post(`/courses/section/${courseId}`, {
      sectionId,
      description,
      parentId: sectionInput.parentId || '',
    });
  },

  async updateSection(sectionId, sectionInput) {
    const description = JSON.stringify({
      title: sectionInput.title,
      description: sectionInput.description,
      resources: Array.isArray(sectionInput.resources) ? sectionInput.resources : [],
      parentId: sectionInput.parentId || '',
    });

    return api.put(`/courses/section/${sectionId}`, { description });
  },

  async deleteSection(sectionId) {
    return api.delete(`/courses/section/${sectionId}`);
  },

  async addSectionResource(sectionId, resourceInput) {
    return api.post(`/courses/section/${sectionId}/resources`, resourceInput);
  },

  async updateSectionResource(sectionId, resourceId, resourceInput) {
    return api.put(`/courses/section/${sectionId}/resources/${resourceId}`, resourceInput);
  },

  async deleteSectionResource(sectionId, resourceId) {
    return api.delete(`/courses/section/${sectionId}/resources/${resourceId}`);
  },

  async cloneCourse(id, data) {
    const currentUser = getCurrentUser();
    return api.post(`/courses/clone/${id}`, {
      newClassCode: data.code,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      fotoPath: data.coverImage,
      creatorId: currentUser.id || currentUser.username || null,
    });
  },

  getStudents: (id) => api.get(`/courses/students/${id}`)
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

    return api.post(`/courses/evaluation/${courseId}`, {
      evalId,
      name: assessmentInput.title,
      type: assessmentInput.type || 'exam',
      content
    });
  },

  async updateAssessment(courseId, evalId, assessmentInput) {
    const content = {
      startDate: assessmentInput.startDate || '',
      startTime: assessmentInput.startTime || '',
      endDate: assessmentInput.endDate || '',
      endTime: assessmentInput.endTime || '',
      questions: createQuestionsFromAssessment(assessmentInput, evalId)
    };

    return api.put(`/courses/evaluation/${courseId}/${evalId}`, {
      name: assessmentInput.title,
      type: assessmentInput.type || 'exam',
      content
    });
  },

  deleteAssessment: (courseId, evalId) => api.delete(`/courses/evaluation/${courseId}/${evalId}`),

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

    return api.post(`/courses/enroll/${courseId}`, { studentId, username });
  },
  async getMyCourses() {
    const currentUser = getCurrentUser();
    const id = currentUser.id || '';
    const username = currentUser.username || '';
    const response = await api.get('/courses/enrolled', {
      params: {
        ...(id ? { id } : {}),
        ...(username ? { username } : {}),
      }
    });
    const courses = Array.isArray(response.data?.courses) ? response.data.courses : [];
    return { data: { courses: courses.map((course) => mapBackendCourse(course, id || username)) } };
  },

  async getTeachingCourses() {
    const currentUser = getCurrentUser();
    const id = currentUser.id || currentUser.username;
    const response = await api.get(`/courses/mine?id=${id}`);
    const courses = Array.isArray(response.data?.classes) ? response.data.classes : [];
    return { data: { courses: courses.map((course) => mapBackendCourse(course, id)) } };
  }
};

export const messageService = {
  sendMessage: (toUserId, content) =>
    api.post('/messages/send/', { toUserId, content }),

  getInbox: () => {
    const userId = getCurrentUser().id;
    return api.get('/messages/inbox/', { params: { id: userId } });
  },

  getConversation: (otherUserId) => {
    const userId = getCurrentUser().id;
    return api.post('/messages/conversation/', { userId, otherUserId });
  }
};
