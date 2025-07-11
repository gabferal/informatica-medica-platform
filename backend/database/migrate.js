const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

async function migrateDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);

        console.log('🔄 Iniciando migración de base de datos...');

        db.serialize(async () => {
            // Verificar si la columna 'role' ya existe
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) {
                    console.error('Error obteniendo info de tabla:', err);
                    db.close();
                    reject(err);
                    return;
                }

                const hasRoleColumn = columns.some(col => col.name === 'role');

                if (!hasRoleColumn) {
                    console.log('➕ Agregando columna "role" a la tabla users...');
                    
                    // Agregar columna role
                    db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'", (err) => {
                        if (err) {
                            console.error('❌ Error agregando columna role:', err);
                            db.close();
                            reject(err);
                            return;
                        }

                        console.log('✅ Columna "role" agregada exitosamente');
                        createAdmin(db, resolve, reject);
                    });
                } else {
                    console.log('✅ Columna "role" ya existe');
                    createAdmin(db, resolve, reject);
                }
            });
        });
    });
}

async function createAdmin(db, resolve, reject) {
    // Verificar si ya existe el administrador
    db.get('SELECT * FROM users WHERE email = ?', ['ec.gabrielalvarez@gmail.com'], async (err, user) => {
        if (err) {
            console.error('Error verificando admin:', err);
            db.close();
            reject(err);
            return;
        }

        if (!user) {
            // Crear administrador
            try {
                console.log('👨‍💼 Creando administrador...');
                const hashedPassword = await bcrypt.hash('Guepardo.25', 12);
                
                db.run(
                    'INSERT INTO users (email, password, ra, nombre, role) VALUES (?, ?, ?, ?, ?)',
                    ['ec.gabrielalvarez@gmail.com', hashedPassword, 'ADMIN001', 'Gabriel Alvarez', 'admin'],
                    function(err) {
                        if (err) {
                            console.error('❌ Error creando administrador:', err);
                            db.close();
                            reject(err);
                        } else {
                            console.log('✅ Administrador creado exitosamente');
                            console.log('📧 Email: ec.gabrielalvarez@gmail.com');
                            console.log('🔑 Password: Guepardo.25');
                            console.log('🎭 Rol: admin');
                            console.log('🆔 ID:', this.lastID);
                            
                            db.close();
                            resolve();
                        }
                    }
                );
            } catch (hashError) {
                console.error('Error hasheando contraseña:', hashError);
                db.close();
                reject(hashError);
            }
        } else {
            // Usuario existe, verificar/actualizar rol
            if (user.role !== 'admin') {
                console.log('🔄 Actualizando rol de usuario existente a admin...');
                db.run(
                    'UPDATE users SET role = ?, nombre = ? WHERE email = ?',
                    ['admin', 'Gabriel Alvarez', 'ec.gabrielalvarez@gmail.com'],
                    (err) => {
                        if (err) {
                            console.error('❌ Error actualizando rol:', err);
                            db.close();
                            reject(err);
                        } else {
                            console.log('✅ Rol de administrador actualizado');
                            console.log('�� Email: ec.gabrielalvarez@gmail.com');
                            console.log('🔑 Password: Guepardo.25');
                            console.log('🎭 Rol: admin');
                            
                            db.close();
                            resolve();
                        }
                    }
                );
            } else {
                console.log('✅ Administrador ya existe con rol correcto');
                console.log('📧 Email: ec.gabrielalvarez@gmail.com');
                console.log('🔑 Password: Guepardo.25');
                console.log('🎭 Rol: admin');
                
                db.close();
                resolve();
            }
        }
    });
}

module.exports = migrateDatabase;

// Ejecutar si se llama directamente
if (require.main === module) {
    migrateDatabase()
        .then(() => {
            console.log('🎉 Migración completada exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error en migración:', error);
            process.exit(1);
        });
}