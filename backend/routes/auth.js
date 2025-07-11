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
        if (!db) {
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const { name, email, ra, password } = req.body;

        if (!name || !email || !ra || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        // Verificar si el usuario ya existe
        db.get('SELECT * FROM users WHERE email = ? OR ra = ?', [email, ra], async (err, user) => {
            if (err) {
                console.error('Error verificando usuario:', err);
                return res.status(500).json({ error: 'Error en la base de datos' });
            }

            if (user) {
                return res.status(400).json({ error: 'Usuario ya existe' });
            }

            // Crear nuevo usuario
            const hashedPassword = await bcrypt.hash(password, 12);
            
            db.run('INSERT INTO users (name, email, ra, password) VALUES (?, ?, ?, ?)',
                [name, email, ra, hashedPassword], function(err) {
                    if (err) {
                        console.error('Error creando usuario:', err);
                        return res.status(500).json({ error: 'Error creando usuario' });
                    }

                    res.status(201).json({ 
                        message: 'Usuario registrado exitosamente',
                        userId: this.lastID 
                    });
                });
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login de usuario
router.post('/login', (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Base de datos no disponible' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Error buscando usuario:', err);
                return res.status(500).json({ error: 'Error en la base de datos' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

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
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
