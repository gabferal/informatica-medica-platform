// Funciones de autenticación para Informática Médica

// Configuración de la API
const API_BASE = window.location.origin;

// Función para mostrar alertas
function showAlert(message, type = 'info', containerId = 'alert-container') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;
    
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Scroll al alert
    alertContainer.scrollIntoView({ behavior: 'smooth' });
}

// Función para obtener token del localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Función para obtener usuario del localStorage
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Función para verificar si el usuario está autenticado
function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    return token && user;
}

// Función para logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Función para verificar rol de admin
function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}

// Función de registro
async function handleRegister(formData) {
    try {
        console.log('📤 Enviando registro:', formData);
        
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        console.log('📥 Respuesta registro:', result);
        
        if (response.ok) {
            showAlert('¡Usuario registrado exitosamente! Redirigiendo al login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(result.error || 'Error en el registro', 'danger');
        }
        
        return { success: response.ok, data: result };
    } catch (error) {
        console.error('❌ Error en registro:', error);
        showAlert('Error de conexión. Intenta nuevamente.', 'danger');
        return { success: false, error: error.message };
    }
}

// Función de login
async function handleLogin(email, password) {
    try {
        console.log('📤 Enviando login para:', email);
        
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        console.log('📥 Respuesta login:', result);
        
        if (response.ok) {
            // Guardar token y usuario
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            showAlert('¡Login exitoso! Redirigiendo...', 'success');
            
            // Redireccionar según el rol
            setTimeout(() => {
                if (result.user.role === 'admin') {
                    window.location.href = 'admin-panel.html';
                } else {
                    window.location.href = 'student-area.html';
                }
            }, 1500);
        } else {
            showAlert(result.error || 'Credenciales inválidas', 'danger');
        }
        
        return { success: response.ok, data: result };
    } catch (error) {
        console.error('❌ Error en login:', error);
        showAlert('Error de conexión. Verifica tu internet.', 'danger');
        return { success: false, error: error.message };
    }
}

// Función para hacer peticiones autenticadas
async function authenticatedFetch(url, options = {}) {
    const token = getToken();
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        
        // Si el token expiró, redireccionar al login
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
        
        return response;
    } catch (error) {
        console.error('❌ Error en petición autenticada:', error);
        throw error;
    }
}

// Función para proteger páginas (llamar al inicio de páginas que requieren auth)
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Función para proteger páginas de admin
function requireAdmin() {
    if (!requireAuth()) return false;
    
    if (!isAdmin()) {
        showAlert('Acceso denegado. Se requieren permisos de administrador.', 'danger');
        setTimeout(() => {
            window.location.href = 'student-area.html';
        }, 2000);
        return false;
    }
    return true;
}

// Función para mostrar información del usuario en la navbar
function displayUserInfo() {
    const user = getUser();
    if (!user) return;
    
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement) {
        userInfoElement.innerHTML = `
            <span class="navbar-text me-3">
                <i class="fas fa-user me-1"></i>
                ${user.name} ${user.role === 'admin' ? '(Admin)' : ''}
            </span>
            <button class="btn btn-outline-light btn-sm" onclick="logout()">
                <i class="fas fa-sign-out-alt me-1"></i>Salir
            </button>
        `;
    }
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Auth.js cargado correctamente');
    
    // Mostrar info del usuario si está autenticado
    if (isAuthenticated()) {
        displayUserInfo();
    }
});

// Exportar funciones para uso global
window.authFunctions = {
    handleRegister,
    handleLogin,
    logout,
    isAuthenticated,
    isAdmin,
    requireAuth,
    requireAdmin,
    authenticatedFetch,
    getUser,
    getToken,
    showAlert,
    displayUserInfo
};