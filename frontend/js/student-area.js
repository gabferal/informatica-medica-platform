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
        this.loadStats();        // ← AGREGADO: Cargar estadísticas
        this.loadSubmissions();
    }

    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            // ✅ CORREGIDO: Usar this.user.name en lugar de this.user.nombre
            const userName = this.user.name || this.user.nombre || this.user.email;
            const userRa = this.user.ra || 'Sin RA';
            userInfo.innerHTML = `👋 Hola, ${userName} (${userRa})`;
        }
    }

    // ✅ AGREGADO: Método para cargar estadísticas del estudiante
    async loadStats() {
        try {
            console.log('📊 Cargando estadísticas del estudiante...');
            
            const response = await fetch('/api/submissions/my-submissions', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const submissions = await response.json();
                this.updateStatsDisplay(submissions);
                console.log(`✅ Estadísticas actualizadas: ${submissions.length} entregas`);
            } else {
                console.error('Error cargando estadísticas:', response.status);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    // ✅ AGREGADO: Actualizar display de estadísticas
    updateStatsDisplay(submissions) {
        const totalSubmissions = submissions.length;
        
        // Calcular entregas de esta semana
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const thisWeekSubmissions = submissions.filter(sub => 
            new Date(sub.submitted_at) >= oneWeekAgo
        ).length;

        // Calcular entregas de hoy
        const today = new Date().toISOString().split('T')[0];
        const todaySubmissions = submissions.filter(sub => 
            sub.submitted_at && sub.submitted_at.split('T')[0] === today
        ).length;

        // Actualizar elementos en el DOM
        const elements = {
            'total-submissions': totalSubmissions,
            'submissions-week': thisWeekSubmissions,
            'submissions-today': todaySubmissions,
            'last-submission': submissions.length > 0 ? 
                new Date(submissions[0].submitted_at).toLocaleDateString('es-ES') : 
                'Ninguna'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
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
                
                // ✅ AGREGADO: Actualizar estadísticas y lista después de subir
                this.loadStats();
                this.loadSubmissions();
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
            console.log('📋 Cargando entregas del estudiante...');
            
            const response = await fetch('/api/submissions/my-submissions', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Token inválido, redirigir al login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'index.html';
                return;
            }

            const submissions = await response.json();

            if (response.ok) {
                this.renderSubmissions(submissions);
                console.log(`✅ Cargadas ${submissions.length} entregas del estudiante`);
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
        
        if (!container) {
            console.error('❌ No se encontró el contenedor submissions-list');
            return;
        }
        
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
                                    <strong>${submission.title || 'Sin título'}</strong>
                                    ${submission.description ? `<br><small class="text-muted">${submission.description}</small>` : ''}
                                </td>
                                <td>
                                    <i class="fas fa-file-alt text-primary me-1"></i>
                                    ${submission.original_name || submission.filename || 'Sin archivo'}
                                </td>
                                <td>
                                    <small>${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('es-ES') : 'Sin fecha'}</small>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm" role="group">
                                        <button class="btn btn-outline-primary" 
                                                onclick="studentArea.downloadSubmission(${submission.id})"
                                                title="Descargar">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" 
                                                onclick="studentArea.confirmDelete(${submission.id}, '${(submission.title || 'Sin título').replace(/'/g, '\'')}')"
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
            
            <div class="mt-3">
                <small class="text-muted">
                    Total: ${submissions.length} entrega${submissions.length !== 1 ? 's' : ''}
                </small>
            </div>
        `;
    }

    downloadSubmission(id) {
        console.log('📥 Iniciando descarga de entrega:', id);
        
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
        if (modalBody) {
            modalBody.innerHTML = `
                <p>¿Estás seguro de que quieres eliminar esta entrega?</p>
                <p><strong>"${title}"</strong></p>
                <p class="text-danger"><strong>Esta acción no se puede deshacer.</strong></p>
            `;
        }
        
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
                
                // ✅ AGREGADO: Actualizar estadísticas y lista después de eliminar
                this.loadStats();
                this.loadSubmissions();
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                if (modal) {
                    modal.hide();
                }
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
        
        if (submitBtn) {
            if (isLoading) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                    Subiendo...
                `;
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <i class="fas fa-upload me-2"></i>
                    Subir Trabajo
                `;
            }
        }
        
        if (form) {
            form.style.opacity = isLoading ? '0.7' : '1';
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