// Funcionalidad principal de la aplicación
class AppManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadMaterials();
        this.setupSmoothScrolling();
    }

    setupEventListeners() {
        // Formulario de entrega de trabajos
        const submissionForm = document.getElementById('submission-form');
        if (submissionForm) {
            submissionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmission();
            });
        }

        // Validación de archivo en tiempo real
        const fileInput = document.getElementById('work-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.validateFile(e.target.files[0]);
            });
        }
    }

    async loadMaterials() {
        const container = document.getElementById('materials-container');
        
        try {
            const response = await fetch('/api/materials');
            
            if (response.ok) {
                const materials = await response.json();
                this.displayMaterials(materials);
            } else {
                container.innerHTML = `
                    <div class="text-center">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            No se pudieron cargar los materiales en este momento
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error cargando materiales:', error);
            container.innerHTML = `
                <div class="text-center">
                    <div class="alert alert-danger">
                        <i class="fas fa-times-circle me-2"></i>
                        Error de conexión al cargar materiales
                    </div>
                </div>
            `;
        }
    }

    displayMaterials(materials) {
        const container = document.getElementById('materials-container');
        
        if (materials.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body py-5">
                            <i class="fas fa-folder-open fa-4x text-muted mb-3"></i>
                            <h5 class="text-muted">No hay materiales disponibles</h5>
                            <p class="text-muted">Los materiales del curso se publicarán próximamente</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Agrupar materiales por categoría
        const categorizedMaterials = this.groupByCategory(materials);
        
        let html = '';
        
        for (const [category, items] of Object.entries(categorizedMaterials)) {
            html += `
                <div class="mb-5">
                    <h4 class="mb-4">
                        <i class="fas fa-folder me-2 text-primary"></i>
                        ${category}
                    </h4>
                    <div class="row g-3">
                        ${items.map(material => this.createMaterialCard(material)).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    groupByCategory(materials) {
        return materials.reduce((groups, material) => {
            const category = material.category || 'General';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(material);
            return groups;
        }, {});
    }

    createMaterialCard(material) {
        const fileExtension = material.filename.split('.').pop().toLowerCase();
        const iconClass = this.getFileIcon(fileExtension);
        const fileSize = material.file_size ? this.formatFileSize(material.file_size) : '';
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm material-card">
                    <div class="card-body">
                        <div class="d-flex align-items-start mb-3">
                            <div class="me-3">
                                <i class="${iconClass} fa-2x text-primary"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${material.title}</h6>
                                <small class="text-muted">${fileSize}</small>
                            </div>
                        </div>
                        
                        ${material.description ? `
                            <p class="card-text text-muted small mb-3">${material.description}</p>
                        ` : ''}
                        
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">
                                <i class="fas fa-calendar me-1"></i>
                                ${new Date(material.uploaded_at).toLocaleDateString('es-ES')}
                            </small>
                            <a href="/uploads/materials/${material.filename}" 
                               class="btn btn-outline-primary btn-sm" 
                               download="${material.original_name || material.filename}"
                               >
                                <i class="fas fa-download me-1"></i>
                                Descargar
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getFileIcon(extension) {
        const iconMap = {
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'txt': 'fas fa-file-alt',
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'png': 'fas fa-file-image',
                        'gif': 'fas fa-file-image',
            'mp4': 'fas fa-file-video',
            'avi': 'fas fa-file-video',
            'mov': 'fas fa-file-video',
            'mp3': 'fas fa-file-audio',
            'wav': 'fas fa-file-audio',
            'zip': 'fas fa-file-archive',
            'rar': 'fas fa-file-archive'
        };
        
        return iconMap[extension] || 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    validateFile(file) {
        const fileInput = document.getElementById('work-file');
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!file) return;

        // Validar tipo de archivo
        if (!allowedTypes.includes(file.type)) {
            this.showFileError('Tipo de archivo no permitido. Solo se aceptan PDF, DOCX, PNG y JPG.');
            fileInput.value = '';
            return false;
        }

        // Validar tamaño
        if (file.size > maxSize) {
            this.showFileError('El archivo es demasiado grande. El tamaño máximo es 10MB.');
            fileInput.value = '';
            return false;
        }

        // Limpiar errores previos
        this.clearFileError();
        return true;
    }

    showFileError(message) {
        const fileInput = document.getElementById('work-file');
        let errorDiv = fileInput.parentNode.querySelector('.file-error');
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'file-error text-danger small mt-1';
            fileInput.parentNode.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i>${message}`;
        fileInput.classList.add('is-invalid');
    }

    clearFileError() {
        const fileInput = document.getElementById('work-file');
        const errorDiv = fileInput.parentNode.querySelector('.file-error');
        
        if (errorDiv) {
            errorDiv.remove();
        }
        
        fileInput.classList.remove('is-invalid');
    }

    async handleSubmission() {
        const title = document.getElementById('work-title').value;
        const description = document.getElementById('work-description').value;
        const fileInput = document.getElementById('work-file');
        const file = fileInput.files[0];

        // Validaciones
        if (!title.trim()) {
            this.showAlert('Por favor, ingresa un título para el trabajo', 'danger');
            return;
        }

        if (!file) {
            this.showAlert('Por favor, selecciona un archivo para entregar', 'danger');
            return;
        }

        if (!this.validateFile(file)) {
            return;
        }

        // Verificar autenticación
        const token = window.authManager.getToken();
        if (!token) {
            this.showAlert('Debes iniciar sesión para entregar trabajos', 'danger');
            return;
        }

        try {
            this.setSubmissionLoading(true);

            // Crear FormData para envío de archivo
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('description', description.trim());
            formData.append('file', file);

            const response = await fetch('/api/submissions/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Mostrar mensaje de éxito
                this.showAlert('¡Trabajo entregado exitosamente! Recibirás un email de confirmación.', 'success');
                
                // Limpiar formulario
                document.getElementById('submission-form').reset();
                this.clearFileError();
                
                // Recargar lista de entregas
                if (window.authManager) {
                    window.authManager.loadUserSubmissions();
                }

            } else {
                this.showAlert(data.error || 'Error al entregar el trabajo', 'danger');
            }

        } catch (error) {
            console.error('Error en entrega:', error);
            this.showAlert('Error de conexión. Intenta nuevamente', 'danger');
        } finally {
            this.setSubmissionLoading(false);
        }
    }

    setSubmissionLoading(isLoading) {
        const form = document.getElementById('submission-form');
        const submitBtn = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, textarea');
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Entregando...
            `;
            inputs.forEach(input => input.disabled = true);
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <i class="fas fa-paper-plane me-2"></i>
                Entregar Trabajo
            `;
            inputs.forEach(input => input.disabled = false);
        }
    }

    setupSmoothScrolling() {
        // Smooth scrolling para enlaces de navegación
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    showAlert(message, type = 'info') {
        // Reutilizar la función del AuthManager
        if (window.authManager) {
            window.authManager.showAlert(message, type);
        } else {
            // Fallback si AuthManager no está disponible
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Funciones utilitarias globales
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.authManager) {
            window.authManager.showAlert('Copiado al portapapeles', 'success');
        }
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.appManager = new AppManager();
    
    // Agregar efectos de animación a las cards
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);

    // Observar todas las cards
    document.querySelectorAll('.card').forEach(card => {
        observer.observe(card);
    });
});

// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada:', e.reason);
});