#!/bin/bash

echo "🚀 DESPLEGANDO INFORMÁTICA MÉDICA - PRODUCCIÓN"
echo "=============================================="
echo "📍 Proyecto: $(pwd)"
echo ""

# Función para confirmar acciones
confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Función para mostrar progreso
show_progress() {
    echo "✅ $1"
    sleep 1
}

echo "🔍 Verificando estructura del proyecto..."

# Verificar archivos críticos
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js no encontrado"
    exit 1
fi

if [ ! -d "backend" ]; then
    echo "❌ Error: directorio backend no encontrado"
    exit 1
fi

if [ ! -d "frontend" ]; then
    echo "❌ Error: directorio frontend no encontrado"
    exit 1
fi

show_progress "Estructura del proyecto verificada"

# PASO 1: Backup de seguridad
echo ""
echo "💾 PASO 1: Creando backup de seguridad..."
if confirm "¿Crear backup de la base de datos actual?"; then
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    
    # Backup de las bases de datos existentes
    if [ -f "backend/database.db" ]; then
        cp backend/database.db "backend/database_backup_${BACKUP_DATE}.db"
        show_progress "Backup de backend/database.db creado"
    fi
    
    if [ -f "database.db" ]; then
        cp database.db "database_backup_${BACKUP_DATE}.db"
        show_progress "Backup de database.db creado"
    fi
    
    # Backup de archivos de configuración
    cp .env ".env_backup_${BACKUP_DATE}"
    show_progress "Backup de configuración creado"
fi

# PASO 2: Limpiar datos de prueba
echo ""
echo "🧹 PASO 2: Limpiando datos de prueba..."
if confirm "¿Limpiar datos de prueba de la base de datos?"; then
    
    # Crear script de limpieza
    mkdir -p backend/scripts
    cat > backend/scripts/clean_production.js << 'CLEAN_SCRIPT'
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
CLEAN_SCRIPT

    # Ejecutar limpieza
    cd backend && node scripts/clean_production.js
    cd ..
    show_progress "Datos de prueba eliminados"
fi

# PASO 3: Crear usuario administrador
echo ""
echo "👤 PASO 3: Configurando usuario administrador..."
if confirm "¿Crear usuario administrador para producción?"; then
    
    cat > backend/scripts/create_admin_prod.js << 'ADMIN_SCRIPT'
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
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

const db = new sqlite3.Database(dbPath);

async function createAdmin() {
    console.log('👤 Creando usuario administrador...');
    
    // Datos del administrador (PERSONALIZAR ESTOS VALORES)
    const adminData = {
        name: 'Prof. Gabriel Alvarez',
        email: ‘ec.gabrielalvarez@gmail.com’,  // CAMBIAR EMAIL
        password: ‘Guepardo.25',  // CAMBIAR CONTRASEÑA
        role: 'admin',
        university: 'Unisud',
        career: 'Informática Médica',
        year: 'Profesor',
        semester: 'N/A'
    };
    
    try {
        // Verificar si ya existe un admin
        db.get(`SELECT * FROM users WHERE email = ?`, [adminData.email], async (err, row) => {
            if (row) {
                console.log('⚠️  Usuario administrador ya existe');
                console.log(`📧 Email: ${row.email}`);
                db.close();
                return;
            }
            
            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(adminData.password, 10);
            
            // Insertar administrador
            db.run(`
                INSERT INTO users (name, email, password, role, university, career, year, semester, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                adminData.name,
                adminData.email,
                hashedPassword,
                adminData.role,
                adminData.university,
                adminData.career,
                adminData.year,
                adminData.semester
            ], function(err) {
                if (err) {
                    console.error('❌ Error creando administrador:', err);
                } else {
                    console.log('✅ Administrador creado exitosamente');
                    console.log(`📧 Email: ${adminData.email}`);
                    console.log(`🔐 Contraseña: ${adminData.password}`);
                    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
                }
                db.close();
            });
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        db.close();
    }
}

createAdmin();
ADMIN_SCRIPT

    cd backend && node scripts/create_admin_prod.js
    cd ..
    show_progress "Usuario administrador configurado"
fi

# PASO 4: Configurar variables de entorno para producción
echo ""
echo "⚙️  PASO 4: Configurando variables de entorno..."
if confirm "¿Crear archivo de configuración de producción?"; then
    
    cat > .env.production << 'ENV_PROD'
# CONFIGURACIÓN DE PRODUCCIÓN - INFORMÁTICA MÉDICA
# ================================================

# Entorno
NODE_ENV=production

# Servidor
PORT=3000
HOST=0.0.0.0

# Base de datos
DATABASE_PATH=./backend/database.db

# Seguridad (CAMBIAR ESTOS VALORES)
JWT_SECRET=tu_jwt_secret_super_seguro_cambiar_esto_12345
SESSION_SECRET=tu_session_secret_super_seguro_cambiar_esto_67890

# CORS (agregar tu dominio)
ALLOWED_ORIGINS=https://web-production-0af6.up.railway.app/index.html, https://www.tudominio.com,http://localhost:3000

# Límites de archivos
MAX_FILE_SIZE=10485760
MAX_FILES_PER_UPLOAD=5

# Uploads
UPLOAD_DIR=./uploads

# Email (configurar si necesitas notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password

# Logs
LOG_LEVEL=info
LOG_DIR=./logs

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL=24
ENV_PROD

    show_progress "Archivo .env.production creado"
    echo "⚠️  IMPORTANTE: Edita .env.production con tus valores reales"
fi

# PASO 5: Optimizar archivos frontend
echo ""
echo "🎨 PASO 5: Optimizando archivos frontend..."
if confirm "¿Optimizar archivos para producción?"; then
    
    # Crear directorio de producción
    mkdir -p frontend/dist
    
    # Copiar archivos principales
    cp frontend/index.html frontend/dist/
    cp frontend/login.html frontend/dist/
    cp frontend/register.html frontend/dist/
    cp frontend/admin-panel.html frontend/dist/
    cp frontend/student-area.html frontend/dist/
    
    # Copiar recursos
    cp -r frontend/css frontend/dist/
    cp -r frontend/js frontend/dist/
    
    # Copiar PWA files
    cp frontend/manifest.json frontend/dist/
    cp frontend/sw.js frontend/dist/
    
    show_progress "Archivos frontend optimizados en frontend/dist/"
fi

# PASO 6: Configurar PM2 para producción
echo ""
echo "🚀 PASO 6: Configurando PM2..."
if confirm "¿Configurar PM2 para gestión de procesos?"; then
    
    # Instalar PM2 globalmente
    npm install -g pm2 2>/dev/null || echo "PM2 ya instalado o sin permisos sudo"
    
    # Crear configuración de PM2
    cat > ecosystem.config.js << 'PM2_CONFIG'
module.exports = {
  apps: [{
    name: 'informatica-medica',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    time: true
  }]
};
PM2_CONFIG

    # Crear directorio de logs
    mkdir -p logs
    
    show_progress "PM2 configurado"
fi

# PASO 7: Instalar dependencias de producción
echo ""
echo "📦 PASO 7: Instalando dependencias..."
if confirm "¿Instalar/actualizar dependencias de producción?"; then
    
    # Instalar dependencias principales
    npm install --production
    
    # Verificar que bcrypt esté instalado (necesario para el admin)
    npm list bcrypt || npm install bcrypt
    
    show_progress "Dependencias instaladas"
fi

# PASO 8: Crear scripts de gestión
echo ""
echo "🔧 PASO 8: Creando scripts de gestión..."

# Script de inicio
cat > start_production.sh << 'START_SCRIPT'
#!/bin/bash
echo "🚀 Iniciando Informática Médica en producción..."

# Usar archivo de producción si existe
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

echo "✅ Aplicación iniciada"
echo "📊 Ver estado: pm2 status"
echo "📋 Ver logs: pm2 logs informatica-medica"
START_SCRIPT

# Script de parada
cat > stop_production.sh << 'STOP_SCRIPT'
#!/bin/bash
echo "🛑 Deteniendo Informática Médica..."
pm2 stop informatica-medica
pm2 delete informatica-medica
echo "✅ Aplicación detenida"
STOP_SCRIPT

# Script de backup
cat > backup_database.sh << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
echo "💾 Creando backup de base de datos..."

# Backup de la base principal
if [ -f "backend/database.db" ]; then
    cp backend/database.db "backend/database_backup_${BACKUP_DATE}.db"
    echo "✅ Backup creado: backend/database_backup_${BACKUP_DATE}.db"
fi

if [ -f "database.db" ]; then
    cp database.db "database_backup_${BACKUP_DATE}.db"
    echo "✅ Backup creado: database_backup_${BACKUP_DATE}.db"
fi

echo "💾 Backup completado"
BACKUP_SCRIPT

# Hacer scripts ejecutables
chmod +x start_production.sh
chmod +x stop_production.sh
chmod +x backup_database.sh

show_progress "Scripts de gestión creados"

# RESUMEN FINAL
echo ""
echo "🎉 DESPLIEGUE COMPLETADO"
echo "======================="
echo ""
echo "📋 ARCHIVOS CREADOS:"
echo "   ✅ .env.production (configuración)"
echo "   ✅ ecosystem.config.js (PM2)"
echo "   ✅ frontend/dist/ (archivos optimizados)"
echo "   ✅ start_production.sh (iniciar)"
echo "   ✅ stop_production.sh (detener)"
echo "   ✅ backup_database.sh (backup)"
echo ""
echo "🚀 PRÓXIMOS PASOS:"
echo "   1. Editar .env.production con tus valores"
echo "   2. Iniciar: ./start_production.sh"
echo "   3. Verificar: pm2 status"
echo "   4. Acceder: http://localhost:3000"
echo ""
echo "🔗 URLs importantes:"
echo "   📱 Frontend: http://localhost:3000"
echo "   👤 Login: http://localhost:3000/login.html"
echo "   ⚙️  Admin: http://localhost:3000/admin-panel.html"
echo ""
echo "👤 Credenciales de administrador:"
echo "   📧 Email: gabriel.alvarez@informaticamedica.edu"
echo "   🔐 Contraseña: InfoMed2024!Admin"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Cambia las credenciales después del primer login"
echo "   - Edita .env.production con valores seguros"
echo "   - Configura tu dominio y SSL para producción"
echo ""
echo "📊 Comandos útiles:"
echo "   pm2 status                    # Ver estado"
echo "   pm2 logs informatica-medica   # Ver logs"
echo "   pm2 restart informatica-medica # Reiniciar"
echo "   ./backup_database.sh          # Crear backup"
