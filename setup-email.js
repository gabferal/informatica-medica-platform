#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔧 Configuración de Email para Informática Médica');
console.log('='.repeat(50));
console.log('');

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupEmail() {
    try {
        console.log('Para configurar el envío de emails, necesitamos algunos datos:');
        console.log('');
        
        const emailUser = await question('📧 Tu email de Gmail: ');
        const emailPass = await question('🔑 App Password de Gmail (no tu contraseña normal): ');
        const professorEmail = await question('👨‍🏫 Email del profesor para recibir notificaciones: ');
        
        console.log('');
        console.log('ℹ️  Para obtener un App Password de Gmail:');
        console.log('   1. Ve a https://myaccount.google.com/security');
        console.log('   2. Activa la verificación en 2 pasos');
        console.log('   3. Ve a "App passwords" y genera una nueva');
        console.log('   4. Usa esa contraseña de 16 caracteres aquí');
        console.log('');
        
        const confirm = await question('¿Continuar con la configuración? (s/n): ');
        
        if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
            console.log('❌ Configuración cancelada');
            rl.close();
            return;
        }

        // Leer el archivo .env actual
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Actualizar o agregar configuraciones de email
        const emailConfig = `
# Configuración de email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}
EMAIL_FROM_NAME=Informática Médica
EMAIL_FROM_ADDRESS=${emailUser}

# Email del profesor (para recibir notificaciones)
PROFESSOR_EMAIL=${professorEmail}
`;

        // Si el archivo .env no existe, crear uno básico
        if (!envContent) {
            envContent = `# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración JWT
JWT_SECRET=tu_clave_secreta_super_segura_aqui_2024

# Configuración de archivos
MAX_FILE_SIZE=10485760
`;
        }

        // Remover configuraciones de email existentes
        envContent = envContent.replace(/# Configuración de email.*?PROFESSOR_EMAIL=.*$/gms, '');
        
        // Agregar nueva configuración
        envContent += emailConfig;

        // Escribir archivo .env
        fs.writeFileSync(envPath, envContent.trim() + '\n');

        console.log('');
        console.log('✅ Configuración de email guardada en .env');
        console.log('');
        console.log('🚀 Para probar la configuración:');
        console.log('   1. Reinicia el servidor: npm run dev');
        console.log('   2. Sube un archivo de prueba');
        console.log('   3. Verifica que lleguen los emails');
        console.log('');
        console.log('📧 Se enviarán emails a:');
        console.log(`   - Estudiante: ${emailUser} (confirmación)`);
        console.log(`   - Profesor: ${professorEmail} (notificación)`);

    } catch (error) {
        console.error('❌ Error en la configuración:', error.message);
    } finally {
        rl.close();
    }
}

setupEmail();
