const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();
const dbPath = path.join(__dirname, '../database.db'); // ← CORREGIDO: ruta simplificada

// Usar el middleware de autenticación
const authenticateToken = authMiddleware.authenticateToken;

// Middleware personalizado para descargas que acepta token por parámetro o header
function authenticateDownload(req, res, next) {
    let token = null;
    
    // Intentar obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    
    // Si no hay token en header, intentar obtenerlo del parámetro de consulta
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'informatica_medica_secret_key_2024', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }

        req.user = user;
        next();
    });
}

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/submissions';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const userId = req.user.userId;
        const extension = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, extension);
        const uniqueName = `${timestamp}_${userId}_${nameWithoutExt}${extension}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten: PDF, DOC, DOCX, TXT, ZIP'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
    }
});

// Obtener entregas del usuario autenticado
router.get('/my-submissions', authenticateToken, (req, res) => {
    console.log('📋 Obteniendo entregas para usuario:', req.user.userId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.all(
        'SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC',
        [req.user.userId],
        (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error obteniendo entregas:', err);
                return res.status(500).json({ error: 'Error al obtener entregas' });
            }
            
            console.log(`✅ Encontradas ${rows.length} entregas para usuario ${req.user.userId}`);
            res.json(rows);
        }
    );
});

// Subir nuevo trabajo con notificación por email
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    console.log('📤 Subida de trabajo por usuario:', req.user.userId);
    
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha seleccionado ningún archivo' });
    }
    
    const { title, description } = req.body;
    
    if (!title || title.trim() === '') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'El título es obligatorio' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    // ✅ CORREGIDO: Usar los nombres de columna correctos
    db.run(
        `INSERT INTO submissions (user_id, filename, original_name, file_path, file_size, mime_type, title, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.user.userId,
            req.file.filename,
            req.file.originalname,  // ← CORREGIDO: ahora coincide con la columna de la DB
            req.file.path,
            req.file.size,          // ← AGREGADO
            req.file.mimetype,      // ← AGREGADO
            title.trim(),
            description ? description.trim() : null
        ],
        async function(err) {
            db.close();
            
            if (err) {
                console.error('Error guardando entrega:', err);
                fs.unlinkSync(req.file.path);
                return res.status(500).json({ error: 'Error al guardar la entrega' });
            }
            
            console.log('✅ Entrega guardada:', title, 'ID:', this.lastID);
            
            // Preparar información para el email
            const submissionInfo = {
                id: this.lastID,
                title: title,
                description: description,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                submitted_at: new Date().toISOString()
            };

            const studentInfo = {
                userId: req.user.userId,
                email: req.user.email,
                nombre: req.user.nombre || req.user.email,
                ra: req.user.ra
            };

            // Enviar notificación por email (no bloquear la respuesta)
            try {
                const emailResult = await emailService.sendSubmissionNotification(studentInfo, submissionInfo);
                if (emailResult.success) {
                    console.log('📧 Notificaciones enviadas exitosamente');
                } else {
                    console.log('⚠️ Error en notificaciones:', emailResult.error);
                }
            } catch (emailError) {
                console.error('❌ Error enviando notificaciones:', emailError);
            }
            
            res.status(201).json({
                message: 'Trabajo subido exitosamente',
                submission: submissionInfo,
                emailNotification: 'Notificaciones enviadas'
            });
        }
    );
});

// Descargar archivo de entrega
router.get('/download/:id', authenticateDownload, (req, res) => {
    const submissionId = req.params.id;
    console.log('📥 Descarga solicitada para entrega:', submissionId, 'por usuario:', req.user.userId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.get(
        'SELECT * FROM submissions WHERE id = ? AND user_id = ?',
        [submissionId, req.user.userId],
        (err, submission) => {
            db.close();
            
            if (err) {
                console.error('Error obteniendo entrega:', err);
                return res.status(500).json({ error: 'Error al obtener la entrega' });
            }
            
            if (!submission) {
                return res.status(404).json({ error: 'Entrega no encontrada' });
            }
            
            const filePath = submission.file_path;
            
            if (!fs.existsSync(filePath)) {
                console.error('Archivo no encontrado:', filePath);
                return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
            }
            
            res.setHeader('Content-Disposition', `attachment; filename="${submission.original_name}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            
            res.sendFile(path.resolve(filePath), (err) => {
                if (err) {
                    console.error('Error enviando archivo:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error al descargar el archivo' });
                    }
                } else {
                    console.log('✅ Archivo descargado:', submission.original_name);
                }
            });
        }
    );
});

// Eliminar entrega
router.delete('/delete/:id', authenticateToken, (req, res) => {
    const submissionId = req.params.id;
    console.log('��️ Eliminación solicitada para entrega:', submissionId, 'por usuario:', req.user.userId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.get(
        'SELECT * FROM submissions WHERE id = ? AND user_id = ?',
        [submissionId, req.user.userId],
        (err, submission) => {
            if (err) {
                db.close();
                console.error('Error obteniendo entrega:', err);
                return res.status(500).json({ error: 'Error al obtener la entrega' });
            }
            
            if (!submission) {
                db.close();
                return res.status(404).json({ error: 'Entrega no encontrada' });
            }
            
            db.run(
                'DELETE FROM submissions WHERE id = ? AND user_id = ?',
                [submissionId, req.user.userId],
                function(err) {
                    db.close();
                    
                    if (err) {
                        console.error('Error eliminando entrega de BD:', err);
                        return res.status(500).json({ error: 'Error al eliminar la entrega' });
                    }
                    
                    if (fs.existsSync(submission.file_path)) {
                        try {
                            fs.unlinkSync(submission.file_path);
                            console.log('✅ Archivo físico eliminado:', submission.file_path);
                        } catch (fileErr) {
                            console.error('Error eliminando archivo físico:', fileErr);
                        }
                    }
                    
                    console.log('✅ Entrega eliminada:', submission.title);
                    res.json({ message: 'Entrega eliminada exitosamente' });
                }
            );
        }
    );
});

// Ruta para probar configuración de email
router.get('/test-email', authenticateToken, async (req, res) => {
    try {
        const testResult = await emailService.testConnection();
        res.json({
            message: 'Test de configuración de email',
            result: testResult
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error en test de email',
            details: error.message
        });
    }
});

module.exports = router;