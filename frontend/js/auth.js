// Gestión de autenticación
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    init() {
        if (this.token && this.user) {
            this.updateUIForLoggedInUser();
        }
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Formulario de login
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Formulario de registro
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showAlert('Por favor, completa todos los campos', 'danger');
            return;
        }

        try {
            this.setLoading('login-form', true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                this.token = data.token;
                this.user = data.user;

                this.updateUIForLoggedInUser();
                this.hideAuthModal();
                this.showAlert('¡Bienvenido! Has iniciado sesión correctamente', 'success');

            } else {
                this.showAlert(data.error || 'Error al iniciar sesión', 'danger');
            }

        } catch (error) {
            console.error('Error en login:', error);
            this.showAlert('Error de conexión. Intenta nuevamente', 'danger');
        } finally {
            this.setLoading('login-form', false);
        }
    }

    async handleRegister() {
        const nombre = document.getElementById('register-nombre').value;
        const email = document.getElementById('register-email').value;
        const ra = document.getElementById('register-ra').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        // Validaciones
        if (!nombre || !email || !ra || !password || !confirmPassword) {
            this.showAlert('Por favor, completa todos los campos', 'danger');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert('Las contraseñas no coinciden', 'danger');
            return;
        }

        if (password.length < 6) {
            this.showAlert('La contraseña debe tener al menos 6 caracteres', 'danger');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showAlert('Por favor, ingresa un email válido', 'danger');
            return;
        }

        try {
            this.setLoading('register-form', true);

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nombre, email, ra, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('¡Registro exitoso! Ahora puedes iniciar sesión', 'success');
                
                // Cambiar a la pestaña de login
                document.getElementById('login-tab').click();
                document.getElementById('register-form').reset();

            } else {
                this.showAlert(data.error || 'Error al registrarse', 'danger');
            }

        } catch (error) {
            console.error('Error en registro:', error);
            this.showAlert('Error de conexión. Intenta nuevamente', 'danger');
        } finally {
            this.setLoading('register-form', false);
        }
    }

    updateUIForLoggedInUser() {
        const loginBtn = document.getElementById('login-btn');
        const userInfo = document.getElementById('user-info');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'block';
            userInfo.innerHTML = `
                <span class="me-3">👋 Hola, ${this.user.nombre}</span>
                <button class="btn btn-outline-secondary btn-sm" onclick="authManager.logout()">
                    Cerrar Sesión
                </button>
            `;
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        this.token = null;
        this.user = null;

        location.reload();
    }

    hideAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
    }

    setLoading(formId, isLoading) {
        const form = document.getElementById(formId);
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Procesando...
            `;
        } else {
            submitBtn.disabled = false;
            if (formId === 'login-form') {
                submitBtn.innerHTML = 'Iniciar Sesión';
            } else if (formId === 'register-form') {
                submitBtn.innerHTML = 'Registrarse';
            }
        }
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});