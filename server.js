require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const migrateDatabase = require('./backend/database/migrate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static('frontend'));

// Rutas de API
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/submissions', require('./backend/routes/submissions'));
app.use('/api/admin', require('./backend/routes/admin'));

// Ruta para materiales (ejemplo)
app.get('/api/materials', (req, res) => {
    const sampleMaterials = [
        {
            id: 1,
            title: 'Introducción a los Sistemas de Información Hospitalaria',
            description: 'Conceptos básicos sobre HIS y su implementación',
            category: 'Teoría',
            uploaded_at: '2024-01-10T10:00:00Z'
        },
        {
            id: 2,
            title: 'Telemedicina: Presente y Futuro',
            description: 'Análisis de las tecnologías de telemedicina actuales',
            category: 'Investigación',
            uploaded_at: '2024-01-08T14:30:00Z'
        },
        {
            id: 3,
            title: 'Seguridad en Datos Médicos',
            description: 'Protocolos y mejores prácticas para proteger información médica',
            category: 'Seguridad',
            uploaded_at: '2024-01-05T09:15:00Z'
        },
        {
            id: 4,
            title: 'Interoperabilidad en Salud Digital',
            description: 'Estándares HL7 y FHIR para intercambio de datos',
            category: 'Estándares',
            uploaded_at: '2024-01-03T16:45:00Z'
        }
    ];
    
    res.json(sampleMaterials);
});

// Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Ruta principal - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    // Si es una ruta de API, devolver JSON
    if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({ 
            error: 'Ruta de API no encontrada',
            path: req.originalUrl 
        });
    } else {
        // Para rutas de frontend, servir index.html (SPA behavior)
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    }
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err);
    
    // Error de Multer (archivos)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'Archivo demasiado grande',
            maxSize: '10MB'
        });
    }
    
    // Error de Multer (tipo de archivo)
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({
            error: err.message
        });
    }
    
    // Error genérico
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

// Función para iniciar el servidor
async function startServer() {
    try {
        // Ejecutar migración de base de datos al iniciar
        console.log('🔄 Verificando base de datos...');
        await migrateDatabase();
        console.log('✅ Base de datos lista');
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log('🚀 Servidor ejecutándose en http://localhost:' + PORT);
            console.log('📚 Plataforma de Informática Médica');
            console.log('='.repeat(50));
            console.log('�� Rutas disponibles:');
            console.log('   🏠 Inicio: http://localhost:' + PORT);
            console.log('   👨‍🎓 Estudiantes: http://localhost:' + PORT + '/student-area.html');
            console.log('   👨‍💼 Admin: http://localhost:' + PORT + '/admin.html');
            console.log('   🔧 API Health: http://localhost:' + PORT + '/api/health');
            console.log('='.repeat(50));
            
            // Mostrar información del administrador
            console.log('👨‍💼 Credenciales de Administrador:');
            console.log('   📧 Email: ec.gabrielalvarez@gmail.com');
            console.log('   🔑 Password: Guepardo.25');
            console.log('='.repeat(50));
        });
        
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Cerrando servidor...');
    process.exit(0);
});

// Iniciar servidor
startServer();