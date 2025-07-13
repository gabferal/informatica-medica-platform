#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
echo "💾 Creando backup de base de datos..."

# Backup de la base principal
if [ -f "backend/database.db" ]; then
    cp backend/database.db "backend/database_backup_${BACKUP_DATE}.db"
    echo "✅ Backup creado: backend/database_backup_${BACKUP_DATE}.db"
fi

if [ -f "database.db" ]; then
    cp database.db "database_backup_${BACKUP_DATE}.db"
    echo "✅ Backup creado: database_backup_${BACKUP_DATE}.db"
fi

echo "💾 Backup completado"
