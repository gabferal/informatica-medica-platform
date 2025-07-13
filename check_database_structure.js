const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 VERIFICANDO ESTRUCTURA DE BASE DE DATOS');
console.log('==========================================');

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

// Verificar tablas existentes
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error obteniendo tablas:', err);
        return;
    }
    
    console.log('\n📋 TABLAS EXISTENTES:');
    tables.forEach(table => {
        console.log(`   - ${table.name}`);
    });
    
    // Verificar estructura de cada tabla importante
    const importantTables = ['users', 'submissions', 'materials'];
    let completed = 0;
    
    importantTables.forEach(tableName => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                console.log(`❌ Tabla ${tableName} no existe o error: ${err.message}`);
            } else if (columns.length > 0) {
                console.log(`\n📊 ESTRUCTURA DE ${tableName.toUpperCase()}:`);
                columns.forEach(col => {
                    console.log(`   - ${col.name} (${col.type}) ${col.pk ? '[PRIMARY KEY]' : ''} ${col.notnull ? '[NOT NULL]' : ''}`);
                });
            } else {
                console.log(`⚠️  Tabla ${tableName} existe pero está vacía`);
            }
            
            completed++;
            if (completed === importantTables.length) {
                // Verificar datos existentes
                checkExistingData();
            }
        });
    });
});

function checkExistingData() {
    console.log('\n📊 DATOS EXISTENTES:');
    
    // Contar usuarios
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        if (!err) {
            console.log(`   👥 Usuarios: ${result.count}`);
            
            // Mostrar usuarios existentes
            db.all('SELECT id, name, email, role FROM users LIMIT 5', (err, users) => {
                if (!err && users.length > 0) {
                    console.log('   📝 Usuarios registrados:');
                    users.forEach(user => {
                        console.log(`      - ${user.name} (${user.email}) [${user.role}]`);
                    });
                }
            });
        }
    });
    
    // Contar entregas
    db.get('SELECT COUNT(*) as count FROM submissions', (err, result) => {
        if (!err) {
            console.log(`   �� Entregas: ${result.count}`);
        } else {
            console.log(`   ❌ Error contando entregas: ${err.message}`);
        }
    });
    
    // Contar materiales
    db.get('SELECT COUNT(*) as count FROM materials', (err, result) => {
        if (!err) {
            console.log(`   �� Materiales: ${result.count}`);
        } else {
            console.log(`   ❌ Error contando materiales: ${err.message}`);
        }
        
        // Cerrar base de datos al final
        setTimeout(() => {
            db.close();
            console.log('\n✅ Verificación completada');
        }, 1000);
    });
}
