const jwt = require('jsonwebtoken');

// ✅ MEJORA: Configuración segura desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ✅ MEJORA: Validación crítica de configuración
if (!JWT_SECRET) {
    console.error('❌ CRÍTICO: JWT_SECRET no está definido en variables de entorno');
    if (NODE_ENV === 'production') {
        console.error('🚨 APLICACIÓN NO PUEDE INICIAR EN PRODUCCIÓN SIN JWT_SECRET');
        process.exit(1);
    }
    console.warn('⚠️ Usando configuración insegura para desarrollo');
}

// ✅ MEJORA: Función para logging de eventos de seguridad
const logSecurityEvent = (event, details, req) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const method = req.method;
    const url = req.originalUrl;
    
    console.log(`🔒 [MIDDLEWARE] ${timestamp} - ${event}`, {
        ip,
        method,
        url,
        userAgent: userAgent.substring(0, 100),
        details
    });
};

// ✅ MEJORA: Validación robusta del payload del token
const validateTokenPayload = (payload) => {
    const requiredFields = ['userId', 'email', 'role'];
    const errors = [];
    
    for (const field of requiredFields) {
        if (!payload[field]) {
            errors.push(`Campo requerido faltante: ${field}`);
        }
    }
    
    // Validar tipos de datos
    if (payload.userId && typeof payload.userId !== 'number') {
        errors.push('userId debe ser un número');
    }
    
    if (payload.email && typeof payload.email !== 'string') {
        errors.push('email debe ser una cadena');
    }
    
    if (payload.role && typeof payload.role !== 'string') {
        errors.push('role debe ser una cadena');
    }
    
    // Validar roles válidos
    const validRoles = ['admin', 'student'];
    if (payload.role && !validRoles.includes(payload.role)) {
        errors.push(`Rol inválido: ${payload.role}`);
    }
    
    return errors;
};

// ✅ MEJORA: Función principal de autenticación mejorada
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        
        // ✅ MEJORA: Validación más robusta del header
        if (!authHeader) {
            logSecurityEvent('AUTH_NO_HEADER', {}, req);
            return res.status(401).json({ 
                error: 'Token de acceso requerido',
                code: 'NO_AUTH_HEADER'
            });
        }
        
        if (!authHeader.startsWith('Bearer ')) {
            logSecurityEvent('AUTH_INVALID_FORMAT', { authHeader: authHeader.substring(0, 20) }, req);
            return res.status(401).json({ 
                error: 'Formato de autorización inválido. Use: Bearer <token>',
                code: 'INVALID_AUTH_FORMAT'
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        if (!token || token.trim() === '') {
            logSecurityEvent('AUTH_EMPTY_TOKEN', {}, req);
            return res.status(401).json({ 
                error: 'Token vacío',
                code: 'EMPTY_TOKEN'
            });
        }

        // ✅ MEJORA: Verificación JWT con manejo detallado de errores
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                let errorMessage = 'Token inválido';
                let errorCode = 'INVALID_TOKEN';
                let logEvent = 'AUTH_TOKEN_INVALID';
                
                // ✅ MEJORA: Manejo específico de diferentes tipos de errores JWT
                switch (err.name) {
                    case 'TokenExpiredError':
                        errorMessage = 'Token expirado';
                        errorCode = 'TOKEN_EXPIRED';
                        logEvent = 'AUTH_TOKEN_EXPIRED';
                        break;
                    case 'JsonWebTokenError':
                        errorMessage = 'Token malformado';
                        errorCode = 'MALFORMED_TOKEN';
                        logEvent = 'AUTH_TOKEN_MALFORMED';
                        break;
                    case 'NotBeforeError':
                        errorMessage = 'Token no válido aún';
                        errorCode = 'TOKEN_NOT_ACTIVE';
                        logEvent = 'AUTH_TOKEN_NOT_ACTIVE';
                        break;
                    default:
                        logEvent = 'AUTH_TOKEN_ERROR';
                }
                
                logSecurityEvent(logEvent, { 
                    error: err.message,
                    tokenLength: token.length 
                }, req);
                
                return res.status(403).json({ 
                    error: errorMessage,
                    code: errorCode
                });
            }

            // ✅ MEJORA: Validar estructura del payload
            const validationErrors = validateTokenPayload(decoded);
            if (validationErrors.length > 0) {
                logSecurityEvent('AUTH_INVALID_PAYLOAD', { 
                    errors: validationErrors,
                    userId: decoded.userId 
                }, req);
                
                return res.status(403).json({ 
                    error: 'Token con estructura inválida',
                    code: 'INVALID_TOKEN_PAYLOAD',
                    details: validationErrors
                });
            }

            // ✅ MEJORA: Verificar que el token no esté próximo a expirar (opcional)
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - now;
            
            if (timeUntilExpiry < 300) { // Menos de 5 minutos
                console.warn(`⚠️ Token próximo a expirar para usuario ${decoded.email}: ${timeUntilExpiry}s restantes`);
                // Agregar header para que el frontend sepa que debe renovar
                res.set('X-Token-Expiry-Warning', 'true');
                res.set('X-Token-Expires-In', timeUntilExpiry.toString());
            }

            logSecurityEvent('AUTH_SUCCESS', { 
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                expiresIn: timeUntilExpiry
            }, req);

            // ✅ MEJORA: Agregar información adicional al objeto user
            req.user = {
                ...decoded,
                tokenExpiresIn: timeUntilExpiry,
                tokenIssuedAt: new Date(decoded.iat * 1000).toISOString(),
                tokenExpiresAt: new Date(decoded.exp * 1000).toISOString()
            };
            
            next();
        });
        
    } catch (error) {
        console.error('❌ Error general en autenticación:', error.message);
        logSecurityEvent('AUTH_GENERAL_ERROR', { error: error.message }, req);
        
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
}

// ✅ MEJORA: Middleware de autenticación admin mejorado
function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, (err) => {
        if (err) return; // El error ya fue manejado por authenticateToken
        
        try {
            // ✅ MEJORA: Verificación más robusta del rol admin
            if (!req.user || !req.user.role) {
                logSecurityEvent('ADMIN_AUTH_NO_ROLE', { 
                    userId: req.user?.userId,
                    email: req.user?.email 
                }, req);
                
                return res.status(403).json({ 
                    error: 'Información de rol no disponible',
                    code: 'NO_ROLE_INFO'
                });
            }
            
            if (req.user.role !== 'admin') {
                logSecurityEvent('ADMIN_AUTH_DENIED', { 
                    userId: req.user.userId,
                    email: req.user.email,
                    role: req.user.role,
                    attemptedResource: req.originalUrl
                }, req);
                
                return res.status(403).json({ 
                    error: 'Acceso denegado. Se requieren privilegios de administrador.',
                    code: 'INSUFFICIENT_PRIVILEGES',
                    requiredRole: 'admin',
                    currentRole: req.user.role
                });
            }
            
            logSecurityEvent('ADMIN_AUTH_SUCCESS', { 
                userId: req.user.userId,
                email: req.user.email,
                resource: req.originalUrl
            }, req);
            
            next();
            
        } catch (error) {
            console.error('❌ Error en autenticación admin:', error.message);
            logSecurityEvent('ADMIN_AUTH_ERROR', { error: error.message }, req);
            
            return res.status(500).json({ 
                error: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    });
}

// ✅ NUEVA FUNCIÓN: Middleware para verificar roles específicos
function requireRole(allowedRoles) {
    return (req, res, next) => {
        authenticateToken(req, res, (err) => {
            if (err) return;
            
            try {
                if (!req.user || !req.user.role) {
                    logSecurityEvent('ROLE_CHECK_NO_ROLE', { 
                        userId: req.user?.userId,
                        requiredRoles: allowedRoles 
                    }, req);
                    
                    return res.status(403).json({ 
                        error: 'Información de rol no disponible',
                        code: 'NO_ROLE_INFO'
                    });
                }
                
                if (!allowedRoles.includes(req.user.role)) {
                    logSecurityEvent('ROLE_CHECK_DENIED', { 
                        userId: req.user.userId,
                        email: req.user.email,
                        currentRole: req.user.role,
                        requiredRoles: allowedRoles,
                        resource: req.originalUrl
                    }, req);
                    
                    return res.status(403).json({ 
                        error: 'Acceso denegado. Rol insuficiente.',
                        code: 'INSUFFICIENT_ROLE',
                        requiredRoles: allowedRoles,
                        currentRole: req.user.role
                    });
                }
                
                logSecurityEvent('ROLE_CHECK_SUCCESS', { 
                    userId: req.user.userId,
                    email: req.user.email,
                    role: req.user.role,
                    resource: req.originalUrl
                }, req);
                
                next();
                
            } catch (error) {
                console.error('❌ Error en verificación de rol:', error.message);
                logSecurityEvent('ROLE_CHECK_ERROR', { error: error.message }, req);
                
                return res.status(500).json({ 
                    error: 'Error interno del servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        });
    };
}

// ✅ NUEVA FUNCIÓN: Middleware opcional (no falla si no hay token)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No hay token, continuar sin autenticación
        req.user = null;
        return next();
    }
    
    // Hay token, intentar autenticar
    authenticateToken(req, res, next);
}

// ✅ NUEVA FUNCIÓN: Middleware para verificar ownership de recursos
function requireOwnership(getResourceUserId) {
    return async (req, res, next) => {
        authenticateToken(req, res, async (err) => {
            if (err) return;
            
            try {
                // Si es admin, permitir acceso
                if (req.user.role === 'admin') {
                    return next();
                }
                
                // Obtener el ID del usuario propietario del recurso
                const resourceUserId = await getResourceUserId(req);
                
                if (resourceUserId !== req.user.userId) {
                    logSecurityEvent('OWNERSHIP_CHECK_DENIED', { 
                        userId: req.user.userId,
                        email: req.user.email,
                        resourceUserId: resourceUserId,
                        resource: req.originalUrl
                    }, req);
                    
                    return res.status(403).json({ 
                        error: 'Acceso denegado. Solo puedes acceder a tus propios recursos.',
                        code: 'RESOURCE_ACCESS_DENIED'
                    });
                }
                
                logSecurityEvent('OWNERSHIP_CHECK_SUCCESS', { 
                    userId: req.user.userId,
                    email: req.user.email,
                    resource: req.originalUrl
                }, req);
                
                next();
                
            } catch (error) {
                console.error('❌ Error en verificación de ownership:', error.message);
                logSecurityEvent('OWNERSHIP_CHECK_ERROR', { error: error.message }, req);
                
                return res.status(500).json({ 
                    error: 'Error interno del servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        });
    };
}

// Alias para compatibilidad
const requireAdmin = authenticateAdmin;

module.exports = {
    authenticateToken,
    authenticateAdmin,
    requireAdmin,
    requireRole,
    optionalAuth,
    requireOwnership
};