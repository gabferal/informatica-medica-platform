const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

// ✅ MEJORA: Configuración de base de datos
const dbPath = path.join(__dirname, '../database/database.db');

// ✅ MEJORA: Función para logging de eventos de seguridad
const logSecurityEvent = (event, details, req) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`�� [ADMIN] ${timestamp} - ${event}`, {
        ip,
        userAgent: userAgent.substring(0, 100),
        details,
        url: req.originalUrl
    });
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

// ✅ MEJORA: Función para obtener una sola fila
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

// ✅ MEJORA: Middleware de autenticación para descargas admin
function authenticateDownload(req, res, next) {
    const token = req.query.token;
    
    if (!token) {
        logSecurityEvent('ADMIN_DOWNLOAD_NO_TOKEN', { submissionId: req.params.id }, req);
        return res.status(401).json({ error: 'Token requerido para descarga' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logSecurityEvent('ADMIN_DOWNLOAD_INVALID_TOKEN', { 
                submissionId: req.params.id,
                error: err.message 
            }, req);
            return res.status(403).json({ error: 'Token inválido' });
        }

        // ✅ MEJORA: Verificar que es admin
        if (user.role !== 'admin') {
            logSecurityEvent('ADMIN_DOWNLOAD_INSUFFICIENT_PRIVILEGES', { 
                submissionId: req.params.id,
                userId: user.userId,
                role: user.role 
            }, req);
            return res.status(403).json({ error: 'Privilegios de administrador requeridos' });
        }

        logSecurityEvent('ADMIN_DOWNLOAD_TOKEN_VALID', { 
            submissionId: req.params.id,
            adminId: user.userId 
        }, req);
        
        req.user = user;
        next();
    });
}

// ✅ RUTA: Estadísticas del dashboard - MEJORADA
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_STATS_REQUEST', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('📊 Solicitando estadísticas del dashboard');

        // ✅ MEJORA: Usar Promise.all para consultas paralelas
        const [
            totalStudentsRow,
            totalSubmissionsRow,
            submissionsTodayRow,
            submissionsWeekRow
        ] = await Promise.all([
            dbGet('SELECT COUNT(*) as count FROM users WHERE role = "student"'),
            dbGet('SELECT COUNT(*) as count FROM submissions'),
            dbGet('SELECT COUNT(*) as count FROM submissions WHERE DATE(submitted_at) = ?', 
                [new Date().toISOString().split('T')[0]]),
            (() => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return dbGet('SELECT COUNT(*) as count FROM submissions WHERE submitted_at >= ?', 
                    [weekAgo.toISOString()]);
            })()
        ]);

        const stats = {
            totalStudents: totalStudentsRow ? totalStudentsRow.count : 0,
            totalSubmissions: totalSubmissionsRow ? totalSubmissionsRow.count : 0,
            submissionsToday: submissionsTodayRow ? submissionsTodayRow.count : 0,
            submissionsWeek: submissionsWeekRow ? submissionsWeekRow.count : 0,
        };

        logSecurityEvent('ADMIN_STATS_SUCCESS', { 
            adminId: req.user.userId,
            stats 
        }, req);

        console.log('📊 Estadísticas enviadas:', stats);
        res.json(stats);

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        logSecurityEvent('ADMIN_STATS_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            code: 'DATABASE_ERROR',
            details: error.message
        });
    }
});

// ✅ RUTA: Listar todas las entregas con filtros - MEJORADA
router.get('/submissions', authenticateAdmin, async (req, res) => {
    try {
        const { search, date, title } = req.query;
        
        logSecurityEvent('ADMIN_LIST_SUBMISSIONS', { 
            adminId: req.user,
                        adminId: req.user.userId,
            filters: { search, date, title }
        }, req);

        console.log('📋 Admin solicitando entregas con filtros:', { search, date, title });

        // ✅ MEJORA: Construcción dinámica de consulta con validación
        let query = `
            SELECT s.*, u.name as student_name, u.email as student_email 
            FROM submissions s 
            JOIN users u ON s.user_id = u.id 
            WHERE 1=1
        `;
        const params = [];

        // ✅ MEJORA: Validación y sanitización de filtros
        if (search && search.trim()) {
            const searchTerm = search.trim();
            if (searchTerm.length > 100) {
                return res.status(400).json({ 
                    error: 'Término de búsqueda demasiado largo',
                    code: 'SEARCH_TOO_LONG'
                });
            }
            query += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
            const searchParam = `%${searchTerm}%`;
            params.push(searchParam, searchParam);
        }

        if (date && date.trim()) {
            const dateValue = date.trim();
            // ✅ MEJORA: Validar formato de fecha
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return res.status(400).json({ 
                    error: 'Formato de fecha inválido. Use YYYY-MM-DD',
                    code: 'INVALID_DATE_FORMAT'
                });
            }
            query += ` AND DATE(s.submitted_at) = ?`;
            params.push(dateValue);
        }

        if (title && title.trim()) {
            const titleTerm = title.trim();
            if (titleTerm.length > 200) {
                return res.status(400).json({ 
                    error: 'Término de título demasiado largo',
                    code: 'TITLE_TOO_LONG'
                });
            }
            query += ` AND s.title LIKE ?`;
            params.push(`%${titleTerm}%`);
        }

        query += ` ORDER BY s.submitted_at DESC`;

        const submissions = await dbOperation(query, params);

        logSecurityEvent('ADMIN_LIST_SUBMISSIONS_SUCCESS', { 
            adminId: req.user.userId,
            count: submissions.length,
            filtersApplied: { search: !!search, date: !!date, title: !!title }
        }, req);

        console.log(`✅ Encontradas ${submissions.length} entregas`);
        res.json(submissions);

    } catch (error) {
        console.error('❌ Error obteniendo entregas:', error);
        logSecurityEvent('ADMIN_LIST_SUBMISSIONS_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al obtener entregas',
            code: 'DATABASE_ERROR'
        });
    }
});

// ✅ RUTA: Ver detalles de entrega - MEJORADA
router.get('/submissions/:id', authenticateAdmin, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        // ✅ MEJORA: Validar que el ID es numérico
        if (!/^\d+$/.test(submissionId)) {
            return res.status(400).json({ 
                error: 'ID de entrega inválido',
                code: 'INVALID_SUBMISSION_ID'
            });
        }

        logSecurityEvent('ADMIN_VIEW_SUBMISSION', { 
            adminId: req.user.userId,
            submissionId 
        }, req);

        console.log('👁️ Admin viendo detalles de entrega:', submissionId);

        const submission = await dbGet(`
            SELECT s.*, u.name as student_name, u.email as student_email, u.ra as student_ra
            FROM submissions s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
            logSecurityEvent('ADMIN_VIEW_SUBMISSION_NOT_FOUND', { 
                adminId: req.user.userId,
                submissionId 
            }, req);
            return res.status(404).json({ 
                error: 'Entrega no encontrada',
                code: 'SUBMISSION_NOT_FOUND'
            });
        }

        // ✅ MEJORA: Verificar si el archivo físico existe
        const fileExists = fs.existsSync(submission.file_path);
        submission.file_exists = fileExists;

        if (!fileExists) {
            console.warn('⚠️ Archivo físico no encontrado:', submission.file_path);
            logSecurityEvent('ADMIN_VIEW_SUBMISSION_FILE_MISSING', { 
                adminId: req.user.userId,
                submissionId,
                filePath: submission.file_path 
            }, req);
        }

        logSecurityEvent('ADMIN_VIEW_SUBMISSION_SUCCESS', { 
            adminId: req.user.userId,
            submissionId,
            studentId: submission.user_id 
        }, req);

        console.log('✅ Detalles de entrega enviados');
        res.json(submission);

    } catch (error) {
        console.error('❌ Error obteniendo detalles:', error);
        logSecurityEvent('ADMIN_VIEW_SUBMISSION_ERROR', { 
            adminId: req.user.userId,
            submissionId: req.params.id,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al obtener detalles de la entrega',
            code: 'DATABASE_ERROR'
        });
    }
});

// ✅ RUTA: Descargar archivo (admin) - MEJORADA
router.get('/download/:id', authenticateDownload, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        logSecurityEvent('ADMIN_DOWNLOAD_ATTEMPT', { 
            adminId: req.user.userId,
            submissionId 
        }, req);

        console.log('📥 Admin descargando archivo - ID:', submissionId);

        // ✅ MEJORA: Admin puede descargar cualquier archivo
        const submission = await dbGet(
            'SELECT * FROM submissions WHERE id = ?',
            [submissionId]
        );

        if (!submission) {
            logSecurityEvent('ADMIN_DOWNLOAD_NOT_FOUND', { 
                adminId: req.user.userId,
                submissionId 
            }, req);
            return res.status(404).json({ 
                error: 'Entrega no encontrada',
                code: 'SUBMISSION_NOT_FOUND'
            });
        }

        // ✅ MEJORA: Verificar que el archivo existe físicamente
        if (!fs.existsSync(submission.file_path)) {
            logSecurityEvent('ADMIN_DOWNLOAD_FILE_NOT_FOUND', { 
                adminId: req.user.userId,
                submissionId,
                filePath: submission.file_path 
            }, req);
            return res.status(404).json({ 
                error: 'Archivo no encontrado en el servidor',
                code: 'FILE_NOT_FOUND'
            });
        }

        logSecurityEvent('ADMIN_DOWNLOAD_SUCCESS', { 
            adminId: req.user.userId,
            submissionId,
            filename: submission.original_name,
            studentId: submission.user_id 
        }, req);

        console.log('✅ Enviando archivo:', submission.original_name);
        
        // ✅ MEJORA: Headers de seguridad para descarga
        res.setHeader('Content-Disposition', `attachment; filename="${submission.original_name}"`);
        res.setHeader('Content-Type', submission.mime_type);
        res.setHeader('Content-Length', submission.file_size);
        
        res.sendFile(path.resolve(submission.file_path), (err) => {
            if (err) {
                console.error('❌ Error enviando archivo:', err);
                logSecurityEvent('ADMIN_DOWNLOAD_SEND_ERROR', { 
                    adminId: req.user.userId,
                    submissionId,
                    error: err.message 
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
        console.error('❌ Error en descarga admin:', error);
        logSecurityEvent('ADMIN_DOWNLOAD_GENERAL_ERROR', { 
            adminId: req.user.userId,
            submissionId: req.params.id,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ RUTA: Eliminar entrega (admin) - MEJORADA
router.delete('/submissions/:id', authenticateAdmin, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        // ✅ MEJORA: Validar que el ID es numérico
        if (!/^\d+$/.test(submissionId)) {
            return res.status(400).json({ 
                error: 'ID de entrega inválido',
                code: 'INVALID_SUBMISSION_ID'
            });
        }

        logSecurityEvent('ADMIN_DELETE_SUBMISSION_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email,
            submissionId 
        }, req);

        console.log('🗑️ Admin eliminando entrega:', submissionId);

        // ✅ MEJORA: Obtener información de la entrega antes de eliminar
        const submission = await dbGet(
            'SELECT * FROM submissions WHERE id = ?',
            [submissionId]
        );

        if (!submission) {
            logSecurityEvent('ADMIN_DELETE_SUBMISSION_NOT_FOUND', { 
                adminId: req.user.userId,
                submissionId 
            }, req);
            return res.status(404).json({ 
                error: 'Entrega no encontrada',
                code: 'SUBMISSION_NOT_FOUND'
            });
        }

        // ✅ MEJORA: Eliminar de base de datos primero
        const deleteResult = await dbOperation(
            'DELETE FROM submissions WHERE id = ?',
            [submissionId]
        );

        if (deleteResult.changes === 0) {
            logSecurityEvent('ADMIN_DELETE_SUBMISSION_NO_CHANGES', { 
                adminId: req.user.userId,
                submissionId 
            }, req);
            return res.status(404).json({ 
                error: 'No se pudo eliminar la entrega',
                code: 'DELETE_FAILED'
            });
        }

        // ✅ MEJORA: Eliminar archivo físico con manejo de errores
        if (fs.existsSync(submission.file_path)) {
            try {
                fs.unlinkSync(submission.file_path);
                console.log('✅ Archivo físico eliminado:', submission.file_path);
            } catch (fileError) {
                console.error('⚠️ Error eliminando archivo físico:', fileError);
                logSecurityEvent('ADMIN_DELETE_FILE_WARNING', { 
                    adminId: req.user.userId,
                    submissionId,
                    filePath: submission.file_path,
                    error: fileError.message 
                }, req);
                // No fallar la operación si el archivo no se puede eliminar
            }
        } else {
            console.warn('⚠️ Archivo físico no encontrado:', submission.file_path);
            logSecurityEvent('ADMIN_DELETE_FILE_NOT_FOUND', { 
                adminId: req.user.userId,
                submissionId,
                filePath: submission.file_path 
            }, req);
        }

        logSecurityEvent('ADMIN_DELETE_SUBMISSION_SUCCESS', { 
            adminId: req.user.userId,
            submissionId,
            studentId: submission.user_id,
            filename: submission.original_name 
        }, req);

        console.log('✅ Entrega eliminada exitosamente por admin');
        res.json({ 
            message: 'Entrega eliminada exitosamente',
            deletedId: submissionId,
            studentId: submission.user_id,
            filename: submission.original_name
        });

    } catch (error) {
        console.error('❌ Error eliminando entrega (admin):', error);
        logSecurityEvent('ADMIN_DELETE_SUBMISSION_ERROR', { 
            adminId: req.user.userId,
            submissionId: req.params.id,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al eliminar entrega',
            code: 'DATABASE_ERROR'
        });
    }
});

// ✅ RUTA: Exportar entregas a CSV - MEJORADA
router.get('/export/submissions', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_EXPORT_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('📊 Admin exportando entregas a CSV');

        const submissions = await dbOperation(`
            SELECT 
                s.id,
                s.title,
                s.description,
                s.original_name,
                s.file_size,
                s.mime_type,
                s.submitted_at,
                u.name as student_name,
                u.email as student_email,
                u.ra as student_ra
            FROM submissions s 
            JOIN users u ON s.user_id = u.id 
            ORDER BY s.submitted_at DESC
        `);

        // ✅ MEJORA: Función para formatear CSV más robusta
        const formatCSVField = (field) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const formatFileSize = (bytes) => {
            if (!bytes) return '0 B';
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
        };

        const formatDate = (dateString) => {
            if (!dateString) return '';
            try {
                return new Date(dateString).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (error) {
                return dateString;
            }
        };

        // ✅ MEJORA: Headers CSV más descriptivos
        const csvHeaders = [
            'ID',
            'Título',
            'Descripción',
            'Nombre del Archivo',
            'Tamaño del Archivo',
            'Tipo de Archivo',
            'Fecha de Entrega',
            'Nombre del Estudiante',
            'Email del Estudiante',
            'RA del Estudiante'
        ];

        let csvContent = csvHeaders.map(formatCSVField).join(',') + '\n';

        submissions.forEach(submission => {
            const row = [
                submission.id,
                submission.title,
                submission.description,
                submission.original_name,
                formatFileSize(submission.file_size),
                submission.mime_type,
                formatDate(submission.submitted_at),
                submission.student_name,
                submission.student_email,
                submission.student_ra
            ];
            csvContent += row.map(formatCSVField).join(',') + '\n';
        });

        logSecurityEvent('ADMIN_EXPORT_SUCCESS', { 
            adminId: req.user.userId,
            recordCount: submissions.length 
        }, req);

        // ✅ MEJORA: Headers de respuesta más específicos
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `entregas_informatica_medica_${timestamp}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // ✅ MEJORA: BOM para UTF-8 (mejor compatibilidad con Excel)
        res.write('\uFEFF');
        res.write(csvContent);
        res.end();

        console.log(`✅ CSV exportado con ${submissions.length} registros`);

    } catch (error) {
        console.error('❌ Error exportando CSV:', error);
        logSecurityEvent('ADMIN_EXPORT_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al exportar datos',
            code: 'EXPORT_ERROR'
        });
    }
});

// ✅ NUEVA RUTA: Estadísticas avanzadas - AGREGADA
router.get('/advanced-stats', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_ADVANCED_STATS_REQUEST', { 
            adminId: req.user.userId 
        }, req);

        console.log('📈 Solicitando estadísticas avanzadas');

        const [
            submissionsByDay,
            submissionsByType,
            topStudents,
            averageFileSize
        ] = await Promise.all([
            // Entregas por día (últimos 30 días)
            dbOperation(`
                SELECT DATE(submitted_at) as date, COUNT(*) as count 
                FROM submissions 
                WHERE submitted_at >= date('now', '-30 days')
                GROUP BY DATE(submitted_at) 
                ORDER BY date DESC
            `),
            // Entregas por tipo de archivo
            dbOperation(`
                SELECT mime_type, COUNT(*) as count 
                FROM submissions 
                GROUP BY mime_type 
                ORDER BY count DESC
            `),
            // Estudiantes más activos
            dbOperation(`
                SELECT u.name, u.email, COUNT(s.id) as submission_count 
                FROM users u 
                LEFT JOIN submissions s ON u.id = s.user_id 
                WHERE u.role = 'student' 
                GROUP BY u.id, u.name, u.email 
                ORDER BY submission_count DESC 
                LIMIT 10
            `),
            // Tamaño promedio de archivo
            dbGet(`
                SELECT 
                    AVG(file_size) as avg_size,
                    MIN(file_size) as min_size,
                    MAX(file_size) as max_size,
                    SUM(file_size) as total_size
                FROM submissions
            `)
        ]);

        const advancedStats = {
            submissionsByDay,
            submissionsByType,
            topStudents,
            fileSizeStats: averageFileSize || {
                avg_size: 0,
                min_size: 0,
                max_size: 0,
                total_size: 0
            }
        };

        logSecurityEvent('ADMIN_ADVANCED_STATS_SUCCESS', { 
            adminId: req.user.userId 
        }, req);

        console.log('📈 Estadísticas avanzadas enviadas');
        res.json(advancedStats);

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas avanzadas:', error);
        logSecurityEvent('ADMIN_ADVANCED_STATS_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);

        res.status(500).json({ 
            error: 'Error al obtener estadísticas avanzadas',
            code: 'DATABASE_ERROR'
        });
    }
});

module.exports = router;
