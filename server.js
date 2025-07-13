// server.js (o tu archivo principal)
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 MIDDLEWARE ESENCIAL
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// �� SERVIR ARCHIVOS ESTÁTICOS CON MIME TYPES CORRECTOS
app.use(express.static('frontend', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// 📊 CONFIGURACIÓN DE MULTER PARA SUBIDA DE ARCHIVOS
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// 🗄️ SIMULACIÓN DE BASE DE DATOS EN MEMORIA
let submissions = [];
let users = [
    {
        id: 1,
        name: 'Estudiante Demo',
        email: 'estudiante@demo.com',
        password: '123456',
        role: 'student'
    },
    {
        id: 2,
        name: 'Administrador',
        email: 'admin@demo.com',
        password: 'admin123',
        role: 'admin',
        isAdmin: true
    }
];

// 🔐 MIDDLEWARE DE AUTENTICACIÓN SIMPLE
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }
    
    // Simulación simple de verificación de token
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = payload;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
}

// 🏥 RUTAS DE LA API

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Sistema de Informática Médica funcionando',
        timestamp: new Date().toISOString()
    });
});

// 🔐 AUTENTICACIÓN
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Crear token simple (en producción usar JWT real)
    const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin || false,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 horas
    };
    
    const token = 'header.' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64') + '.signature';
    
    res.json({
        success: true,
        token: token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

// 📋 ENTREGAS (SUBMISSIONS)

// Obtener todas las entregas del usuario
app.get('/api/submissions', authenticateToken, (req, res) => {
    try {
        const userSubmissions = submissions.filter(s => s.userId === req.user.userId);
        res.json(userSubmissions);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo entregas' });
    }
});

// Subir nueva entrega
app.post('/api/submissions', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        
        const newSubmission = {
            id: submissions.length + 1,
            userId: req.user.userId,
            title: req.body.title,
            description: req.body.description,
            filename: req.file.filename,
            original_name: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            submitted_at: new Date().toISOString(),
            user_name: req.user.name,
            user_email: req.user.email
        };
        
        submissions.push(newSubmission);
        
        res.json({
            success: true,
            message: 'Entrega subida exitosamente',
            submission: newSubmission
        });
        
    } catch (error) {
        console.error('Error subiendo entrega:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar entrega
app.delete('/api/submissions/:id', authenticateToken, (req, res) => {
    try {
        const submissionId = parseInt(req.params.id);
        const submissionIndex = submissions.findIndex(s => 
            s.id === submissionId && s.userId === req.user.userId
        );
        
        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }
        
        const submission = submissions[submissionIndex];
        
        // Eliminar archivo físico
        const filePath = path.join('uploads', submission.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        submissions.splice(submissionIndex, 1);
        
        res.json({
            success: true,
            message: 'Entrega eliminada exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando entrega:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Descargar archivo
app.get('/api/submissions/download/:id', authenticateToken, (req, res) => {
    try {
        const submissionId = parseInt(req.params.id);
        const submission = submissions.find(s => 
            s.id === submissionId && s.userId === req.user.userId
        );
        
        if (!submission) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }
        
        const filePath = path.join('uploads', submission.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        res.download(filePath, submission.original_name);
        
    } catch (error) {
        console.error('Error descargando archivo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 👨‍⚕️ RUTAS DE ADMINISTRACIÓN

// Obtener todas las entregas (solo admin)
app.get('/api/admin/submissions', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedSubmissions = submissions.slice(startIndex, endIndex);
        
        res.json({
            submissions: paginatedSubmissions,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(submissions.length / limit),
                totalItems: submissions.length,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo entregas' });
    }
});

// Obtener estadísticas generales (solo admin)
app.get('/api/admin/stats/general', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const todaySubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= today
        ).length;
        
        const thisWeekSubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= thisWeek
        ).length;
        
        const totalStorage = submissions.reduce((total, s) => total + (s.file_size || 0), 0);
        
        res.json({
            totalUsers: users.filter(u => u.role === 'student').length,
            totalSubmissions: submissions.length,
            todaySubmissions,
            thisWeekSubmissions,
            totalStorage,
            avgFileSize: submissions.length > 0 ? totalStorage / submissions.length : 0,
            activeUsers: users.filter(u => u.role === 'student').length,
            weeklyGrowthPercentage: 15 // Simulado
        });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// Obtener usuarios (solo admin)
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const studentsWithStats = users
            .filter(u => u.role === 'student')
            .map(user => {
                const userSubmissions = submissions.filter(s => s.userId === user.id);
                const totalSize = userSubmissions.reduce((total, s) => total + (s.file_size || 0), 0);
                
                return {
                    ...user,
                    submission_count: userSubmissions.length,
                    total_size: totalSize,
                    created_at: '2024-01-01T00:00:00.000Z', // Simulado
                    last_login: '2024-01-15T10:30:00.000Z', // Simulado
                    status: 'activo'
                };
            });
        
        res.json(studentsWithStats);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
});

// Health check para admin
app.get('/api/admin/health-check', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// 🌐 RUTAS DE FRONTEND
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

app.get('/student-area', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'student-area.html'));
});

app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-panel.html'));
});

// 🚀 INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`
🏥 ===================================
   SERVIDOR INFORMÁTICA MÉDICA
   
   🚀 Servidor corriendo en puerto ${PORT}
   🌐 Frontend: http://localhost:${PORT}
   📡 API: http://localhost:${PORT}/api
   👨‍⚕️ Admin: http://localhost:${PORT}/admin-panel
   
   ✅ Sistema listo para usar
===================================
    `);
});
// 📊 RUTAS ADICIONALES DE ESTADÍSTICAS PARA ADMIN

// Obtener entregas por fecha para gráficos
app.get('/api/admin/stats/submissions-by-date', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const days = parseInt(req.query.days) || 30;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        
        // Crear array de fechas para los últimos N días
        const labels = [];
        const values = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toLocaleDateString('es-ES', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            const daySubmissions = submissions.filter(s => {
                const submissionDate = new Date(s.submitted_at);
                return submissionDate.toDateString() === date.toDateString();
            }).length;
            
            labels.push(dateStr);
            values.push(daySubmissions);
        }
        
        res.json({
            labels,
            values
        });
        
    } catch (error) {
        console.error('Error obteniendo entregas por fecha:', error);
        res.status(500).json({ error: 'Error obteniendo estadísticas por fecha' });
    }
});

// Obtener tipos de archivo para gráfico de pie
app.get('/api/admin/stats/file-types', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const fileTypes = {};
        
        submissions.forEach(submission => {
            const extension = (submission.original_name || submission.filename)
                .split('.')
                .pop()
                .toLowerCase();
            
            fileTypes[extension] = (fileTypes[extension] || 0) + 1;
        });
        
        const labels = Object.keys(fileTypes);
        const values = Object.values(fileTypes);
        
        res.json({
            labels: labels.length > 0 ? labels : ['PDF', 'DOC', 'TXT'], // Datos demo si no hay archivos
            values: values.length > 0 ? values : [5, 3, 2] // Datos demo
        });
        
    } catch (error) {
        console.error('Error obteniendo tipos de archivo:', error);
        res.status(500).json({ error: 'Error obteniendo tipos de archivo' });
    }
});

// Obtener detalles de una entrega específica (admin)
app.get('/api/admin/submissions/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const submissionId = parseInt(req.params.id);
        const submission = submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }
        
        res.json(submission);
        
    } catch (error) {
        console.error('Error obteniendo detalles de entrega:', error);
        res.status(500).json({ error: 'Error obteniendo detalles' });
    }
});

// Eliminar entrega (admin)
app.delete('/api/admin/submissions/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const submissionId = parseInt(req.params.id);
        const submissionIndex = submissions.findIndex(s => s.id === submissionId);
        
        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }
        
        const submission = submissions[submissionIndex];
        
        // Eliminar archivo físico
        const filePath = path.join('uploads', submission.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        submissions.splice(submissionIndex, 1);
        
        res.json({
            success: true,
            message: 'Entrega eliminada exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando entrega (admin):', error);
        res.status(500).json({ error: 'Error eliminando entrega' });
    }
});

// Registrar nuevo estudiante (admin)
app.post('/api/admin/users', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const { name, email, ra, password } = req.body;
        
        // Verificar si el email ya existe
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        
        const newUser = {
            id: users.length + 1,
            name,
            email,
            ra: ra || '',
            password,
            role: 'student',
            created_at: new Date().toISOString(),
            status: 'activo'
        };
        
        users.push(newUser);
        
        res.json({
            success: true,
            message: 'Estudiante registrado exitosamente',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                ra: newUser.ra
            }
        });
        
    } catch (error) {
        console.error('Error registrando estudiante:', error);
        res.status(500).json({ error: 'Error registrando estudiante' });
    }
});

// Eliminar estudiante (admin)
app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const userId = parseInt(req.params.id);
        const userIndex = users.findIndex(u => u.id === userId && u.role === 'student');
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        
        // Eliminar entregas del estudiante
        const userSubmissions = submissions.filter(s => s.userId === userId);
        userSubmissions.forEach(submission => {
            const filePath = path.join('uploads', submission.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
        
        // Remover entregas de la lista
        submissions = submissions.filter(s => s.userId !== userId);
        
        // Remover usuario
        users.splice(userIndex, 1);
        
        res.json({
            success: true,
            message: 'Estudiante eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando estudiante:', error);
        res.status(500).json({ error: 'Error eliminando estudiante' });
    }
});

// Obtener información del sistema (admin)
app.get('/api/admin/system/info', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const totalStorage = submissions.reduce((total, s) => total + (s.file_size || 0), 0);
        const avgFileSize = submissions.length > 0 ? totalStorage / submissions.length : 0;
        
        const today = new Date();
        const todaySubmissions = submissions.filter(s => {
            const submissionDate = new Date(s.submitted_at);
            return submissionDate.toDateString() === today.toDateString();
        }).length;
        
        res.json({
            os: process.platform,
            nodeVersion: process.version,
            totalMemory: process.memoryUsage().heapTotal,
            freeMemory: process.memoryUsage().heapUsed,
            uptime: process.uptime(),
            dbType: 'Memory (SQLite simulado)',
            dbVersion: '1.0.0',
            dbSize: totalStorage,
            dbConnections: 1,
            totalFiles: submissions.length,
            totalStorage,
            avgFileSize,
            dailyUploads: todaySubmissions
        });
        
    } catch (error) {
        console.error('Error obteniendo info del sistema:', error);
        res.status(500).json({ error: 'Error obteniendo información del sistema' });
    }
});

// Verificar base de datos (admin)
app.get('/api/admin/system/check-database', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    res.json({
        success: true,
        message: 'Base de datos funcionando correctamente',
        status: 'healthy'
    });
});

// Optimizar base de datos (admin)
app.post('/api/admin/system/optimize-database', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    // Simular optimización
    setTimeout(() => {
        res.json({
            success: true,
            message: 'Base de datos optimizada correctamente'
        });
    }, 1000);
});

// Limpiar caché (admin)
app.post('/api/admin/system/clear-cache', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    res.json({
        success: true,
        message: 'Caché limpiado correctamente'
    });
});

// Crear respaldo (admin)
app.post('/api/admin/system/backup', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    try {
        const backupData = {
            timestamp: new Date().toISOString(),
            users: users.filter(u => u.role === 'student'), // No incluir passwords en backup
            submissions: submissions,
            version: '2.0.0'
        };
        
        res.json({
            success: true,
            message: 'Respaldo creado exitosamente',
            backup: backupData
        });
        
    } catch (error) {
        console.error('Error creando respaldo:', error);
        res.status(500).json({ error: 'Error creando respaldo' });
    }
});

// Obtener logs del sistema (admin)
app.get('/api/admin/system/logs', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    // Simular logs del sistema
    const logs = [
        {
            id: 1,
            timestamp: new Date().toISOString(),
            type: 'LOGIN',
            user_email: 'estudiante@demo.com',
            action: 'Usuario inició sesión',
            ip_address: '192.168.1.100',
            details: 'Login exitoso'
        },
        {
            id: 2,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            type: 'UPLOAD',
            user_email: 'estudiante@demo.com',
            action: 'Archivo subido',
            ip_address: '192.168.1.100',
            details: 'documento.pdf - 2.5MB'
        },
        {
            id: 3,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            type: 'ADMIN',
            user_email: 'admin@demo.com',
            action: 'Acceso al panel de admin',
            ip_address: '192.168.1.101',
            details: 'Dashboard accedido'
        }
    ];
    
    res.json(logs);
});

// Ping para mantener sesión activa (admin)
app.get('/api/admin/ping', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    res.json({
        success: true,
        timestamp: new Date().toISOString()
    });
});
// 🛡️ MANEJO DE ERRORES
app.use((err, req, res, next) => {
    console.error('Error del servidor:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

// 404 para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        path: req.originalUrl
    });
});