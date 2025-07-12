const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../database.db');

// Usar los middlewares de autenticación
const authenticateToken = authMiddleware.authenticateToken;
const authenticateAdmin = authMiddleware.authenticateAdmin;

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

        // Verificar que sea admin
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }

        req.user = user;
        next();
    });
}

// Obtener estadísticas del dashboard
router.get('/stats', authenticateAdmin, (req, res) => {
    console.log('📊 Solicitando estadísticas del dashboard');
    
    const db = new sqlite3.Database(dbPath);
    
    // Obtener estadísticas en paralelo
    const stats = {};
    let completed = 0;
    const totalQueries = 4;
    
    function checkComplete() {
        completed++;
        if (completed === totalQueries) {
            db.close();
            res.json(stats);
        }
    }
    
    function handleError(operation, err) {
        console.error(`Error en ${operation}:`, err);
        checkComplete();
    }
    
    // Total de estudiantes
    db.get('SELECT COUNT(*) as count FROM users WHERE role = "student"', (err, row) => {
        if (err) {
            handleError('conteo de estudiantes', err);
            stats.totalStudents = 0;
        } else {
            stats.totalStudents = row.count;
            checkComplete();
        }
    });
    
    // Total de entregas
    db.get('SELECT COUNT(*) as count FROM submissions', (err, row) => {
        if (err) {
            handleError('conteo de entregas', err);
            stats.totalSubmissions = 0;
        } else {
            stats.totalSubmissions = row.count;
            checkComplete();
        }
    });
    
    // Entregas de hoy
    const today = new Date().toISOString().split('T')[0];
    db.get(
        'SELECT COUNT(*) as count FROM submissions WHERE DATE(submitted_at) = ?',
        [today],
        (err, row) => {
            if (err) {
                handleError('entregas de hoy', err);
                stats.submissionsToday = 0;
            } else {
                stats.submissionsToday = row.count;
                checkComplete();
            }
        }
    );
    
    // Entregas de la última semana
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    db.get(
        'SELECT COUNT(*) as count FROM submissions WHERE submitted_at >= ?',
        [weekAgo.toISOString()],
        (err, row) => {
            if (err) {
                handleError('entregas de la semana', err);
                stats.submissionsWeek = 0;
            } else {
                stats.submissionsWeek = row.count;
                checkComplete();
            }
        }
    );
});

// Obtener todas las entregas con información del estudiante
router.get('/submissions', authenticateAdmin, (req, res) => {
    console.log('📋 Solicitando todas las entregas para admin');
    console.log("🔍 Query:", query);
    console.log("🔍 Params:", params);    
    const { search, date, title } = req.query;
    
    const db = new sqlite3.Database(dbPath);
    
    let query = `
        SELECT 
            s.*,
            u.name as student_name,
            u.email as student_email,
            u.ra as student_ra
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE 1=1
    `;
    
    const params = [];
    
    // Aplicar filtros
    if (search) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.ra LIKE ?)`;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
    }
    
    if (date) {
        query += ` AND DATE(s.submitted_at) = ?`;
        params.push(date);
    }
    
    if (title) {
        query += ` AND s.title LIKE ?`;
        params.push(`%${title}%`);
    }
    
    query += ` ORDER BY s.submitted_at DESC`;
    
    db.all(query, params, (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error obteniendo entregas:', err);
            return res.status(500).json({ error: 'Error al obtener entregas' });
        }
        
        console.log("🔍 Raw rows from DB:", rows);        console.log(`✅ Encontradas ${rows.length} entregas para admin`);
        res.json(rows);
    });
});

// Obtener detalles de una entrega específica
router.get('/submission/:id', authenticateAdmin, (req, res) => {
    const submissionId = req.params.id;
    console.log('🔍 Solicitando detalles de entrega:', submissionId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.get(
        `SELECT 
            s.*,
            u.name as student_name,
            u.email as student_email,
            u.ra as student_ra
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?`,
        [submissionId],
        (err, row) => {
            db.close();
            
            if (err) {
                console.error('Error obteniendo detalles de entrega:', err);
                return res.status(500).json({ error: 'Error al obtener detalles' });
            }
            
            if (!row) {
                return res.status(404).json({ error: 'Entrega no encontrada' });
            }
            
            console.log('✅ Detalles de entrega obtenidos:', row.title);
            res.json(row);
        }
    );
});

// Obtener todos los usuarios (solo admin) - AGREGADO
router.get('/users', authenticateAdmin, (req, res) => {
    console.log('👥 Admin obteniendo todos los usuarios');
    
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
        SELECT 
            id, 
            name, 
            email, 
            ra, 
            role, 
            created_at 
        FROM users 
        ORDER BY created_at DESC
    `, (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error obteniendo usuarios:', err);
            return res.status(500).json({ error: 'Error al obtener usuarios' });
        }
        
        console.log(`✅ Admin obtuvo ${rows.length} usuarios`);
        res.json(rows);
    });
});

// Descargar archivo de entrega (admin)
router.get('/download/:id', authenticateDownload, (req, res) => {
    const submissionId = req.params.id;
    console.log('📥 Descarga admin solicitada para entrega:', submissionId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.get(
        'SELECT * FROM submissions WHERE id = ?',
        [submissionId],
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
            
            if (!filePath || !fs.existsSync(filePath)) {
                console.error('Archivo no encontrado:', filePath);
                return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
            }
            
            // Obtener el nombre del archivo original o usar el filename como fallback
            const downloadName = submission.original_name || submission.filename || `submission_${submission.id}`;
            
            res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            
            res.sendFile(path.resolve(filePath), (err) => {
                if (err) {
                    console.error('Error enviando archivo:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error al descargar el archivo' });
                    }
                } else {
                    console.log('✅ Archivo descargado por admin:', downloadName);
                }
            });
        }
    );
});

// Eliminar entrega (admin)
router.delete('/submissions/:id', authenticateAdmin, (req, res) => {
    const submissionId = req.params.id;
    console.log('🗑️ Admin eliminando entrega:', submissionId);
    
    const db = new sqlite3.Database(dbPath);
    
    // Primero obtener info del archivo
    db.get('SELECT * FROM submissions WHERE id = ?', [submissionId], (err, submission) => {
        if (err) {
            db.close();
            console.error('Error obteniendo entrega:', err);
            return res.status(500).json({ error: 'Error al obtener la entrega' });
        }
        
        if (!submission) {
            db.close();
            return res.status(404).json({ error: 'Entrega no encontrada' });
        }
        
        // Eliminar de la base de datos
        db.run('DELETE FROM submissions WHERE id = ?', [submissionId], function(err) {
            db.close();
            
            if (err) {
                console.error('Error eliminando entrega:', err);
                return res.status(500).json({ error: 'Error al eliminar la entrega' });
            }
            
            // Eliminar archivo físico
            if (submission.file_path && fs.existsSync(submission.file_path)) {
                try {
                    fs.unlinkSync(submission.file_path);
                    console.log('✅ Archivo físico eliminado:', submission.file_path);
                } catch (fileErr) {
                    console.error('⚠️ Error eliminando archivo físico:', fileErr);
                    // No fallar la operación si no se puede eliminar el archivo
                }
            }
            
            console.log('✅ Admin eliminó entrega:', submission.title);
            res.json({ 
                message: 'Entrega eliminada exitosamente',
                id: submissionId,
                title: submission.title
            });
        });
    });
});

// Obtener estadísticas avanzadas - AGREGADO
router.get('/advanced-stats', authenticateAdmin, (req, res) => {
    console.log('📈 Solicitando estadísticas avanzadas');
    
    const db = new sqlite3.Database(dbPath);
    
    const stats = {};
    let completed = 0;
    const totalQueries = 3;
    
    function checkComplete() {
        completed++;
        if (completed === totalQueries) {
            db.close();
            res.json(stats);
        }
    }
    
    // Entregas por día (últimos 7 días)
    db.all(`
        SELECT 
            DATE(submitted_at) as date,
            COUNT(*) as count
        FROM submissions 
        WHERE submitted_at >= datetime('now', '-7 days')
        GROUP BY DATE(submitted_at)
        ORDER BY date DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error obteniendo entregas por día:', err);
            stats.submissionsByDay = [];
        } else {
            stats.submissionsByDay = rows;
        }
        checkComplete();
    });
    
    // Top 5 estudiantes con más entregas
    db.all(`
        SELECT 
            u.name as student_name,
            u.email as student_email,
            COUNT(s.id) as submission_count
        FROM users u
        LEFT JOIN submissions s ON u.id = s.user_id
        WHERE u.role = 'student'
        GROUP BY u.id, u.name, u.email
        ORDER BY submission_count DESC
        LIMIT 5
    `, (err, rows) => {
        if (err) {
            console.error('Error obteniendo top estudiantes:', err);
            stats.topStudents = [];
        } else {
            stats.topStudents = rows;
        }
        checkComplete();
    });
    
    // Tipos de archivo más comunes
    db.all(`
        SELECT 
            CASE 
                WHEN original_name LIKE '%.pdf' THEN 'PDF'
                WHEN original_name LIKE '%.doc%' THEN 'Word'
                WHEN original_name LIKE '%.txt' THEN 'Texto'
                WHEN original_name LIKE '%.zip' THEN 'ZIP'
                ELSE 'Otros'
            END as file_type,
            COUNT(*) as count
        FROM submissions
        GROUP BY file_type
        ORDER BY count DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error obteniendo tipos de archivo:', err);
            stats.fileTypes = [];
        } else {
            stats.fileTypes = rows;
        }
        checkComplete();
    });
});

// Exportar datos a CSV
router.get('/export', authenticateDownload, (req, res) => {
    console.log('📊 Exportando datos a CSV');
    
    const db = new sqlite3.Database(dbPath);
    
    db.all(
        `SELECT 
            s.id,
            s.title,
            s.description,
            s.original_name,
            s.file_size,
            s.submitted_at,
            u.name as student_name,
            u.email as student_email,
            u.ra as student_ra
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.submitted_at DESC`,
        (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error exportando datos:', err);
                return res.status(500).json({ error: 'Error al exportar datos' });
            }
            
            // Generar CSV con más información
            const csvHeader = 'ID,Título,Descripción,Archivo,Tamaño (MB),Fecha,Estudiante,Email,RA\n';
            const csvRows = rows.map(row => {
                const fileSize = row.file_size ? (row.file_size / 1024 / 1024).toFixed(2) : '0';
                return [
                    row.id,
                    `"${(row.title || '').replace(/"/g, '""')}"`,
                    `"${(row.description || '').replace(/"/g, '""')}"`,
                    `"${(row.original_name || '').replace(/"/g, '""')}"`,
                    fileSize,
                    `"${new Date(row.submitted_at).toLocaleString('es-ES')}"`,
                    `"${(row.student_name || '').replace(/"/g, '""')}"`,
                    `"${(row.student_email || '').replace(/"/g, '""')}"`,
                    `"${(row.student_ra || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');
            
            const csvContent = csvHeader + csvRows;
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="entregas_${new Date().toISOString().split('T')[0]}.csv"`);
            
            console.log('✅ CSV generado con', rows.length, 'registros');
            res.send(csvContent);
        }
    );
});

module.exports = router;