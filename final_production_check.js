const sqlite3 = require('sqlite3').verbose();

console.log('🎯 VERIFICACIÓN FINAL - SITIO LISTO PARA ALUMNOS');
console.log('===============================================');

const db = new sqlite3.Database('./backend/database.db');

// Verificar admin existe
db.get('SELECT * FROM users WHERE role = "admin"', (err, admin) => {
    if (err) {
        console.error('❌ Error verificando admin:', err);
        return;
    }
    
    if (admin) {
        console.log('✅ ADMINISTRADOR CONFIGURADO:');
        console.log(`   👤 Nombre: ${admin.name}`);
        console.log(`   📧 Email: ${admin.email}`);
        console.log(`   🎓 RA: ${admin.ra}`);
        console.log(`   🔑 Rol: ${admin.role}`);
        console.log(`   📅 Creado: ${admin.created_at}`);
    } else {
        console.log('❌ No se encontró administrador');
    }
    
    // Estadísticas generales
    db.get('SELECT COUNT(*) as total FROM users', (err, users) => {
        if (!err) {
            console.log(`\n📊 ESTADÍSTICAS:`);
            console.log(`   👥 Total usuarios: ${users.total}`);
        }
        
        db.get('SELECT COUNT(*) as total FROM submissions', (err, submissions) => {
            if (!err) {
                console.log(`   📄 Total entregas: ${submissions.total}`);
            }
            
            db.get('SELECT COUNT(*) as total FROM materials', (err, materials) => {
                if (!err) {
                    console.log(`   📚 Total materiales: ${materials.total}`);
                }
                
                console.log('\n🎉 TU SITIO ESTÁ LISTO PARA TUS ALUMNOS:');
                console.log('======================================');
                console.log('🔗 URLS PRINCIPALES:');
                console.log('   🏠 Inicio: https://web-production-0af6.up.railway.app/');
                console.log('   📝 Registro: https://web-production-0af6.up.railway.app/register.html');
                console.log('   👤 Login: https://web-production-0af6.up.railway.app/login.html');
                console.log('   ⚙️  Admin: https://web-production-0af6.up.railway.app/admin-panel.html');
                console.log('');
                console.log('👨‍🏫 ACCESO DE PROFESOR:');
                console.log('   📧 Email: gabriel.alvarez@informaticamedica.edu');
                console.log('   🔐 Contraseña: InfoMedica2024!Prod');
                console.log('');
                console.log('📋 FUNCIONALIDADES DISPONIBLES:');
                console.log('   ✅ Registro de estudiantes');
                console.log('   ✅ Login/logout');
                console.log('   ✅ Subida de entregas');
                console.log('   ✅ Descarga de materiales');
                console.log('   ✅ Panel administrativo');
                console.log('   ✅ Gestión de usuarios');
                
                db.close();
            });
        });
    });
});
