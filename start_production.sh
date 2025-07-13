#!/bin/bash
echo "🚀 Iniciando Informática Médica en producción..."

# Usar archivo de producción si existe
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

echo "✅ Aplicación iniciada"
echo "📊 Ver estado: pm2 status"
echo "📋 Ver logs: pm2 logs informatica-medica"
