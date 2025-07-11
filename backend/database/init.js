const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);

        db.serialize(() => {
            // Crear tabla de usuarios con campo role
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    ra TEXT,
                    nombre TEXT,
                    role TEXT DEFAULT 'student',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creando tabla users:', err);
                } else {
                    console.log('✅ Tabla users verificada');
                }
            });

            // Crear tabla de entregas
            db.run(`
                CREATE TABLE IF NOT EXISTS submissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creando tabla submissions:', err);
                } else {
                    console.log('✅ Tabla submissions verificada');
                }
            });

            // Crear tabla de materiales
            db.run(`
                CREATE TABLE IF NOT EXISTS materials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    file_path TEXT,
                    category TEXT,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creando tabla materials:', err);
                } else {
                    console.log('✅ Tabla materials verificada');
                    db.close();
                    resolve();
                }
            });
        });
    });
}

module.exports = initDatabase;

// Ejecutar si se llama directamente
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('🎉 Base de datos inicializada correctamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error inicializando base de datos:', error);
            process.exit(1);
        });
}