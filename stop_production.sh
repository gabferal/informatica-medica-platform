#!/bin/bash
echo "🛑 Deteniendo Informática Médica..."
pm2 stop informatica-medica
pm2 delete informatica-medica
echo "✅ Aplicación detenida"
