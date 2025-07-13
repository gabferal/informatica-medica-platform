const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

console.log('🔧 Iniciando migración de base de datos...');
console.log('📍 Ubicación DB:', dbPath);

const db = new sqlite3.Database(dbPath);

// Función para verificar si una columna existe
function columnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                reject(err);
            } else {
                const exists = columns.some(col => col.name === columnName);
                resolve(exists);
            }
        });
    });
}

// Función para agregar columna si no existe
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    return new Promise(async (resolve, reject) => {
        try {
            const exists = await columnExists(tableName, columnName);
            
            if (!exists) {
                console.log(`➕ Agregando columna ${columnName} a tabla ${tableName}`);
                db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
                    if (err) {
                        console.error(`❌ Error agregando columna ${columnName}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Columna ${columnName} agregada exitosamente`);
                        resolve();
                    }
                });
            } else {
                console.log(`✅ Columna ${columnName} ya existe en tabla ${tableName}`);
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Función para actualizar datos faltantes
function updateMissingData() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Actualizando datos faltantes...');
        
        // Actualizar original_name donde sea NULL usando filename
        db.run(`
            UPDATE submissions 
            SET original_name = filename 
            WHERE original_name IS NULL OR original_name = ''
        `, function(err) {
            if (err) {
                console.error('❌ Error actualizando original_name:', err.message);
                reject(err);
            } else {
                console.log(`✅ Actualizadas ${this.changes} filas con original_name`);
                
                // Actualizar file_path donde sea NULL
                db.run(`
                    UPDATE submissions 
                    SET file_path = 'uploads/submissions/' || filename 
                    WHERE file_path IS NULL OR file_path = ''
                `, function(err) {
                    if (err) {
                        console.error('❌ Error actualizando file_path:', err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Actualizadas ${this.changes} filas con file_path`);
                        resolve();
                    }
                });
            }
        });
    });
}

// Ejecutar migración
async function runMigration() {
    try {
        console.log('📋 Verificando estructura actual de submissions...');
        
        // Verificar columnas existentes
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns);
            });
        });
        
        console.log('📋 Columnas actuales en submissions:');
        columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
        
        // Agregar columnas faltantes
        await addColumnIfNotExists('submissions', 'original_name', 'TEXT');
        await addColumnIfNotExists('submissions', 'file_path', 'TEXT');
        await addColumnIfNotExists('submissions', 'file_size', 'INTEGER');
        await addColumnIfNotExists('submissions', 'mime_type', 'TEXT');
        
        // Actualizar datos faltantes
        await updateMissingData();
        
        // Verificar estructura final
        console.log('\n📋 Verificando estructura final...');
        const finalColumns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns);
            });
        });
        
        console.log('📋 Columnas finales en submissions:');
        finalColumns.forEach(col => {
            console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
        
        console.log('\n🎉 ¡Migración completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ Error cerrando DB:', err);
            } else {
                console.log('✅ Base de datos cerrada');
            }
        });
    }
}

// Ejecutar migración
runMigration();