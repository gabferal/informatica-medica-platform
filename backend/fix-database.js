const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Corrigiendo estructura de base de datos...');

// Verificar estructura actual
db.all("PRAGMA table_info(submissions)", (err, columns) => {
    if (err) {
        console.error('❌ Error verificando columnas:', err);
        return;
    }
    
    console.log('📋 Columnas actuales en submissions:');
    columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });
    
    const columnNames = columns.map(col => col.name);
    
    // Si tiene original_filename pero no original_name, necesitamos migrar
    if (columnNames.includes('original_filename') && !columnNames.includes('original_name')) {
        console.log('🔄 Migrando de original_filename a original_name...');
        
        db.serialize(() => {
            // Paso 1: Crear tabla nueva con estructura correcta
            db.run(`CREATE TABLE submissions_new (
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
                    console.error('❌ Error creando tabla nueva:', err);
                    return;
                }
                console.log('✅ Tabla nueva creada');
                
                // Paso 2: Copiar datos existentes
                db.run(`INSERT INTO submissions_new 
                        (id, user_id, title, description, filename, original_name, file_size, submitted_at)
                        SELECT id, user_id, title, description, filename, 
                               COALESCE(original_filename, filename) as original_name, 
                               file_size, submitted_at 
                        FROM submissions`, (err) => {
                    if (err) {
                        console.error('❌ Error copiando datos:', err);
                        return;
                    }
                    console.log('✅ Datos copiados');
                    
                    // Paso 3: Eliminar tabla vieja
                    db.run(`DROP TABLE submissions`, (err) => {
                        if (err) {
                            console.error('❌ Error eliminando tabla vieja:', err);
                            return;
                        }
                        console.log('✅ Tabla vieja eliminada');
                        
                        // Paso 4: Renombrar tabla nueva
                        db.run(`ALTER TABLE submissions_new RENAME TO submissions`, (err) => {
                            if (err) {
                                console.error('❌ Error renombrando tabla:', err);
                                return;
                            }
                            console.log('✅ Tabla renombrada exitosamente');
                            
                            // Verificar resultado final
                            db.all("PRAGMA table_info(submissions)", (err, newColumns) => {
                                if (err) {
                                    console.error('❌ Error verificando resultado:', err);
                                    return;
                                }
                                
                                console.log('🎯 Estructura final de submissions:');
                                newColumns.forEach(col => {
                                    console.log(`  - ${col.name} (${col.type})`);
                                });
                                
                                console.log('🎉 ¡Migración completada exitosamente!');
                                
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
                    });
                });
            });
        });
    } else if (columnNames.includes('original_name')) {
        console.log('✅ La columna original_name ya existe');
        db.close();
    } else {
        console.log('🔧 Agregando columna original_name...');
        db.run(`ALTER TABLE submissions ADD COLUMN original_name TEXT`, (err) => {
            if (err) {
                console.error('❌ Error agregando columna:', err);
            } else {
                console.log('✅ Columna original_name agregada');
            }
            db.close();
        });
    }
});
