const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/app/data/database.sqlite'
    : path.join(__dirname, '..', 'data', 'database.sqlite');

console.log('🔧 Iniciando migración completa de la base de datos...');
console.log('📍 Ruta de BD:', dbPath);

const db = new sqlite3.Database(dbPath);

// ✅ MIGRACIÓN COMPLETA: Todas las columnas necesarias
const migrations = [
    {
        name: 'add_file_size_column',
        sql: `ALTER TABLE submissions ADD COLUMN file_size INTEGER DEFAULT 0`,
        check: `PRAGMA table_info(submissions)`
    },
    {
        name: 'add_mime_type_column', 
        sql: `ALTER TABLE submissions ADD COLUMN mime_type TEXT DEFAULT 'application/octet-stream'`,
        check: `PRAGMA table_info(submissions)`
    },
    {
        name: 'add_file_path_column',
        sql: `ALTER TABLE submissions ADD COLUMN file_path TEXT`,
        check: `PRAGMA table_info(submissions)`
    },
    {
        name: 'add_original_filename_column',
        sql: `ALTER TABLE submissions ADD COLUMN original_filename TEXT`,
        check: `PRAGMA table_info(submissions)`
    }
];

async function runMigration() {
    try {
        console.log('📋 Verificando estructura actual de la tabla...');
        
        // Obtener columnas actuales
        const currentColumns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(submissions)`, (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        console.log('✅ Columnas actuales:', currentColumns);
        
        // Ejecutar migraciones necesarias
        const results = [];
        
        for (const migration of migrations) {
            const columnName = migration.name.replace('add_', '').replace('_column', '');
            
            if (!currentColumns.includes(columnName) && !currentColumns.includes(columnName.replace('_', ''))) {
                console.log(`➕ Ejecutando migración: ${migration.name}`);
                
                try {
                    await new Promise((resolve, reject) => {
                        db.run(migration.sql, (err) => {
                            if (err) {
                                console.error(`❌ Error en ${migration.name}:`, err.message);
                                reject(err);
                            } else {
                                console.log(`✅ ${migration.name} completada`);
                                resolve();
                            }
                        });
                    });
                    
                    results.push({ migration: migration.name, status: 'success' });
                } catch (error) {
                    results.push({ migration: migration.name, status: 'error', error: error.message });
                }
            } else {
                console.log(`⏭️ Saltando ${migration.name} - columna ya existe`);
                results.push({ migration: migration.name, status: 'skipped' });
            }
        }
        
        // ✅ ACTUALIZAR DATOS EXISTENTES
        console.log('🔄 Actualizando registros existentes...');
        
        // Actualizar mime_type basado en filename
        const mimeTypeUpdate = await new Promise((resolve, reject) => {
            db.run(`
                UPDATE submissions 
                SET mime_type = CASE 
                    WHEN filename LIKE '%.pdf' THEN 'application/pdf'
                    WHEN filename LIKE '%.doc' THEN 'application/msword'
                    WHEN filename LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    WHEN filename LIKE '%.txt' THEN 'text/plain'
                    WHEN filename LIKE '%.zip' THEN 'application/zip'
                    WHEN filename LIKE '%.png' THEN 'image/png'
                    WHEN filename LIKE '%.jpg' OR filename LIKE '%.jpeg' THEN 'image/jpeg'
                    ELSE 'application/octet-stream'
                END
                WHERE mime_type IS NULL OR mime_type = '' OR mime_type = 'application/octet-stream'
            `, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        
        // Actualizar original_filename si está vacío
        const filenameUpdate = await new Promise((resolve, reject) => {
            db.run(`
                UPDATE submissions 
                SET original_filename = filename
                WHERE original_filename IS NULL OR original_filename = ''
            `, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        
        // Actualizar file_path con ruta por defecto
        const pathUpdate = await new Promise((resolve, reject) => {
            db.run(`
                UPDATE submissions 
                SET file_path = 'uploads/' || filename
                WHERE file_path IS NULL OR file_path = ''
            `, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        
        // Verificar estructura final
        const finalColumns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(submissions)`, (err, columns) => {
                if (err) reject(err);
                else resolve(columns);
            });
        });
        
        console.log('🎉 Migración completada exitosamente!');
        console.log('📊 Resultados:', {
            migrations: results,
            updates: {
                mimeTypes: mimeTypeUpdate.changes,
                filenames: filenameUpdate.changes,
                paths: pathUpdate.changes
            },
            finalColumns: finalColumns.map(col => `${col.name} (${col.type})`)
        });
        
        return {
            success: true,
            migrations: results,
            updates: {
                mimeTypes: mimeTypeUpdate.changes,
                filenames: filenameUpdate.changes,
                paths: pathUpdate.changes
            },
            finalColumns: finalColumns.map(col => `${col.name} (${col.type})`)
        };
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        throw error;
    } finally {
        db.close();
        console.log('🔒 Conexión a BD cerrada');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runMigration()
        .then(result => {
            console.log('✅ Migración exitosa:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error en migración:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };