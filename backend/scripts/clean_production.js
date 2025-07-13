const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Buscar la base de datos principal
let dbPath;
if (require('fs').existsSync(path.join(__dirname, '../database.db'))) {
    dbPath = path.join(__dirname, '../database.db');
} else if (require('fs').existsSync(path.join(__dirname, '../../database.db'))) {
    dbPath = path.join(__dirname, '../../database.db');
} else {
    console.log('❌ No se encontró la base de datos');
    process.exit(1);
}

console.log('🗄️  Usando base de datos:', dbPath);
const db = new sqlite3.Database(dbPath);

console.log('🧹 Limpiando datos de prueba...');

// Eliminar usuarios de prueba
db.run(`DELETE FROM users WHERE 
    email LIKE '%test%' OR 
    email LIKE '%demo%' OR 
    email LIKE '%prueba%' OR
    email LIKE '%ejemplo%' OR
    name LIKE '%test%'`, function(err) {
    if (err) {
        console.error('Error eliminando usuarios de prueba:', err);
    } else {
        console.log(`✅ ${this.changes} usuarios de prueba eliminados`);
    }
});

// Eliminar entregas de prueba
db.run(`DELETE FROM submissions WHERE 
    student_email LIKE '%test%' OR 
    student_email LIKE '%demo%' OR
    student_name LIKE '%test%'`, function(err) {
    if (err) {
        console.error('Error eliminando entregas de prueba:', err);
    } else {
        console.log(`✅ ${this.changes} entregas de prueba eliminadas`);
    }
});

// Eliminar materiales de prueba
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

console.log('🎉 Limpieza completada');
db.close();
