const jwt = require('jsonwebtoken');

// ✅ CORREGIDO: Usar la misma clave que en routes/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'informatica_medica_secret_key_2024';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Error verificando token:', err.message);
            return res.status(403).json({ error: 'Token inválido' });
        }

        console.log('✅ Token válido para usuario:', user.email, 'Role:', user.role);
        req.user = user;
        next();
    });
}

function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, (err) => {
        if (err) return;
        
        // Verificar que el usuario tenga rol de admin
        if (req.user.role !== 'admin') {
            console.log('⚠️ Acceso denegado - Usuario no es admin:', req.user.email, 'Role:', req.user.role);
            return res.status(403).json({ 
                error: 'Acceso denegado. Se requieren privilegios de administrador.' 
            });
        }
        
        console.log('✅ Admin autenticado:', req.user.email);
        next();
    });
}

// Alias para compatibilidad
const requireAdmin = authenticateAdmin;

module.exports = {
    authenticateToken,
    authenticateAdmin,
    requireAdmin
};