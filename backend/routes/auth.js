const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../database/database.db');

// Registro de usuario
router.post('/register', async (req, res) => {
    const { email, password, ra, nombre } = req.body;
    
    try {
        console.log('👤 Intento de registro:', email);
        
        // Validaciones
        if (!email || !password || !ra) {
            return res.status(400).json({ 
                error: 'Email, contraseña y RA son obligatorios' 
            });
        }
        
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Formato de email inválido' 
            });
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'La contraseña debe tener al menos 6 caracteres' 
            });
        }
        
        const db = new sqlite3.Database(dbPath);
        
        // Verificar si el usuario ya existe
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Error en base de datos:', err);
                db.close();
                return res.status(500).json({ error: 'Error en la base de datos' });
            }
            
            if (user) {
                db.close();
                return res.status(400).json({ 
                    error: 'El email ya está registrado' 
                });
            }
            
            try {
                // Hashear contraseña
                const hashedPassword = await bcrypt.hash(password, 12);
                
                // Insertar nuevo usuario (role por defecto: 'student')
                db.run(
                    'INSERT INTO users (email, password, ra, nombre, role) VALUES (?, ?, ?, ?, ?)',
                    [email, hashedPassword, ra, nombre || email, 'student'],
                    function(err) {
                        db.close();
                        
                        if (err) {
                            console.error('Error al crear usuario:', err);
                            return res.status(500).json({ 
                                error: 'Error al crear usuario' 
                            });
                        }
                        
                        console.log('✅ Usuario registrado:', email, 'ID:', this.lastID);
                        res.status(201).json({ 
                            message: 'Usuario registrado exitosamente',
                            userId: this.lastID 
                        });
                    }
                );
            } catch (hashError) {
                console.error('Error al hashear contraseña:', hashError);
                db.close();
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });
        
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login de usuario
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔑 Intento de login:', email);
    
    if (!email || !password) {
        return res.status(400).json({ 
            error: 'Email y contraseña son obligatorios' 
        });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Error en base de datos:', err);
            db.close();
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        
        if (!user) {
            console.log('❌ Usuario no encontrado:', email);
            db.close();
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }
        
        try {
            // Verificar contraseña
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            db.close();
            
            if (!isValidPassword) {
                console.log('❌ Contraseña incorrecta para:', email);
                return res.status(401).json({ 
                    error: 'Credenciales inválidas' 
                });
            }
            
            // Generar JWT incluyendo el rol
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    ra: user.ra,
                    role: user.role || 'student'
                },
                process.env.JWT_SECRET || 'tu_clave_secreta_aqui',
                { expiresIn: '24h' }
            );
            
            console.log('✅ Login exitoso:', email, 'Rol:', user.role);
            
            res.json({
                message: 'Login exitoso',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    ra: user.ra,
                    nombre: user.nombre,
                    role: user.role || 'student'
                }
            });
            
        } catch (compareError) {
            console.error('Error al verificar contraseña:', compareError);
            db.close();
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });
});

module.exports = router;