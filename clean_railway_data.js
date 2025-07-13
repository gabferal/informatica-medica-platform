const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🧹 LIMPIANDO DATOS DE PRUEBA EN RAILWAY');
console.log('======================================');

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
    console.log('📁 Archivos disponibles:');
    require('fs').readdirSync('.').forEach(file => console.log(`   - ${file}`));
    process.exit(1);
}

console.log(`🗄️  Usando base de datos: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

// Función para limpiar datos de prueba
function cleanTestData() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Eliminar usuarios de prueba
            db.run(`DELETE FROM users WHERE 
                email LIKE '%test%' OR 
                email LIKE '%demo%' OR 
                email LIKE '%prueba%' OR
                email LIKE '%ejemplo%' OR
                name LIKE '%test%' OR
                name LIKE '%demo%'`, function(err) {
                if (err) {
                    console.error('Error eliminando usuarios de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} usuarios de prueba eliminados`);
                }
            });

            // 2. Eliminar entregas de prueba
            db.run(`DELETE FROM submissions WHERE 
                student_email LIKE '%test%' OR 
                student_email LIKE '%demo%' OR
                student_name LIKE '%test%' OR
                assignment_title LIKE '%test%'`, function(err) {
                if (err) {
                    console.error('Error eliminando entregas de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} entregas de prueba eliminadas`);
                }
            });

            // 3. Eliminar materiales de prueba
            db.run(`DELETE FROM materials WHERE 
                title LIKE '%test%' OR 
                title LIKE '%prueba%' OR
                description LIKE '%test%'`, function(err) {
                if (err) {
                    console.error('Error eliminando materiales de prueba:', err);
                } else {
                    console.log(`✅ ${this.changes} materiales de prueba eliminados`);
                }
            });

            // 4. Limpiar avisos de prueba (si existe la tabla)
            db.run(`DELETE FROM announcements WHERE 
                title LIKE '%test%' OR 
                content LIKE '%test%'`, function(err) {
                if (err && !err.message.includes('no such table')) {
                    console.error('Error eliminando avisos de prueba:', err);
                } else if (!err.message?.includes('no such table')) {
                    console.log(`✅ ${this.changes} avisos de prueba eliminados`);
                }
            });

            console.log('🎉 Limpieza de datos de prueba completada');
            resolve();
        });
    });
}

// Ejecutar limpieza
cleanTestData().then(() => {
    db.close();
    console.log('✅ Base de datos limpia y lista para producción');
}).catch(err => {
    console.error('❌ Error en limpieza:', err);
    db.close();
});
