/**
 * SCRIPT: Crear Usuario Admin
 * 
 * Usa fetch nativo de Node.js (v18+) - sin dependencias externas
 * 
 * USO:
 *    node create-admin.js
 * 
 * REQUISITOS DE CONTRASEÑA:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula, 1 minúscula, 1 número, 1 símbolo especial
 * - Ejemplo válido: Admin@1234
 * 
 * RESPUESTA EXITOSA:
 * {
 *   "success": true,
 *   "message": "Administrador creado exitosamente",
 *   "data": {
 *     "id": "user/123abc",
 *     "username": "admin",
 *     "email": "admin@example.com",
 *     "role": "admin",
 *     "name": "Administrador del Sistema"
 *   }
 * }
 */

async function createAdmin() {
  try {
    console.log(' Enviando solicitud para crear administrador...\n');
    
    const response = await fetch('http://localhost:3001/admin/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        email: 'admin@example.com',
        password: 'Admin@1234',
        fullName: 'Administrador del Sistema',
        dateOfBirth: '1990-01-01'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(' Admin creado exitosamente:\n');
      console.log(JSON.stringify(data.data, null, 2));
      console.log('\n Puedes iniciar sesión con:');
      console.log('   Username: admin');
      console.log('   Password: Admin@1234');
    } else {
      console.error(' Error al crear admin:\n');
      console.error('Respuesta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(' Error de conexión:', error.message);
    console.error('\n Asegúrate de que:');
    console.error('   1. El servidor esté corriendo (npm start)');
    console.error('   2. Esté en http://localhost:3001');
    console.error('   3. Todas las bases de datos estén disponibles');
  }
}

createAdmin();
