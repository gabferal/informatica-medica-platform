const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

console.log('🔧 Recreando base de datos completa...');
console.log('📍 Ubicación DB:', dbPath);

// Eliminar base de datos existente si existe
const fs = require('fs');
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️ Base de datos anterior eliminada');
}

const db = new sqlite3.Database(dbPath);

console.log('✅ Nueva base de datos creada');

// Crear tabla de usuarios
db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    ra TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) {
        console.error('❌ Error creando tabla users:', err.message);
    } else {
        console.log('✅ Tabla users creada');
    }
});

// Crear tabla de entregas con estructura correcta
db.run(`CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
)`, (err) => {
    if (err) {
        console.error('❌ Error creando tabla submissions:', err.message);
    } else {
        console.log('✅ Tabla submissions creada');
    }
});

// Crear tabla de materiales
db.run(`CREATE TABLE materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) {
        console.error('❌ Error creando tabla materials:', err.message);
    } else {
        console.log('✅ Tabla materials creada');
    }
});

// Crear usuario admin
setTimeout(() => {
    const adminEmail = 'ec.gabrielalvarez@gmail.com';
    const hashedPassword = bcrypt.hashSync('Guepardo.25', 10);
    
    db.run(`INSERT INTO users (name, email, ra, password, role) VALUES (?, ?, ?, ?, ?)`,
        ['Gabriel Álvarez', adminEmail, 'ADMIN001', hashedPassword, 'admin'],
        (err) => {
            if (err) {
                console.error('❌ Error creando admin:', err.message);
            } else {
                console.log('✅ Usuario admin creado');
            }
            
            // Verificar estructura final
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    console.error('❌ Error verificando tablas:', err);
                } else {
                    console.log('�� Tablas creadas:');
                    tables.forEach(table => {
                        console.log(`  - ${table.name}`);
                    });
                }
                
                // Verificar estructura de submissions
                db.all("PRAGMA table_info(submissions)", (err, columns) => {
                    if (err) {
                        console.error('❌ Error verificando columnas:', err);
                    } else {
                        console.log('📋 Columnas en submissions:');
                        columns.forEach(col => {
                            console.log(`  - ${col.name} (${col.type})`);
                        });
                    }
                    
                    console.log('🎉 ¡Base de datos recreada exitosamente!');
                    
                    // Cerrar base de datos
                    db.close((err) => {
                        if (err) {
                            console.error('❌ Error cerrando DB:', err);
                        } else {
                            console.log('✅ Base de datos cerrada');
                        }
                    });
                });
            });
        }
    );
}, 1000);
