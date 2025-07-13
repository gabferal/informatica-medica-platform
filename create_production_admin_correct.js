const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs'); // Usando bcryptjs como en tu código
const path = require('path');

console.log('👤 CREANDO ADMINISTRADOR DE PRODUCCIÓN - ESTRUCTURA CORRECTA');
console.log('============================================================');

// Buscar la base de datos
let dbPath;
const possiblePaths = [
    './backend/database.db',
    './database.db',
    './backend/database.sqlite',
    './database.sqlite'
];

for (const testPath of possiblePaths) {
    if (require('fs').existsSync(testPath)) {
        dbPath = testPath;
        break;
    }
}

if (!dbPath) {
    console.log('❌ No se encontró la base de datos');
    process.exit(1);
}

console.log(`🗄️  Usando base de datos: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

function createProductionAdminCorrect() {
    // Datos del administrador de PRODUCCIÓN (estructura: name, email, ra, password, role)
    const adminData = {
        name: 'Prof. Gabriel Álvarez',
        email: 'gabriel.alvarez@informaticamedica.edu',
        ra: 'PROF001',  // Registro Académico único
        password: 'InfoMedica2024!Prod',  // CAMBIAR DESPUÉS DEL PRIMER LOGIN
        role: 'admin'
    };

    console.log('🔍 Verificando si ya existe un administrador...');
    
    // Verificar si ya existe un admin
    db.get('SELECT * FROM users WHERE email = ? OR role = "admin" OR ra = ?', 
           [adminData.email, adminData.ra], (err, row) => {
        if (err) {
            console.error('❌ Error verificando usuarios existentes:', err);
            db.close();
            return;
        }
        
        if (row) {
            console.log('⚠️  Usuario administrador ya existe:');
            console.log(`   👤 Nombre: ${row.name}`);
            console.log(`   📧 Email: ${row.email}`);
            console.log(`   🎓 RA: ${row.ra}`);
            console.log(`   🔑 Rol: ${row.role}`);
            console.log('');
            console.log('💡 Si necesitas cambiar la contraseña, hazlo desde el panel admin');
            console.log('🔗 Panel admin: https://web-production-0af6.up.railway.app/admin-panel.html');
            
            // Mostrar credenciales actuales si es el admin esperado
            if (row.email === 'ec.gabrielalvarez@gmail.com') {
                console.log('');
                console.log('📋 CREDENCIALES ACTUALES:');
                console.log(`   📧 Email: ${row.email}`);
                console.log(`   �� Contraseña: Guepardo.25`);
            }
            
            db.close();
            return;
        }

        console.log('👤 Creando nuevo administrador...');
        
        try {
            // Hash de la contraseña usando bcryptjs
            const hashedPassword = bcrypt.hashSync(adminData.password, 10);
            
            // Insertar administrador con estructura correcta
            db.run(`INSERT INTO users (name, email, ra, password, role, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))`, [
                adminData.name,
                adminData.email,
                adminData.ra,
                hashedPassword,
                adminData.role
            ], function(err) {
                if (err) {
                    console.error('❌ Error creando administrador:', err);
                } else {
                    console.log('✅ Administrador de producción creado exitosamente');
                    console.log('');
                    console.log('📋 CREDENCIALES DE ACCESO:');
                    console.log('========================');
                    console.log(`👤 Nombre: ${adminData.name}`);
                    console.log(`📧 Email: ${adminData.email}`);
                    console.log(`🎓 RA: ${adminData.ra}`);
                    console.log(`🔐 Contraseña: ${adminData.password}`);
                    console.log(`🔑 Rol: ${adminData.role}`);
                    console.log('');
                    console.log('�� URLS DE ACCESO:');
                    console.log('   🏠 Sitio: https://web-production-0af6.up.railway.app/');
                    console.log('   👤 Login: https://web-production-0af6.up.railway.app/login.html');
                    console.log('   ⚙️  Admin: https://web-production-0af6.up.railway.app/admin-panel.html');
                    console.log('');
                    console.log('⚠️  IMPORTANTE:');
                    console.log('   - Cambia la contraseña después del primer login');
                    console.log('   - Guarda estas credenciales en un lugar seguro');
                    console.log('   - El RA (Registro Académico) debe ser único');
                }
                db.close();
            });
        } catch (hashError) {
            console.error('❌ Error generando hash de contraseña:', hashError);
            db.close();
        }
    });
}

createProductionAdminCorrect();
