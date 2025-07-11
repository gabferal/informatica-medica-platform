const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'Guepardo.25', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }

        req.user = user;
        next();
    });
}

function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, (err) => {
        if (err) return;
        
        // Verificar que el usuario tenga rol de admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Acceso denegado. Se requieren privilegios de administrador.' 
            });
        }
        
        next();
    });
}

module.exports = {
    authenticateToken,
    authenticateAdmin
};