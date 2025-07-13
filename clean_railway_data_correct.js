const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🧹 LIMPIANDO DATOS DE PRUEBA - ESTRUCTURA CORRECTA');
console.log('==================================================');

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

// Función para limpiar datos de prueba con estructura correcta
function cleanTestDataCorrect() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            
            console.log('🧹 Iniciando limpieza de datos de prueba...');
            
            // 1. Limpiar usuarios de prueba (manteniendo estructura: id, name, email, ra, password, role, created_at)
            console.log('👥 Limpiando usuarios de prueba...');
            db.run(`DELETE FROM users WHERE 
                email LIKE '%test%' OR 
                email LIKE '%demo%' OR 
                email LIKE '%prueba%' OR
                email LIKE '%exemplo%' OR
                email LIKE '%ejemplo%' OR
                name LIKE '%test%' OR
                name LIKE '%demo%' OR
                ra LIKE '%TEST%' OR
                ra LIKE '%DEMO%' OR
                email = 'fernandoteste@teste.com'`, function(err) {
                if (err) {
                    console.error('❌ Error eliminando usuarios de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} usuarios de prueba eliminados`);
                }
            });

            // 2. Limpiar entregas de prueba (estructura: id, user_id, title, description, filename, original_name, file_path, file_size, mime_type, submitted_at)
            console.log('📄 Limpiando entregas de prueba...');
            db.run(`DELETE FROM submissions WHERE 
                title LIKE '%test%' OR 
                title LIKE '%demo%' OR 
                title LIKE '%prueba%' OR
                description LIKE '%test%' OR
                filename LIKE '%test%' OR
                original_name LIKE '%test%' OR
                original_name LIKE '%demo%'`, function(err) {
                if (err) {
                    console.error('❌ Error eliminando entregas de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} entregas de prueba eliminadas`);
                }
            });

            // 3. Limpiar materiales de prueba (estructura: id, title, description, filename, file_path, uploaded_at)
            console.log('📚 Limpiando materiales de prueba...');
            db.run(`DELETE FROM materials WHERE 
                title LIKE '%test%' OR 
                title LIKE '%prueba%' OR
                title LIKE '%demo%' OR
                description LIKE '%test%' OR
                filename LIKE '%test%'`, function(err) {
                if (err) {
                    console.error('❌ Error eliminando materiales de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} materiales de prueba eliminados`);
                }
            });

            // 4. Eliminar entregas huérfanas (sin usuario válido)
            console.log('🔗 Limpiando entregas huérfanas...');
            db.run(`DELETE FROM submissions WHERE user_id NOT IN (SELECT id FROM users)`, function(err) {
                if (err) {
                    console.error('❌ Error eliminando entregas huérfanas:', err);
                } else {
                    console.log(`✅ ${this.changes} entregas huérfanas eliminadas`);
                }
            });

            console.log('🎉 Limpieza de datos de prueba completada');
            setTimeout(() => {
                resolve();
            }, 2000);
        });
    });
}

// Ejecutar limpieza
cleanTestDataCorrect().then(() => {
    // Mostrar estadísticas finales
    db.get('SELECT COUNT(*) as total FROM users', (err, users) => {
        if (!err) {
            console.log(`📊 Usuarios restantes: ${users.total}`);
        }
        
        db.get('SELECT COUNT(*) as total FROM submissions', (err, submissions) => {
            if (!err) {
                console.log(`📊 Entregas restantes: ${submissions.total}`);
            }
            
            db.get('SELECT COUNT(*) as total FROM materials', (err, materials) => {
                if (!err) {
                    console.log(`📊 Materiales restantes: ${materials.total}`);
                }
                
                db.close();
                console.log('✅ Base de datos limpia y lista para producción');
            });
        });
    });
}).catch(err => {
    console.error('❌ Error en limpieza:', err);
    db.close();
});
