const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// ========================================
// CONFIGURACIÓN BÁSICA
// ========================================

// Variables de entorno
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`🚀 Iniciando servidor en modo: ${NODE_ENV}`);
console.log(`📡 Puerto configurado: ${PORT}`);

// ========================================
// MIDDLEWARES GLOBALES
// ========================================

// CORS configurado para Railway
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? ['https://web-production-0af6.up.railway.app', 'https://*.railway.app']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: {
        error: 'Demasiadas peticiones desde esta IP',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: NODE_ENV === 'production'
});

app.use(globalLimiter);

// Logging de peticiones
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ========================================
// RUTAS DE API
// ========================================

// Importar rutas
let authRoutes, adminRoutes, studentRoutes, materialsRoutes;

try {
    authRoutes = require('./routes/auth');
    console.log('✅ Rutas de auth cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas de auth:', error.message);
}

try {
    adminRoutes = require('./routes/admin');
    console.log('✅ Rutas de admin cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas de admin:', error.message);
}

try {
    studentRoutes = require('./routes/student');
    console.log('✅ Rutas de student cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas de student:', error.message);
}

try {
    materialsRoutes = require('./routes/materials');
    console.log('✅ Rutas de materials cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas de materials:', error.message);
}

// Configurar rutas de API
if (authRoutes) {
    app.use('/api/auth', authRoutes);
    console.log('🔐 Rutas de autenticación configuradas en /api/auth');
}

if (adminRoutes) {
    app.use('/api/admin', adminRoutes);
    console.log('👨‍💼 Rutas de admin configuradas en /api/admin');
}

if (studentRoutes) {
    app.use('/api/student', studentRoutes);
    console.log('👨‍🎓 Rutas de student configuradas en /api/student');
}

if (materialsRoutes) {
    app.use('/api/materials', materialsRoutes);
    console.log('�� Rutas de materials configuradas en /api/materials');
}

// ========================================
// SERVIR ARCHIVOS ESTÁTICOS
// ========================================

// Servir archivos estáticos desde frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ========================================
// RUTAS DE PÁGINAS
// ========================================

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Rutas específicas de páginas
const pages = ['login', 'register', 'admin-panel', 'student-area'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, `../frontend/${page}.html`));
    });
});

// ========================================
// RUTA DE SALUD DEL SERVIDOR
// ========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        port: PORT,
        routes: {
            auth: !!authRoutes,
            admin: !!adminRoutes,
            student: !!studentRoutes,
            materials: !!materialsRoutes
        }
    });
});

// ========================================
// MANEJO DE ERRORES
// ========================================

// Ruta 404 para API
app.use('/api/*', (req, res) => {
    console.log(`❌ Ruta de API no encontrada: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Endpoint no encontrado',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Ruta 404 para páginas (redirigir al index)
app.use('*', (req, res) => {
    console.log(`❌ Página no encontrada: ${req.path}, redirigiendo al index`);
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Manejo de errores global
app.use((error, req, res, next) => {
    console.error('❌ Error del servidor:', error);
    
    res.status(error.status || 500).json({
        error: NODE_ENV === 'production' 
            ? 'Error interno del servidor' 
            : error.message,
        timestamp: new Date().toISOString(),
        path: req.path
    });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🎉 ================================');
    console.log('�� SERVIDOR INICIADO EXITOSAMENTE');
    console.log('🎉 ================================');
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌍 Entorno: ${NODE_ENV}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 RUTAS DISPONIBLES:');
    console.log('   🔐 /api/auth/* - Autenticación');
    console.log('   👨‍💼 /api/admin/* - Administración');
    console.log('   ��‍🎓 /api/student/* - Estudiantes');
    console.log('   📚 /api/materials/* - Materiales');
    console.log('   ❤️  /health - Estado del servidor');
    console.log('');
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
    process.exit(0);
});

module.exports = app;
