const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ AGREGAR: Configuración para Railway/proxies
app.set('trust proxy', true);

// Middleware - ORDEN IMPORTANTE
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`, req.body ? 'with body' : 'no body');
    next();
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'frontend')));

// Crear directorios necesarios
const uploadsDir = path.join(__dirname, 'uploads');
const dbDir = path.join(__dirname, 'backend/database');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicializar base de datos
try {
    require('./backend/database/init');
    console.log('✅ Base de datos inicializada');
} catch (error) {
    console.log('⚠️ Error de base de datos:', error.message);
}

// Rutas API
try {
    app.use('/api/auth', require('./backend/routes/auth'));
    app.use('/api/submissions', require('./backend/routes/submissions'));
    app.use('/api/admin', require('./backend/routes/admin'));
    console.log('✅ Rutas API cargadas');
} catch (error) {
    console.log('⚠️ Error cargando rutas:', error.message);
}

// Ruta de salud
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3000
    });
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Puerto
const PORT = parseInt(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`�� Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`�� Listening on all interfaces (0.0.0.0:${PORT})`);
});
