const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

// ✅ CORRECCIÓN: Configuración correcta de base de datos
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/app/backend/database/database.db'
    : path.join(__dirname, '..', 'database', 'database.db');    

console.log('🔧 Ruta de BD configurada:', dbPath);

// ✅ MEJORA: Función para logging de eventos de seguridad
const logSecurityEvent = (event, details, req) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`🔒 [ADMIN] ${timestamp} - ${event}`, {
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

// ✅ RUTA: Listar todas las entregas con filtros - MEJORADA Y CORREGIDA
router.get('/submissions', authenticateAdmin, async (req, res) => {
    try {
        const { search, date, title } = req.query;
        
        logSecurityEvent('ADMIN_LIST_SUBMISSIONS', { 
            adminId: req.user.userId,
            filters: { search, date, title }
        }, req);

        console.log('📋 Admin solicitando entregas con filtros:', { search, date, title });

        // ✅ MEJORA: Construcción dinámica de consulta con validación
        // ✅ CORRECCIÓN: Usar original_filename con alias as original_name
        let query = `
            SELECT s.*, s.original_filename as original_name, u.name as student_name, u.email as student_email 
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

// ✅ RUTA: Ver detalles de entrega - MEJORADA Y CORREGIDA
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

        // ✅ CORRECCIÓN: Usar original_filename con alias as original_name
        const submission = await dbGet(`
            SELECT s.*, s.original_filename as original_name, u.name as student_name, u.email as student_email, u.ra as student_ra
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
            filename: submission.original_filename,
            studentId: submission.user_id 
        }, req);

        console.log('✅ Enviando archivo:', submission.original_filename);
        
        // ✅ MEJORA: Headers de seguridad para descarga
        res.setHeader('Content-Disposition', `attachment; filename="${submission.original_filename}"`);
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
            filename: submission.original_filename 
        }, req);

        console.log('✅ Entrega eliminada exitosamente por admin');
        res.json({ 
            message: 'Entrega eliminada exitosamente',
            deletedId: submissionId,
            studentId: submission.user_id,
            filename: submission.original_filename
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

// ✅ RUTA: Exportar entregas a CSV - MEJORADA Y CORREGIDA
router.get('/export/submissions', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_EXPORT_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('📊 Admin exportando entregas a CSV');

        // ✅ CORRECCIÓN: Usar original_filename con alias as original_name
        const submissions = await dbOperation(`
            SELECT 
                s.id,
                s.title,
                s.description,
                s.original_filename as original_name,
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

// ✅ NUEVO: Endpoint de verificación completa de estructura
router.post('/check-database-structure', authenticateAdmin, async (req, res) => {
    try {
        console.log('🔍 Verificando estructura completa de la base de datos...');
        logSecurityEvent('ADMIN_CHECK_DB_STRUCTURE', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        const db = new sqlite3.Database(dbPath);
        
        // Obtener estructura completa
        const tableInfo = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns);
            });
        });
        
        // Obtener algunos registros de ejemplo
        const sampleData = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM submissions LIMIT 3", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Contar total de registros
        const totalCount = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM submissions", (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        db.close();
        
        const columnNames = tableInfo.map(col => col.name);
        const requiredColumns = ['mime_type', 'file_size', 'file_path', 'original_filename'];
        const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
        
        console.log('📊 Estructura verificada:', {
            totalColumns: columnNames.length,
            columnNames,
            missingColumns,
            totalRecords: totalCount
        });
        
        logSecurityEvent('ADMIN_CHECK_DB_STRUCTURE_SUCCESS', { 
            adminId: req.user.userId,
            columnCount: columnNames.length,
            missingColumns
        }, req);
        
        res.json({
            success: true,
            structure: {
                columns: tableInfo,
                columnNames,
                missingColumns,
                totalRecords: totalCount,
                sampleData: sampleData.map(row => Object.keys(row))
            }
        });
        
    } catch (error) {
        console.error('❌ Error verificando estructura:', error);
        logSecurityEvent('ADMIN_CHECK_DB_STRUCTURE_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ NUEVO: Endpoint de migración forzada completa
router.post('/force-complete-migration', authenticateAdmin, async (req, res) => {
    try {
        console.log('🚀 Ejecutando migración forzada completa...');
        logSecurityEvent('ADMIN_FORCE_MIGRATION_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        const db = new sqlite3.Database(dbPath);
        
        const results = [];
        
        // Lista de todas las columnas necesarias
        const migrations = [
            {
                name: 'mime_type',
                sql: "ALTER TABLE submissions ADD COLUMN mime_type TEXT DEFAULT 'application/octet-stream'",
                update: `UPDATE submissions SET mime_type = CASE 
                    WHEN filename LIKE '%.pdf' THEN 'application/pdf'
                    WHEN filename LIKE '%.doc' THEN 'application/msword'
                    WHEN filename LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    WHEN filename LIKE '%.txt' THEN 'text/plain'
                    WHEN filename LIKE '%.zip' THEN 'application/zip'
                    WHEN filename LIKE '%.png' THEN 'image/png'
                    WHEN filename LIKE '%.jpg' OR filename LIKE '%.jpeg' THEN 'image/jpeg'
                    ELSE 'application/octet-stream'
                END WHERE mime_type IS NULL OR mime_type = '' OR mime_type = 'application/octet-stream'`
            },
            {
                name: 'file_size',
                sql: "ALTER TABLE submissions ADD COLUMN file_size INTEGER DEFAULT 0",
                update: "UPDATE submissions SET file_size = 0 WHERE file_size IS NULL"
            },
            {
                name: 'file_path',
                sql: "ALTER TABLE submissions ADD COLUMN file_path TEXT",
                update: "UPDATE submissions SET file_path = 'uploads/' || filename WHERE file_path IS NULL OR file_path = ''"
            },
            {
                name: 'original_filename',
                sql: "ALTER TABLE submissions ADD COLUMN original_filename TEXT",
                update: "UPDATE submissions SET original_filename = filename WHERE original_filename IS NULL OR original_filename = ''"
            }
        ];
        
        // Obtener columnas actuales
        const currentColumns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
                console.log('📋 Columnas actuales:', currentColumns);
        
        // Ejecutar cada migración
        for (const migration of migrations) {
            try {
                if (!currentColumns.includes(migration.name)) {
                    console.log(`➕ Agregando columna: ${migration.name}`);
                    
                    // Agregar columna
                    await new Promise((resolve, reject) => {
                        db.run(migration.sql, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    // Actualizar datos
                    const updateResult = await new Promise((resolve, reject) => {
                        db.run(migration.update, function(err) {
                            if (err) reject(err);
                            else resolve({ changes: this.changes });
                        });
                    });
                    
                    results.push({
                        column: migration.name,
                        status: 'added',
                        updatedRecords: updateResult.changes
                    });
                    
                    console.log(`✅ ${migration.name} agregada, ${updateResult.changes} registros actualizados`);
                } else {
                    console.log(`⏭️ ${migration.name} ya existe`);
                    results.push({
                        column: migration.name,
                        status: 'exists'
                    });
                }
            } catch (error) {
                console.error(`❌ Error con ${migration.name}:`, error.message);
                results.push({
                    column: migration.name,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        // Verificar estructura final
        const finalColumns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        db.close();
        
        console.log('🎉 Migración forzada completada');
        console.log('📊 Columnas finales:', finalColumns);
        
        logSecurityEvent('ADMIN_FORCE_MIGRATION_SUCCESS', { 
            adminId: req.user.userId,
            results,
            finalColumns
        }, req);
        
        res.json({
            success: true,
            message: 'Migración forzada completada',
            results,
            finalColumns
        });
        
    } catch (error) {
        console.error('❌ Error en migración forzada:', error);
        logSecurityEvent('ADMIN_FORCE_MIGRATION_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ ENDPOINT: Agregar columna mime_type (mejorado)
router.post('/fix-mime-type-column', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_FIX_MIME_TYPE_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('🔧 Verificando/agregando columna mime_type...');
        const db = new sqlite3.Database(dbPath);
        
        // Verificar si ya existe
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        console.log('📋 Columnas actuales:', columns);
        
        if (columns.includes('mime_type')) {
            db.close();
            return res.json({ success: true, message: 'Columna mime_type ya existe', currentColumns: columns });
        }
        
        // Agregar columna
        await new Promise((resolve, reject) => {
            console.log('➕ Ejecutando: ALTER TABLE submissions ADD COLUMN mime_type TEXT DEFAULT \'application/octet-stream\'');
            db.run("ALTER TABLE submissions ADD COLUMN mime_type TEXT DEFAULT 'application/octet-stream'", (err) => {
                if (err) {
                    console.error('❌ Error agregando mime_type:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Columna mime_type agregada');
                    resolve();
                }
            });
        });
        
        // Actualizar registros existentes con tipos MIME apropiados
        const updateResult = await new Promise((resolve, reject) => {
            console.log('🔄 Actualizando tipos MIME...');
            const updateQuery = `
                UPDATE submissions 
                SET mime_type = CASE 
                    WHEN filename LIKE '%.pdf' THEN 'application/pdf'
                    WHEN filename LIKE '%.doc' THEN 'application/msword'
                    WHEN filename LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    WHEN filename LIKE '%.txt' THEN 'text/plain'
                    WHEN filename LIKE '%.zip' THEN 'application/zip'
                    WHEN filename LIKE '%.png' THEN 'image/png'
                    WHEN filename LIKE '%.jpg' OR filename LIKE '%.jpeg' THEN 'image/jpeg'
                    ELSE 'application/octet-stream'
                END
                WHERE mime_type IS NULL OR mime_type = '' OR mime_type = 'application/octet-stream'
            `;
            
            db.run(updateQuery, function(err) {
                if (err) {
                    console.error('❌ Error actualizando tipos MIME:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ ${this.changes} registros actualizados con tipos MIME`);
                    resolve({ changes: this.changes });
                }
            });
        });
        
        db.close();
        
        logSecurityEvent('ADMIN_FIX_MIME_TYPE_SUCCESS', { 
            adminId: req.user.userId,
            updateResult 
        }, req);
        
        res.json({ 
            success: true, 
            message: 'Columna mime_type agregada y actualizada exitosamente', 
            updatedRecords: updateResult.changes 
        });
        
    } catch (error) {
        console.error('❌ Error con mime_type:', error);
        logSecurityEvent('ADMIN_FIX_MIME_TYPE_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ ENDPOINTS ESPECÍFICOS para columnas faltantes
router.post('/add-file-path-column', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_ADD_FILE_PATH_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('🔧 Agregando columna file_path...');
        const db = new sqlite3.Database(dbPath);
        
        // Verificar si ya existe
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        console.log('📋 Columnas actuales:', columns);
        
        if (columns.includes('file_path')) {
            db.close();
            return res.json({ success: true, message: 'Columna file_path ya existe', currentColumns: columns });
        }
        
        // Agregar columna
        await new Promise((resolve, reject) => {
            console.log('➕ Ejecutando: ALTER TABLE submissions ADD COLUMN file_path TEXT');
            db.run("ALTER TABLE submissions ADD COLUMN file_path TEXT", (err) => {
                if (err) {
                    console.error('❌ Error agregando file_path:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Columna file_path agregada');
                    resolve();
                }
            });
        });
        
        // Actualizar registros existentes
        const updateResult = await new Promise((resolve, reject) => {
            console.log('🔄 Actualizando registros existentes...');
            db.run("UPDATE submissions SET file_path = 'uploads/' || filename WHERE file_path IS NULL OR file_path = ''", function(err) {
                if (err) {
                    console.error('❌ Error actualizando registros:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ ${this.changes} registros actualizados`);
                    resolve({ changes: this.changes });
                }
            });
        });
        
        db.close();
        
        logSecurityEvent('ADMIN_ADD_FILE_PATH_SUCCESS', { 
            adminId: req.user.userId,
            updateResult 
        }, req);
        
        res.json({ 
            success: true, 
            message: 'Columna file_path agregada exitosamente', 
            updatedRecords: updateResult.changes 
        });
        
    } catch (error) {
        console.error('❌ Error agregando file_path:', error);
        logSecurityEvent('ADMIN_ADD_FILE_PATH_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/add-original-filename-column', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_ADD_ORIGINAL_FILENAME_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('🔧 Agregando columna original_filename...');
        const db = new sqlite3.Database(dbPath);
        
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        console.log('📋 Columnas actuales:', columns);
        
        if (columns.includes('original_filename')) {
            db.close();
            return res.json({ success: true, message: 'Columna original_filename ya existe', currentColumns: columns });
        }
        
        await new Promise((resolve, reject) => {
            console.log('➕ Ejecutando: ALTER TABLE submissions ADD COLUMN original_filename TEXT');
            db.run("ALTER TABLE submissions ADD COLUMN original_filename TEXT", (err) => {
                if (err) {
                    console.error('❌ Error agregando original_filename:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Columna original_filename agregada');
                    resolve();
                }
            });
        });
        
        const updateResult = await new Promise((resolve, reject) => {
            console.log('🔄 Actualizando registros existentes...');
            db.run("UPDATE submissions SET original_filename = filename WHERE original_filename IS NULL OR original_filename = ''", function(err) {
                if (err) {
                    console.error('❌ Error actualizando registros:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ ${this.changes} registros actualizados`);
                    resolve({ changes: this.changes });
                }
            });
        });
        
        db.close();
        
        logSecurityEvent('ADMIN_ADD_ORIGINAL_FILENAME_SUCCESS', { 
            adminId: req.user.userId,
            updateResult 
        }, req);
        
        res.json({ 
            success: true, 
            message: 'Columna original_filename agregada exitosamente', 
            updatedRecords: updateResult.changes 
        });
        
    } catch (error) {
        console.error('❌ Error agregando original_filename:', error);
        logSecurityEvent('ADMIN_ADD_ORIGINAL_FILENAME_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/add-file-size-column', authenticateAdmin, async (req, res) => {
    try {
        logSecurityEvent('ADMIN_ADD_FILE_SIZE_ATTEMPT', { 
            adminId: req.user.userId,
            adminEmail: req.user.email 
        }, req);

        console.log('🔧 Verificando/agregando columna file_size...');
        const db = new sqlite3.Database(dbPath);
        
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(submissions)", (err, columns) => {
                if (err) reject(err);
                else resolve(columns.map(col => col.name));
            });
        });
        
        console.log('📋 Columnas actuales:', columns);
        
        if (columns.includes('file_size')) {
            db.close();
            return res.json({ success: true, message: 'Columna file_size ya existe', currentColumns: columns });
        }
        
        await new Promise((resolve, reject) => {
            console.log('➕ Ejecutando: ALTER TABLE submissions ADD COLUMN file_size INTEGER DEFAULT 0');
            db.run("ALTER TABLE submissions ADD COLUMN file_size INTEGER DEFAULT 0", (err) => {
                if (err) {
                    console.error('❌ Error agregando file_size:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Columna file_size agregada');
                    resolve();
                }
            });
        });
        
        // Para file_size, establecer un valor por defecto
        const updateResult = await new Promise((resolve, reject) => {
            console.log('🔄 Estableciendo file_size por defecto...');
            db.run("UPDATE submissions SET file_size = 0 WHERE file_size IS NULL", function(err) {
                if (err) {
                    console.error('❌ Error actualizando file_size:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ ${this.changes} registros actualizados con file_size = 0`);
                    resolve({ changes: this.changes });
                }
            });
        });
        
        db.close();
        
        logSecurityEvent('ADMIN_ADD_FILE_SIZE_SUCCESS', { 
            adminId: req.user.userId,
            updateResult 
        }, req);
        
        res.json({ 
            success: true, 
            message: 'Columna file_size agregada exitosamente', 
            updatedRecords: updateResult.changes 
        });
        
    } catch (error) {
        console.error('❌ Error agregando file_size:', error);
        logSecurityEvent('ADMIN_ADD_FILE_SIZE_ERROR', { 
            adminId: req.user.userId,
            error: error.message 
        }, req);
        
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;