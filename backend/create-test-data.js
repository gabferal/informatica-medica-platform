const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
console.log('📊 Creando datos de prueba...');

const db = new sqlite3.Database(dbPath);

// Crear un usuario estudiante de prueba
db.run(`INSERT OR IGNORE INTO users (name, email, ra, password, role) 
        VALUES (?, ?, ?, ?, ?)`,
    ['Estudiante Test', 'estudiante@test.com', 'TEST001', 'password_hash', 'student'],
    function(err) {
        if (err) {
            console.error('Error creando estudiante:', err);
            return;
        }
        
        const studentId = this.lastID || 1;
        console.log('✅ Estudiante creado con ID:', studentId);
        
        // Crear entregas de prueba
        const submissions = [
            {
                title: 'Trabajo Práctico 1',
                description: 'Primer trabajo del curso',
                filename: 'tp1_test.pdf',
                original_name: 'Trabajo_Practico_1.pdf'
            },
            {
                title: 'Ensayo Informática Médica',
                description: 'Ensayo sobre sistemas de información hospitalaria',
                filename: 'ensayo_test.docx',
                original_name: 'Ensayo_Informatica_Medica.docx'
            },
            {
                title: 'Proyecto Final',
                description: 'Proyecto final del curso',
                filename: 'proyecto_final_test.zip',
                original_name: 'Proyecto_Final.zip'
            }
        ];
        
        let completed = 0;
        submissions.forEach((sub, index) => {
            db.run(`INSERT INTO submissions 
                    (user_id, title, description, filename, original_name, file_path, file_size, mime_type, submitted_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    studentId,
                    sub.title,
                    sub.description,
                    sub.filename,
                    sub.original_name,
                    `uploads/submissions/${sub.filename}`,
                    1024 * (index + 1), // Tamaño ficticio
                    'application/pdf',
                    new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString() // Fechas diferentes
                ],
                function(err) {
                    if (err) {
                        console.error('Error creando entrega:', err);
                    } else {
                        console.log(`✅ Entrega creada: ${sub.title} (ID: ${this.lastID})`);
                    }
                    
                    completed++;
                    if (completed === submissions.length) {
                        // Verificar datos creados
                        db.all(`SELECT 
                                s.id, s.title, s.original_name,
                                u.name as student_name, u.email
                            FROM submissions s
                            JOIN users u ON s.user_id = u.id`, 
                            (err, rows) => {
                                if (err) {
                                    console.error('Error verificando datos:', err);
                                } else {
                                    console.log('\n📋 Entregas creadas:');
                                    rows.forEach(row => {
                                        console.log(`  - ${row.title} por ${row.student_name}`);
                                    });
                                }
                                
                                db.close();
                                console.log('\n🎉 Datos de prueba creados exitosamente!');
                            });
                    }
                });
        });
    });
