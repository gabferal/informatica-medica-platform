class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.submissions = [];
        this.filteredSubmissions = [];
        this.init();
    }

    init() {
        // VERIFICAR AUTENTICACIÓN ANTES DE CONTINUAR
        if (!this.checkAuthentication()) {
            return; // No continuar si no está autenticado
        }

        this.updateUserInfo();
        this.loadDashboardStats();
        this.loadAllSubmissions();
        this.setupEventListeners();
    }

    checkAuthentication() {
        if (!this.token || !this.user) {
            this.showUnauthorizedAccess();
            return false;
        }

        // Verificar que el token no haya expirado
        try {
            const tokenPayload = JSON.parse(atob(this.token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenPayload.exp < currentTime) {
                console.log('Token expirado');
                this.clearAuthAndRedirect();
                return false;
            }
        } catch (error) {
            console.log('Token inválido');
            this.clearAuthAndRedirect();
            return false;
        }

        return true;
    }

    showUnauthorizedAccess() {
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="card border-danger">
                            <div class="card-header bg-danger text-white text-center">
                                <h4><i class="fas fa-lock me-2"></i>Acceso Restringido</h4>
                            </div>
                            <div class="card-body text-center">
                                <div class="mb-4">
                                    <i class="fas fa-shield-alt fa-4x text-danger mb-3"></i>
                                    <h5>Panel de Administración</h5>
                                    <p class="text-muted">
                                        Necesitas iniciar sesión para acceder a esta área.
                                    </p>
                                </div>
                                
                                <div class="alert alert-warning">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Área Protegida:</strong> Solo usuarios autenticados pueden acceder.
                                </div>
                                
                                <div class="d-grid gap-2">
                                    <a href="index.html" class="btn btn-primary">
                                        <i class="fas fa-sign-in-alt me-2"></i>
                                        Ir a Iniciar Sesión
                                    </a>
                                    <a href="index.html" class="btn btn-outline-secondary">
                                        <i class="fas fa-home me-2"></i>
                                        Volver al Inicio
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    clearAuthAndRedirect() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.showUnauthorizedAccess();
    }

    updateUserInfo() {
        const userInfo = document.getElementById('admin-user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="me-3">👨‍💼 ${this.user.nombre} (${this.user.role.toUpperCase()})</span>
                <button class="btn btn-outline-light btn-sm" onclick="adminPanel.logout()">
                    <i class="fas fa-sign-out-alt me-1"></i>
                    Cerrar Sesión
                </button>
            `;
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    setupEventListeners() {
        // Filtros
        const searchStudent = document.getElementById('search-student');
        const filterDate = document.getElementById('filter-date');
        const filterTitle = document.getElementById('filter-title');

        if (searchStudent) {
            searchStudent.addEventListener('input', () => {
                this.applyFilters();
            });
        }
        
        if (filterDate) {
            filterDate.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        if (filterTitle) {
            filterTitle.addEventListener('input', () => {
                this.applyFilters();
            });
        }
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.clearAuthAndRedirect();
                return;
            }
            
            if (response.ok) {
                const stats = await response.json();
                this.updateDashboard(stats);
            } else {
                console.error('Error cargando estadísticas');
                this.updateDashboard({
                    totalStudents: '-',
                    totalSubmissions: '-',
                    submissionsToday: '-',
                    submissionsWeek: '-'
                });
            }
        } catch (error) {
            console.error('Error:', error);
            this.updateDashboard({
                totalStudents: 'Error',
                totalSubmissions: 'Error',
                submissionsToday: 'Error',
                submissionsWeek: 'Error'
            });
        }
    }

    updateDashboard(stats) {
        const elements = {
            'total-students': stats.totalStudents,
            'total-submissions': stats.totalSubmissions,
            'submissions-today': stats.submissionsToday,
            'email-status': '✓'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Actualizar el estado del email
        const emailStatus = document.getElementById('email-status');
        if (emailStatus) {
            emailStatus.parentElement.parentElement.className = 'card bg-success text-white';
        }
    }

    async loadAllSubmissions() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/admin/submissions', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.clearAuthAndRedirect();
                return;
            }
            
            if (response.ok) {
                this.submissions = await response.json();
                this.filteredSubmissions = [...this.submissions];
                this.renderSubmissions(this.filteredSubmissions);
            } else {
                this.showError('Error al cargar entregas');
            }
        } catch (error) {
            console.error('Error cargando entregas:', error);
            this.showError('Error de conexión');
        }
    }

    applyFilters() {
        const studentSearch = document.getElementById('search-student')?.value.toLowerCase() || '';
        const dateFilter = document.getElementById('filter-date')?.value || '';
        const titleFilter = document.getElementById('filter-title')?.value.toLowerCase() || '';

        this.filteredSubmissions = this.submissions.filter(submission => {
            const matchesStudent = !studentSearch || 
                submission.student_name.toLowerCase().includes(studentSearch) ||
                submission.student_email.toLowerCase().includes(studentSearch) ||
                submission.student_ra.toLowerCase().includes(studentSearch);

            const matchesDate = !dateFilter || 
                submission.submitted_at.split('T')[0] === dateFilter;

            const matchesTitle = !titleFilter || 
                submission.title.toLowerCase().includes(titleFilter);

            return matchesStudent && matchesDate && matchesTitle;
        });

        this.renderSubmissions(this.filteredSubmissions);
    }

    showLoading() {
        const container = document.getElementById('submissions-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando entregas...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const container = document.getElementById('submissions-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <p class="text-muted">${message}</p>
                    <button class="btn btn-outline-primary" onclick="adminPanel.loadAllSubmissions()">
                        <i class="fas fa-refresh me-1"></i>
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    renderSubmissions(submissions) {
        const container = document.getElementById('submissions-list');
        if (!container) return;
        
        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No hay entregas que coincidan con los filtros</p>
                    <button class="btn btn-outline-secondary" onclick="adminPanel.clearFilters()">
                        <i class="fas fa-times me-1"></i>
                        Limpiar filtros
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th>Estudiante</th>
                            <th>Trabajo</th>
                            <th>Archivo</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${submissions.map(submission => `
                            <tr>
                                <td>
                                    <div>
                                        <strong>${submission.student_name || 'Sin nombre'}</strong><br>
                                        <small class="text-muted">${submission.student_email}</small><br>
                                        <span class="badge bg-secondary">${submission.student_ra}</span>
                                    </div>
                                </td>
                                <td>
                                    <strong>${submission.title}</strong>
                                    ${submission.description ? `<br><small class="text-muted">${submission.description}</small>` : ''}
                                </td>
                                <td>
                                    <i class="fas fa-file-alt text-primary me-1"></i>
                                    ${submission.original_name}<br>
                                    <small class="text-muted">ID: ${submission.id}</small>
                                </td>
                                <td>
                                    <small>${new Date(submission.submitted_at).toLocaleString('es-ES')}</small>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm" role="group">
                                        <button class="btn btn-outline-primary" 
                                                onclick="adminPanel.downloadSubmission(${submission.id})"
                                                title="Descargar">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button class="btn btn-outline-info" 
                                                onclick="adminPanel.viewDetails(${submission.id})"
                                                title="Ver detalles">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-outline-success" 
                                                onclick="adminPanel.sendFeedback(${submission.id})"
                                                title="Enviar feedback">
                                            <i class="fas fa-comment"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 d-flex justify-content-between align-items-center">
                <small class="text-muted">
                    Mostrando ${submissions.length} de ${this.submissions.length} entregas
                </small>
                <div>
                    <button class="btn btn-outline-success btn-sm" onclick="adminPanel.exportData()">
                        <i class="fas fa-file-excel me-1"></i>
                        Exportar CSV
                    </button>
                </div>
            </div>
        `;
    }

    clearFilters() {
        const elements = ['search-student', 'filter-date', 'filter-title'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        this.applyFilters();
    }

    downloadSubmission(id) {
        console.log('Descargando entrega:', id);
        window.open(`/api/admin/download/${id}?token=${encodeURIComponent(this.token)}`, '_blank');
    }

    async viewDetails(id) {
        try {
            const response = await fetch(`/api/admin/submission/${id}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                this.clearAuthAndRedirect();
                return;
            }
            
            if (response.ok) {
                const submission = await response.json();
                this.showDetailsModal(submission);
            } else {
                this.showAlert('Error al obtener detalles', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'danger');
        }
    }

    showDetailsModal(submission) {
        // Crear modal dinámicamente
        const modalHtml = `
            <div class="modal fade" id="detailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-info-circle text-info me-2"></i>
                                Detalles de la Entrega
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-primary">👤 Información del Estudiante</h6>
                                    <p><strong>Nombre:</strong> ${submission.student_name}</p>
                                    <p><strong>Email:</strong> ${submission.student_email}</p>
                                    <p><strong>RA:</strong> ${submission.student_ra}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-success">📋 Información del Trabajo</h6>
                                    <p><strong>ID:</strong> ${submission.id}</p>
                                    <p><strong>Título:</strong> ${submission.title}</p>
                                    <p><strong>Fecha:</strong> ${new Date(submission.submitted_at).toLocaleString('es-ES')}</p>
                                </div>
                            </div>
                            
                            <hr>
                            
                            <h6 class="text-info">📄 Archivo</h6>
                            <p><strong>Nombre original:</strong> ${submission.original_name}</p>
                            <p><strong>Nombre en servidor:</strong> ${submission.filename}</p>
                            
                            ${submission.description ? `
                                <hr>
                                <h6 class="text-warning">📝 Descripción</h6>
                                <p>${submission.description}</p>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="adminPanel.downloadSubmission(${submission.id})">
                                <i class="fas fa-download me-1"></i>
                                Descargar Archivo
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior si existe
        const existingModal = document.getElementById('detailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Agregar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
        modal.show();
    }

    sendFeedback(id) {
        console.log('Enviando feedback para entrega:', id);
        this.showAlert('Funcionalidad de feedback en desarrollo', 'info');
    }

    async exportData() {
        try {
            console.log('Exportando datos...');
            window.open(`/api/admin/export?token=${encodeURIComponent(this.token)}`, '_blank');
            this.showAlert('Exportación iniciada', 'success');
        } catch (error) {
            console.error('Error exportando:', error);
            this.showAlert('Error en la exportación', 'danger');
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

// Funciones globales para los botones
function applyFilters() {
    if (window.adminPanel) {
        window.adminPanel.applyFilters();
    }
}

function loadAllSubmissions() {
    if (window.adminPanel) {
        window.adminPanel.loadAllSubmissions();
    }
}

function exportData() {
    if (window.adminPanel) {
        window.adminPanel.exportData();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});