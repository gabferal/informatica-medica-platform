const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Intentar cargar la base de datos
let db;
try {
    db = require('../database/init');
} catch (error) {
    console.error('❌ Error cargando base de datos en auth.js:', error);
}

const JWT_SECRET = process.env.JWT_SECRET || 'informatica_medica_secret_key_2024';

// Registro de usuario
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Datos recibidos en /register:', req.body);
        console.log('📝 Headers:', req.headers);
        
        if (!db) {
            console.error('❌ Base de datos no disponible');
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const { name, email, ra, password } = req.body;
        
        console.log('📋 Campos extraídos:', { 
            name: name ? 'OK' : 'VACÍO', 
            email: email ? 'OK' : 'VACÍO', 
            ra: ra ? 'OK' : 'VACÍO', 
            password: password ? 'OK' : 'VACÍO' 
        });

        if (!name || !email || !ra || !password) {
            console.log('❌ Campos faltantes:', { name, email, ra, password: password ? '[OCULTA]' : 'VACÍA' });
            return res.status(400).json({ 
                error: 'Todos los campos son obligatorios',
                received: { name: !!name, email: !!email, ra: !!ra, password: !!password }
            });
        }

        // Verificar si el usuario ya existe
        db.get('SELECT * FROM users WHERE email = ? OR ra = ?', [email, ra], async (err, user) => {
            if (err) {
                console.error('❌ Error verificando usuario:', err);
                return res.status(500).json({ error: 'Error en la base de datos' });
            }

            if (user) {
                console.log('⚠️ Usuario ya existe:', user.email);
                return res.status(400).json({ error: 'Usuario ya existe con ese email o RA' });
            }

            // Crear nuevo usuario
            console.log('✅ Creando nuevo usuario...');
            const hashedPassword = await bcrypt.hash(password, 12);
            
            db.run('INSERT INTO users (name, email, ra, password) VALUES (?, ?, ?, ?)',
                [name, email, ra, hashedPassword], function(err) {
                    if (err) {
                        console.error('❌ Error creando usuario:', err);
                        return res.status(500).json({ error: 'Error creando usuario: ' + err.message });
                    }

                    console.log('✅ Usuario creado exitosamente con ID:', this.lastID);
                    res.status(201).json({ 
                        message: 'Usuario registrado exitosamente',
                        userId: this.lastID 
                    });
                });
        });
    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

// Login de usuario
router.post('/login', (req, res) => {
    try {
        console.log('📝 Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        
        if (!db) {
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('❌ Error buscando usuario:', err);
                return res.status(500).json({ error: 'Error en la base de datos' });
            }

            if (!user) {
                console.log('⚠️ Usuario no encontrado:', email);
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('⚠️ Contraseña incorrecta para:', email);
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log('✅ Login exitoso:', email);
            res.json({
                message: 'Login exitoso',
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        });
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
