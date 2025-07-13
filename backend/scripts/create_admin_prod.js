const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Buscar la base de datos principal
let dbPath;
if (require('fs').existsSync(path.join(__dirname, '../database.db'))) {
    dbPath = path.join(__dirname, '../database.db');
} else if (require('fs').existsSync(path.join(__dirname, '../../database.db'))) {
    dbPath = path.join(__dirname, '../../database.db');
} else {
    console.log('❌ No se encontró la base de datos');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

async function createAdmin() {
    console.log('👤 Creando usuario administrador...');
    
    // Datos del administrador (PERSONALIZAR ESTOS VALORES)
    const adminData = {
        name: 'Prof. Gabriel Alvarez',
        email: ‘ec.gabrielalvarez@gmail.com’,  // CAMBIAR EMAIL
        password: ‘Guepardo.25',  // CAMBIAR CONTRASEÑA
        role: 'admin',
        university: 'Unisud',
        career: 'Informática Médica',
        year: 'Profesor',
        semester: 'N/A'
    };
    
    try {
        // Verificar si ya existe un admin
        db.get(`SELECT * FROM users WHERE email = ?`, [adminData.email], async (err, row) => {
            if (row) {
                console.log('⚠️  Usuario administrador ya existe');
                console.log(`📧 Email: ${row.email}`);
                db.close();
                return;
            }
            
            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(adminData.password, 10);
            
            // Insertar administrador
            db.run(`
                INSERT INTO users (name, email, password, role, university, career, year, semester, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                adminData.name,
                adminData.email,
                hashedPassword,
                adminData.role,
                adminData.university,
                adminData.career,
                adminData.year,
                adminData.semester
            ], function(err) {
                if (err) {
                    console.error('❌ Error creando administrador:', err);
                } else {
                    console.log('✅ Administrador creado exitosamente');
                    console.log(`📧 Email: ${adminData.email}`);
                    console.log(`🔐 Contraseña: ${adminData.password}`);
                    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
                }
                db.close();
            });
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        db.close();
    }
}

createAdmin();
