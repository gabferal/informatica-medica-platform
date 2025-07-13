#!/bin/bash

echo "🔍 VERIFICANDO SITIO ACTUAL EN RAILWAY"
echo "======================================"

SITE_URL="https://web-production-0af6.up.railway.app"

echo "📡 Verificando páginas principales..."

# Verificar páginas principales
pages=("index.html" "login.html" "register.html" "admin-panel.html" "student-area.html")

for page in "${pages[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/$page")
    if [ "$status" = "200" ]; then
        echo "✅ $page - OK"
    else
        echo "❌ $page - Error ($status)"
    fi
done

echo ""
echo "🔗 URLs de tu sitio:"
echo "   �� Inicio: $SITE_URL/index.html"
echo "   👤 Login: $SITE_URL/login.html"
echo "   �� Registro: $SITE_URL/register.html"
echo "   ⚙️  Admin: $SITE_URL/admin-panel.html"
echo "   🎓 Estudiantes: $SITE_URL/student-area.html"
