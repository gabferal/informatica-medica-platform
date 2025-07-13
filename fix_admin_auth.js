const fs = require('fs');
const path = require('path');

console.log('🔒 CORRIGIENDO AUTENTICACIÓN EN ADMIN PANEL');
console.log('==========================================');

const adminPanelPath = './frontend/admin-panel.html';

// Leer archivo actual
if (!fs.existsSync(adminPanelPath)) {
    console.error('❌ No se encontró admin-panel.html');
    process.exit(1);
}

let content = fs.readFileSync(adminPanelPath, 'utf8');

// Buscar donde está el script actual
const scriptStart = content.indexOf('<script>');
const scriptEnd = content.lastIndexOf('</script>');

if (scriptStart === -1 || scriptEnd === -1) {
    console.error('❌ No se encontraron tags de script');
    process.exit(1);
}

// Extraer el contenido antes y después del script
const beforeScript = content.substring(0, scriptStart);
const afterScript = content.substring(scriptEnd + 9);

// Nuevo script con autenticación obligatoria
const newScript = `<script src="js/auth.js"></script>
<script>
// ========================================
// PANEL ADMIN CON AUTENTICACIÓN OBLIGATORIA
// ========================================

// 🔒 VERIFICAR AUTENTICACIÓN AL CARGAR
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔒 Verificando autenticación de administrador...');
    
    // Verificar autenticación obligatoria
    if (!requireAdmin()) {
        console.log('❌ Acceso denegado - redirigiendo al login');
        return; // requireAdmin ya maneja la redirección
    }
    
    console.log('✅ Autenticación de admin verificada');
    
    // Mostrar información del usuario
    displayUserInfo();
    
    // Inicializar panel admin
    initAdminPanel();
});

// Función para inicializar el panel admin
function initAdminPanel() {
    console.log('🚀 Inicializando Panel Admin');
    
    // Verificar autenticación cada 30 segundos
    setInterval(() => {
        if (!isAuthenticated() || !isAdmin()) {
            console.log('⚠️ Sesión expirada - redirigiendo al login');
            logout();
        }
    }, 30000);
    
    // Inicializar funcionalidades del panel
    initNavigation();
    initDateTime();
    initCounters();
    loadDashboardData();
    hideLoading();
}

// Navegación del panel
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            showSection(section);
        });
    });
}

// Mostrar sección específica
function showSection(sectionName) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar sección seleccionada
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Actualizar navegación activa
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    const activeLink = document.querySelector(\`[data-section="\${sectionName}"]\`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Cargar datos específicos de la sección
    loadSectionData(sectionName);
}

// Cargar datos de sección específica
async function loadSectionData(section) {
    try {
        switch(section) {
            case 'users':
                await loadUsers();
                break;
            case 'submissions':
                await loadSubmissions();
                break;
            case 'materials':
                await loadMaterials();
                break;
            case 'dashboard':
                await loadDashboardData();
                break;
        }
    } catch (error) {
        console.error(\`❌ Error cargando datos de \${section}:\`, error);
        showAlert(\`Error cargando datos de \${section}\`, 'danger');
    }
}

// Cargar datos del dashboard
async function loadDashboardData() {
    try {
        const response = await authenticatedFetch('/api/admin/stats');
        if (!response.ok) throw new Error('Error obteniendo estadísticas');
        
        const stats = await response.json();
        updateDashboardCounters(stats);
    } catch (error) {
        console.error('❌ Error cargando dashboard:', error);
        showAlert('Error cargando estadísticas del dashboard', 'danger');
    }
}

// Actualizar contadores del dashboard
function updateDashboardCounters(stats) {
    const counters = {
        'total-users': stats.totalUsers || 0,
        'total-submissions': stats.totalSubmissions || 0,
        'total-materials': stats.totalMaterials || 0,
        'pending-submissions': stats.pendingSubmissions || 0
    };
    
    Object.entries(counters).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Cargar usuarios
async function loadUsers() {
    try {
        const response = await authenticatedFetch('/api/admin/users');
        if (!response.ok) throw new Error('Error obteniendo usuarios');
        
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        showAlert('Error cargando lista de usuarios', 'danger');
    }
}

// Mostrar usuarios en tabla
function displayUsers(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => \`
        <tr>
            <td>\${user.id}</td>
            <td>\${user.name}</td>
            <td>\${user.email}</td>
            <td>\${user.ra || 'N/A'}</td>
            <td><span class="badge bg-\${user.role === 'admin' ? 'danger' : 'primary'}">\${user.role}</span></td>
            <td>\${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editUser(\${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
                \${user.role !== 'admin' ? \`
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(\${user.id})">
                    <i class="fas fa-trash"></i>
                </button>
                \` : ''}
            </td>
        </tr>
    \`).join('');
}

// Cargar entregas
async function loadSubmissions() {
    try {
        const response = await authenticatedFetch('/api/admin/submissions');
        if (!response.ok) throw new Error('Error obteniendo entregas');
        
        const submissions = await response.json();
        displaySubmissions(submissions);
    } catch (error) {
        console.error('❌ Error cargando entregas:', error);
        showAlert('Error cargando entregas', 'danger');
    }
}

// Mostrar entregas
function displaySubmissions(submissions) {
    const tbody = document.querySelector('#submissions-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = submissions.map(submission => \`
        <tr>
            <td>\${submission.id}</td>
            <td>\${submission.title}</td>
            <td>\${submission.user_name || 'N/A'}</td>
            <td>\${submission.original_name}</td>
            <td>\${new Date(submission.submitted_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="downloadSubmission(\${submission.id})">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSubmission(\${submission.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    \`).join('');
}

// Cargar materiales
async function loadMaterials() {
    try {
        const response = await authenticatedFetch('/api/admin/materials');
        if (!response.ok) throw new Error('Error obteniendo materiales');
        
        const materials = await response.json();
        displayMaterials(materials);
    } catch (error) {
        console.error('❌ Error cargando materiales:', error);
        showAlert('Error cargando materiales', 'danger');
    }
}

// Mostrar materiales
function displayMaterials(materials) {
    const tbody = document.querySelector('#materials-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = materials.map(material => \`
        <tr>
            <td>\${material.id}</td>
            <td>\${material.title}</td>
            <td>\${material.description || 'Sin descripción'}</td>
            <td>\${material.filename}</td>
            <td>\${new Date(material.uploaded_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="downloadMaterial(\${material.id})">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteMaterial(\${material.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    \`).join('');
}

// Funciones de utilidad
function initDateTime() {
    const updateDateTime = () => {
        const now = new Date();
        const dateTimeElement = document.getElementById('current-datetime');
        if (dateTimeElement) {
            dateTimeElement.textContent = now.toLocaleString();
        }
    };
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

function initCounters() {
    // Los contadores se actualizan con loadDashboardData()
    console.log('✅ Contadores inicializados');
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// Funciones de acción
function editUser(userId) {
    console.log('Editando usuario:', userId);
    // Implementar edición de usuario
}

function deleteUser(userId) {
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
        console.log('Eliminando usuario:', userId);
        // Implementar eliminación de usuario
    }
}

function deleteSubmission(submissionId) {
    if (confirm('¿Estás seguro de eliminar esta entrega?')) {
        console.log('Eliminando entrega:', submissionId);
        // Implementar eliminación de entrega
    }
}

function deleteMaterial(materialId) {
    if (confirm('¿Estás seguro de eliminar este material?')) {
        console.log('Eliminando material:', materialId);
        // Implementar eliminación de material
    }
}

function downloadSubmission(submissionId) {
    window.open(\`/api/admin/submissions/\${submissionId}/download\`, '_blank');
}

function downloadMaterial(materialId) {
    window.open(\`/api/materials/\${materialId}/download\`, '_blank');
}

console.log('✅ Panel Admin con autenticación cargado');
</script>`;

// Crear nuevo contenido
const newContent = beforeScript + newScript + afterScript;

// Crear backup
const backupPath = adminPanelPath + '.backup';
fs.writeFileSync(backupPath, content);
console.log(`✅ Backup creado: ${backupPath}`);

// Escribir nuevo contenido
fs.writeFileSync(adminPanelPath, newContent);
console.log(`✅ Admin panel actualizado con autenticación obligatoria`);

console.log('');
console.log('🔒 CAMBIOS REALIZADOS:');
console.log('   ✅ Verificación de autenticación al cargar');
console.log('   ✅ Verificación de rol de administrador');
console.log('   ✅ Redirección automática si no está autenticado');
console.log('   ✅ Verificación periódica de sesión');
console.log('   ✅ Integración completa con auth.js');
console.log('');
console.log('⚠️  IMPORTANTE: Sube los cambios a Railway para aplicar la corrección');
