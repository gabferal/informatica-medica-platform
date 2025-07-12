const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Inicializando base de datos...');

// Crear tabla de usuarios
db.run(`CREATE TABLE IF NOT EXISTS users (
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
        console.log('✅ Tabla users creada/verificada');
    }
});

// Crear tabla de entregas - ESTRUCTURA CORRECTA
db.run(`CREATE TABLE IF NOT EXISTS submissions (
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
        console.log('✅ Tabla submissions creada/verificada');
    }
});

// Crear tabla de materiales
db.run(`CREATE TABLE IF NOT EXISTS materials (
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
        console.log('✅ Tabla materials creada/verificada');
    }
});

// Crear usuario admin por defecto
const adminEmail = 'ec.gabrielalvarez@gmail.com';
db.get("SELECT * FROM users WHERE email = ?", [adminEmail], (err, row) => {
    if (err) {
        console.error('❌ Error verificando admin:', err.message);
        return;
    }
    
    if (!row) {
        const hashedPassword = bcrypt.hashSync('Guepardo.25', 10);
        db.run(`INSERT INTO users (name, email, ra, password, role) VALUES (?, ?, ?, ?, ?)`,
            ['Gabriel Álvarez', adminEmail, 'ADMIN001', hashedPassword, 'admin'],
            (err) => {
                if (err) {
                    console.error('❌ Error creando admin:', err.message);
                } else {
                    console.log('✅ Usuario admin creado');
                }
            }
        );
    } else {
        console.log('✅ Usuario admin ya existe');
    }
});

console.log('🎯 Inicialización completada');

// Cerrar la base de datos después de un momento
setTimeout(() => {
    db.close();
}, 2000);
