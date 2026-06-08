import express, { json } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables BEFORE importing other modules
import crypto from "crypto";
import { promises as fs } from "fs";

//funcioines externas
import {
  CreateUser,
  RDBinitializeStore,
  searchUser,
  searchUserById,
  ValidateUser,
  getUser,
  updateUser,
  loadUser,
  getFriends,
  addFriend,
  removeFriend,
  sendFriendRequest,
  getPendingRequests,
  getSentRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  checkUsernameExists,
  checkEmailExists,
  getUserByEmail,
} from "./users.js";
import { validatePassword } from "./passwordValidation.js";
import { RedisinitializeStore } from "./redisStore.js";
import {
  connectToNeo4j,
  createClass,
  classCodeExists,
  addEvaluation,
  updateEvaluation,
  deleteEvaluation,
  addStudent,
  addSection,
  updateSection,
  deleteSection,
  deleteClass,
  updateClass,
  updateClassVisibility,
  cloneClass,
  getClassDetails,
  getEvaluations,
  getStudents,
  getSections,
  getAllClasses,
  sendSampleData,
  getEnrolledClasses,
  getCreatedClasses,
  submitEvaluation,
  getEvaluationResult,
  getEvaluationSubmissions,
  getCourseSubmissionsForUser

} from "./clases.js";
import {
  createAccessLog,
  initializeMongo,
  getDeviceInfo
} from "./accessLogs.js";
import { MailpitClientStarter, sendEmail } from "./mailpit.js";
import { get } from "http";
import { createMessage, getInboxMessages, getConversationMessages, clearAllMessages, markMessagesAsRead, getUnreadCount } from "./messages.js";
//constantes de cleintes de acceso de BD para reciclarlos segun se necesite
let store = null;
let RDclient = null;
let neo4jDriver = null;
let MPClient = null;

const PORT = process.env.PORT || 3000;
const app = express();
// Aumentar límite de tamaño de payload para soportar imágenes en base64
// Las imágenes de portada pueden ser bastante grandes (~500KB en base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// CONFIGURACIÓN: Decirle a Express que confíe en los proxies
// Esto hace que req.ip lea correctamente desde headers X-Forwarded-For
// En desarrollo: seguirá siendo ::1
// En producción: será la IP real del cliente
app.set('trust proxy', 1);
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Middleware de debugging para capturar headers en login/logout
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') {
    console.log(`[${req.method}] ${req.path}`);
    console.log('Headers recibidos:', {
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'all-headers': req.headers
    });
  }
  next();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

app.get("/", (req, res) => {
  // Send a JSON response with a json
  res.json({
    message: `Hello World! app is running in port: ${PORT}`,
    timestamp: new Date().toISOString(),
    methods: {
      users: [
        "POST /users/create",
        "GET /users/reset",
        "PUT /users/update/password?id=ID",
        "GET /users/",
        "GET /users",
        "GET /users/log?id=ID",
        "POST /users/role?id=ID",
        "GET /users/role?id=ID",
        "POST /users/friends/request?id=ID",
        "GET /users/friends?id=ID",
        "GET /users/friends/requests?id=ID",
        "POST /users/friends/accept?id=ID",
        "POST /users/friends/reject?id=ID",
        "GET /users/courses?id=ID",
        "GET /users/details?userId=ID",
      ],
      login: ["POST /login", "POST /logout"],
      courses: [
        "POST /courses/create",
        "POST /courses/section?classCode=CODE",
        "PUT /courses/section?classCode=CODE",
        "POST /courses/evaluation?classCode=CODE",
        "PUT /courses/status?id=ID",
        "POST /courses/students?classCode=CODE",
        "GET /courses/students?classCode=CODE",
        "GET /courses/mine",
        "POST /courses/clone?sourceClassCode=CODE",
        "GET /courses?classCode=CODE",
        "GET /courses",
        "POST /courses/enroll?classCode=CODE",
        "GET /courses/enrolled",
        "GET /courses/evaluations?classCode=CODE",
        "POST /courses/submit?id=ID",
        "GET /courses/grades?id=ID",
      ],
      messages: [
        "POST /messages/send?id=ID",
        "GET /messages/inbox?id=ID",
        "POST /messages/conversation?id=ID",
      ],
    },
  });
  // Send a plain text response

  //startupo fucntion to check if all db are up and setup correctlly
});

//------------------------------------------------------------------------------------------------------------------------------------------------
// usuarios
app.post("/users/create", async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const email = req.body.correo?.trim();
    const password = req.body.password;
    
    // Validar que username y email no estén vacíos
    if (!username || !email) {
      return res.status(400).json({ 
        success: false, 
        error: "El usuario y correo electrónico son requeridos" 
      });
    }

    // Validar política de contraseña (CRÍTICO)
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: "La contraseña no cumple con la política de seguridad. Requisitos: " + 
               passwordValidation.errors.join(", ")
      });
    }

    // Verificar si el username ya existe
    const usernameAlreadyExists = await checkUsernameExists(username, store);
    if (usernameAlreadyExists) {
      console.log('[/users/create] Username duplicado detectado');
      return res.status(409).json({ 
        success: false, 
        error: `El usuario "${username}" ya está registrado en el sistema` 
      });
    }

    // Verificar si el email ya existe
    const emailAlreadyExists = await checkEmailExists(email, store);
    if (emailAlreadyExists) {
      console.log('[/users/create] Email duplicado detectado');
      return res.status(409).json({ 
        success: false, 
        error: `El correo "${email}" ya está registrado en el sistema` 
      });
    }

    // Si no hay duplicados, crear el usuario
    const data = await CreateUser(req.body, store);
    if (!data) {
      return res.status(400).json({ success: false, error: "No se pudo crear el usuario" });
    }
    res.json({ message: "User created successfully", data: data });
  } catch (error) {
    console.error("Error creating user:", error.message);
    console.error("[/users/create] EXCEPTION:", error.message);
    console.error("[/users/create] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to create user. Please try again.",
      error: "Error interno al crear el usuario: " + error.message
    });
  }
});

//password reset
/* Se reemplazó esta parte para integrar la forma de recuperar contraseña del frontend
  app.post("/users/reset", async (req, res) => {
  let tmp = await getUser(req.body.username, store);
  if (!tmp) {
    return res.json({ success: false, message: "User not found" });
  }
  tmp = await loadUser(tmp.data.id, store);
  const tmppass = crypto
    .createHash("sha256")
    .update(req.body.username + new Date())
    .digest("hex")
    .slice(0, 8);

  tmp.data.password = tmppass
  await updateUser(tmp.data.id, tmp.data, store);

  const result = await loadUser(req.body.username, store);
  RDclient.del(tmp.data.id); // Invalidate any existing sessions for the user
  sendEmail(MPClient, null, null, "Contraseña Reestablecida", `Su contraseña ha sido reestablecida, su contraseña temporal es: ${tmppass}`)
  res.json({
    message: "Password reset successful, you temporal pass word is ",
    temporaryPassword: tmppass,
  });*/

app.post("/users/reset", async (req, res) => {
  const email = req.body.email?.trim();
  if (!email) {
    return res.status(400).json({ success: false, message: "Correo requerido." });
  }

  try {
    const user = await getUserByEmail(email, store);
    if (!user) {
      return res.status(404).json({ success: false, message: "No existe una cuenta registrada con ese correo." });
    }

    // Generar token criptográficamente seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const redisKey = `resetToken:${resetToken}`;
    const TTL = 5 * 60; // 5 minutos

    // Guardar en Redis: token → {userId, email}, con expiración de 1 hora
    await RDclient.set(redisKey, JSON.stringify({ userId: user.id, email: user.correo }), { EX: TTL });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    sendEmail(
      MPClient,
      user.correo,
      null,
      "Recuperación de contraseña - TecDigitalito",
      `Hola ${user.name || user.username},\n\nRecibimos una solicitud para restablecer tu contraseña.\n\nHaz clic en el siguiente enlace (válido por 5 minutos):\n\n${resetLink}\n\nSi no solicitaste esto, ignora este correo. Tu contraseña no será cambiada.`
    );

    res.json({ success: true, message: "Se ha enviado un enlace de recuperación a tu correo." });
  } catch (error) {
    console.error("Error in /users/reset:", error);
    res.status(500).json({ success: false, message: "Error al procesar la solicitud." });
  }
});

// Confirmar restablecimiento de contraseña con token de un solo uso
app.post("/users/reset/confirm", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: "Token y nueva contraseña son requeridos." });
  }

  // Validar política de contraseña
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: "La contraseña no cumple con la política de seguridad. Requisitos: " +
               passwordValidation.errors.join(", ")
    });
  }

  try {
    const redisKey = `resetToken:${token}`;
    const raw = await RDclient.get(redisKey);

    if (!raw) {
      return res.status(400).json({ success: false, message: "El enlace es inválido o ha expirado." });
    }

    const { userId, email } = JSON.parse(raw);

    // Actualizar la contraseña en RavenDB
    await updateUser(userId, { password: newPassword }, store);

    // Invalidar el token (uso único)
    await RDclient.del(redisKey);

    // Invalidar sesiones activas del usuario
    const sessionToken = crypto.createHash('sha256').update(userId).digest('hex');
    await RDclient.del(sessionToken);

    sendEmail(
      MPClient,
      email,
      null,
      "Contraseña restablecida - TecDigitalito",
      "Tu contraseña ha sido restablecida exitosamente. Si no realizaste este cambio, contacta al soporte."
    );

    res.json({ success: true, message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
  } catch (error) {
    console.error("Error in /users/reset/confirm:", error);
    res.status(500).json({ success: false, message: "Error al restablecer la contraseña." });
  }
});
//update password
/**
 * CAMBIO EN ENDPOINT: PUT /users/update/password
 * 
 * Validar que cumpla con la política de seguridad
 * 
 * Validaciones:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula
 * - Al menos 1 minúscula  
 * - Al menos 1 número
 * - Al menos 1 símbolo especial
 */
app.put("/users/update/password", async (req, res) => {
  try {
    const userId = req.query.id;
    const newPassword = req.body.newpassword;

    // Validación básica
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "User ID y nueva contraseña son requeridos"
      });
    }

    // Validar política de contraseña
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: "La contraseña no cumple con la política de seguridad. Requisitos: " +
               passwordValidation.errors.join(", ")
      });
    }

    // Actualizar contraseña
    await updateUser(userId, { password: newPassword }, store);

    // Enviar email de confirmación
    try {
      const user = await loadUser(userId, store);
      sendEmail(
        MPClient,
        user.data.correo,
        null,
        "Contraseña Actualizada - TecDigitalito",
        `Hola ${user.data.name},\n\nTu contraseña ha sido actualizada exitosamente. Si no realizaste este cambio, contacta al soporte.`
      );
    } catch (emailError) {
      console.error("Error enviando email de confirmación:", emailError.message);
      // No retornar error, la contraseña ya se actualizó
    }

    res.json({
      success: true,
      message: "Contraseña actualizada exitosamente"
    });
  } catch (error) {
    console.error("Error updating password:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al actualizar la contraseña: " + error.message
    });
  }
});

//DONE:
app.get("/users", async (req, res) => {
  if (req.body && req.body.type == "id") {
    const data = await searchUserById(req.body.id, store);
    res.json({ message: "User search completed", data: data });
  } else {
    const data = await searchUser(req.body, store);
    res.json({ message: "User search completed", data: data });
  }
});
//TODO:
app.get("/users/log", async (req, res) => {
  const uid = req.query.id;
  // Logic to get user login history
  try {
    const { AccessLog } = await import('./accessLogs.js');
    const logs = await AccessLog.find({ userId: uid }).sort({ createdAt: -1 });
    res.json({ message: `Login history for user ID: ${uid}`, logs });
  } catch (error) {
    console.error("Error fetching login history:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve login history.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  res.json({ message: `Login history for user ID: ${req.query.id}` });
});

/**
 * NUEVO ENDPOINT: GET /admin/logs
 * 
 * Propósito: Traer todos los registros de auditoría del sistema
 * Requiere: Usuario con rol "admin" y sesión válida
 * 
 * Parámetros query opcionales:
 * - page: número de página (default 1)
 * - limit: resultados por página (default 50)
 * - userId: filtrar por ID de usuario específico
 * - action: filtrar por acción (login/logout)
 * - successful: filtrar por estado (true/false)
 */
app.get("/admin/logs", async (req, res) => {
  try {
    // Validación de autenticación
    // Se extrae el token de la cookie o header
    // En código actual: no hay validación de admin
    const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No autenticado. Se requiere token de sesión."
      });
    }

    // Validar que sea admin en Redis
    // Busca la sesión del token en Redis para verificar que el usuario es admin
    let adminUser = null;
    try {
      const sessionData = await RDclient.get(token);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed.user && parsed.user.id) {
          // Cargar usuario de RavenDB para verificar su rol
          const userResult = await loadUser(parsed.user.id, store);
          if (userResult.data && userResult.data.typeofuser === "admin") {
            adminUser = userResult.data;
          }
        }
      }
    } catch (tokenError) {
      console.error("[/admin/logs] Error verificando admin:", tokenError.message);
    }

    if (!adminUser) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. Se requiere rol de administrador."
      });
    }

    // CAMBIO 3: Obtener parámetros de paginación y filtros
    // En código actual: no hay paginación, solo traía 1 usuario
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // CAMBIO 4: Construir query de filtros
    const query = {};
    if (req.query.userId) query.userId = req.query.userId;
    if (req.query.action) query.action = req.query.action; // "login" o "logout"
    if (req.query.successful !== undefined) query.successful = req.query.successful === 'true';

    // CAMBIO 5: Importar modelo de AccessLog
    const { AccessLog } = await import('./accessLogs.js');
    
    // CAMBIO 6: Ejecutar query con paginación
    const logs = await AccessLog
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();

    // CAMBIO 7: Contar total de registros para paginación
    const total = await AccessLog.countDocuments(query);

    // CAMBIO 8: Retornar respuesta paginada
    res.json({
      success: true,
      message: "Registros de auditoría del sistema",
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("[/admin/logs] Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error al obtener registros de auditoría",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * NUEVO ENDPOINT: POST /admin/create
 * 
 * Propósito: Crear un usuario con rol de administrador
 * 
 * SEGURIDAD IMPORTANTE:
 * - Si NO hay admins en el sistema: permite crear el primer admin SIN autenticación
 * - Si YA hay admins: requiere que usuario sea admin autenticado
 * 
 * Body requerido:
 * {
 *   "username": "admin",
 *   "email": "admin@example.com",
 *   "password": "Admin@1234",
 *   "fullName": "Administrador del Sistema",
 *   "dateOfBirth": "1990-01-01"
 * }
 * 
 * Cambios vs código anterior:
 * - NUEVO: Este endpoint no existía
 * - Implementa lógica de "primer admin"
 * - Valida política de contraseña
 * - Verifica existencia de admin previo
 * - Requiere autenticación si ya hay admin
 */
app.post("/admin/create", async (req, res) => {
  try {
    console.log("[/admin/create] Intento de crear usuario admin");

    // PASO 1: Verificar si ya existe algún admin en el sistema
    // Busca en RavenDB cualquier usuario con typeofuser === "admin"
    const session = store.openSession();
    const existingAdmin = await session.query({ collection: "user" })
      .search("typeofuser", "admin")
      .firstOrNull();
    
    // PASO 2: Si ya existe admin, validar autenticación
    // El nuevo admin solo puede ser creado por un admin ya existente
    if (existingAdmin) {
      console.log("[/admin/create] Ya existe admin en el sistema, requiere autenticación");
      
      // Obtener token del request
      const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Autenticación requerida. Solo un admin puede crear otro admin."
        });
      }

      // Validar que el usuario autenticado es admin
      try {
        const sessionData = await RDclient.get(token);
        if (!sessionData) {
          return res.status(401).json({
            success: false,
            error: "Sesión inválida o expirada."
          });
        }

        const parsed = JSON.parse(sessionData);
        if (!parsed.user || !parsed.user.id) {
          return res.status(403).json({
            success: false,
            error: "Acceso denegado. Se requiere ser administrador."
          });
        }

        // Cargar usuario de RavenDB para verificar que es admin
        const sessionForAuth = store.openSession();
        const authUser = await sessionForAuth.load(parsed.user.id);
        
        if (!authUser || authUser.typeofuser !== "admin") {
          return res.status(403).json({
            success: false,
            error: "Acceso denegado. Solo administradores pueden crear otros administradores."
          });
        }
      } catch (tokenError) {
        console.error("[/admin/create] Error validando token:", tokenError.message);
        return res.status(401).json({
          success: false,
          error: "Error al validar autenticación."
        });
      }
    } else {
      console.log("[/admin/create] No existe admin en el sistema - permitiendo crear primer admin");
    }

    // PASO 3: Validar datos requeridos
    const username = req.body.username?.trim();
    const email = req.body.correo?.trim() || req.body.email?.trim();
    const password = req.body.password;
    const fullName = req.body.fullName?.trim() || req.body.name?.trim();
    const dateOfBirth = req.body.dateOfBirth || req.body.dob;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Username, email y password son requeridos."
      });
    }

    // PASO 4: Validar política de contraseña
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: "La contraseña no cumple con la política de seguridad. Requisitos: " +
               passwordValidation.errors.join(", ")
      });
    }

    // PASO 5: Verificar que username no esté duplicado
    const usernameExists = await checkUsernameExists(username, store);
    if (usernameExists) {
      console.log("[/admin/create] Username duplicado:", username);
      return res.status(409).json({
        success: false,
        error: `El usuario "${username}" ya está registrado en el sistema`
      });
    }

    // PASO 6: Verificar que email no esté duplicado
    const emailExists = await checkEmailExists(email, store);
    if (emailExists) {
      console.log("[/admin/create] Email duplicado:", email);
      return res.status(409).json({
        success: false,
        error: `El correo "${email}" ya está registrado en el sistema`
      });
    }

    // PASO 7: Crear el usuario admin
    const userData = {
      username,
      password,
      correo: email,
      name: fullName || username,
      dob: dateOfBirth,
      typeofuser: "admin", // IMPORTANTE: Especificar role admin
      picPath: req.body.picPath || req.body.avatar || null
    };

    const newAdmin = await CreateUser(userData, store);
    if (!newAdmin) {
      return res.status(400).json({
        success: false,
        error: "No se pudo crear el usuario administrador"
      });
    }

    // PASO 8: Log de auditoría - crear admin
    console.log(`[/admin/create] Admin creado exitosamente: ${username} (${email})`);
    
    createAccessLog({
      ip: req.ip,
      userIdOrToken: newAdmin.id,
      action: 'admin_created',
      device: getDeviceInfo(req),
      successful: true
    });

    // PASO 9: Enviar email de confirmación al nuevo admin
    try {
      sendEmail(
        MPClient,
        email,
        null,
        "Cuenta de Administrador Creada - TecDigitalito",
        `¡Hola ${fullName || username}!\n\nTu cuenta de administrador ha sido creada exitosamente en TecDigitalito.\n\nUsername: ${username}\nEmail: ${email}\n\nPuedes acceder al panel de administración en: /admin/logs\n\n¡Bienvenido al equipo de administración!`
      );
    } catch (emailError) {
      console.error("[/admin/create] Error enviando email:", emailError.message);
      // No retornar error, el admin ya fue creado
    }

    res.status(201).json({
      success: true,
      message: "Administrador creado exitosamente",
      data: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.correo,
        role: newAdmin.typeofuser,
        name: newAdmin.name
      }
    });

  } catch (error) {
    console.error("[/admin/create] ❌ Error:", error.message);
    console.error("[/admin/create] Stack:", error.stack);
    res.status(500).json({
      success: false,
      error: "Error interno al crear el administrador: " + error.message
    });
  }
});

//TEST:
app.post("/users/role", (req, res) => {
  // Logic to assign a role to a user
  updateUser(req.query.id, { password: req.body.newrole }, store)
  res.json({ message: `Role assigned to user ID: ${req.query.id}` });
});
//TEST:
app.get("/users/role", async (req, res) => {
  // Logic to get the role of a user
  const tmp = await loadUser(req.query.id, store);
  res.json({ message: `Role for user ID: ${req.query.id}`, role: tmp.data?.typeofuser });
});
//TODO:
app.post("/users/friends/request", async (req, res) => {
  // Tuve que cambiarlo un poco para que funcione con el frontend, pero la lógica es la misma, 
  // solo que ahora acepta tanto query params como body params para mayor flexibilidad
  const userId = req.body.userId || req.query.id;
  const friendId = req.body.friendId || req.body.id;

  if (!userId || !friendId) {
    return res.status(400).json({ message: "Missing userId or friendId" });
  }

  const result = await sendFriendRequest(userId, friendId, store);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }

  res.json({ message: result.message });
});

app.get("/users/friends", async (req, res) => {
  const id = req.query.id || req.body.id;
  const result = await getFriends(id, store);
  if (!result.success) {
    return res.status(404).json({ message: result.message });
  }
  res.json({ message: `Friends list for user ID: ${id}`, friends: result.friends });
});

app.get("/users/friends/requests", async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({ message: "Missing user id" });
  }
  const result = await getPendingRequests(id, store);
  if (!result.success) {
    return res.status(404).json({ message: result.message });
  }
  res.json({ message: `Pending requests for user ID: ${id}`, requests: result.requests });
});

app.get("/users/friends/sent", async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({ message: "Missing user id" });
  }
  const result = await getSentRequests(id, store);
  if (!result.success) {
    return res.status(404).json({ message: result.message });
  }
  res.json({ message: `Sent requests for user ID: ${id}`, requests: result.requests });
});

app.post("/users/friends/accept", async (req, res) => {
  const userId = req.body.userId || req.query.id;
  const fromUserId = req.body.fromUserId || req.body.friendId;
  if (!userId || !fromUserId) {
    return res.status(400).json({ message: "Missing userId or fromUserId" });
  }
  const result = await acceptFriendRequest(userId, fromUserId, store);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  res.json({ message: result.message });
});

app.post("/users/friends/reject", async (req, res) => {
  const userId = req.body.userId || req.query.id;
  const fromUserId = req.body.fromUserId || req.body.friendId;
  if (!userId || !fromUserId) {
    return res.status(400).json({ message: "Missing userId or fromUserId" });
  }
  const result = await rejectFriendRequest(userId, fromUserId, store);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  res.json({ message: result.message });
});

app.delete("/users/friends", async (req, res) => {
  const userId = req.body.userId || req.query.id;
  const friendId = req.body.friendId || req.query.friendId;
  if (!userId || !friendId) {
    return res.status(400).json({ message: "Missing userId or friendId" });
  }
  const result = await removeFriend(userId, friendId, store);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  res.json({ message: result.message });
});

app.get("/users/courses", async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({
      message: "Missing studentId. Use /users/courses?id=USER_ID",
    });
  }

  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST:
app.get("/users/courses", async (req, res) => {
  const id = req.query.id;
  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST: upgrade: add course data and firends
app.get("/users/details", async (req, res) => {
  const id = req.query.userId;
  const tmp = await loadUser(id, store);
  const tmpClss = await getEnrolledClasses(neo4jDriver, id);
  // Logic to get user details
  res.json({ message: `User details for user ID: ${id}`, data: tmp.data, clases: tmpClss });
});

// NOTA: Se usa /users/update?id=<id> en lugar de /users/:id porque los IDs de RavenDB
// tienen formato "users/000-A" (contienen una barra). Express interpreta la barra como
// un separador de segmentos de ruta, por lo que /:id nunca hace match con esos valores.
// Pasar el ID como query string evita este problema ya que req.query.id lo decodifica sin
// romper el enrutamiento.
app.put("/users/update", async (req, res) => {
  // --- Validación de sesión ---
  // El token se recibe por Authorization Bearer (frontend) o por cookie (withCredentials).
  // Se consulta en Redis para verificar que la sesión esté activa.
  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const token = req.cookies?.accessToken || bearerToken;

  let tokenUserId = null;
  if (token && RDclient) {
    try {
      const raw = await RDclient.get(token);
      if (raw) {
        const parsed = JSON.parse(raw);
        tokenUserId = parsed?.user?.id || parsed?.uid || null;
      }
    } catch { /* Redis error — se trata como no autenticado */ }
  }

  if (!tokenUserId) {
    return res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' });
  }

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta el parámetro id.' });

  // --- Autorización: solo puede editar su propio perfil ---
  if (tokenUserId !== id) {
    return res.status(403).json({ error: 'No tienes permiso para modificar este perfil.' });
  }

  const { username, fullName, dateOfBirth, avatar, email, role } = req.body;

  // Verificar que el nuevo username no esté ya en uso por otro usuario
  if (username) {
    const current = await loadUser(id, store);
    const currentUsername = current?.data?.username || '';
    if (username.toLowerCase() !== currentUsername.toLowerCase()) {
      const taken = await checkUsernameExists(username, store);
      if (taken) {
        return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
      }
    }
  }

  const data = {
    username,
    name: fullName,
    dob: dateOfBirth,
    picPath: avatar,
    correo: email,
    typeofuser: role
  };
  const result = await updateUser(id, data, store);
  if (!result.success) {
    return res.status(404).json({ error: result.message });
  }
  res.json({ user: result.data });
});

//login logout
//DONE:     // TEST: test access logging feature
// cambio de get a post para que el frontend pueda enviar el token por body
app.post("/login", async (req, res) => {
  try {
    let msg = null;
    const userDevice = getDeviceInfo(req);

    if (req.body.token) {
      //validate token on redis here
      try {
        const token = await RDclient.get(req.body.token);
        if (token && JSON.parse(token).login) {
          await RDclient.expire(req.body.token, 60 * 60); // Refresh token expiration 1 hr
          msg = { success: true, message: `Token valid, welcome back!` };
        }
      } catch (redisError) {
        console.error("Redis error during token validation:", redisError);
        return res.status(500).json({
          success: false,
          message: "Session validation error. Please try again."
        });
      }
    } else {
      //no hay token, validar credenciales

      const token = crypto
        .createHash("sha256")
        .update(req.body.username)
        .digest("hex");

      //validar que no haya lockout
      try {
        let tocheck = await RDclient.get(token);
        if (tocheck) {
          tocheck = JSON.parse(tocheck);
          if (tocheck.lockout) {
            return res.json({
              success: false,
              message: "Account locked due to too many failed login attempts",
            });
          }
        }
      } catch (redisError) {
        console.error("Redis error checking lockout:", redisError);
        return res.status(500).json({
          success: false,
          message: "Authentication service error. Please try again."
        });
      }

      //no hay lockout, validar login
      msg = await ValidateUser(req.body, store);

      //malas creds
      if (msg.success === false && msg.user && msg.uid) {
        //usuario existe pero password es incorrecto si no exixte pues no hacemos nada
        //increment failed login attempts on redis here and check if it reaches the lockout threshold
        try {
          const value = await RDclient.get(token);
          if (value != null) {
            const data = JSON.parse(value);
            data.attempts += 1;
            if (data.attempts >= 5) { //lockout
              await RDclient.set(
                token,
                JSON.stringify({
                  lastLogin: new Date(),
                  attempts: data.attempts,
                  lockout: true,
                  login: false,
                }),
                { EX: 60 * 60 },
              ); // Lock account for 1 hour
              createAccessLog({
                ip: req.ip,
                userIdOrToken: msg.user.id,
                action: 'login',
                device: userDevice,
                successful: false
              })
              sendEmail(MPClient, null, null, "Bloqueo de cuenta", "su cuenta se ha bloqueado por 1 hora")
              return res.json({
                success: false,
                message: "Account locked due to too many failed login attempts",
              });
            }
            await RDclient.set(
              token,
              JSON.stringify({
                lastLogin: new Date(),
                attempts: data.attempts,
                lockout: false,
                login: false,
              }),
              { EX: 60 * 60 },
            ); // Update failed attempts with expiration of 1 hour
            sendEmail(MPClient, null, null, "Intento de inicio de sesion fallido", "Ha habido un intento fallido de inicio de sesion a su cuenta")
            createAccessLog({
              ip: req.ip,
              userIdOrToken: msg.user.id,
              action: 'login',
              device: userDevice,
              successful: false
            })
            return res.json({
              success: false,
              message: "Invalid username or password",
            });
          } else {
            // Este es el PRIMER intento fallido
            // Inicializar contador en Redis y registrar el intento en MongoDB
            await RDclient.set(
              token,
              JSON.stringify({
                lastLogin: new Date(),
                attempts: 1, // Primer intento fallido
                lockout: false,
                login: false,
              }),
              { EX: 60 * 60 },
            );
            
            // Registrar el primer intento fallido en MongoDB
            sendEmail(MPClient, null, null, "Intento de inicio de sesion fallido", "Ha habido un intento fallido de inicio de sesion a su cuenta")
            createAccessLog({
              ip: req.ip,
              userIdOrToken: msg.user.id,
              action: 'login',
              device: userDevice,
              successful: false
            })
            
            return res.json({
              success: false,
              message: "Invalid username or password",
            });
          }
        } catch (redisError) {
          console.error("Redis error during failed login tracking:", redisError);
          return res.status(500).json({
            success: false,
            message: "Authentication service error. Please try again."
          });
        }
      }
      //creds validas
      else if (msg.success === true) {
        try {
          const sessionTTL = req.body.rememberMe ? 14 * 24 * 60 * 60 : 60 * 60;
          
          // Guardar IP y Device en la sesión
          // Esto permite recuperar estos valores exactos en logout
          // sin depender de que el cliente los reenvíe
          await RDclient.set(
            token,
            JSON.stringify({
              lastLogin: new Date(),
              attempts: 0,
              lockout: false,
              token: token,
              user: { id: msg.user.id },
              ip: req.ip, // IP real (considerando proxies)
              device: userDevice, // Device/navegador capturado
              login: true,
            }),
            // Si el usuario marcó "Recordarme", la sesión dura 14 días; si no, 1 hora.
            { EX: sessionTTL },
          ); // Set token with expiration
          msg.token = token;

          // Establecer cookie httpOnly con el token de sesión.
          // httpOnly: no accesible desde JavaScript (protege contra XSS).
          // secure: solo se envía por HTTPS (en producción).
          // sameSite: Strict para proteger contra CSRF.
          res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: sessionTTL * 1000
          });

          createAccessLog({
            ip: req.ip,
            userIdOrToken: msg.user.id,
            device: userDevice,
            action: 'login',
            successful: true
          })

        } catch (redisError) {
          console.error("Redis error during successful login:", redisError);
          return res.status(500).json({
            success: false,
            message: "Session creation error. Please try again."
          });
        }
      }
    }
    res.json(msg);
  } catch (error) {
    console.error("Unexpected error in /login:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
});

//DONE:
// cambio de get a post para que el frontend pueda enviar el token por
// body o cookie
app.post("/logout", async (req, res) => {
  try {
    // El token puede venir como cookie httpOnly (flujo normal) o en el body (compatibilidad).
    const token = req.cookies?.accessToken || req.body?.token;
    
    if (token) {
      try {
        // Recupera datos de la sesión ANTES de borrarla
        // Esto asegura que usemos exactamente los mismos valores de IP y Device del login
        let userId = null;
        let sessionIp = req.ip; // Fallback a IP actual
        let sessionDevice = getDeviceInfo(req); // Fallback a device actual
        
        try {
          const sessionData = await RDclient.get(token);
          if (sessionData) {
            const parsed = JSON.parse(sessionData);
            userId = parsed?.user?.id || null;
            // Usar IP y Device guardados en login, si existen
            sessionIp = parsed?.ip || sessionIp;
            sessionDevice = parsed?.device || sessionDevice;
          }
        } catch (parseError) {
          console.error("Error parsing session data:", parseError.message);
        }

        // Ahora sí borrar la sesión
        await RDclient.del(token);

        // Eliminar la cookie de sesión del navegador.
        res.clearCookie('accessToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict'
        });

        // Usar IP y Device de la sesión guardada
        createAccessLog({
          ip: sessionIp,
          userIdOrToken: userId || token,
          device: sessionDevice,
          action: 'logout',
          successful: true
        })

        res.json({ success: true, message: "Logout successful" });
      } catch (redisError) {
        console.error("Redis error during logout:", redisError);

        // En caso de error, intentar recuperar lo máximo posible
        let userId = null;
        let sessionIp = req.ip;
        let sessionDevice = getDeviceInfo(req);
        
        try {
          const sessionData = await RDclient.get(token);
          if (sessionData) {
            const parsed = JSON.parse(sessionData);
            userId = parsed?.user?.id || null;
            sessionIp = parsed?.ip || sessionIp;
            sessionDevice = parsed?.device || sessionDevice;
          }
        } catch (e) {
          // Silent fail
        }

        createAccessLog({
          ip: sessionIp,
          userIdOrToken: userId || token,
          device: sessionDevice,
          action: 'logout',
          successful: false
        })

        return res.status(500).json({
          success: false,
          message: "Logout error. Please try again."
        });
      }
    } else {
      res.json({ success: false, message: "No token provided" });
    }
  } catch (error) {
    console.error("Unexpected error in /logout:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed. Please try again."
    });
  }
});

// cursos
//DONE, si crea:
app.post("/courses/create", async (req, res) => {
  try {
    const classData = req.body.class;
    if (!classData?.classCode) {
      return res.status(400).json({ message: "Missing class data or classCode" });
    }

    const created = await createClass(neo4jDriver, classData, req.body.id);
    if (!created || !created.classCode) {
      return res.status(400).json({ success: false, message: "Course creation failed - invalid response" });
    }

    // Conexión CreateCourse: Obtener los detalles completos del curso recién creado
    // con evaluaciones, secciones y estudiantes para que CourseEditor lo reciba completo.
    // Sin esto, CourseEditor intenta cargar con GET /courses?classCode=X y podría fallar si Neo4j tarda.
    // Agregamos un pequeño delay para permitir que la transacción se replique.
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const fullDetails = await getClassDetails(neo4jDriver, created.classCode);
    const courseData = fullDetails || { 
      class: created, 
      evaluations: [], 
      students: [], 
      sections: [] 
    };

    res.json({ message: "Course created successfully", course: courseData });
  } catch (error) {
    console.error("Error creating course:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create course. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
//DONE:
app.post("/courses/section", async (req, res) => {
  const parentId = req.query.id;
  const { sectionId, description, isClassParent = true } = req.body;

  if (!sectionId || !description) {
    return res.status(400).json({ message: "Missing sectionId or description" });
  }

  const result = await addSection(neo4jDriver, parentId, sectionId, description, isClassParent);

  if (result == null)
    res.json({ message: "Section added successfully", sectionId, parentId, isClassParent });
  res.json({ message: "Couldnt add section", error: result })
});
//DONE:
app.put("/courses/section", async (req, res) => {
  const sectionId = req.query.classCode;
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ message: "Missing section description" });
  }

  await updateSection(neo4jDriver, sectionId, description);
  res.json({ message: "Section updated successfully", sectionId });
});

// Conexión SectionEditor: Endpoint para eliminar secciones.
// DELETE /courses/section?sectionId=ID elimina una sección completamente.
// Usa deleteSection() que ejecuta DETACH DELETE en Neo4j para remover el nodo y sus relaciones.
app.delete("/courses/section", async (req, res) => {
  const sectionId = req.query.sectionId;

  if (!sectionId) {
    return res.status(400).json({ message: "Missing sectionId" });
  }

  await deleteSection(neo4jDriver, sectionId);
  res.json({ message: "Section deleted successfully", sectionId });
});

// Conexión DeleteCourse: Endpoint para eliminar un curso completamente.
// DELETE /courses?classCode=CODE elimina el curso, todas sus secciones, evaluaciones y relaciones con estudiantes.
// Usa deleteClass() que ejecuta DETACH DELETE en Neo4j para remover el nodo Course y sus relaciones.
app.delete("/courses", async (req, res) => {
  const classCode = req.query.classCode;

  if (!classCode) {
    return res.status(400).json({ message: "Missing classCode. Use /courses?classCode=CODE" });
  }

  await deleteClass(neo4jDriver, classCode);
  res.json({ message: "Course deleted successfully", classCode });
});

//DONE:
app.post("/courses/evaluation", async (req, res) => {
  const classCode = req.query.classCode;
  const { evalId, name, type, content } = req.body;

  if (!evalId || !name || !type || content == null) {
    return res.status(400).json({ message: "Missing evaluation fields (evalId, name, type, content)" });
  }

  const normalizedContent = typeof content === "string" ? content : JSON.stringify(content);
  await addEvaluation(neo4jDriver, classCode, evalId, name, type, normalizedContent);
  res.json({ message: "Evaluation added successfully", classCode, evalId });
});

// Conexión AssessmentEditor: Endpoint para actualizar evaluaciones existentes.
// PUT /courses/evaluation?evalId=ID requiere evalId, name, type, content en el body.
// Usa updateEvaluation() que modifica el nodo Evaluation en Neo4j.
app.put("/courses/evaluation", async (req, res) => {
  const evalId = req.query.evalId;
  const { name, type, content } = req.body;

  if (!evalId || !name || !type || content == null) {
    return res.status(400).json({ message: "Missing evaluation fields (evalId, name, type, content)" });
  }

  const normalizedContent = typeof content === "string" ? content : JSON.stringify(content);
  await updateEvaluation(neo4jDriver, evalId, name, type, normalizedContent);
  res.json({ message: "Evaluation updated successfully", evalId });
});

// Conexión AssessmentEditor: Endpoint para eliminar evaluaciones.
// DELETE /courses/evaluation?evalId=ID elimina la evaluación completamente de Neo4j.
// Usa deleteEvaluation() que ejecuta DETACH DELETE en Neo4j para remover el nodo y sus relaciones.
// Llamado por handleDelete() en AssessmentEditor.jsx
app.delete("/courses/evaluation", async (req, res) => {
  const evalId = req.query.evalId;

  if (!evalId) {
    return res.status(400).json({ message: "Missing evalId. Use /courses/evaluation?evalId=ID" });
  }

  try {
    await deleteEvaluation(neo4jDriver, evalId);
    res.json({ message: "Evaluation deleted successfully", evalId });
  } catch (error) {
    console.error("Error deleting evaluation:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete evaluation",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Conexión CourseEditor: Endpoint para actualizar metadatos del curso
// PUT /courses?classCode=CODE actualiza nombre, descripción, fechas e imagen en Neo4j
// Body: {name, description, startDate, endDate, fotoPath}
// Llamado por handleSaveCourse() en CourseEditor.jsx
app.put("/courses", async (req, res) => {
  const classCode = req.query.classCode;
  
  if (!classCode) {
    return res.status(400).json({ message: "Missing classCode. Use /courses?classCode=CODE" });
  }

  const { name, description, startDate, endDate, fotoPath } = req.body;

  try {
    await updateClass(neo4jDriver, classCode, {
      name,
      description,
      startDate,
      endDate,
      fotoPath
    });

    res.json({
      message: "Course updated successfully",
      classCode
    });
  } catch (error) {
    console.error("Error updating course:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

//DONE:
app.put("/courses/status", async (req, res) => {
  // Conexión CourseEditor: Endpoint para actualizar estado de publicación del curso
  // PUT /courses/status?id=CLASSCODE actualiza isPublished en Neo4j
  // Llamado por publishCourse() en CourseEditor.jsx
  const classCode = req.query.id;
  const { isPublished } = req.body;

  if (!classCode || isPublished === undefined) {
    return res.status(400).json({ message: "Missing classCode or isPublished" });
  }

  try {
    await updateClassVisibility(neo4jDriver, classCode, !!isPublished);
    res.json({
      message: `Course status updated successfully`,
      classCode,
      isPublished: !!isPublished
    });
  } catch (error) {
    console.error("Error updating course status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update course status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
//DONE:
app.post("/courses/students", async (req, res) => {
  const classCode = req.query.classCode;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Missing studentId" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student added successfully", classCode, studentId });
});
//DONE:
app.get("/courses/students", async (req, res) => {
  const classCode = req.query.classCode;
  const students = await getStudents(neo4jDriver, classCode);
  res.json({ message: `Students enrolled in course ${classCode}`, students });
});
//DONE:
app.get("/courses/mine", async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({
      message: "Missing user ID. Use /courses/mine?id=USER_ID",
    });
  }

  console.log('[/courses/mine] Searching for courses with creatorId:', id);
  const classes = await getCreatedClasses(neo4jDriver, id);
  console.log('[/courses/mine] Found', classes.length, 'courses');
  res.json({
    message: `Courses created by user ${id}`,
    classes,
  });
});

// Conexión CreateCourse: Endpoint para validar disponibilidad de códigos
// GET /courses/check-code?code=CLASSSCODE
// Devuelve {exists: true/false} para validación en tiempo real en el formulario
app.get("/courses/check-code", async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.status(400).json({ message: "Missing code parameter. Use /courses/check-code?code=CLASSCODE" });
  }

  try {
    const exists = await classCodeExists(neo4jDriver, code);
    res.json({ exists });
  } catch (error) {
    console.error("Error checking course code:", error.message);
    res.status(500).json({ success: false, message: "Error checking course code" });
  }
});

//DONE:
app.post("/courses/clone", async (req, res) => {
  try {
    const sourceClassCode = req.query.sourceClassCode;
    const newClassCode = req.body.newClassCode;
    const creatorId = req.body.creatorId || req.body.id || null;

    console.log('[CloneCourse] Request received - sourceCode:', sourceClassCode, 'newCode:', newClassCode, 'creatorId:', creatorId);

    if (!sourceClassCode) {
      return res.status(400).json({ message: "Missing sourceClassCode. Use /courses/clone?sourceClassCode=CODE" });
    }

    if (!newClassCode) {
      return res.status(400).json({ message: "Missing newClassCode in request body" });
    }

    // Conexión CloneCourse: Validar que el nuevo código no esté duplicado
    const codeExists = await classCodeExists(neo4jDriver, newClassCode);
    if (codeExists) {
      return res.status(409).json({
        success: false,
        message: `El código "${newClassCode}" ya está en uso. Por favor, usa otro.`
      });
    }

    // Conexión CloneCourse: Pasar metadatos al backend para crear el curso clonado
    // Metadatos del nuevo curso: código, nombre, fechas inicio/fin
    // Mantiene: descripción, imagen (del original)
    const newData = {
      name: req.body.name || '',
      description: req.body.description || '',
      startDate: req.body.startDate || '',
      endDate: req.body.endDate || null,
      fotoPath: req.body.fotoPath || '',
      creatorUsername: req.body.creatorUsername || ''
    };

    // Conexión CloneCourse: Crea el nuevo curso clonando secciones y materiales
    console.log('[CloneCourse] Calling cloneClass with creatorId:', creatorId);
    const cloned = await cloneClass(neo4jDriver, sourceClassCode, newClassCode, newData, creatorId);
    if (!cloned) {
      return res.status(404).json({ message: `Source course not found: ${sourceClassCode}` });
    }

    // Conexión CloneCourse: Esperar y reintentar hasta que el curso esté completamente disponible
    // Problema: Neo4j necesita tiempo para replicar completamente los datos (especialmente las secciones)
    // Solución: Hacer retries con delay creciente hasta que getClassDetails() retorne datos válidos
    let fullDetails = null;
    let retries = 0;
    const maxRetries = 10;
    const initialDelay = 100;
    
    while (!fullDetails && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, initialDelay * (retries + 1)));
      fullDetails = await getClassDetails(neo4jDriver, newClassCode);
      retries++;
      console.log(`[CloneCourse] Retry ${retries}/${maxRetries} - fullDetails available:`, !!fullDetails);
    }

    if (!fullDetails) {
      // Fallback: retornar estructura básica si los detalles no están listos
      fullDetails = {
        class: cloned,
        evaluations: [],
        students: [],
        sections: []
      };
    }

    console.log('[CloneCourse] Clone completed successfully - classCode:', newClassCode);
    res.json({ message: "Course cloned successfully", course: fullDetails });
  } catch (error) {
    console.error("Error cloning course:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to clone course. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
//DONE:
// Conexión StudentCourseView: Obtener detalles de un curso específico o listado de todos
app.get("/courses", async (req, res) => {
  const classCode = req.query.classCode;
  if (classCode) {
    const details = await getClassDetails(neo4jDriver, classCode);
    if (!details) {
      return res.status(404).json({ message: `Class not found: ${classCode}` });
    }
    return res.json({ message: `Class details for ${classCode}`, details });
  }
  const classes = await getAllClasses(neo4jDriver);
  res.json({ message: "All available courses", classes });
});
//DONE:
// Conexión CourseDetail: Matricular un estudiante en un curso
app.post("/courses/enroll", async (req, res) => {
  const classCode = req.query.classCode;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Missing studentId" });
  }

  if (!classCode) {
    return res.status(400).json({ message: "Missing classCode. Use /courses/enroll?classCode=CODE" });
  }

  try {
    await addStudent(neo4jDriver, classCode, studentId);
    res.json({ message: "Student enrolled successfully", classCode, studentId });
  } catch (err) {
    res.status(500).json({ message: `Could not enroll student: ${err.message}` });
  }
});
//DONE:
// Conexión CourseDetail: Obtener cursos en los que está matriculado un estudiante
app.get("/courses/enrolled", async (req, res) => {
  const studentId = req.query.id || req.body.id;
  if (!studentId) {
    return res.status(400).json({ message: "Missing student ID. Use /courses/enrolled?id=STUDENT_ID" });
  }

  const courses = await getEnrolledClasses(neo4jDriver, studentId);
  res.json({ message: `Courses enrolled by student ${studentId}`, courses });
});
//DONE:
app.get("/courses/evaluations", async (req, res) => {
  const classCode = req.query.classCode;
  const evaluations = await getEvaluations(neo4jDriver, classCode);
  res.json({ message: `Evaluations for course ${classCode}`, evaluations });
});
app.post("/courses/submit", async (req, res) => {
  const classCode = req.query.classCode || req.query.id;
  const evalId = req.query.evalId || req.body.evalId;

  if (!evalId) {
    return res.status(400).json({ success: false, message: "Missing evalId" });
  }

  const submission = {
    userId: req.body.userId,
    username: req.body.username,
    courseId: req.body.courseId || classCode,
    evalId: req.body.evalId || evalId,
    assessmentTitle: req.body.assessmentTitle,
    score: req.body.score,
    correctAnswers: req.body.correctAnswers,
    totalQuestions: req.body.totalQuestions,
    questionResults: req.body.questionResults,
    submittedAt: req.body.submittedAt || new Date().toISOString()
  };

  if (!submission.userId) {
    return res.status(400).json({ success: false, message: "Missing userId" });
  }

  try {
    await submitEvaluation(neo4jDriver, submission);
    res.json({ success: true, message: "Evaluation submitted successfully", result: submission });
  } catch (error) {
    console.error("Error submitting evaluation:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit evaluation",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get("/courses/grades", async (req, res) => {
  const evalId = req.query.evalId || req.query.id;
  const userId = req.query.userId;
  const classCode = req.query.classCode;

  try {
    // Caso 1: resultado individual → evalId + userId
    if (evalId && userId) {
      const result = await getEvaluationResult(neo4jDriver, evalId, userId);
      return res.json({ success: true, result });
    }

    // Caso 2: todos los intentos de una evaluación → evalId solo
    if (evalId && !userId) {
      const results = await getEvaluationSubmissions(neo4jDriver, evalId);
      return res.json({ success: true, results });
    }

    // Caso 3: todos los resultados de un usuario en un curso → classCode + userId
    if (classCode && userId) {
      const results = await getCourseSubmissionsForUser(neo4jDriver, classCode, userId);
      return res.json({ success: true, results });
    }

    return res.status(400).json({ success: false, message: "Provide evalId, classCode, and/or userId" });
  } catch (error) {
    console.error("Error fetching grades:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch grades",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

//messages
//TODO:
app.post("/messages/send", async (req, res) => {
  // Logic to send a message
  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const token = req.cookies?.accessToken || req.body?.token || bearerToken;
  let senderIdFromToken = null;
  if (token && RDclient) {
    try {
      const raw = await RDclient.get(token);
      if (raw) {
        const parsedToken = JSON.parse(raw);
        senderIdFromToken = parsedToken?.user?.id || parsedToken?.uid || null;
      }
    } catch {/* does nothing */};
  }

  // Usar fromUserId del body como prioridad (es lo que el frontend está controlando)
  // El token podría estar desactualizado/sobreescrito entre tabs
  // Esto fue un intento para arreglar problemas de token en el frontend 
  // Pero básicamente es que si abre dos tabs van a compartir la misma cookie y
  // eso no le gusta al sistema de mensajes.
  const fromUserId = req.body.fromUserId || senderIdFromToken || req.query.id;
  const toUserId = req.body.toUserId || req.body.recipientId;
  const content = req.body.content;

  const hasValidFromUserId = typeof fromUserId === "string" && fromUserId.trim().length > 0;
  const hasValidToUserId = typeof toUserId === "string" && toUserId.trim().length > 0;
  const hasValidContent = typeof content === "string" && content.trim().length > 0;

  if (!hasValidFromUserId || !hasValidToUserId || !hasValidContent) {
    return res.status(400).json({ success: false, message: "Wrong format. Missing fromUserId, toUserId or content" })
  }

  try {
    const msg = await createMessage({
      fromUserId: fromUserId.trim(),
      toUserId: toUserId.trim(),
      content: content.trim(),
    });
    return res.json({success: true, message: "Message sent successfully", data: msg });
  } catch (err) {
    console.error("messages/send error:", err);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
  
});
//TODO:
app.get("/messages/inbox", async (req, res) => {
  // Logic to get inbox messages for a user
  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const token = req.cookies?.accessToken || req.body?.token || bearerToken;

  let userIdFromToken = null;
  if (token && RDclient) {
    try {
      const raw = await RDclient.get(token);
      if (raw) {
        const parsedToken = JSON.parse(raw);
        userIdFromToken = parsedToken?.user?.id || parsedToken?.uid || null;
      }
    } catch {/* does nothing */};
  }

  const userId = userIdFromToken || req.query.id || req.body?.userId;
  const hasValidUserId = typeof userId === "string" && userId.trim().length > 0;

  if (!hasValidUserId) {
    return res.status(400).json({ success: false, message: "Wrong format. Missing userId" });
  }

  try {
    const messages = await getInboxMessages(userId.trim());
    return res.json({
      success: true,
      message: `Inbox messages for user ID: ${userId.trim()}`,
      data: messages,
    });
  } catch (err) {
    console.error("messages/inbox error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch inbox messages" });
  }
});
//TODO:
app.post("/messages/conversation", async (req, res) => {
  // Logic to get conversation messages between two users
  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const token = req.cookies?.accessToken || req.body?.token || bearerToken;

  let userIdFromToken = null;
  if (token && RDclient) {
    try {
      const raw = await RDclient.get(token);
      if (raw) {
        const parsedToken = JSON.parse(raw);
        userIdFromToken = parsedToken?.user?.id || parsedToken?.uid || null;
      }
    } catch {/* does nothing */};
  }

  const userId = userIdFromToken || req.query.id || req.body?.userId;
  const otherUserId = req.body?.otherUserId || req.body?.toUserId || req.query?.otherUserId;

  const hasValidUserId = typeof userId === "string" && userId.trim().length > 0;
  const hasValidOtherUserId = typeof otherUserId === "string" && otherUserId.trim().length > 0;

  if (!hasValidUserId || !hasValidOtherUserId) {
    return res.status(400).json({ success: false, message: "Wrong format. Missing userId or otherUserId" });
  }

  try {
    const conversation = await getConversationMessages(userId.trim(), otherUserId.trim());
    return res.json({
      success: true,
      message: `Conversation messages for user ID: ${userId.trim()}`,
      data: conversation,
    });
  } catch (err) {
    console.error("messages/conversation error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch conversation messages" });
  }
});

app.post("/messages/clear-all", async (req, res) => {
  try {
    const result = await clearAllMessages();
    return res.json({
      success: true,
      message: "All messages cleared successfully",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("messages/clear-all error:", err);
    return res.status(500).json({ success: false, message: "Failed to clear messages" });
  }
});

app.post("/messages/mark-as-read", async (req, res) => {
  const { userId, otherUserId } = req.body;
  
  if (!userId || !otherUserId) {
    return res.status(400).json({ success: false, message: "Missing userId or otherUserId" });
  }

  try {
    const result = await markMessagesAsRead(userId, otherUserId);
    return res.json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("messages/mark-as-read error:", err);
    return res.status(500).json({ success: false, message: "Failed to mark messages as read" });
  }
});

app.post("/messages/unread-count", async (req, res) => {
  const { userId, otherUserId } = req.body;
  
  if (!userId || !otherUserId) {
    return res.status(400).json({ success: false, message: "Missing userId or otherUserId" });
  }

  try {
    const count = await getUnreadCount(userId, otherUserId);
    return res.json({
      success: true,
      unreadCount: count
    });
  } catch (err) {
    console.error("messages/unread-count error:", err);
    return res.status(500).json({ success: false, message: "Failed to get unread count" });
  }
});

app.post("/test", async (req, res) => {
  console.log("started test")

  sendEmail(MPClient, null, null, "TEST", "esto es una prueba")
  res.json({
    message: `Test Complete`,
  });

});

app.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  // Initialize RavenDB
  try {
    store = await RDBinitializeStore(
      process.env.RAVENDB_URL || "http://localhost:8080",
      process.env.RAVENDB_DB || "test",
    );
    console.log("RavenDB store initialized successfully");
  } catch (error) {
    console.error("Failed to initialize RavenDB:", error.message);
  }

  // Initialize Redis
  try {
    RDclient = await RedisinitializeStore(
      process.env.REDIS_URL || "http://localhost:6379",
      process.env.REDIS_DB || "0",
    );
    console.log("Redis client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Redis:", error.message);
  }

  // Initialize Neo4j
  try {
    neo4jDriver = connectToNeo4j(
      process.env.NEO4J_URL || "bolt://localhost:7687",
      process.env.NEO4J_USER || "neo4j",
      process.env.NEO4J_PASSWORD || "password"
    );
    console.log("Neo4j driver initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Neo4j:", error.message);
  }

  // Initialize MongoDB
  try {
    await initializeMongo();

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to initialize MongoDB:", error.message);
  }

  try {
    MPClient = MailpitClientStarter(process.env.MAILPIT_URL || "http://localhost:8025")
  }
  catch (error) {
    console.error()
  }

  console.log("\nAll database connections initialized successfully!");
  console.log("Server is ready to accept requests.\n");

  //await sendSampleData(neo4jDriver);
});
