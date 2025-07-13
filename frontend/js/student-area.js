// ✅ MEJORA: Configuración global y constantes
const CONFIG = {
    API_BASE: '/api',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'image/png',
        'image/jpeg'
    ],
    ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.txt', '.zip', '.png', '.jpg', '.jpeg'],
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// ✅ MEJORA: Estado global de la aplicación
const AppState = {
    isLoading: false,
    submissions: [],
    currentUser: null,
    lastUpdate: null,
    uploadInProgress: false
};

// ✅ MEJORA: Utilidades para manejo de errores y UI
const UIUtils = {
    // Mostrar alertas mejoradas
    showAlert(message, type = 'info', duration = 5000) {
        const alertContainer = document.getElementById('alert-container') || this.createAlertContainer();
        
        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-dismiss después del tiempo especificado
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, duration);
    },

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alert-container';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    },

    getAlertIcon(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    // Mostrar/ocultar loading states
    setLoadingState(element, isLoading, originalText = '') {
        if (isLoading) {
            element.disabled = true;
            element.dataset.originalText = element.innerHTML;
            element.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Cargando...
            `;
        } else {
            element.disabled = false;
            element.innerHTML = element.dataset.originalText || originalText;
        }
    },

    // Formatear tamaño de archivo
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // Formatear fecha
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.warn('Error formateando fecha:', error);
            return dateString;
        }
    },

    // Obtener icono por tipo de archivo
    getFileIcon(mimeType) {
        const iconMap = {
            'application/pdf': 'fas fa-file-pdf text-danger',
            'application/msword': 'fas fa-file-word text-primary',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word text-primary',
            'text/plain': 'fas fa-file-alt text-secondary',
            'application/zip': 'fas fa-file-archive text-warning',
            'application/x-zip-compressed': 'fas fa-file-archive text-warning',
            'image/png': 'fas fa-file-image text-success',
            'image/jpeg': 'fas fa-file-image text-success'
        };
        return iconMap[mimeType] || 'fas fa-file text-muted';
    }
};

// ✅ MEJORA: Clase para manejo de API con retry y mejor error handling
class APIClient {
    constructor() {
        this.baseURL = CONFIG.API_BASE;
        this.token = localStorage.getItem('token');
    }

    // Obtener headers con token
    getHeaders(includeContentType = true) {
        const headers = {
            'Authorization': `Bearer ${this.token}`
        };
        
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        
        return headers;
    }

    // Realizar petición con retry automático
    async request(url, options = {}, retryCount = 0) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                ...options,
                headers: {
                    ...this.getHeaders(!options.body || !(options.body instanceof FormData)),
                    ...options.headers
                }
            });

            // ✅ MEJORA: Verificar headers de advertencia de token
            const tokenWarning = response.headers.get('X-Token-Warning');
            if (tokenWarning) {
                console.warn('⚠️ Advertencia de token:', tokenWarning);
                UIUtils.showAlert('Tu sesión expirará pronto. Considera recargar la página.', 'warning', 8000);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(response.status, errorData.error || 'Error en la petición', errorData.code);
            }

            return await response.json();
        } catch (error) {
            // ✅ MEJORA: Retry automático para errores de red
            if (retryCount < CONFIG.RETRY_ATTEMPTS && this.shouldRetry(error)) {
                console.log(`🔄 Reintentando petición (${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS}):`, url);
                await this.delay(CONFIG.RETRY_DELAY * (retryCount + 1));
                return this.request(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    shouldRetry(error) {
        return error.name === 'TypeError' || // Network errors
               (error.status >= 500 && error.status < 600); // Server errors
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Métodos específicos de API
    async getSubmissions() {
        return this.request('/submissions/my-submissions');
    }

    async uploadSubmission(formData) {
        return this.request('/submissions/upload', {
            method: 'POST',
            body: formData
        });
    }

    async deleteSubmission(id) {
        return this.request(`/submissions/${id}`, {
            method: 'DELETE'
        });
    }

    async downloadSubmission(id) {
        const url = `${this.baseURL}/submissions/download/${id}?token=${this.token}`;
        window.open(url, '_blank');
    }
}

// ✅ MEJORA: Clase de error personalizada
class APIError extends Error {
    constructor(status, message, code) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
    }
}

// ✅ MEJORA: Clase principal de la aplicación
class StudentArea {
    constructor() {
        this.api = new APIClient();
        this.initializeElements();
        this.attachEventListeners();
        this.loadSubmissions();
        this.setupFileValidation();
    }

    initializeElements() {
        // Elementos del DOM
        this.elements = {
            uploadForm: document.getElementById('uploadForm'),
            fileInput: document.getElementById('file'),
            titleInput: document.getElementById('title'),
            descriptionInput: document.getElementById('description'),
            uploadBtn: document.getElementById('uploadBtn'),
            submissionsList: document.getElementById('submissionsList'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            emptyState: document.getElementById('emptyState'),
            fileInfo: document.getElementById('fileInfo'),
            fileError: document.getElementById('fileError')
        };

        // Verificar elementos críticos
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('❌ Elementos DOM faltantes:', missingElements);
            UIUtils.showAlert('Error inicializando la aplicación. Recarga la página.', 'danger');
        }
    }

    attachEventListeners() {
        // ✅ MEJORA: Event listeners con mejor manejo de errores
        if (this.elements.uploadForm) {
            this.elements.uploadForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileChange(e));
        }

        // ✅ MEJORA: Validación en tiempo real del título
        if (this.elements.titleInput) {
            this.elements.titleInput.addEventListener('input', (e) => this.validateTitle(e.target.value));
        }

        // ✅ MEJORA: Auto-resize del textarea de descripción
        if (this.elements.descriptionInput) {
            this.elements.descriptionInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
            });
        }

        // ✅ MEJORA: Prevenir pérdida de datos accidental
        window.addEventListener('beforeunload', (e) => {
            if (AppState.uploadInProgress) {
                e.preventDefault();
                e.returnValue = '¿Estás seguro? Hay una subida en progreso.';
            }
        });
    }

    setupFileValidation() {
        if (!this.elements.fileInput) return;

        // ✅ MEJORA: Configurar atributos de validación
        this.elements.fileInput.setAttribute('accept', CONFIG.ALLOWED_EXTENSIONS.join(','));
        
        // ✅ MEJORA: Drag & Drop support
        const dropZone = this.elements.fileInput.closest('.mb-3');
        if (dropZone) {
            this.setupDragAndDrop(dropZone);
        }
    }

    setupDragAndDrop(dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('border-primary', 'bg-light');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('border-primary', 'bg-light');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.elements.fileInput.files = files;
                this.handleFileChange({ target: { files } });
            }
        });
    }

    // ✅ MEJORA: Validación de archivo mejorada
    validateFile(file) {
        const errors = [];

        if (!file) {
            errors.push('Debe seleccionar un archivo');
            return { isValid: false, errors };
        }

        // Validar tamaño
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            errors.push(`El archivo es demasiado grande. Máximo: ${UIUtils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`);
        }

        // Validar tipo MIME
        if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
            errors.push(`Tipo de archivo no permitido. Tipos válidos: ${CONFIG.ALLOWED_EXTENSIONS.join(', ')}`);
        }

        // Validar extensión
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
            errors.push(`Extensión no permitida: ${extension}`);
        }

        // Validar nombre de archivo
        if (file.name.length > 255) {
            errors.push('El nombre del archivo es demasiado largo');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        const validation = this.validateFile(file);

        // Limpiar estados anteriores
        this.clearFileMessages();

        if (!validation.isValid) {
            this.showFileErrors(validation.errors);
            this.elements.uploadBtn.disabled = true;
            return;
        }

        this.showFileInfo(file);
        this.updateUploadButtonState();
    }

    clearFileMessages() {
        if (this.elements.fileInfo) {
            this.elements.fileInfo.style.display = 'none';
        }
        if (this.elements.fileError) {
            this.elements.fileError.style.display = 'none';
        }
    }

    showFileErrors(errors) {
        if (!this.elements.fileError) return;

        this.elements.fileError.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Error en el archivo:</strong>
                <ul class="mb-0 mt-2">
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
        this.elements.fileError.style.display = 'block';
    }

    showFileInfo(file) {
        if (!this.elements.fileInfo) return;

        const icon = UIUtils.getFileIcon(file.type);
        this.elements.fileInfo.innerHTML = `
            <div class="alert alert-success">
                <i class="${icon} me-2"></i>
                <strong>Archivo seleccionado:</strong> ${file.name}
                <br>
                <small class="text-muted">
                    Tamaño: ${UIUtils.formatFileSize(file.size)} | 
                    Tipo: ${file.type || 'Desconocido'}
                </small>
            </div>
        `;
        this.elements.fileInfo.style.display = 'block';
    }

    validateTitle(title) {
        const titleGroup = this.elements.titleInput?.closest('.mb-3');
        if (!titleGroup) return true;

        const feedback = titleGroup.querySelector('.invalid-feedback') || this.createFeedbackElement(titleGroup);
        
        if (!title || title.trim().length === 0) {
            this.elements.titleInput.classList.add('is-invalid');
            feedback.textContent = 'El título es obligatorio';
            return false;
        }

        if (title.length > 200) {
            this.elements.titleInput.classList.add('is-invalid');
            feedback.textContent = 'El título es demasiado largo (máximo 200 caracteres)';
            return false;
        }

        this.elements.titleInput.classList.remove('is-invalid');
        this.elements.titleInput.classList.add('is-valid');
        return true;
    }

    createFeedbackElement(parent) {
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        parent.appendChild(feedback);
        return feedback;
    }

    updateUploadButtonState() {
        if (!this.elements.uploadBtn) return;

        const hasFile = this.elements.fileInput?.files?.length > 0;
        const hasTitle = this.elements.titleInput?.value?.trim().length > 0;
        const isValid = hasFile && hasTitle && !AppState.uploadInProgress;

        this.elements.uploadBtn.disabled = !isValid;
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (AppState.uploadInProgress) {
            UIUtils.showAlert('Ya hay una subida en progreso', 'warning');
            return;
        }

        // ✅ MEJORA: Validación completa antes de enviar
        const title = this.elements.titleInput?.value?.trim();
        const description = this.elements.descriptionInput?.value?.trim();
        const file = this.elements.fileInput?.files[0];

        if (!this.validateTitle(title)) {
            UIUtils.showAlert('Por favor corrige los errores en el formulario', 'danger');
            return;
        }

        const fileValidation = this.validateFile(file);
        if (!fileValidation.isValid) {
            this.showFileErrors(fileValidation.errors);
            UIUtils.showAlert('Por favor selecciona un archivo válido', 'danger');
            return;
        }

        await this.uploadFile(title, description, file);
    }

    async uploadFile(title, description, file) {
        AppState.uploadInProgress = true;
        UIUtils.setLoadingState(this.elements.uploadBtn, true);

        try {
            console.log('📤 Iniciando subida:', { title, filename: file.name, size: file.size });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            if (description) {
                formData.append('description', description);
            }

            const result = await this.api.uploadSubmission(formData);

            console.log('✅ Subida exitosa:', result);
            
            UIUtils.showAlert(
                `¡Archivo "${file.name}" subido exitosamente!`, 
                'success'
            );

            // ✅ MEJORA: Limpiar formulario y actualizar lista
            this.resetForm();
            await this.loadSubmissions();

        } catch (error) {
            console.error('❌ Error en subida:', error);
            this.handleUploadError(error);
        } finally {
            AppState.uploadInProgress = false;
            UIUtils.setLoadingState(this.elements.uploadBtn, false);
            this.updateUploadButtonState();
        }
    }

    handleUploadError(error) {
        let message = 'Error al subir el archivo';
        
        if (error instanceof APIError) {
            switch (error.code) {
                case 'TITLE_REQUIRED':
                    message = 'El título es obligatorio';
                    break;
                case 'FILE_REQUIRED':
                    message = 'Debe seleccionar un archivo';
                    break;
                case 'FILE_PROCESSING_ERROR':
                    message = 'Error procesando el archivo. Inténtalo de nuevo.';
                    break;
                case 'DUPLICATE_TITLE':
                    message = 'Ya existe una entrega con ese título';
                    break;
                default:
                    message = error.message || message;
            }
        }

        UIUtils.showAlert(message, 'danger');
    }

    resetForm() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.reset();
        }
        
        this.clearFileMessages();
        
        // Limpiar clases de validación
        [this.elements.titleInput, this.elements.fileInput].forEach(input => {
            if (input) {
                input.classList.remove('is-valid', 'is-invalid');
            }
        });

        this.updateUploadButtonState();
    }

    async loadSubmissions() {
        if (AppState.isLoading) return;

        AppState.isLoading = true;
        this.showLoadingState();

        try {
            console.log('📋 Cargando entregas...');
            
            const submissions = await this.api.getSubmissions();
            
            console.log(`✅ Cargadas ${submissions.length} entregas`);
            
            AppState.submissions = submissions;
            AppState.lastUpdate = new Date();
            
            this.renderSubmissions(submissions);

        } catch (error) {
            console.error('❌ Error cargando entregas:', error);
            this.handleLoadError(error);
        } finally {
            AppState.isLoading = false;
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'block';
        }
        if (this.elements.submissionsList) {
            this.elements.submissionsList.style.display = 'none';
        }
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'none';
        }
    }

    hideLoadingState() {
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'none';
        }
    }

    handleLoadError(error) {
        let message = 'Error al cargar las entregas';
        
        if (error instanceof APIError) {
            if (error.status === 401) {
                message = 'Sesión expirada. Por favor inicia sesión nuevamente.';
                // Redirigir al login después de un delay
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 3000);
            } else {
                message = error.message || message;
            }
        }

        UIUtils.showAlert(message, 'danger');
        
        // Mostrar estado de error en lugar de lista vacía
        this.renderErrorState(message);
    }

    renderErrorState(message) {
        if (!this.elements.submissionsList) return;

        this.elements.submissionsList.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <h5>Error al cargar entregas</h5>
                <p>${message}</p>
                <button class="btn btn-outline-danger" onclick="studentArea.loadSubmissions()">
                    <i class="fas fa-redo me-2"></i>Reintentar
                </button>
            </div>
        `;
        this.elements.submissionsList.style.display = 'block';
    }

    renderSubmissions(submissions) {
        if (!this.elements.submissionsList) return;

        if (submissions.length === 0) {
            this.showEmptyState();
            return;
        }

        const submissionsHtml = submissions.map(submission => 
            this.createSubmissionCard(submission)
        ).join('');

        this.elements.submissionsList.innerHTML = submissionsHtml;
        this.elements.submissionsList.style.display = 'block';
        
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'none';
        }
    }

    showEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'block';
        }
        if (this.elements.submissionsList) {
            this.elements.submissionsList.style.display = 'none';
        }
    }

    createSubmissionCard(submission) {
        const icon = UIUtils.getFileIcon(submission.mime_type);
        const formattedDate = UIUtils.formatDate(submission.submitted_at);
        const formattedSize = UIUtils.formatFileSize(submission.file_size);

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 submission-card" data-id="${submission.id}">
                    <div class="card-body">
                        <div class="d-flex align-items-start mb-3">
                            <i class="${icon} fa-2x me-3"></i>
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${this.escapeHtml(submission.title)}</h6>
                                <small class="text-muted">${this.escapeHtml(submission.original_name)}</small>
                            </div>
                        </div>
                        
                        ${submission.description ? `
                            <p class="card-text text-muted small mb-3">
                                ${this.escapeHtml(submission.description)}
                            </p>
                        ` : ''}
                        
                        <div class="submission-meta mb-3">
                            <small class="text-muted d-block">
                                <i class="fas fa-calendar me-1"></i>
                                ${formattedDate}
                            </small>
                            <small class="text-muted d-block">
                                <i class="fas fa-hdd me-1"></i>
                                ${formattedSize}
                            </small>
                        </div>
                    </div>
                    
                    <div class="card-footer bg-transparent">
                        <div class="btn-group w-100" role="group">
                            <button class="btn btn-outline-primary btn-sm" 
                                    onclick="studentArea.downloadSubmission(${submission.id})"
                                    title="Descargar archivo">
                                <i class="fas fa-download me-1"></i>
                                Descargar
                            </button>
                            <button class="btn btn-outline-danger btn-sm" 
                                    onclick="studentArea.confirmDelete(${submission.id}, '${this.escapeHtml(submission.title)}')"
                                    title="Eliminar entrega">
                                <i class="fas fa-trash me-1"></i>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async downloadSubmission(id) {
        try {
            console.log('📥 Descargando entrega:', id);
            await this.api.downloadSubmission(id);
            
            UIUtils.showAlert('Descarga iniciada', 'success', 2000);
            
        } catch (error) {
            console.error('❌ Error en descarga:', error);
            UIUtils.showAlert('Error al descargar el archivo', 'danger');
        }
    }

    confirmDelete(id, title) {
        // ✅ MEJORA: Modal de confirmación más informativo
        const modal = this.createDeleteModal(id, title);
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Limpiar modal cuando se cierre
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    createDeleteModal(id, title) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-exclamation-triangle text-warning me-2"></i>
                            Confirmar eliminación
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Estás seguro de que quieres eliminar la siguiente entrega?</p>
                        <div class="alert alert-warning">
                            <strong>Título:</strong> ${this.escapeHtml(title)}
                        </div>
                        <p class="text-danger small">
                            <i class="fas fa-exclamation-circle me-1"></i>
                            Esta acción no se puede deshacer.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-danger" onclick="studentArea.deleteSubmission(${id})" data-bs-dismiss="modal">
                            <i class="fas fa-trash me-1"></i>
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    async deleteSubmission(id) {
        try {
            console.log('🗑️ Eliminando entrega:', id);
            
            const result = await this.api.deleteSubmission(id);
            
            console.log('✅ Entrega eliminada:', result);
            
            UIUtils.showAlert('Entrega eliminada exitosamente', 'success');
            
                        // ✅ MEJORA: Actualizar lista sin recargar completamente
            await this.loadSubmissions();
            
        } catch (error) {
            console.error('❌ Error eliminando entrega:', error);
            this.handleDeleteError(error);
        }
    }

    handleDeleteError(error) {
        let message = 'Error al eliminar la entrega';
        
        if (error instanceof APIError) {
            switch (error.code) {
                case 'NOT_FOUND_OR_UNAUTHORIZED':
                    message = 'No tienes permisos para eliminar esta entrega';
                    break;
                case 'DATABASE_ERROR':
                    message = 'Error en la base de datos. Inténtalo de nuevo.';
                    break;
                default:
                    message = error.message || message;
            }
        }

        UIUtils.showAlert(message, 'danger');
    }

    // ✅ MEJORA: Método para refrescar datos automáticamente
    startAutoRefresh(intervalMinutes = 5) {
        setInterval(() => {
            if (!AppState.isLoading && !AppState.uploadInProgress) {
                console.log('🔄 Auto-refresh de entregas');
                this.loadSubmissions();
            }
        }, intervalMinutes * 60 * 1000);
    }

    // ✅ MEJORA: Método para verificar conectividad
    async checkConnectivity() {
        try {
            await fetch('/api/health', { method: 'HEAD' });
            return true;
        } catch (error) {
            return false;
        }
    }

    // ✅ MEJORA: Manejo de eventos de conectividad
    setupConnectivityHandlers() {
        window.addEventListener('online', () => {
            UIUtils.showAlert('Conexión restaurada', 'success', 3000);
            this.loadSubmissions();
        });

        window.addEventListener('offline', () => {
            UIUtils.showAlert('Sin conexión a internet', 'warning', 5000);
        });
    }

    // ✅ MEJORA: Método para exportar datos del usuario
    exportUserData() {
        if (AppState.submissions.length === 0) {
            UIUtils.showAlert('No hay entregas para exportar', 'info');
            return;
        }

        const data = {
            exportDate: new Date().toISOString(),
            totalSubmissions: AppState.submissions.length,
            submissions: AppState.submissions.map(s => ({
                id: s.id,
                title: s.title,
                description: s.description,
                originalName: s.original_name,
                fileSize: s.file_size,
                mimeType: s.mime_type,
                submittedAt: s.submitted_at
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis_entregas_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UIUtils.showAlert('Datos exportados exitosamente', 'success');
    }

    // ✅ MEJORA: Método para buscar entregas
    searchSubmissions(query) {
        if (!query || query.trim().length === 0) {
            this.renderSubmissions(AppState.submissions);
            return;
        }

        const searchTerm = query.toLowerCase().trim();
        const filtered = AppState.submissions.filter(submission => 
            submission.title.toLowerCase().includes(searchTerm) ||
            submission.description?.toLowerCase().includes(searchTerm) ||
            submission.original_name.toLowerCase().includes(searchTerm)
        );

        this.renderSubmissions(filtered);
        
        // Mostrar resultado de búsqueda
        const resultText = filtered.length === 1 ? '1 resultado' : `${filtered.length} resultados`;
        UIUtils.showAlert(`Búsqueda: "${query}" - ${resultText}`, 'info', 3000);
    }

    // ✅ MEJORA: Método para ordenar entregas
    sortSubmissions(criteria = 'date', order = 'desc') {
        const sorted = [...AppState.submissions].sort((a, b) => {
            let comparison = 0;
            
            switch (criteria) {
                case 'date':
                    comparison = new Date(a.submitted_at) - new Date(b.submitted_at);
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'size':
                    comparison = a.file_size - b.file_size;
                    break;
                case 'type':
                    comparison = a.mime_type.localeCompare(b.mime_type);
                    break;
            }
            
            return order === 'desc' ? -comparison : comparison;
        });

        this.renderSubmissions(sorted);
    }

    // ✅ MEJORA: Método para obtener estadísticas del usuario
    getUserStats() {
        if (AppState.submissions.length === 0) {
            return {
                totalSubmissions: 0,
                totalSize: 0,
                averageSize: 0,
                fileTypes: {},
                oldestSubmission: null,
                newestSubmission: null
            };
        }

        const totalSize = AppState.submissions.reduce((sum, s) => sum + (s.file_size || 0), 0);
        const fileTypes = AppState.submissions.reduce((types, s) => {
            types[s.mime_type] = (types[s.mime_type] || 0) + 1;
            return types;
        }, {});

        const dates = AppState.submissions.map(s => new Date(s.submitted_at)).sort();

        return {
            totalSubmissions: AppState.submissions.length,
            totalSize,
            averageSize: totalSize / AppState.submissions.length,
            fileTypes,
            oldestSubmission: dates[0],
            newestSubmission: dates[dates.length - 1]
        };
    }

    // ✅ MEJORA: Método para mostrar estadísticas
    showUserStats() {
        const stats = this.getUserStats();
        
        if (stats.totalSubmissions === 0) {
            UIUtils.showAlert('No hay entregas para mostrar estadísticas', 'info');
            return;
        }

        const modal = this.createStatsModal(stats);
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    createStatsModal(stats) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        
        const fileTypesHtml = Object.entries(stats.fileTypes)
            .map(([type, count]) => {
                const icon = UIUtils.getFileIcon(type);
                const percentage = ((count / stats.totalSubmissions) * 100).toFixed(1);
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span><i class="${icon} me-2"></i>${type}</span>
                        <span class="badge bg-primary">${count} (${percentage}%)</span>
                    </div>
                `;
            }).join('');

        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-chart-bar me-2"></i>
                            Mis Estadísticas
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card mb-3">
                                    <div class="card-body text-center">
                                        <i class="fas fa-file fa-2x text-primary mb-2"></i>
                                        <h4>${stats.totalSubmissions}</h4>
                                        <small class="text-muted">Total de Entregas</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card mb-3">
                                    <div class="card-body text-center">
                                        <i class="fas fa-hdd fa-2x text-success mb-2"></i>
                                        <h4>${UIUtils.formatFileSize(stats.totalSize)}</h4>
                                        <small class="text-muted">Espacio Utilizado</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card mb-3">
                                    <div class="card-body text-center">
                                        <i class="fas fa-calendar-plus fa-2x text-info mb-2"></i>
                                        <h6>${UIUtils.formatDate(stats.oldestSubmission)}</h6>
                                        <small class="text-muted">Primera Entrega</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card mb-3">
                                    <div class="card-body text-center">
                                        <i class="fas fa-calendar-check fa-2x text-warning mb-2"></i>
                                        <h6>${UIUtils.formatDate(stats.newestSubmission)}</h6>
                                        <small class="text-muted">Última Entrega</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">
                                    <i class="fas fa-file-alt me-2"></i>
                                    Tipos de Archivo
                                </h6>
                            </div>
                            <div class="card-body">
                                ${fileTypesHtml}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-primary" onclick="studentArea.exportUserData()">
                            <i class="fas fa-download me-1"></i>
                            Exportar Datos
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    // ✅ MEJORA: Método para inicializar funcionalidades adicionales
    initializeAdvancedFeatures() {
        // Auto-refresh cada 5 minutos
        this.startAutoRefresh(5);
        
        // Manejo de conectividad
        this.setupConnectivityHandlers();
        
        // Atajos de teclado
        this.setupKeyboardShortcuts();
        
        // Tooltips de Bootstrap
        this.initializeTooltips();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R: Refrescar entregas
            if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
                e.preventDefault();
                this.loadSubmissions();
                UIUtils.showAlert('Entregas actualizadas', 'info', 2000);
            }
            
            // Ctrl/Cmd + U: Enfocar campo de subida
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                this.elements.fileInput?.focus();
            }
            
            // Escape: Limpiar formulario
            if (e.key === 'Escape' && !AppState.uploadInProgress) {
                this.resetForm();
            }
        });
    }

    initializeTooltips() {
        // Inicializar tooltips de Bootstrap si están disponibles
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }

    // ✅ MEJORA: Método para cleanup al salir
    cleanup() {
        // Cancelar uploads en progreso
        if (AppState.uploadInProgress) {
            console.log('🛑 Cancelando upload en progreso...');
        }
        
        // Limpiar intervalos
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Limpiar event listeners
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
}

// ✅ MEJORA: Funciones globales para compatibilidad con HTML inline events
let studentArea;

// ✅ MEJORA: Inicialización con manejo de errores robusto
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('🚀 Inicializando Student Area...');
        
        // Verificar dependencias
        if (typeof bootstrap === 'undefined') {
            console.warn('⚠️ Bootstrap no detectado. Algunas funcionalidades pueden no funcionar.');
        }
        
        // Verificar token de autenticación
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('❌ No hay token de autenticación');
            UIUtils.showAlert('Sesión no válida. Redirigiendo al login...', 'danger');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        // Inicializar aplicación
        studentArea = new StudentArea();
        studentArea.initializeAdvancedFeatures();
        
        console.log('✅ Student Area inicializado correctamente');
        
        // Mostrar mensaje de bienvenida
        setTimeout(() => {
            UIUtils.showAlert('¡Bienvenido! Área de estudiante cargada correctamente.', 'success', 3000);
        }, 500);
        
    } catch (error) {
        console.error('❌ Error inicializando Student Area:', error);
        UIUtils.showAlert('Error inicializando la aplicación. Por favor recarga la página.', 'danger');
    }
});

// ✅ MEJORA: Cleanup al salir de la página
window.addEventListener('beforeunload', function() {
    if (studentArea) {
        studentArea.cleanup();
    }
});

// ✅ MEJORA: Manejo de errores globales
window.addEventListener('error', function(event) {
    console.error('❌ Error global:', event.error);
    UIUtils.showAlert('Ha ocurrido un error inesperado. Si persiste, recarga la página.', 'danger');
});

// ✅ MEJORA: Manejo de promesas rechazadas
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Promesa rechazada:', event.reason);
    UIUtils.showAlert('Error de conexión. Verifica tu internet e inténtalo de nuevo.', 'warning');
});

// ✅ MEJORA: Funciones de utilidad globales para el HTML
window.StudentAreaUtils = {
    refreshSubmissions: () => studentArea?.loadSubmissions(),
    showStats: () => studentArea?.showUserStats(),
    exportData: () => studentArea?.exportUserData(),
    searchSubmissions: (query) => studentArea?.searchSubmissions(query),
    sortSubmissions: (criteria, order) => studentArea?.sortSubmissions(criteria, order)
};
            