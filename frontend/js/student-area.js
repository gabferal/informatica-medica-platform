class StudentArea {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.deleteSubmissionId = null;
        
        this.init();
    }

    init() {
        // Verificar autenticación
        if (!this.token || !this.user) {
            window.location.href = 'index.html';
            return;
        }

        this.updateUserInfo();
        this.setupEventListeners();
        this.loadSubmissions();
    }

    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `👋 Hola, ${this.user.nombre} (${this.user.ra})`;
        }
    }

    setupEventListeners() {
        // Formulario de subida
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpload();
            });
        }

        // Modal de eliminación
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                this.deleteSubmission(this.deleteSubmissionId);
            });
        }
    }

    async handleUpload() {
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const fileInput = document.getElementById('file');
        const file = fileInput.files[0];

        if (!title) {
            this.showAlert('El título es obligatorio', 'danger');
            return;
        }

        if (!file) {
            this.showAlert('Debes seleccionar un archivo', 'danger');
            return;
        }

        // Verificar tamaño del archivo (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showAlert('El archivo es demasiado grande. Máximo 10MB', 'danger');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('file', file);

        try {
            this.setUploadLoading(true);

            const response = await fetch('/api/submissions/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('¡Trabajo subido exitosamente!', 'success');
                document.getElementById('upload-form').reset();
                this.loadSubmissions(); // Recargar lista
            } else {
                this.showAlert(data.error || 'Error al subir el archivo', 'danger');
            }

        } catch (error) {
            console.error('Error en subida:', error);
            this.showAlert('Error de conexión. Intenta nuevamente', 'danger');
        } finally {
            this.setUploadLoading(false);
        }
    }

    async loadSubmissions() {
        try {
            const response = await fetch('/api/submissions/my-submissions', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const submissions = await response.json();

            if (response.ok) {
                this.renderSubmissions(submissions);
            } else {
                this.showAlert('Error al cargar entregas', 'danger');
            }

        } catch (error) {
            console.error('Error cargando entregas:', error);
            this.showAlert('Error de conexión', 'danger');
        }
    }

    renderSubmissions(submissions) {
        const container = document.getElementById('submissions-list');
        
        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No tienes entregas aún</p>
                    <p class="small text-muted">Sube tu primer trabajo usando el formulario de arriba</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Archivo</th>
                            <th>Fecha de Entrega</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${submissions.map(submission => `
                            <tr>
                                <td>
                                    <strong>${submission.title}</strong>
                                    ${submission.description ? `<br><small class="text-muted">${submission.description}</small>` : ''}
                                </td>
                                <td>
                                    <i class="fas fa-file-alt text-primary me-1"></i>
                                    ${submission.original_name}
                                </td>
                                <td>
                                    <small>${new Date(submission.submitted_at).toLocaleString('es-ES')}</small>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm" role="group">
                                        <button class="btn btn-outline-primary" 
                                                onclick="studentArea.downloadSubmission(${submission.id})"
                                                title="Descargar">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" 
                                                onclick="studentArea.confirmDelete(${submission.id}, '${submission.title}')"
                                                title="Eliminar">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // MÉTODO MEJORADO PARA DESCARGA
    downloadSubmission(id) {
        console.log('Iniciando descarga de entrega:', id);
        
        // Crear un enlace temporal con el token
        const downloadUrl = `/api/submissions/download/${id}?token=${encodeURIComponent(this.token)}`;
        
        // Crear elemento <a> temporal para forzar la descarga
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.style.display = 'none';
        
        // Agregar al DOM, hacer clic y remover
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Mostrar mensaje de confirmación
        this.showAlert('Descarga iniciada', 'success');
    }

    confirmDelete(id, title) {
        this.deleteSubmissionId = id;
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        
        // Actualizar el texto del modal
        const modalBody = document.querySelector('#deleteModal .modal-body');
        modalBody.innerHTML = `
            <p>¿Estás seguro de que quieres eliminar esta entrega?</p>
            <p><strong>"${title}"</strong></p>
            <p class="text-danger"><strong>Esta acción no se puede deshacer.</strong></p>
        `;
        
        modal.show();
    }

    async deleteSubmission(id) {
        try {
            const response = await fetch(`/api/submissions/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Entrega eliminada exitosamente', 'success');
                this.loadSubmissions(); // Recargar lista
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                modal.hide();
            } else {
                this.showAlert(data.error || 'Error al eliminar la entrega', 'danger');
            }

        } catch (error) {
            console.error('Error eliminando entrega:', error);
            this.showAlert('Error de conexión', 'danger');
        }
    }

    setUploadLoading(isLoading) {
        const submitBtn = document.querySelector('#upload-form button[type="submit"]');
        const form = document.getElementById('upload-form');
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Subiendo...
            `;
            form.style.opacity = '0.7';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <i class="fas fa-upload me-2"></i>
                Subir Trabajo
            `;
            form.style.opacity = '1';
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
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.studentArea = new StudentArea();
});