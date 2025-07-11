const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Configuración para Railway
const isProduction = process.env.NODE_ENV === 'production';
const dbDir = path.join(__dirname);
const dbPath = path.join(dbDir, 'database.db');

// Asegurar que el directorio existe
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
    // Crear base de datos
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error('❌ Error conectando a la base de datos:', err.message);
            // Intentar con base de datos en memoria como fallback
            db = new sqlite3.Database(':memory:', (memErr) => {
                if (memErr) {
                    console.error('❌ Error con base de datos en memoria:', memErr.message);
                } else {
                    console.log('⚠️ Usando base de datos en memoria (temporal)');
                    initializeTables();
                }
            });
        } else {
            console.log('✅ Conectado a la base de datos SQLite');
            initializeTables();
        }
    });
} catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    // Fallback a memoria
    db = new sqlite3.Database(':memory:');
    initializeTables();
}

function initializeTables() {
    console.log('🔄 Inicializando tablas...');
    
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

    // Crear tabla de entregas
    db.run(`CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Error creando tabla submissions:', err.message);
        } else {
            console.log('✅ Tabla submissions creada/verificada');
        }
    });

    // Crear usuario admin por defecto
    setTimeout(() => {
        const adminPassword = bcrypt.hashSync('Guepardo.25', 12);
        
        db.run(`INSERT OR IGNORE INTO users (name, email, ra, password, role) 
                VALUES (?, ?, ?, ?, ?)`, 
                ['Gabriel Álvarez', 'ec.gabrielalvarez@gmail.com', 'ADMIN001', adminPassword, 'admin'],
                (err) => {
                    if (err) {
                        console.error('❌ Error creando admin:', err.message);
                    } else {
                        console.log('✅ Usuario admin verificado/creado');
                    }
                });
    }, 1000);
}

// Manejo de errores de la base de datos
if (db) {
    db.on('error', (err) => {
        console.error('❌ Error de base de datos:', err);
    });
}

module.exports = db;
