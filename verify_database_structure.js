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
        console.error('❌ Error obteniendo tablas:', err);
        return;
    }
    
    console.log('\n📋 TABLAS EXISTENTES:');
    tables.forEach(table => {
        console.log(`   ✅ ${table.name}`);
    });
    
    // Verificar estructura de cada tabla
    const checkTable = (tableName, callback) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                console.log(`❌ Error verificando ${tableName}: ${err.message}`);
            } else if (columns.length > 0) {
                console.log(`\n📊 ESTRUCTURA DE ${tableName.toUpperCase()}:`);
                columns.forEach(col => {
                    const flags = [];
                    if (col.pk) flags.push('PRIMARY KEY');
                    if (col.notnull) flags.push('NOT NULL');
                    if (col.dflt_value) flags.push(`DEFAULT: ${col.dflt_value}`);
                    
                    console.log(`   - ${col.name} (${col.type}) ${flags.join(', ')}`);
                });
            }
            if (callback) callback();
        });
    };
    
    // Verificar cada tabla
    checkTable('users', () => {
        checkTable('submissions', () => {
            checkTable('materials', () => {
                // Mostrar datos existentes
                console.log('\n📊 DATOS EXISTENTES:');
                
                db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
                    if (!err) {
                        console.log(`   👥 Usuarios: ${result.count}`);
                        
                        // Mostrar usuarios por rol
                        db.all('SELECT role, COUNT(*) as count FROM users GROUP BY role', (err, roles) => {
                            if (!err) {
                                roles.forEach(role => {
                                    console.log(`      - ${role.role}: ${role.count}`);
                                });
                            }
                        });
                    }
                });
                
                db.get('SELECT COUNT(*) as count FROM submissions', (err, result) => {
                    if (!err) {
                        console.log(`   📄 Entregas: ${result.count}`);
                    }
                });
                
                db.get('SELECT COUNT(*) as count FROM materials', (err, result) => {
                    if (!err) {
                        console.log(`   📚 Materiales: ${result.count}`);
                    }
                    
                    setTimeout(() => {
                        db.close();
                        console.log('\n✅ Verificación completada');
                    }, 1000);
                });
            });
        });
    });
});
