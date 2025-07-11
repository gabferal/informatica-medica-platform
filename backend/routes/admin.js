const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../database/database.db');

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

    jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta_aqui', (err, user) => {
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
    
    // Total de estudiantes
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
            console.error('Error obteniendo total de estudiantes:', err);
            stats.totalStudents = 0;
        } else {
            stats.totalStudents = row.count;
        }
        checkComplete();
    });
    
    // Total de entregas
    db.get('SELECT COUNT(*) as count FROM submissions', (err, row) => {
        if (err) {
            console.error('Error obteniendo total de entregas:', err);
            stats.totalSubmissions = 0;
        } else {
            stats.totalSubmissions = row.count;
        }
        checkComplete();
    });
    
    // Entregas de hoy
    const today = new Date().toISOString().split('T')[0];
    db.get(
        'SELECT COUNT(*) as count FROM submissions WHERE DATE(submitted_at) = ?',
        [today],
        (err, row) => {
            if (err) {
                console.error('Error obteniendo entregas de hoy:', err);
                stats.submissionsToday = 0;
            } else {
                stats.submissionsToday = row.count;
            }
            checkComplete();
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
                console.error('Error obteniendo entregas de la semana:', err);
                stats.submissionsWeek = 0;
            } else {
                stats.submissionsWeek = row.count;
            }
            checkComplete();
        }
    );
});

// Obtener todas las entregas con información del estudiante
router.get('/submissions', authenticateAdmin, (req, res) => {
    console.log('📋 Solicitando todas las entregas para admin');
    
    const { search, date, title } = req.query;
    
    const db = new sqlite3.Database(dbPath);
    
    let query = `
        SELECT 
            s.*,
            u.nombre as student_name,
            u.email as student_email,
            u.ra as student_ra
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE 1=1
    `;
    
    const params = [];
    
    // Aplicar filtros
    if (search) {
        query += ` AND (u.nombre LIKE ? OR u.email LIKE ? OR u.ra LIKE ?)`;
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
        
        console.log(`✅ Encontradas ${rows.length} entregas para admin`);
        res.json(rows);
    });
});

// Obtener detalles de una entrega específica
router.get('/submission/:id', authenticateAdmin, (req, res) => {
    const submissionId = req.params.id;
    console.log('�� Solicitando detalles de entrega:', submissionId);
    
    const db = new sqlite3.Database(dbPath);
    
    db.get(
        `SELECT 
            s.*,
            u.nombre as student_name,
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
                    console.log('✅ Archivo descargado por admin:', submission.original_name);
                }
            });
        }
    );
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
            s.submitted_at,
            u.nombre as student_name,
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
            
            // Generar CSV
            const csvHeader = 'ID,Título,Descripción,Archivo,Fecha,Estudiante,Email,RA\n';
            const csvRows = rows.map(row => {
                return [
                    row.id,
                    `"${row.title || ''}"`,
                    `"${row.description || ''}"`,
                    `"${row.original_name || ''}"`,
                    `"${new Date(row.submitted_at).toLocaleString('es-ES')}"`,
                    `"${row.student_name || ''}"`,
                    `"${row.student_email || ''}"`,
                    `"${row.student_ra || ''}"`
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