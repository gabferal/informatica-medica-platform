const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Intentar cargar la base de datos
let db;
try {
    db = require('../database/init');
} catch (error) {
    console.error('❌ Error cargando base de datos en auth.js:', error);
}

// ✅ Configuración desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ✅ Validación estricta de configuración crítica
if (!JWT_SECRET) {
    console.error('❌ CRÍTICO: JWT_SECRET no está definido en variables de entorno');
    console.log('💡 Verifica tu archivo .env y asegúrate de que JWT_SECRET esté configurado');
}

// ✅ Rate limiting configurado para Railway
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    message: {
        error: 'Demasiados intentos de autenticación. Intenta en 15 minutos.',
        retryAfter: Math.floor((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: NODE_ENV === 'production' ? 1 : true,
    skip: (req) => {
        return NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1');
    },
    onLimitReached: (req) => {
        console.warn(`⚠️ Rate limit alcanzado para IP: ${req.ip} en ruta de autenticación`);
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3,
    message: {
        error: 'Demasiados registros desde esta IP. Intenta en 1 hora.',
        retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: NODE_ENV === 'production' ? 1 : true,
    skip: (req) => {
        return NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1');
    },
    onLimitReached: (req) => {
        console.warn(`⚠️ Rate limit de registro alcanzado para IP: ${req.ip}`);
    }
});

// ✅ Función de validación robusta
const validateRegistrationData = (data) => {
    const { name, email, ra, password } = data;
    const errors = [];

    // Validar nombre
    if (!name || typeof name !== 'string') {
        errors.push('Nombre es obligatorio');
    } else {
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            errors.push('Nombre debe tener al menos 2 caracteres');
        }
        if (trimmedName.length > 100) {
            errors.push('Nombre no puede exceder 100 caracteres');
        }
        if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/.test(trimmedName)) {
            errors.push('Nombre solo puede contener letras, espacios, apostrofes y guiones');
        }
    }

    // Validar email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || typeof email !== 'string') {
        errors.push('Email es obligatorio');
    } else {
        const trimmedEmail = email.trim().toLowerCase();
        if (!emailRegex.test(trimmedEmail)) {
            errors.push('Formato de email inválido');
        }
        if (trimmedEmail.length > 255) {
            errors.push('Email no puede exceder 255 caracteres');
        }
    }

    // Validar RA
    const raRegex = /^[0-9]{6,10}$/;
    if (!ra || typeof ra !== 'string') {
        errors.push('RA (Registro Académico) es obligatorio');
    } else {
        const trimmedRA = ra.trim();
        if (!raRegex.test(trimmedRA)) {
            errors.push('RA debe contener solo números (6-10 dígitos)');
        }
    }

    // Validar contraseña
    if (!password || typeof password !== 'string') {
        errors.push('Contraseña es obligatoria');
    } else {
        if (password.length < 8) {
            errors.push('Contraseña debe tener al menos 8 caracteres');
        }
        if (password.length > 128) {
            errors.push('Contraseña no puede exceder 128 caracteres');
        }
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        
        if (!hasUpperCase) {
            errors.push('Contraseña debe contener al menos una letra mayúscula');
        }
        if (!hasLowerCase) {
            errors.push('Contraseña debe contener al menos una letra minúscula');
        }
        if (!hasNumbers) {
            errors.push('Contraseña debe contener al menos un número');
        }
    }

    return errors;
};

// ✅ Función de logging seguro
const logSafeData = (data, excludeFields = ['password']) => {
    if (!data || typeof data !== 'object') return data;
    
    const safe = { ...data };
    excludeFields.forEach(field => {
        if (safe[field]) {
            safe[field] = '[PROTEGIDO]';
        }
    });
    return safe;
};

// ✅ Función para sanitizar entrada
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str.trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
};

// ✅ Función para generar timestamp ISO
const getCurrentTimestamp = () => {
    return new Date().toISOString();
};

// ✅ Función para log de eventos de seguridad
const logSecurityEvent = (event, details, req) => {
    const timestamp = getCurrentTimestamp();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`🔒 [SECURITY] ${timestamp} - ${event}`, {
        ip,
        userAgent: userAgent.substring(0, 100),
        details: logSafeData(details),
        url: req.originalUrl
    });
};

// ✅ REGISTRO DE USUARIO - COMPATIBLE CON TU ESQUEMA
router.post('/register', registerLimiter, async (req, res) => {
    const startTime = Date.now();
    
    try {
        logSecurityEvent('REGISTER_ATTEMPT', { email: req.body.email }, req);
        
        if (!db) {
            console.error('❌ Base de datos no disponible');
            return res.status(503).json({ 
                error: 'Servicio temporalmente no disponible',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const validationErrors = validateRegistrationData(req.body);
        if (validationErrors.length > 0) {
            logSecurityEvent('REGISTER_VALIDATION_FAILED', { 
                errors: validationErrors,
                email: req.body.email 
            }, req);
            
            return res.status(400).json({ 
                error: 'Datos de registro inválidos',
                details: validationErrors,
                code: 'VALIDATION_ERROR'
            });
        }

        const { name, email, ra, password } = req.body;
        const sanitizedData = {
            name: sanitizeInput(name).trim(),
            email: sanitizeInput(email).trim().toLowerCase(),
            ra: sanitizeInput(ra).trim(),
            password: password
        };

        // ✅ COMPATIBLE: Usar solo columnas que existen en tu esquema
        db.get('SELECT id, email, ra FROM users WHERE email = ? OR ra = ?', 
            [sanitizedData.email, sanitizedData.ra], async (err, existingUser) => {
            
            if (err) {
                console.error('❌ Error verificando usuario existente:', err.message);
                logSecurityEvent('REGISTER_DB_ERROR', { error: err.message }, req);
                return res.status(500).json({ 
                    error: 'Error interno del servidor',
                    code: 'DATABASE_ERROR'
                });
            }

            if (existingUser) {
                const duplicateField = existingUser.email === sanitizedData.email ? 'email' : 'ra';
                logSecurityEvent('REGISTER_DUPLICATE_ATTEMPT', { 
                    field: duplicateField,
                    email: sanitizedData.email,
                    ra: sanitizedData.ra
                }, req);
                
                return res.status(409).json({ 
                    error: 'Usuario ya existe con ese email o RA',
                    code: 'USER_EXISTS',
                    field: duplicateField
                });
            }

            try {
                console.log('✅ Creando nuevo usuario...');
                const hashedPassword = await bcrypt.hash(sanitizedData.password, BCRYPT_ROUNDS);
                
                // ✅ EXACTAMENTE TU ESQUEMA: name, email, ra, password, role (created_at es automático)
                db.run('INSERT INTO users (name, email, ra, password, role) VALUES (?, ?, ?, ?, ?)',
                    [sanitizedData.name, sanitizedData.email, sanitizedData.ra, hashedPassword, 'student'], 
                    function(err) {
                        if (err) {
                            console.error('❌ Error creando usuario:', err.message);
                            logSecurityEvent('REGISTER_CREATE_ERROR', { 
                                error: err.message,
                                email: sanitizedData.email 
                            }, req);
                            
                            return res.status(500).json({ 
                                error: 'Error creando usuario',
                                code: 'CREATE_ERROR'
                            });
                        }

                        const processingTime = Date.now() - startTime;
                        logSecurityEvent('REGISTER_SUCCESS', { 
                            userId: this.lastID,
                            email: sanitizedData.email,
                            processingTime: `${processingTime}ms`
                        }, req);

                        res.status(201).json({ 
                            message: 'Usuario registrado exitosamente',
                            userId: this.lastID,
                            email: sanitizedData.email
                        });
                    });
                    
            } catch (hashError) {
                console.error('❌ Error en hash de contraseña:', hashError.message);
                logSecurityEvent('REGISTER_HASH_ERROR', { error: hashError.message }, req);
                return res.status(500).json({ 
                    error: 'Error procesando registro',
                    code: 'HASH_ERROR'
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error general en registro:', error.message);
        logSecurityEvent('REGISTER_GENERAL_ERROR', { error: error.message }, req);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ LOGIN DE USUARIO - COMPATIBLE CON TU ESQUEMA
router.post('/login', authLimiter, async (req, res) => {
    const startTime = Date.now();
    
    try {
        logSecurityEvent('LOGIN_ATTEMPT', { email: req.body.email }, req);
        
        if (!db) {
            return res.status(503).json({ 
                error: 'Servicio temporalmente no disponible',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            logSecurityEvent('LOGIN_VALIDATION_FAILED', { missingFields: { email: !email, password: !password } }, req);
            return res.status(400).json({ 
                error: 'Email y contraseña son obligatorios',
                code: 'VALIDATION_ERROR'
            });
        }

        const sanitizedEmail = sanitizeInput(email).trim().toLowerCase();
        
        if (!sanitizedEmail) {
            logSecurityEvent('LOGIN_INVALID_EMAIL', { originalEmail: email }, req);
            return res.status(400).json({ 
                error: 'Email inválido',
                code: 'INVALID_EMAIL'
            });
        }

        // ✅ EXACTAMENTE TU ESQUEMA: id, name, email, password, role, created_at
        db.get('SELECT id, name, email, password, role, created_at FROM users WHERE email = ?', 
            [sanitizedEmail], async (err, user) => {
            
            if (err) {
                console.error('❌ Error buscando usuario:', err.message);
                logSecurityEvent('LOGIN_DB_ERROR', { error: err.message }, req);
                return res.status(500).json({ 
                    error: 'Error interno del servidor',
                    code: 'DATABASE_ERROR'
                });
            }

            if (!user) {
                logSecurityEvent('LOGIN_USER_NOT_FOUND', { email: sanitizedEmail }, req);
                return res.status(401).json({ 
                    error: 'Credenciales inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            try {
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    logSecurityEvent('LOGIN_INVALID_PASSWORD', { 
                        email: sanitizedEmail,
                        userId: user.id 
                    }, req);
                    
                    return res.status(401).json({ 
                        error: 'Credenciales inválidas',
                        code: 'INVALID_CREDENTIALS'
                    });
                }

                const tokenPayload = {
                    userId: user.id,
                    email: user.email,
                    role: user.role || 'student',
                    name: user.name,
                    iat: Math.floor(Date.now() / 1000)
                };

                const token = jwt.sign(
                    tokenPayload,
                    JWT_SECRET,
                    { 
                        expiresIn: JWT_EXPIRES_IN,
                        issuer: 'informatica-medica-platform',
                        audience: 'students',
                        subject: user.id.toString()
                    }
                );

                const processingTime = Date.now() - startTime;
                logSecurityEvent('LOGIN_SUCCESS', { 
                    userId: user.id,
                    email: sanitizedEmail,
                    role: user.role,
                    processingTime: `${processingTime}ms`
                }, req);
                
                res.json({
                    message: 'Login exitoso',
                    token,
                    expiresIn: JWT_EXPIRES_IN,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role || 'student',
                        memberSince: user.created_at
                    }
                });
                
            } catch (compareError) {
                console.error('❌ Error comparando contraseña:', compareError.message);
                logSecurityEvent('LOGIN_COMPARE_ERROR', { 
                    error: compareError.message,
                    email: sanitizedEmail 
                }, req);
                
                return res.status(500).json({ 
                    error: 'Error interno del servidor',
                    code: 'COMPARE_ERROR'
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error general en login:', error.message);
        logSecurityEvent('LOGIN_GENERAL_ERROR', { error: error.message }, req);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ NUEVA RUTA: Verificar token
router.get('/verify', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Token no proporcionado o formato inválido',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                logSecurityEvent('TOKEN_VERIFICATION_FAILED', { 
                    error: err.message,
                    tokenPresent: !!token 
                }, req);
                
                let errorMessage = 'Token inválido';
                let errorCode = 'INVALID_TOKEN';
                
                if (err.name === 'TokenExpiredError') {
                    errorMessage = 'Token expirado';
                    errorCode = 'TOKEN_EXPIRED';
                } else if (err.name === 'JsonWebTokenError') {
                    errorMessage = 'Token malformado';
                    errorCode = 'MALFORMED_TOKEN';
                }
                
                return res.status(401).json({ 
                    error: errorMessage,
                    code: errorCode
                });
            }

            logSecurityEvent('TOKEN_VERIFICATION_SUCCESS', { 
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role 
            }, req);

            res.json({ 
                valid: true, 
                user: {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                    name: decoded.name
                },
                issuedAt: new Date(decoded.iat * 1000).toISOString(),
                expiresAt: new Date(decoded.exp * 1000).toISOString()
            });
        });
        
    } catch (error) {
        console.error('❌ Error verificando token:', error.message);
        logSecurityEvent('TOKEN_VERIFICATION_ERROR', { error: error.message }, req);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ✅ NUEVA RUTA: Información del usuario autenticado
router.get('/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Token no proporcionado',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ 
                    error: 'Token inválido',
                    code: 'INVALID_TOKEN'
                });
            }

            // ✅ COMPATIBLE: Buscar información usando tu esquema
            db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', 
                [decoded.userId], (dbErr, user) => {
                
                if (dbErr) {
                    console.error('❌ Error buscando usuario:', dbErr.message);
                    return res.status(500).json({ 
                        error: 'Error interno del servidor',
                        code: 'DATABASE_ERROR'
                    });
                }

                if (!user) {
                    return res.status(404).json({ 
                        error: 'Usuario no encontrado',
                        code: 'USER_NOT_FOUND'
                    });
                }

                res.json({
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        memberSince: user.created_at
                    }
                });
            });
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo información del usuario:', error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router;