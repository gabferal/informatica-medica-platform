const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    init() {
        try {
            // CORRECCIÓN: createTransport (sin "r" al final)
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            console.log('📧 Servicio de email inicializado correctamente');
            
            // Verificar configuración si están definidas las variables
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                this.testConnection().then(result => {
                    if (result.success) {
                        console.log('✅ Conexión SMTP verificada exitosamente');
                    } else {
                        console.log('⚠️ Problema con conexión SMTP:', result.message);
                        console.log('📧 Modo simulación activado');
                    }
                });
            } else {
                console.log('📧 Variables de email no configuradas - usando modo simulación');
            }
            
        } catch (error) {
            console.error('❌ Error inicializando servicio de email:', error.message);
            this.transporter = null;
        }
    }

    async sendSubmissionNotification(studentInfo, submissionInfo) {
        // Si no hay transporter o no está configurado, usar simulación
        if (!this.transporter || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('📧 Usando modo simulación (SMTP no configurado)');
            return this.simulateEmail(studentInfo, submissionInfo);
        }

        try {
            // Email para el profesor
            const professorEmail = {
                from: `"${process.env.EMAIL_FROM_NAME || 'Informática Médica'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER}>`,
                to: process.env.PROFESSOR_EMAIL || 'profesor@universidad.edu',
                subject: `Nueva entrega: ${submissionInfo.title}`,
                html: this.generateProfessorEmailTemplate(studentInfo, submissionInfo)
            };

            // Email de confirmación para el estudiante
            const studentEmail = {
                from: `"${process.env.EMAIL_FROM_NAME || 'Informática Médica'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER}>`,
                to: studentInfo.email,
                subject: `Confirmación de entrega: ${submissionInfo.title}`,
                html: this.generateStudentEmailTemplate(studentInfo, submissionInfo)
            };

            // Enviar ambos emails
            const professorResult = await this.transporter.sendMail(professorEmail);
            const studentResult = await this.transporter.sendMail(studentEmail);

            console.log('✅ Emails enviados exitosamente');
            console.log('📧 Profesor:', professorResult.messageId);
            console.log('📧 Estudiante:', studentResult.messageId);

            return {
                success: true,
                professorMessageId: professorResult.messageId,
                studentMessageId: studentResult.messageId
            };

        } catch (error) {
            console.error('❌ Error enviando emails:', error.message);
            console.log('📧 Fallback: usando modo simulación');
            return this.simulateEmail(studentInfo, submissionInfo);
        }
    }

    simulateEmail(studentInfo, submissionInfo) {
        console.log('📧 SIMULACIÓN DE EMAIL:');
        console.log('='.repeat(50));
        console.log(`Para Profesor: ${process.env.PROFESSOR_EMAIL || 'profesor@universidad.edu'}`);
        console.log(`Asunto: Nueva entrega: ${submissionInfo.title}`);
        console.log(`Estudiante: ${studentInfo.nombre} (${studentInfo.email})`);
        console.log(`RA: ${studentInfo.ra}`);
        console.log(`Archivo: ${submissionInfo.originalName}`);
        console.log(`Fecha: ${new Date().toLocaleString('es-ES')}`);
        console.log('-'.repeat(50));
        console.log(`Para Estudiante: ${studentInfo.email}`);
        console.log(`Asunto: Confirmación de entrega: ${submissionInfo.title}`);
        console.log(`Mensaje: Tu trabajo ha sido entregado exitosamente`);
        console.log('='.repeat(50));

        return {
            success: true,
            simulated: true,
            message: 'Email simulado - configurar SMTP para envío real'
        };
    }

    generateProfessorEmailTemplate(studentInfo, submissionInfo) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f8f9fa; }
                .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🩺 Nueva Entrega - Informática Médica</h2>
                </div>
                
                <div class="content">
                    <p>Se ha recibido una nueva entrega de trabajo práctico:</p>
                    
                    <div class="info-box">
                        <h4>📋 Información del Trabajo</h4>
                        <p><strong>Título:</strong> ${submissionInfo.title}</p>
                        <p><strong>Descripción:</strong> ${submissionInfo.description || 'Sin descripción'}</p>
                        <p><strong>Archivo:</strong> ${submissionInfo.originalName}</p>
                        <p><strong>Tamaño:</strong> ${this.formatFileSize(submissionInfo.size)}</p>
                        <p><strong>Fecha de entrega:</strong> ${new Date().toLocaleString('es-ES')}</p>
                    </div>
                    
                    <div class="info-box">
                        <h4>👤 Información del Estudiante</h4>
                        <p><strong>Nombre:</strong> ${studentInfo.nombre}</p>
                        <p><strong>Email:</strong> ${studentInfo.email}</p>
                        <p><strong>RA:</strong> ${studentInfo.ra}</p>
                    </div>
                    
                    <p>Puedes acceder al archivo desde la plataforma administrativa.</p>
                </div>
                
                <div class="footer">
                    <p>Este email fue generado automáticamente por la Plataforma de Informática Médica</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateStudentEmailTemplate(studentInfo, submissionInfo) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f8f9fa; }
                .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px; }
                .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #28a745; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>✅ Entrega Confirmada</h2>
                </div>
                
                <div class="content">
                    <div class="success-box">
                        <h4>🎉 ¡Tu trabajo ha sido entregado exitosamente!</h4>
                        <p>Hemos recibido tu entrega y está disponible para revisión.</p>
                    </div>
                    
                    <div class="info-box">
                        <h4>📋 Detalles de tu entrega</h4>
                        <p><strong>Título:</strong> ${submissionInfo.title}</p>
                        <p><strong>Archivo:</strong> ${submissionInfo.originalName}</p>
                        <p><strong>Fecha de entrega:</strong> ${new Date().toLocaleString('es-ES')}</p>
                        <p><strong>Tamaño:</strong> ${this.formatFileSize(submissionInfo.size)}</p>
                    </div>
                    
                    <p><strong>Próximos pasos:</strong></p>
                    <ul>
                        <li>Tu trabajo será revisado por el profesor</li>
                        <li>Recibirás feedback en la plataforma</li>
                        <li>Puedes subir versiones actualizadas si es necesario</li>
                    </ul>
                    
                    <p>Puedes ver todas tus entregas en el área de estudiantes.</p>
                </div>
                
                <div class="footer">
                    <p>Este email fue generado automáticamente por la Plataforma de Informática Médica</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async testConnection() {
        if (!this.transporter) {
            return { success: false, message: 'Transporter no inicializado' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Conexión SMTP exitosa' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = new EmailService();