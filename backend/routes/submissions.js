const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ✅ MEJORA: Configuración de base de datos
const dbPath = path.join(__dirname, '../database/database.db');

// ✅ MEJORA: Función para logging de eventos de seguridad (importada del middleware)
const logSecurityEvent = (event, details, req) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`🔒 [SUBMISSIONS] ${timestamp} - ${event}`, {
        ip,
        userAgent: userAgent.substring(0, 100),
        details,
        url: req.originalUrl
    });
};

// ✅ MEJORA: Configuración de Multer con tipos de archivo sincronizados
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/submissions');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

// ✅ MEJORA: Tipos de archivo sincronizados con frontend
const fileFilter = (req, file, cb) => {
    console.log('📁 Validando archivo:', file.originalname, 'Tipo:', file.mimetype);
    
    const allowedTypes = [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain', // .txt
        'application/zip',
        'application/x-zip-compressed',
        'image/png', // ✅ AGREGADO para sincronizar con frontend
        'image/jpeg' // ✅ AGREGADO para sincronizar con frontend
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        console.log('✅ Tipo de archivo válido');
        cb(null, true);
    } else {
        console.log('❌ Tipo de archivo no permitido:', file.mimetype);
        logSecurityEvent('FILE_TYPE_REJECTED', { 
            filename: file.originalname, 
            mimetype: file.mimetype,
            userId: req.user?.userId 
        }, req);
        cb(new Error('Tipo de archivo no permitido. Solo se permiten: PDF, DOC, DOCX, TXT, ZIP, PNG, JPG'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// ✅ MEJORA: Configuración de email con validación
const createEmailTransporter = () => {
    try {
        return nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } catch (error) {
        console.error('❌ Error configurando transporter de email:', error);
        return null;
    }
};

// ✅ MEJORA: Función para enviar email con manejo de errores robusto
const sendNotificationEmail = async (userEmail, userName, submissionTitle, req) => {
    const transporter = createEmailTransporter();
    
    if (!transporter) {
        console.warn('⚠️ Transporter de email no disponible');
        return { success: false, error: 'Configuración de email no disponible' };
    }

    const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: userEmail,
        subject: '✅ Entrega recibida - Informática Médica',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #007bff;">¡Entrega Recibida!</h2>
                <p>Hola <strong>${userName}</strong>,</p>
                <p>Hemos recibido exitosamente tu entrega:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <strong>Título:</strong> ${submissionTitle}<br>
                    <strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}
                </div>
                <p>Puedes revisar tus entregas en tu área de estudiante.</p>
                <hr>
                <p style="color: #6c757d; font-size: 12px;">
                    Este es un mensaje automático del sistema de Informática Médica.<br>
                    Prof. Gabriel Álvarez
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logSecurityEvent('EMAIL_SENT_SUCCESS', { 
            to: userEmail, 
            subject: mailOptions.subject,
            messageId: info.messageId 
        }, req);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        logSecurityEvent('EMAIL_SENT_FAILED', { 
            to: userEmail, 
            error: error.message 
        }, req);
        return { success: false, error: error.message };
    }
};

// ✅ MEJORA: Función para operaciones de base de datos con promesas
const dbOperation = (query, params = []) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        if (query.trim().toLowerCase().startsWith('select')) {
            db.all(query, params, (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
            });
        } else {
            db.run(query, params, function(err) {
                db.close();
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
};

// ✅ MEJORA: Función para obtener una sola fila de la base de datos
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        db.get(query, params, (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// ✅ MEJORA: Middleware de autenticación para descargas con logging
function authenticateDownload(req, res, next) {
    const token = req.query.token;
    
    if (!token) {
        logSecurityEvent('DOWNLOAD_NO_TOKEN', { submissionId: req.params.id }, req);
        return res.status(401).json({ error: 'Token requerido para descarga' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logSecurityEvent('DOWNLOAD_INVALID_TOKEN', { 
                submissionId: req.params.id,
                error: err.message 
            }, req);
            return res.status(403).json({ error: 'Token inválido' });
        }

        logSecurityEvent('DOWNLOAD_TOKEN_VALID', { 
            submissionId: req.params.id,
            userId: user.userId 
        }, req);
        
        req.user = user;
        next();
    });
}

// ✅ RUTA: Subir archivo - MEJORADA
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    
    try {
        logSecurityEvent('UPLOAD_ATTEMPT', { 
            userId: req.user.userId,
            email: req.user.email 
        }, req);

        const { title, description } = req.body;

        // ✅ MEJORA: Validación más robusta
        if (!title || title.trim().length === 0) {
            if (req.file) {
                fs.unlinkSync(req.file.path); // Limpiar archivo si la validación falla
            }
            logSecurityEvent('UPLOAD_VALIDATION_FAILED', { 
                error: 'Título requerido',
                userId: req.user.userId 
            }, req);
            return res.status(400).json({ 
                error: 'El título es obligatorio',
                code: 'TITLE_REQUIRED'
            });
        }

        if (!req.file) {
            logSecurityEvent('UPLOAD_VALIDATION_FAILED', { 
                error: 'Archivo requerido',
                userId: req.user.userId 
            }, req);
            return res.status(400).json({ 
                error: 'Debe seleccionar un archivo',
                code: 'FILE_REQUIRED'
            });
        }

        // ✅ MEJORA: Validación adicional del archivo
        if (!fs.existsSync(req.file.path)) {
            logSecurityEvent('UPLOAD_FILE_NOT_FOUND', { 
                filePath: req.file.path,
                userId: req.user.userId 
            }, req);
            return res.status(500).json({ 
                error: 'Error procesando el archivo',
                code: 'FILE_PROCESSING_ERROR'
            });
        }

        console.log('📤 Procesando subida de archivo:', {
            usuario: req.user.email,
            archivo: req.file.originalname,
            tamaño: req.file.size,
            tipo: req.file.mimetype
        });

        // ✅ MEJORA: Usar función de base de datos con promesas
        try {
            const result = await dbOperation(
                'INSERT INTO submissions (user_id, title, description, filename, original_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    req.user.userId,
                    title.trim(),
                    description ? description.trim() : '',
                    req.file.filename,
                    req.file.originalname,
                    req.file.path,
                    req.file.size,
                    req.file.mimetype
                ]
            );

            const processingTime = Date.now() - startTime;
            
            logSecurityEvent('UPLOAD_SUCCESS', { 
                submissionId: result.lastID,
                userId: req.user.userId,
                title: title.trim(),
                filename: req.file.originalname,
                fileSize: req.file.size,
                processingTime: `${processingTime}ms`
            }, req);

            // ✅ MEJORA: Envío de email asíncrono (no bloquea la respuesta)
            sendNotificationEmail(req.user.email, req.user.name, title.trim(), req)
                .then(emailResult => {
                    if (emailResult.success) {
                        console.log('📧 Email de notificación enviado exitosamente');
                    } else {
                        console.warn('⚠️ Fallo al enviar email de notificación:', emailResult.error);
                    }
                })
                .catch(emailError => {
                    console.error('❌ Error inesperado enviando email:', emailError);
                });

            res.status(201).json({
                message: 'Archivo subido exitosamente',
                submissionId: result.lastID,
                filename: req.file.originalname,
                size: req.file.size,
                processingTime: `${processingTime}ms`
            });

        } catch (dbError) {
            // ✅ MEJORA: Limpiar archivo si falla la base de datos
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                    console.log('🗑️ Archivo eliminado tras error de BD');
                } catch (unlinkError) {
                    console.error('❌ Error eliminando archivo tras fallo de BD:', unlinkError);
                }
            }

            console.error('❌ Error guardando en base de datos:', dbError);
            logSecurityEvent('UPLOAD_DB_ERROR', { 
                error: dbError.message,
                userId: req.user.userId,
                filename: req.file?.originalname 
            }, req);

            // ✅ MEJORA: Mensaje de error más específico
            let errorMessage = 'Error al guardar la entrega';
            let errorCode = 'DATABASE_ERROR';

            if (dbError.message.includes('UNIQUE constraint failed')) {
                errorMessage = 'Ya existe una entrega con ese título';
                errorCode = 'DUPLICATE_TITLE';
            }

            return res.status(500).json({ 
                error: errorMessage,
                code: errorCode
            });
        }

    } catch (error) {
        // ✅ MEJORA: Limpiar archivo en caso de error general
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('❌ Error eliminando archivo tras error general:', unlinkError);
            }
        }

        console.error('❌ Error general en subida:', error);
        logSecurityEvent('UPLOAD_GENERAL_ERROR', { 
            error: error.message,
            userId: req.user?.userId 
        }, req);

        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ RUTA: Listar entregas del usuario - MEJORADA
router.get('/my-submissions', authenticateToken, async (req, res) => {
    try {
        logSecurityEvent('LIST_SUBMISSIONS_ATTEMPT', { 
            userId: req.user.userId 
        }, req);

        console.log('📋 Obteniendo entregas para usuario:', req.user.email);

        const submissions = await dbOperation(
            'SELECT id, title, description, original_name, file_size, mime_type, submitted_at FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC',
            [req.user.userId]
        );

        logSecurityEvent('LIST_SUBMISSIONS_SUCCESS', { 
            userId: req.user.userId,
            count: submissions.length 
        }, req);

        console.log(`✅ Encontradas ${submissions.length} entregas`);
        res.json(submissions);

    } catch (error) {
        console.error('❌ Error obteniendo entregas:', error);
        logSecurityEvent('LIST_SUBMISSIONS_ERROR', { 
            error: error.message,
            userId: req.user.userId 
        }, req);

        res.status(500).json({ 
            error: 'Error al obtener entregas',
            code: 'DATABASE_ERROR'
        });
    }
});

// ✅ RUTA: Descargar archivo - MEJORADA
router.get('/download/:id', authenticateDownload, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        logSecurityEvent('DOWNLOAD_ATTEMPT', { 
            submissionId,
            userId: req.user.userId 
        }, req);

        console.log('📥 Descarga solicitada - ID:', submissionId, 'Usuario:', req.user.email);

        // ✅ MEJORA: Verificar ownership del archivo
        const submission = await dbGet(
            'SELECT * FROM submissions WHERE id = ? AND user_id = ?',
            [submissionId, req.user.userId]
        );

        if (!submission) {
            logSecurityEvent('DOWNLOAD_UNAUTHORIZED', { 
                submissionId,
                userId: req.user.userId 
            }, req);
            return res.status(404).json({ 
                error: 'Entrega no encontrada o sin permisos',
                code: 'NOT_FOUND_OR_UNAUTHORIZED'
            });
        }

        // ✅ MEJORA: Verificar que el archivo existe físicamente
        if (!fs.existsSync(submission.file_path)) {
            logSecurityEvent('DOWNLOAD_FILE_NOT_FOUND', { 
                submissionId,
                filePath: submission.file_path,
                userId: req.user.userId 
            }, req);
            return res.status(404).json({ 
                error: 'Archivo no encontrado en el servidor',
                code: 'FILE_NOT_FOUND'
            });
        }

        logSecurityEvent('DOWNLOAD_SUCCESS', { 
            submissionId,
            userId: req.user.userId,
            filename: submission.original_name 
        }, req);

        console.log('✅ Enviando archivo:', submission.original_name);
        
        // ✅ MEJORA: Headers de seguridad para descarga
        res.setHeader('Content-Disposition', `attachment; filename="${submission.original_name}"`);
        res.setHeader('Content-Type', submission.mime_type);
        res.setHeader('Content-Length', submission.file_size);
        
        res.sendFile(path.resolve(submission.file_path), (err) => {
            if (err) {
                console.error('❌ Error enviando archivo:', err);
                logSecurityEvent('DOWNLOAD_SEND_ERROR', { 
                    submissionId,
                    error: err.message,
                    userId: req.user.userId 
                }, req);
                
                if (!res.headersSent) {
                    res.status(500).json({ 
                        error: 'Error enviando archivo',
                        code: 'SEND_FILE_ERROR'
                    });
                }
            }
        });

    } catch (error) {
        console.error('❌ Error en descarga:', error);
        logSecurityEvent('DOWNLOAD_GENERAL_ERROR', { 
            submissionId: req.params.id,
            error: error.message,
            userId: req.user?.userId 
        }, req);

        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ RUTA: Eliminar entrega - MEJORADA
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        logSecurityEvent('DELETE_SUBMISSION_ATTEMPT', { 
            submissionId,
            userId: req.user.userId 
        }, req);

        console.log('🗑️ Eliminando entrega:', submissionId, 'Usuario:', req.user.email);

        // ✅ MEJORA: Verificar ownership antes de eliminar
        const submission = await dbGet(
            'SELECT * FROM submissions WHERE id = ? AND user_id = ?',
            [submissionId, req.user.userId]
        );

        if (!submission) {
            logSecurityEvent('DELETE_SUBMISSION_UNAUTHORIZED', { 
                submissionId,
                userId: req.user.userId 
            }, req);
            return res.status(404).json({ 
                error: 'Entrega no encontrada o sin permisos',
                code: 'NOT_FOUND_OR_UNAUTHORIZED'
            });
        }

        // ✅ MEJORA: Eliminar de base de datos primero
        await dbOperation(
            'DELETE FROM submissions WHERE id = ? AND user_id = ?',
            [submissionId, req.user.userId]
        );

        // ✅ MEJORA: Eliminar archivo físico con manejo de errores
        if (fs.existsSync(submission.file_path)) {
            try {
                fs.unlinkSync(submission.file_path);
                console.log('✅ Archivo físico eliminado:', submission.file_path);
            } catch (fileError) {
                console.error('⚠️ Error eliminando archivo físico:', fileError);
                // No fallar la operación si el archivo no se puede eliminar
                logSecurityEvent('DELETE_FILE_WARNING', { 
                    submissionId,
                    filePath: submission.file_path,
                    error: fileError.message,
                    userId: req.user.userId 
                }, req);
            }
        } else {
            console.warn('⚠️ Archivo físico no encontrado:', submission.file_path);
        }

        logSecurityEvent('DELETE_SUBMISSION_SUCCESS', { 
            submissionId,
            userId: req.user.userId,
            filename: submission.original_name 
        }, req);

        console.log('✅ Entrega eliminada exitosamente');
        res.json({ 
            message: 'Entrega eliminada exitosamente',
            deletedId: submissionId
        });

    } catch (error) {
        console.error('❌ Error eliminando entrega:', error);
        logSecurityEvent('DELETE_SUBMISSION_ERROR', { 
            submissionId: req.params.id,
            error: error.message,
            userId: req.user?.userId 
        }, req);

        res.status(500).json({ 
            error: 'Error al eliminar entrega',
            code: 'DATABASE_ERROR'
        });
    }
});

// ✅ RUTA: Test de email - MEJORADA
router.get('/test-email', authenticateToken, async (req, res) => {
    try {
        logSecurityEvent('EMAIL_TEST_ATTEMPT', { 
            userId: req.user.userId 
        }, req);

        console.log('📧 Probando configuración de email...');

        const emailResult = await sendNotificationEmail(
            req.user.email,
            req.user.name,
            'Test de configuración del sistema',
            req
        );

        if (emailResult.success) {
            console.log('✅ Test de email exitoso');
            res.json({
                result: { success: true },
                message: 'Email de prueba enviado exitosamente',
                messageId: emailResult.messageId
            });
        } else {
            console.log('❌ Test de email falló:', emailResult.error);
            res.status(500).json({
                result: { success: false },
                error: 'Error enviando email de prueba',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('❌ Error en test de email:', error);
        logSecurityEvent('EMAIL_TEST_ERROR', { 
            error: error.message,
            userId: req.user.userId 
        }, req);

        res.status(500).json({
            result: { success: false },
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router;