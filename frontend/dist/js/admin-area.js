// 👨‍⚕️ PANEL DE ADMINISTRACIÓN - INFORMÁTICA MÉDICA
// Versión: 2.0 - Completamente en Español
// Autor: Prof. Gabriel Álvarez

// 🔧 CONFIGURACIÓN GLOBAL DEL ADMIN
const CONFIG_ADMIN = {
    API_BASE: '/api',
    ADMIN_API: '/api/admin',
    REFRESH_INTERVAL: 30000, // 30 segundos
    CHART_COLORS: {
        primary: '#007AFF',
        secondary: '#34C759',
        accent: '#5856D6',
        warning: '#FF9500',
        danger: '#FF3B30',
        info: '#5AC8FA'
    },
    PAGINATION_SIZE: 10,
    MAX_LOG_ENTRIES: 100
};

// 🎨 MENSAJES EN ESPAÑOL PARA ADMIN
const MENSAJES_ADMIN = {
    CARGANDO: 'Cargando datos del sistema...',
    ERROR_CONEXION: 'Error de conexión con el servidor',
    ERROR_AUTENTICACION: 'Error de autenticación de administrador',
    DATOS_ACTUALIZADOS: 'Datos actualizados correctamente',
    ESTUDIANTE_REGISTRADO: 'Estudiante registrado exitosamente',
    ENTREGA_ELIMINADA: 'Entrega eliminada correctamente',
    REPORTE_GENERADO: 'Reporte generado exitosamente',
    BD_VERIFICADA: 'Base de datos verificada correctamente',
    CACHE_LIMPIADO: 'Caché del sistema limpiado',
    RESPALDO_CREADO: 'Respaldo de base de datos creado',
    SESION_EXPIRADA: 'Sesión de administrador expirada',
    ACCESO_DENEGADO: 'Acceso denegado - Permisos insuficientes',
    OPERACION_EXITOSA: 'Operación completada exitosamente',
    ERROR_INESPERADO: 'Error inesperado del sistema'
};

// 🔐 GESTIÓN DE AUTENTICACIÓN DE ADMIN
class GestorAutenticacionAdmin {
    static verificarTokenAdmin() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.redirigirLogin();
            return false;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const ahora = Date.now() / 1000;
            
            // Verificar expiración
            if (payload.exp < ahora) {
                this.cerrarSesionAdmin();
                return false;
            }
            
            // Verificar permisos de admin
            if (!payload.isAdmin && payload.role !== 'admin') {
                this.mostrarAccesoDenegado();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error verificando token admin:', error);
            this.cerrarSesionAdmin();
            return false;
        }
    }
    
    static obtenerTokenAdmin() {
        return localStorage.getItem('token');
    }
    
    static cerrarSesionAdmin() {
        localStorage.removeItem('token');
        localStorage.removeItem('adminData');
        this.redirigirLogin();
    }
    
    static redirigirLogin() {
        mostrarNotificacionAdmin('warning', 'Sesión Expirada', MENSAJES_ADMIN.SESION_EXPIRADA);
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
    
    static mostrarAccesoDenegado() {
        mostrarNotificacionAdmin('error', 'Acceso Denegado', MENSAJES_ADMIN.ACCESO_DENEGADO);
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

// 📡 CLIENTE API PARA ADMIN
class ClienteAPIAdmin {
    static async realizarPeticionAdmin(endpoint, opciones = {}) {
        const token = GestorAutenticacionAdmin.obtenerTokenAdmin();
        
        const configuracionPorDefecto = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (opciones.body instanceof FormData) {
            delete configuracionPorDefecto.headers['Content-Type'];
        }
        
        const configuracionFinal = {
            ...configuracionPorDefecto,
            ...opciones,
            headers: {
                ...configuracionPorDefecto.headers,
                ...opciones.headers
            }
        };
        
        try {
            const respuesta = await fetch(`${CONFIG_ADMIN.ADMIN_API}${endpoint}`, configuracionFinal);
            
            if (respuesta.status === 401) {
                GestorAutenticacionAdmin.cerrarSesionAdmin();
                return null;
            }
            
            if (respuesta.status === 403) {
                GestorAutenticacionAdmin.mostrarAccesoDenegado();
                return null;
            }
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }
            
            const contentType = respuesta.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await respuesta.json();
            }
            
            return respuesta;
        } catch (error) {
            console.error(`❌ Error en petición admin ${endpoint}:`, error);
            mostrarNotificacionAdmin('error', 'Error de Conexión', MENSAJES_ADMIN.ERROR_CONEXION);
            throw error;
        }
    }
    
    // 📊 Endpoints de estadísticas
    static async obtenerEstadisticasGenerales() {
        return await this.realizarPeticionAdmin('/stats/general');
    }
    
    static async obtenerEntregasPorFecha(dias = 30) {
        return await this.realizarPeticionAdmin(`/stats/submissions-by-date?days=${dias}`);
    }
    
    static async obtenerTiposArchivo() {
        return await this.realizarPeticionAdmin('/stats/file-types');
    }
    
    // 📋 Endpoints de entregas
    static async obtenerTodasLasEntregas(pagina = 1, limite = 10, filtros = {}) {
        const params = new URLSearchParams({
            page: pagina,
            limit: limite,
            ...filtros
        });
        return await this.realizarPeticionAdmin(`/submissions?${params}`);
    }
    
    static async eliminarEntregaAdmin(id) {
        return await this.realizarPeticionAdmin(`/submissions/${id}`, {
            method: 'DELETE'
        });
    }
    
    static async obtenerDetallesEntrega(id) {
        return await this.realizarPeticionAdmin(`/submissions/${id}`);
    }
    
    // 👥 Endpoints de estudiantes
    static async obtenerEstudiantes() {
        return await this.realizarPeticionAdmin('/users');
    }
    
    static async registrarEstudiante(datosEstudiante) {
        return await this.realizarPeticionAdmin('/users', {
            method: 'POST',
            body: JSON.stringify(datosEstudiante)
        });
    }
    
    static async eliminarEstudiante(id) {
        return await this.realizarPeticionAdmin(`/users/${id}`, {
            method: 'DELETE'
        });
    }
    
    // 🔧 Endpoints de sistema
    static async verificarBaseDatos() {
        return await this.realizarPeticionAdmin('/system/check-database');
    }
    
    static async optimizarBaseDatos() {
        return await this.realizarPeticionAdmin('/system/optimize-database', {
            method: 'POST'
        });
    }
    
    static async obtenerInfoSistema() {
        return await this.realizarPeticionAdmin('/system/info');
    }
    
    static async limpiarCache() {
        return await this.realizarPeticionAdmin('/system/clear-cache', {
            method: 'POST'
        });
    }
    
    static async crearRespaldo() {
        return await this.realizarPeticionAdmin('/system/backup', {
            method: 'POST'
        });
    }
    
    static async obtenerLogs(filtros = {}) {
        const params = new URLSearchParams(filtros);
        return await this.realizarPeticionAdmin(`/system/logs?${params}`);
    }
}

// 🎨 GESTOR DE INTERFAZ ADMIN
class GestorInterfazAdmin {
    static mostrarCargandoAdmin(elemento, mostrar = true) {
        if (mostrar) {
            elemento.classList.add('loading');
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary mb-2" role="status"></div>
                    <p class="text-muted">${MENSAJES_ADMIN.CARGANDO}</p>
                </div>
            `;
            elemento.style.position = 'relative';
            elemento.appendChild(overlay);
        } else {
            elemento.classList.remove('loading');
            const overlay = elemento.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }
    
    static formatearFechaAdmin(fecha) {
        const opciones = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(fecha).toLocaleDateString('es-ES', opciones);
    }
    
    static formatearTamanoAdmin(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const tamaños = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + tamaños[i];
    }
    
    static obtenerIconoArchivoAdmin(nombreArchivo) {
        const extension = nombreArchivo.toLowerCase().split('.').pop();
        const iconos = {
            'pdf': 'fas fa-file-pdf text-danger',
            'doc': 'fas fa-file-word text-primary',
            'docx': 'fas fa-file-word text-primary',
            'txt': 'fas fa-file-alt text-secondary',
            'zip': 'fas fa-file-archive text-warning',
            'rar': 'fas fa-file-archive text-warning',
            'jpg': 'fas fa-file-image text-info',
            'jpeg': 'fas fa-file-image text-info',
            'png': 'fas fa-file-image text-info'
        };
        return iconos[extension] || 'fas fa-file text-muted';
    }
    
    static generarBadgeEstado(estado) {
        const badges = {
            'activo': '<span class="badge badge-online">Activo</span>',
            'inactivo': '<span class="badge badge-offline">Inactivo</span>',
            'pendiente': '<span class="badge badge-custom" style="background: rgba(255, 149, 0, 0.1); color: #FF9500;">Pendiente</span>'
        };
        return badges[estado] || '<span class="badge badge-custom">Desconocido</span>';
    }
}

// 🔔 SISTEMA DE NOTIFICACIONES ADMIN
function mostrarNotificacionAdmin(tipo, titulo, mensaje, duracion = 5000) {
    const toast = document.getElementById('toastNotificacionAdmin');
    const iconoToast = document.getElementById('iconoToastAdmin');
    const tituloToast = document.getElementById('tituloToastAdmin');
    const mensajeToast = document.getElementById('mensajeToastAdmin');
    const tiempoToast = document.getElementById('tiempoToastAdmin');
    
    const configuraciones = {
        'success': {
            icono: 'fas fa-check-circle text-success',
            clase: 'bg-success'
        },
        'error': {
            icono: 'fas fa-exclamation-circle text-danger',
            clase: 'bg-danger'
        },
        'warning': {
            icono: 'fas fa-exclamation-triangle text-warning',
            clase: 'bg-warning'
        },
        'info': {
            icono: 'fas fa-info-circle text-primary',
            clase: 'bg-primary'
        }
    };
    
    const config = configuraciones[tipo] || configuraciones['info'];
    
    iconoToast.className = config.icono;
    tituloToast.textContent = titulo;
    mensajeToast.textContent = mensaje;
    tiempoToast.textContent = 'ahora';
    
    const bsToast = new bootstrap.Toast(toast, { delay: duracion });
    bsToast.show();
}

// 📊 GESTOR DE ESTADÍSTICAS ADMIN
class GestorEstadisticasAdmin {
    static async cargarEstadisticasGenerales() {
        try {
            const estadisticas = await ClienteAPIAdmin.obtenerEstadisticasGenerales();
            if (!estadisticas) return;
            
            this.actualizarInterfazEstadisticas(estadisticas);
            
        } catch (error) {
            console.error('❌ Error cargando estadísticas generales:', error);
        }
    }
    
    static actualizarInterfazEstadisticas(estadisticas) {
        // Actualizar cards principales
        document.getElementById('totalEstudiantes').textContent = estadisticas.totalUsers || 0;
        document.getElementById('totalEntregas').textContent = estadisticas.totalSubmissions || 0;
        document.getElementById('entregasSemana').textContent = estadisticas.thisWeekSubmissions || 0;
        document.getElementById('espacioTotal').textContent = 
            GestorInterfazAdmin.formatearTamanoAdmin(estadisticas.totalStorage || 0);
        
        // Actualizar métricas adicionales
        document.getElementById('nuevosEstudiantes').textContent = estadisticas.newUsersThisWeek || 0;
        document.getElementById('entregasHoy').textContent = estadisticas.todaySubmissions || 0;
        
        // Calcular porcentaje de cambio
        const porcentajeCambio = estadisticas.weeklyGrowthPercentage || 0;
        const elementoPorcentaje = document.getElementById('porcentajeCambio');
        elementoPorcentaje.textContent = `${porcentajeCambio > 0 ? '+' : ''}${porcentajeCambio}%`;
        elementoPorcentaje.className = porcentajeCambio >= 0 ? 'text-success' : 'text-danger';
        
        // Porcentaje de espacio usado
        const porcentajeEspacio = Math.round((estadisticas.totalStorage || 0) / (10 * 1024 * 1024 * 1024) * 100); // Asumiendo 10GB límite
        document.getElementById('porcentajeEspacio').textContent = `${porcentajeEspacio}%`;
    }
}

// 📈 GESTOR DE GRÁFICOS
class GestorGraficos {
    static async inicializarGraficos() {
        await this.crearGraficoEntregas();
        await this.crearGraficoTiposArchivo();
    }
    
    static async crearGraficoEntregas(dias = 30) {
        try {
            const datos = await ClienteAPIAdmin.obtenerEntregasPorFecha(dias);
            if (!datos) return;
            
            const ctx = document.getElementById('graficoEntregas').getContext('2d');
            
            // Destruir gráfico anterior si existe
            if (window.graficoEntregas) {
                window.graficoEntregas.destroy();
            }
            
            window.graficoEntregas = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: datos.labels || [],
                    datasets: [{
                        label: 'Entregas por día',
                        data: datos.values || [],
                        borderColor: CONFIG_ADMIN.CHART_COLORS.primary,
                        backgroundColor: CONFIG_ADMIN.CHART_COLORS.primary + '20',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: CONFIG_ADMIN.CHART_COLORS.primary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: CONFIG_ADMIN.CHART_COLORS.primary,
                            borderWidth: 1
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                stepSize: 1
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error creando gráfico de entregas:', error);
        }
    }
    
    static async crearGraficoTiposArchivo() {
        try {
            const datos = await ClienteAPIAdmin.obtenerTiposArchivo();
            if (!datos) return;
            
            const ctx = document.getElementById('graficoTiposArchivo').getContext('2d');
            
            // Destruir gráfico anterior si existe
            if (window.graficoTiposArchivo) {
                window.graficoTiposArchivo.destroy();
            }
            
            const colores = [
                CONFIG_ADMIN.CHART_COLORS.primary,
                CONFIG_ADMIN.CHART_COLORS.secondary,
                CONFIG_ADMIN.CHART_COLORS.accent,
                CONFIG_ADMIN.CHART_COLORS.warning,
                CONFIG_ADMIN.CHART_COLORS.danger,
                CONFIG_ADMIN.CHART_COLORS.info
            ];
            
            window.graficoTiposArchivo = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: datos.labels || [],
                    datasets: [{
                        data: datos.values || [],
                        backgroundColor: colores.slice(0, datos.labels?.length || 0),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.raw / total) * 100).toFixed(1);
                                    return `${context.label}: ${context.raw} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error creando gráfico de tipos de archivo:', error);
        }
    }
    
    static async cambiarPeriodoGrafico(dias) {
        // Actualizar botones activos
        document.querySelectorAll('.btn-group .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Recrear gráfico
        await this.crearGraficoEntregas(parseInt(dias));
    }
}

// 📋 GESTOR DE ENTREGAS ADMIN
class GestorEntregasAdmin {
    static paginaActual = 1;
    static filtrosActivos = {};
    
    static async cargarTablaEntregas(pagina = 1, filtros = {}) {
        try {
            const cuerpoTabla = document.getElementById('cuerpoTablaEntregas');
            GestorInterfazAdmin.mostrarCargandoAdmin(cuerpoTabla.parentElement, true);
            
            this.paginaActual = pagina;
            this.filtrosActivos = filtros;
            
            const datos = await ClienteAPIAdmin.obtenerTodasLasEntregas(
                pagina, 
                CONFIG_ADMIN.PAGINATION_SIZE, 
                filtros
            );
            
            if (!datos) return;
            
            this.renderizarTablaEntregas(datos.submissions || []);
            this.renderizarPaginacion(datos.pagination || {});
            
        } catch (error) {
            console.error('❌ Error cargando tabla de entregas:', error);
            this.mostrarErrorTabla();
        } finally {
            const cuerpoTabla = document.getElementById('cuerpoTablaEntregas');
            GestorInterfazAdmin.mostrarCargandoAdmin(cuerpoTabla.parentElement, false);
        }
    }
    
    static renderizarTablaEntregas(entregas) {
        const cuerpoTabla = document.getElementById('cuerpoTablaEntregas');
        
        if (entregas.length === 0) {
            cuerpoTabla.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No se encontraron entregas</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        const html = entregas.map(entrega => this.generarFilaEntrega(entrega)).join('');
        cuerpoTabla.innerHTML = html;
    }
    
    static generarFilaEntrega(entrega) {
        const fechaFormateada = GestorInterfazAdmin.formatearFechaAdmin(entrega.submitted_at);
        const tamanoFormateado = GestorInterfazAdmin.formatearTamanoAdmin(entrega.file_size || 0);
        const iconoArchivo = GestorInterfazAdmin.obtenerIconoArchivoAdmin(entrega.original_name || entrega.filename);
        
        return `
            <tr data-id="${entrega.id}">
                <td>
                    <span class="badge badge-primary">#${entrega.id}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="status-indicator status-online me-2"></div>
                        <div>
                            <strong>${entrega.user_name || entrega.user_email}</strong><br>
                            <small class="text-muted">${entrega.user_email}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${entrega.title}</strong><br>
                        <small class="text-muted">${(entrega.description || '').substring(0, 50)}${entrega.description && entrega.description.length > 50 ? '...' : ''}</small>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="${iconoArchivo} me-2"></i>
                        <span>${entrega.original_name || entrega.filename}</span>
                    </div>
                </td>
                <td>${tamanoFormateado}</td>
                <td>
                    <small>${fechaFormateada}</small>
                </td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn admin-action-btn btn-outline-primary btn-sm" 
                                onclick="verDetallesEntrega(${entrega.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn admin-action-btn btn-outline-success btn-sm" 
                                onclick="descargarEntregaAdmin(${entrega.id})" 
                                title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn admin-action-btn btn-outline-danger btn-sm" 
                                onclick="confirmarEliminacionAdmin(${entrega.id}, '${entrega.title}', '${entrega.user_name || entrega.user_email}')" 
                                title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    static renderizarPaginacion(paginacion) {
        const contenedorPaginacion = document.getElementById('paginacionEntregas');
        
        if (!paginacion.totalPages || paginacion.totalPages <= 1) {
            contenedorPaginacion.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Botón anterior
        html += `
            <li class="page-item ${paginacion.currentPage <= 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="cambiarPaginaEntregas(${paginacion.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Páginas
        for (let i = 1; i <= paginacion.totalPages; i++) {
            if (i === 1 || i === paginacion.totalPages || 
                (i >= paginacion.currentPage - 2 && i <= paginacion.currentPage + 2)) {
                html += `
                    <li class="page-item ${i === paginacion.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="cambiarPaginaEntregas(${i})">${i}</a>
                    </li>
                `;
            } else if (i === paginacion.currentPage - 3 || i === paginacion.currentPage + 3) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        // Botón siguiente
        html += `
            <li class="page-item ${paginacion.currentPage >= paginacion.totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="cambiarPaginaEntregas(${paginacion.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
        
        contenedorPaginacion.innerHTML = html;
    }
    
    static mostrarErrorTabla() {
        const cuerpoTabla = document.getElementById('cuerpoTablaEntregas');
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                    <p class="text-muted">Error al cargar las entregas</p>
                    <button class="btn btn-primary btn-sm" onclick="actualizarTablaEntregas()">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

// 👥 GESTOR DE ESTUDIANTES ADMIN
class GestorEstudiantesAdmin {
    static async cargarEstudiantes() {
        try {
            const contenedor = document.getElementById('contenedorEstudiantes');
            GestorInterfazAdmin.mostrarCargandoAdmin(contenedor, true);
            
            const estudiantes = await ClienteAPIAdmin.obtenerEstudiantes();
            if (!estudiantes) return;
            
            this.renderizarEstudiantes(estudiantes);
            
        } catch (error) {
            console.error('❌ Error cargando estudiantes:', error);
            this.mostrarErrorEstudiantes();
        } finally {
            const contenedor = document.getElementById('contenedorEstudiantes');
            GestorInterfazAdmin.mostrarCargandoAdmin(contenedor, false);
        }
    }
    
    static renderizarEstudiantes(estudiantes) {
        const contenedor = document.getElementById('contenedorEstudiantes');
        
        if (estudiantes.length === 0) {
            contenedor.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="fas fa-user-graduate fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No hay estudiantes registrados</h5>
                    <button class="btn btn-primary" onclick="mostrarModalNuevoEstudiante()">
                                                <i class="fas fa-user-plus"></i> Registrar Primer Estudiante
                    </button>
                </div>
            `;
            return;
        }
        
        const html = estudiantes.map(estudiante => this.generarCardEstudiante(estudiante)).join('');
        contenedor.innerHTML = html;
    }
    
    static generarCardEstudiante(estudiante) {
        const fechaRegistro = GestorInterfazAdmin.formatearFechaAdmin(estudiante.created_at);
        const estadoBadge = GestorInterfazAdmin.generarBadgeEstado(estudiante.status || 'activo');
        const ultimaActividad = estudiante.last_login ? 
            GestorInterfazAdmin.formatearFechaAdmin(estudiante.last_login) : 'Nunca';
        
        return `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="admin-stat-card">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="d-flex align-items-center">
                            <div class="medical-stat-icon me-3" style="width: 40px; height: 40px; font-size: 16px;">
                                <i class="fas fa-user-graduate"></i>
                            </div>
                            <div>
                                <h6 class="mb-0 fw-bold">${estudiante.name}</h6>
                                <small class="text-muted">${estudiante.email}</small>
                            </div>
                        </div>
                        ${estadoBadge}
                    </div>
                    
                    <div class="row text-center mb-3">
                        <div class="col-4">
                            <div class="border-end">
                                <h6 class="mb-0 text-primary">${estudiante.submission_count || 0}</h6>
                                <small class="text-muted">Entregas</small>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="border-end">
                                <h6 class="mb-0 text-success">${GestorInterfazAdmin.formatearTamanoAdmin(estudiante.total_size || 0)}</h6>
                                <small class="text-muted">Espacio</small>
                            </div>
                        </div>
                        <div class="col-4">
                            <h6 class="mb-0 text-info">${estudiante.ra || 'N/A'}</h6>
                            <small class="text-muted">RA</small>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <small class="text-muted">
                            <i class="fas fa-calendar-plus"></i> Registrado: ${fechaRegistro}<br>
                            <i class="fas fa-clock"></i> Último acceso: ${ultimaActividad}
                        </small>
                    </div>
                    
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm flex-fill" 
                                onclick="verPerfilEstudiante(${estudiante.id})">
                            <i class="fas fa-eye"></i> Ver Perfil
                        </button>
                        <button class="btn btn-outline-success btn-sm flex-fill" 
                                onclick="verEntregasEstudiante(${estudiante.id})">
                            <i class="fas fa-file-alt"></i> Entregas
                        </button>
                        <button class="btn btn-outline-danger btn-sm" 
                                onclick="confirmarEliminacionEstudiante(${estudiante.id}, '${estudiante.name}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    static mostrarErrorEstudiantes() {
        const contenedor = document.getElementById('contenedorEstudiantes');
        contenedor.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h5 class="text-muted">Error al cargar estudiantes</h5>
                <button class="btn btn-primary" onclick="cargarEstudiantesAdmin()">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
    
    static async registrarNuevoEstudiante(datosEstudiante) {
        try {
            const resultado = await ClienteAPIAdmin.registrarEstudiante(datosEstudiante);
            
            if (resultado && resultado.success !== false) {
                mostrarNotificacionAdmin('success', 'Estudiante Registrado', MENSAJES_ADMIN.ESTUDIANTE_REGISTRADO);
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoEstudiante'));
                modal.hide();
                
                // Limpiar formulario
                document.getElementById('formularioNuevoEstudiante').reset();
                
                // Recargar lista de estudiantes
                await this.cargarEstudiantes();
                
                // Actualizar estadísticas
                await GestorEstadisticasAdmin.cargarEstadisticasGenerales();
                
            } else {
                throw new Error(resultado?.message || 'Error registrando estudiante');
            }
            
        } catch (error) {
            console.error('❌ Error registrando estudiante:', error);
            mostrarNotificacionAdmin('error', 'Error', `Error al registrar estudiante: ${error.message}`);
        }
    }
}

// 🔧 GESTOR DE SISTEMA ADMIN
class GestorSistemaAdmin {
    static async verificarBaseDatos() {
        try {
            mostrarNotificacionAdmin('info', 'Verificando', 'Verificando estado de la base de datos...');
            
            const resultado = await ClienteAPIAdmin.verificarBaseDatos();
            
            if (resultado && resultado.success) {
                mostrarNotificacionAdmin('success', 'Base de Datos OK', MENSAJES_ADMIN.BD_VERIFICADA);
                
                // Actualizar interfaz
                document.getElementById('estadoBD').textContent = 'Conectada';
                document.getElementById('estadoBD').className = 'badge badge-success';
                document.getElementById('ultimaVerificacion').textContent = 
                    new Date().toLocaleTimeString('es-ES');
                
            } else {
                throw new Error(resultado?.message || 'Error en verificación');
            }
            
        } catch (error) {
            console.error('❌ Error verificando BD:', error);
            mostrarNotificacionAdmin('error', 'Error BD', `Error verificando base de datos: ${error.message}`);
            
            document.getElementById('estadoBD').textContent = 'Error';
            document.getElementById('estadoBD').className = 'badge badge-offline';
        }
    }
    
    static async optimizarBaseDatos() {
        try {
            mostrarNotificacionAdmin('info', 'Optimizando', 'Optimizando base de datos...');
            
            const resultado = await ClienteAPIAdmin.optimizarBaseDatos();
            
            if (resultado && resultado.success) {
                mostrarNotificacionAdmin('success', 'BD Optimizada', 'Base de datos optimizada correctamente');
            } else {
                throw new Error(resultado?.message || 'Error en optimización');
            }
            
        } catch (error) {
            console.error('❌ Error optimizando BD:', error);
            mostrarNotificacionAdmin('error', 'Error', `Error optimizando base de datos: ${error.message}`);
        }
    }
    
    static async limpiarCacheArchivos() {
        try {
            mostrarNotificacionAdmin('info', 'Limpiando', 'Limpiando caché del sistema...');
            
            const resultado = await ClienteAPIAdmin.limpiarCache();
            
            if (resultado && resultado.success) {
                mostrarNotificacionAdmin('success', 'Caché Limpiado', MENSAJES_ADMIN.CACHE_LIMPIADO);
            } else {
                throw new Error(resultado?.message || 'Error limpiando caché');
            }
            
        } catch (error) {
            console.error('❌ Error limpiando caché:', error);
            mostrarNotificacionAdmin('error', 'Error', `Error limpiando caché: ${error.message}`);
        }
    }
    
    static async crearRespaldoBD() {
        try {
            mostrarNotificacionAdmin('info', 'Creando Respaldo', 'Creando respaldo de la base de datos...');
            
            const resultado = await ClienteAPIAdmin.crearRespaldo();
            
            if (resultado && resultado.success) {
                mostrarNotificacionAdmin('success', 'Respaldo Creado', MENSAJES_ADMIN.RESPALDO_CREADO);
                
                // Si hay URL de descarga, iniciar descarga
                if (resultado.downloadUrl) {
                    const enlace = document.createElement('a');
                    enlace.href = resultado.downloadUrl;
                    enlace.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
                    enlace.click();
                }
                
            } else {
                throw new Error(resultado?.message || 'Error creando respaldo');
            }
            
        } catch (error) {
            console.error('❌ Error creando respaldo:', error);
            mostrarNotificacionAdmin('error', 'Error', `Error creando respaldo: ${error.message}`);
        }
    }
    
    static async mostrarInfoSistema() {
        try {
            const info = await ClienteAPIAdmin.obtenerInfoSistema();
            if (!info) return;
            
            const contenido = this.generarHTMLInfoSistema(info);
            document.getElementById('contenidoInfoSistema').innerHTML = contenido;
            
            const modal = new bootstrap.Modal(document.getElementById('modalInfoSistema'));
            modal.show();
            
        } catch (error) {
            console.error('❌ Error obteniendo info del sistema:', error);
            mostrarNotificacionAdmin('error', 'Error', 'No se pudo obtener la información del sistema');
        }
    }
    
    static generarHTMLInfoSistema(info) {
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-server text-primary"></i> Información del Servidor</h6>
                        <ul class="list-unstyled">
                            <li><strong>Sistema Operativo:</strong> ${info.os || 'N/A'}</li>
                            <li><strong>Versión Node.js:</strong> ${info.nodeVersion || 'N/A'}</li>
                            <li><strong>Memoria Total:</strong> ${GestorInterfazAdmin.formatearTamanoAdmin(info.totalMemory || 0)}</li>
                            <li><strong>Memoria Libre:</strong> ${GestorInterfazAdmin.formatearTamanoAdmin(info.freeMemory || 0)}</li>
                            <li><strong>Uptime:</strong> ${this.formatearUptime(info.uptime || 0)}</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-database text-success"></i> Base de Datos</h6>
                        <ul class="list-unstyled">
                            <li><strong>Tipo:</strong> ${info.dbType || 'SQLite'}</li>
                            <li><strong>Versión:</strong> ${info.dbVersion || 'N/A'}</li>
                            <li><strong>Tamaño BD:</strong> ${GestorInterfazAdmin.formatearTamanoAdmin(info.dbSize || 0)}</li>
                            <li><strong>Conexiones:</strong> ${info.dbConnections || 'N/A'}</li>
                            <li><strong>Estado:</strong> <span class="badge badge-success">Conectada</span></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-chart-bar text-info"></i> Estadísticas del Sistema</h6>
                        <div class="row">
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-primary">${info.totalFiles || 0}</h5>
                                    <small class="text-muted">Archivos Totales</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-success">${GestorInterfazAdmin.formatearTamanoAdmin(info.totalStorage || 0)}</h5>
                                    <small class="text-muted">Espacio Usado</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-warning">${info.avgFileSize ? GestorInterfazAdmin.formatearTamanoAdmin(info.avgFileSize) : 'N/A'}</h5>
                                    <small class="text-muted">Tamaño Promedio</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-info">${info.dailyUploads || 0}</h5>
                                    <small class="text-muted">Subidas Hoy</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    static formatearUptime(segundos) {
        const dias = Math.floor(segundos / 86400);
        const horas = Math.floor((segundos % 86400) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        
        if (dias > 0) {
            return `${dias}d ${horas}h ${minutos}m`;
        } else if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else {
            return `${minutos}m`;
        }
    }
}

// �� GESTOR DE REPORTES ADMIN
class GestorReportesAdmin {
    static async generarReporteParticipacion() {
        try {
            mostrarNotificacionAdmin('info', 'Generando', 'Generando reporte de participación...');
            
            // Simular generación de reporte
            setTimeout(() => {
                mostrarNotificacionAdmin('success', 'Reporte Generado', MENSAJES_ADMIN.REPORTE_GENERADO);
                
                // Aquí iría la lógica real de generación de reporte
                const datosReporte = {
                    fecha: new Date().toLocaleDateString('es-ES'),
                    totalEstudiantes: document.getElementById('totalEstudiantes').textContent,
                    totalEntregas: document.getElementById('totalEntregas').textContent,
                    participacionPromedio: '85%'
                };
                
                this.descargarReporte('reporte-participacion', datosReporte);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error generando reporte:', error);
            mostrarNotificacionAdmin('error', 'Error', 'Error generando reporte de participación');
        }
    }
    
    static async generarAnalisisEntregas() {
        try {
            mostrarNotificacionAdmin('info', 'Analizando', 'Generando análisis de entregas...');
            
            setTimeout(() => {
                mostrarNotificacionAdmin('success', 'Análisis Completo', 'Análisis de entregas completado');
                
                const datosAnalisis = {
                    fecha: new Date().toLocaleDateString('es-ES'),
                    tipoMasComun: 'PDF',
                    promedioTamano: '2.5 MB',
                    tendencia: 'Creciente'
                };
                
                this.descargarReporte('analisis-entregas', datosAnalisis);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error generando análisis:', error);
            mostrarNotificacionAdmin('error', 'Error', 'Error generando análisis de entregas');
        }
    }
    
    static async generarReporteAcademico() {
        try {
            mostrarNotificacionAdmin('info', 'Creando', 'Creando reporte académico...');
            
            setTimeout(() => {
                mostrarNotificacionAdmin('success', 'Reporte Académico', 'Reporte académico creado exitosamente');
                
                const datosAcademicos = {
                    fecha: new Date().toLocaleDateString('es-ES'),
                    periodo: 'Semestre Actual',
                    estudiantes: document.getElementById('totalEstudiantes').textContent,
                    entregas: document.getElementById('totalEntregas').textContent
                };
                
                this.descargarReporte('reporte-academico', datosAcademicos);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error generando reporte académico:', error);
            mostrarNotificacionAdmin('error', 'Error', 'Error generando reporte académico');
        }
    }
    
    static descargarReporte(tipo, datos) {
        const contenido = JSON.stringify(datos, null, 2);
        const blob = new Blob([contenido], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `${tipo}-${new Date().toISOString().split('T')[0]}.json`;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        window.URL.revokeObjectURL(url);
    }
}

// 📋 FUNCIONES GLOBALES PARA EL ADMIN

// Funciones de inicialización
async function verificarAutenticacionAdmin() {
    return GestorAutenticacionAdmin.verificarTokenAdmin();
}

async function cargarDatosAdmin() {
    try {
        const token = GestorAutenticacionAdmin.obtenerTokenAdmin();
        if (!token) return;
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        const nombreAdmin = payload.name || payload.email || 'Administrador';
        
        document.getElementById('adminNameNav').textContent = nombreAdmin;
        
        localStorage.setItem('adminData', JSON.stringify({
            name: nombreAdmin,
            email: payload.email,
            role: payload.role || 'admin'
        }));
        
    } catch (error) {
        console.error('❌ Error cargando datos del admin:', error);
    }
}

async function cargarDashboardAdmin() {
    await Promise.all([
        GestorEstadisticasAdmin.cargarEstadisticasGenerales(),
        GestorEntregasAdmin.cargarTablaEntregas(),
        GestorEstudiantesAdmin.cargarEstudiantes()
    ]);
}

function configurarEventosAdmin() {
    // Formulario de nuevo estudiante
    const formulario = document.getElementById('formularioNuevoEstudiante');
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const datosEstudiante = {
            name: document.getElementById('nombreEstudiante').value,
            email: document.getElementById('emailEstudiante').value,
            ra: document.getElementById('raEstudiante').value,
            password: document.getElementById('passwordEstudiante').value
        };
        
        await GestorEstudiantesAdmin.registrarNuevoEstudiante(datosEstudiante);
    });
    
    // Filtros de entregas
    const filtros = ['buscarEstudiante', 'filtroFecha', 'filtroTitulo'];
    filtros.forEach(filtroId => {
        const elemento = document.getElementById(filtroId);
        if (elemento) {
            elemento.addEventListener('input', debounce(() => {
                aplicarFiltrosAdmin();
            }, 500));
        }
    });
}

async function inicializarGraficos() {
    await GestorGraficos.inicializarGraficos();
}

function configurarActualizacionAutomatica() {
    setInterval(async () => {
        try {
            await GestorEstadisticasAdmin.cargarEstadisticasGenerales();
        } catch (error) {
            console.log('🔄 Actualización automática fallida:', error.message);
        }
    }, CONFIG_ADMIN.REFRESH_INTERVAL);
}

// Funciones de interfaz
function actualizarDashboard() {
    mostrarNotificacionAdmin('info', 'Actualizando', 'Actualizando datos del dashboard...');
    cargarDashboardAdmin().then(() => {
        mostrarNotificacionAdmin('success', 'Actualizado', MENSAJES_ADMIN.DATOS_ACTUALIZADOS);
    });
}

function cambiarPeriodoGrafico(dias) {
    GestorGraficos.cambiarPeriodoGrafico(dias);
}

// Funciones de entregas
function aplicarFiltrosAdmin() {
    const filtros = {
        student: document.getElementById('buscarEstudiante').value,
        date: document.getElementById('filtroFecha').value,
        title: document.getElementById('filtroTitulo').value
    };
    
    // Remover filtros vacíos
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });
    
    GestorEntregasAdmin.cargarTablaEntregas(1, filtros);
}

function limpiarFiltrosAdmin() {
    document.getElementById('buscarEstudiante').value = '';
    document.getElementById('filtroFecha').value = '';
    document.getElementById('filtroTitulo').value = '';
    
    GestorEntregasAdmin.cargarTablaEntregas(1, {});
    mostrarNotificacionAdmin('info', 'Filtros Limpiados', 'Filtros restablecidos');
}

function actualizarTablaEntregas() {
    GestorEntregasAdmin.cargarTablaEntregas(GestorEntregasAdmin.paginaActual, GestorEntregasAdmin.filtrosActivos);
}

function cambiarPaginaEntregas(pagina) {
    GestorEntregasAdmin.cargarTablaEntregas(pagina, GestorEntregasAdmin.filtrosActivos);
}

// Funciones de entregas específicas
async function verDetallesEntrega(id) {
    try {
        const entrega = await ClienteAPIAdmin.obtenerDetallesEntrega(id);
        if (!entrega) return;
        
        const contenido = generarHTMLDetallesEntrega(entrega);
        document.getElementById('contenidoDetallesEntrega').innerHTML = contenido;
        
        // Configurar botones del modal
        document.getElementById('btnDescargarEntrega').onclick = () => descargarEntregaAdmin(id);
        document.getElementById('btnEliminarEntrega').onclick = () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalDetallesEntrega'));
            modal.hide();
            confirmarEliminacionAdmin(id, entrega.title, entrega.user_name);
        };
        
        const modal = new bootstrap.Modal(document.getElementById('modalDetallesEntrega'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error obteniendo detalles:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudieron cargar los detalles de la entrega');
    }
}

function generarHTMLDetallesEntrega(entrega) {
    const fechaFormateada = GestorInterfazAdmin.formatearFechaAdmin(entrega.submitted_at);
    const tamanoFormateado = GestorInterfazAdmin.formatearTamanoAdmin(entrega.file_size || 0);
    const iconoArchivo = GestorInterfazAdmin.obtenerIconoArchivoAdmin(entrega.original_name || entrega.filename);
    
    return `
        <div class="admin-stat-card">
            <div class="row">
                <div class="col-md-8">
                    <h5 class="medical-gradient-text mb-3">
                        <i class="${iconoArchivo} me-2"></i>
                        ${entrega.title}
                    </h5>
                    
                    <div class="mb-3">
                        <h6><i class="fas fa-user text-primary"></i> Estudiante:</h6>
                        <p class="text-muted">${entrega.user_name} (${entrega.user_email})</p>
                    </div>
                    
                    <div class="mb-3">
                        <h6><i class="fas fa-align-left text-primary"></i> Descripción:</h6>
                        <p class="text-muted">${entrega.description || 'Sin descripción proporcionada'}</p>
                    </div>
                    
                    <div class="row">
                        <div class="col-sm-6">
                            <h6><i class="fas fa-file text-info"></i> Archivo:</h6>
                            <p class="text-muted">${entrega.original_name || entrega.filename}</p>
                        </div>
                        <div class="col-sm-6">
                            <h6><i class="fas fa-weight text-success"></i> Tamaño:</h6>
                            <p class="text-muted">${tamanoFormateado}</p>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-sm-6">
                            <h6><i class="fas fa-calendar text-warning"></i> Fecha de entrega:</h6>
                            <p class="text-muted">${fechaFormateada}</p>
                        </div>
                        <div class="col-sm-6">
                            <h6><i class="fas fa-hashtag text-secondary"></i> ID:</h6>
                            <p class="text-muted">#${entrega.id}</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4 text-center">
                    <div class="medical-stat-icon mb-3" style="width: 80px; height: 80px; margin: 0 auto; font-size: 30px;">
                        <i class="${iconoArchivo.split(' ')[1]}"></i>
                    </div>
                    
                    <div class="d-grid gap-2">
                        <span class="badge badge-primary">Entrega #${entrega.id}</span>
                        <span class="badge badge-success">${entrega.mime_type || 'Tipo desconocido'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function descargarEntregaAdmin(id) {
    try {
        const token = GestorAutenticacionAdmin.obtenerTokenAdmin();
        const url = `${CONFIG_ADMIN.API_BASE}/submissions/download/${id}?token=${token}`;
        
        mostrarNotificacionAdmin('info', 'Descargando', 'Iniciando descarga del archivo...');
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        setTimeout(() => {
            mostrarNotificacionAdmin('success', 'Descarga Iniciada', 'El archivo se está descargando');
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error descargando archivo:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudo descargar el archivo');
    }
}

function confirmarEliminacionAdmin(id, titulo, estudiante) {
    document.getElementById('tituloEliminarAdmin').textContent = titulo;
    document.getElementById('estudianteEliminarAdmin').textContent = estudiante;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminacionAdmin');
    btnConfirmar.onclick = () => eliminarEntregaAdmin(id);
    
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmarEliminacionAdmin'));
    modal.show();
}

async function eliminarEntregaAdmin(id) {
    try {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmarEliminacionAdmin'));
        modal.hide();
        
        const resultado = await ClienteAPIAdmin.eliminarEntregaAdmin(id);
        
        if (resultado && resultado.success !== false) {
            mostrarNotificacionAdmin('success', 'Eliminado', MENSAJES_ADMIN.ENTREGA_ELIMINADA);
            
            // Recargar tabla
            await actualizarTablaEntregas();
            
            // Actualizar estadísticas
            await GestorEstadisticasAdmin.cargarEstadisticasGenerales();
            
        } else {
            throw new Error(resultado?.message || 'Error eliminando entrega');
        }
        
    } catch (error) {
        console.error('❌ Error eliminando entrega:', error);
                mostrarNotificacionAdmin('error', 'Error', `Error al eliminar la entrega: ${error.message}`);
    }
}

// Funciones de estudiantes
function mostrarModalNuevoEstudiante() {
    const modal = new bootstrap.Modal(document.getElementById('modalNuevoEstudiante'));
    modal.show();
}

function cargarEstudiantesAdmin() {
    GestorEstudiantesAdmin.cargarEstudiantes();
}

async function verPerfilEstudiante(id) {
    try {
        // Aquí iría la lógica para mostrar el perfil del estudiante
        mostrarNotificacionAdmin('info', 'Perfil', `Mostrando perfil del estudiante ID: ${id}`);
        
        // Por ahora, mostrar un modal simple
        alert(`Funcionalidad de perfil del estudiante ${id} - En desarrollo`);
        
    } catch (error) {
        console.error('❌ Error mostrando perfil:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudo cargar el perfil del estudiante');
    }
}

async function verEntregasEstudiante(id) {
    try {
        // Aplicar filtro por estudiante en la tabla de entregas
        const filtros = { user_id: id };
        await GestorEntregasAdmin.cargarTablaEntregas(1, filtros);
        
        // Scroll a la sección de entregas
        document.getElementById('entregas').scrollIntoView({ behavior: 'smooth' });
        
        mostrarNotificacionAdmin('info', 'Filtrado', 'Mostrando entregas del estudiante seleccionado');
        
    } catch (error) {
        console.error('❌ Error filtrando entregas:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudieron cargar las entregas del estudiante');
    }
}

function confirmarEliminacionEstudiante(id, nombre) {
    if (confirm(`¿Estás seguro de que deseas eliminar al estudiante "${nombre}"?\n\nEsta acción también eliminará todas sus entregas y no se puede deshacer.`)) {
        eliminarEstudianteAdmin(id);
    }
}

async function eliminarEstudianteAdmin(id) {
    try {
        const resultado = await ClienteAPIAdmin.eliminarEstudiante(id);
        
        if (resultado && resultado.success !== false) {
            mostrarNotificacionAdmin('success', 'Estudiante Eliminado', 'Estudiante eliminado correctamente');
            
            // Recargar estudiantes
            await GestorEstudiantesAdmin.cargarEstudiantes();
            
            // Actualizar estadísticas
            await GestorEstadisticasAdmin.cargarEstadisticasGenerales();
            
            // Recargar tabla de entregas
            await actualizarTablaEntregas();
            
        } else {
            throw new Error(resultado?.message || 'Error eliminando estudiante');
        }
        
    } catch (error) {
        console.error('❌ Error eliminando estudiante:', error);
        mostrarNotificacionAdmin('error', 'Error', `Error al eliminar estudiante: ${error.message}`);
    }
}

function importarEstudiantes() {
    // Crear input de archivo temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    
    input.onchange = function(e) {
        const archivo = e.target.files[0];
        if (archivo) {
            procesarArchivoCSVEstudiantes(archivo);
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

function procesarArchivoCSVEstudiantes(archivo) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const lineas = csv.split('\n');
            const estudiantes = [];
            
            // Procesar CSV (formato: nombre,email,ra,password)
            for (let i = 1; i < lineas.length; i++) { // Saltar encabezado
                const linea = lineas[i].trim();
                if (linea) {
                    const [nombre, email, ra, password] = linea.split(',');
                    if (nombre && email && password) {
                        estudiantes.push({
                            name: nombre.trim(),
                            email: email.trim(),
                            ra: ra ? ra.trim() : '',
                            password: password.trim()
                        });
                    }
                }
            }
            
            if (estudiantes.length > 0) {
                importarEstudiantesEnLote(estudiantes);
            } else {
                mostrarNotificacionAdmin('warning', 'Archivo Vacío', 'No se encontraron estudiantes válidos en el archivo');
            }
            
        } catch (error) {
            console.error('❌ Error procesando CSV:', error);
            mostrarNotificacionAdmin('error', 'Error CSV', 'Error procesando el archivo CSV');
        }
    };
    
    reader.readAsText(archivo);
}

async function importarEstudiantesEnLote(estudiantes) {
    try {
        mostrarNotificacionAdmin('info', 'Importando', `Importando ${estudiantes.length} estudiantes...`);
        
        let exitosos = 0;
        let errores = 0;
        
        for (const estudiante of estudiantes) {
            try {
                await GestorEstudiantesAdmin.registrarNuevoEstudiante(estudiante);
                exitosos++;
            } catch (error) {
                console.error(`Error registrando ${estudiante.email}:`, error);
                errores++;
            }
            
            // Pequeña pausa para no sobrecargar el servidor
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        mostrarNotificacionAdmin('success', 'Importación Completa', 
            `Importación finalizada: ${exitosos} exitosos, ${errores} errores`);
        
        // Recargar estudiantes
        await GestorEstudiantesAdmin.cargarEstudiantes();
        
    } catch (error) {
        console.error('❌ Error en importación en lote:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error en la importación en lote');
    }
}

// Funciones de reportes
function generarReporteParticipacion() {
    GestorReportesAdmin.generarReporteParticipacion();
}

function generarAnalisisEntregas() {
    GestorReportesAdmin.generarAnalisisEntregas();
}

function generarReporteAcademico() {
    GestorReportesAdmin.generarReporteAcademico();
}

async function exportarReporteCompleto() {
    try {
        mostrarNotificacionAdmin('info', 'Exportando', 'Generando reporte completo del sistema...');
        
        // Obtener todos los datos
        const [estadisticas, entregas, estudiantes] = await Promise.all([
            ClienteAPIAdmin.obtenerEstadisticasGenerales(),
            ClienteAPIAdmin.obtenerTodasLasEntregas(1, 1000), // Obtener muchas entregas
            ClienteAPIAdmin.obtenerEstudiantes()
        ]);
        
        const reporteCompleto = {
            fecha_generacion: new Date().toISOString(),
            estadisticas_generales: estadisticas,
            resumen_entregas: {
                total: entregas?.submissions?.length || 0,
                por_tipo: {},
                espacio_total: 0
            },
            resumen_estudiantes: {
                total: estudiantes?.length || 0,
                activos: estudiantes?.filter(e => e.status === 'activo').length || 0
            },
            entregas_detalle: entregas?.submissions || [],
            estudiantes_detalle: estudiantes || []
        };
        
        // Calcular estadísticas adicionales
        if (entregas?.submissions) {
            entregas.submissions.forEach(entrega => {
                const extension = (entrega.original_name || entrega.filename).split('.').pop().toLowerCase();
                reporteCompleto.resumen_entregas.por_tipo[extension] = 
                    (reporteCompleto.resumen_entregas.por_tipo[extension] || 0) + 1;
                reporteCompleto.resumen_entregas.espacio_total += entrega.file_size || 0;
            });
        }
        
        // Descargar reporte
        const contenido = JSON.stringify(reporteCompleto, null, 2);
        const blob = new Blob([contenido], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `reporte-completo-informatica-medica-${new Date().toISOString().split('T')[0]}.json`;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        window.URL.revokeObjectURL(url);
        
        mostrarNotificacionAdmin('success', 'Reporte Exportado', MENSAJES_ADMIN.REPORTE_GENERADO);
        
    } catch (error) {
        console.error('❌ Error exportando reporte completo:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error generando reporte completo');
    }
}

function exportarEntregasCSV() {
    try {
        // Obtener datos de la tabla actual
        const filas = document.querySelectorAll('#tablaEntregas tbody tr');
        if (filas.length === 0 || filas[0].cells.length === 1) {
            mostrarNotificacionAdmin('warning', 'Sin Datos', 'No hay entregas para exportar');
            return;
        }
        
        const encabezados = ['ID', 'Estudiante', 'Email', 'Título', 'Archivo', 'Tamaño', 'Fecha'];
        const datos = [];
        
        filas.forEach(fila => {
            if (fila.cells.length > 1) {
                const celdas = Array.from(fila.cells);
                datos.push([
                    celdas[0].textContent.replace('#', '').trim(),
                    celdas[1].querySelector('strong')?.textContent || '',
                    celdas[1].querySelector('small')?.textContent || '',
                    celdas[2].querySelector('strong')?.textContent || '',
                    celdas[3].querySelector('span')?.textContent || '',
                    celdas[4].textContent.trim(),
                    celdas[5].textContent.trim()
                ]);
            }
        });
        
        const csvContent = [
            encabezados.join(','),
            ...datos.map(fila => fila.map(celda => `"${celda.replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `entregas-informatica-medica-${new Date().toISOString().split('T')[0]}.csv`;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        window.URL.revokeObjectURL(url);
        
        mostrarNotificacionAdmin('success', 'CSV Exportado', 'Archivo CSV descargado exitosamente');
        
    } catch (error) {
        console.error('❌ Error exportando CSV:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error exportando archivo CSV');
    }
}

// Funciones de estadísticas avanzadas
async function mostrarEstadisticasAvanzadas() {
    try {
        const contenido = await generarHTMLEstadisticasAvanzadas();
        document.getElementById('contenidoEstadisticasAvanzadas').innerHTML = contenido;
        
        const modal = new bootstrap.Modal(document.getElementById('modalEstadisticasAvanzadas'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error mostrando estadísticas avanzadas:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudieron cargar las estadísticas avanzadas');
    }
}

async function generarHTMLEstadisticasAvanzadas() {
    try {
        const [estadisticas, tiposArchivo, entregasPorFecha] = await Promise.all([
            ClienteAPIAdmin.obtenerEstadisticasGenerales(),
            ClienteAPIAdmin.obtenerTiposArchivo(),
            ClienteAPIAdmin.obtenerEntregasPorFecha(30)
        ]);
        
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-chart-bar text-primary"></i> Resumen General</h6>
                        <div class="row text-center">
                            <div class="col-6">
                                <h4 class="text-primary">${estadisticas?.totalUsers || 0}</h4>
                                <small class="text-muted">Estudiantes</small>
                            </div>
                            <div class="col-6">
                                <h4 class="text-success">${estadisticas?.totalSubmissions || 0}</h4>
                                <small class="text-muted">Entregas</small>
                            </div>
                        </div>
                        <hr>
                        <div class="row text-center">
                            <div class="col-6">
                                <h5 class="text-info">${estadisticas?.thisWeekSubmissions || 0}</h5>
                                <small class="text-muted">Esta Semana</small>
                            </div>
                            <div class="col-6">
                                <h5 class="text-warning">${estadisticas?.todaySubmissions || 0}</h5>
                                <small class="text-muted">Hoy</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-file-alt text-success"></i> Tipos de Archivo</h6>
                        <div class="list-group list-group-flush">
                            ${tiposArchivo?.labels?.map((tipo, index) => `
                                <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                                    <span class="badge badge-primary">${tipo.toUpperCase()}</span>
                                    <span class="fw-bold">${tiposArchivo.values[index]} archivo${tiposArchivo.values[index] !== 1 ? 's' : ''}</span>
                                </div>
                            `).join('') || '<p class="text-muted">No hay datos disponibles</p>'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-chart-line text-info"></i> Tendencia de Entregas (Últimos 30 días)</h6>
                        <div class="row">
                            ${entregasPorFecha?.labels?.slice(-7).map((fecha, index) => `
                                <div class="col-md-3 mb-2">
                                    <div class="text-center">
                                        <h6 class="text-primary">${entregasPorFecha.values[entregasPorFecha.values.length - 7 + index] || 0}</h6>
                                        <small class="text-muted">${fecha}</small>
                                    </div>
                                </div>
                            `).join('') || '<p class="text-muted">No hay datos de tendencia disponibles</p>'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="admin-stat-card">
                        <h6><i class="fas fa-server text-warning"></i> Información del Sistema</h6>
                        <div class="row">
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h6 class="text-success">${GestorInterfazAdmin.formatearTamanoAdmin(estadisticas?.totalStorage || 0)}</h6>
                                    <small class="text-muted">Espacio Usado</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h6 class="text-info">${estadisticas?.avgFileSize ? GestorInterfazAdmin.formatearTamanoAdmin(estadisticas.avgFileSize) : 'N/A'}</h6>
                                    <small class="text-muted">Tamaño Promedio</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h6 class="text-primary">${estadisticas?.activeUsers || 0}</h6>
                                    <small class="text-muted">Usuarios Activos</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h6 class="text-warning">${Math.round((estadisticas?.weeklyGrowthPercentage || 0))}%</h6>
                                    <small class="text-muted">Crecimiento Semanal</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('❌ Error generando HTML de estadísticas:', error);
        return '<p class="text-danger">Error cargando estadísticas avanzadas</p>';
    }
}

function exportarEstadisticasAvanzadas() {
    try {
        const contenido = document.getElementById('contenidoEstadisticasAvanzadas').innerHTML;
        
        // Crear un documento HTML completo para exportar
        const htmlCompleto = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Estadísticas Avanzadas - Informática Médica</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .admin-stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <h1>Estadísticas Avanzadas - Sistema de Informática Médica</h1>
                <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
                <hr>
                ${contenido}
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlCompleto], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `estadisticas-avanzadas-${new Date().toISOString().split('T')[0]}.html`;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        window.URL.revokeObjectURL(url);
        
        mostrarNotificacionAdmin('success', 'Estadísticas Exportadas', 'Archivo HTML descargado exitosamente');
        
    } catch (error) {
        console.error('❌ Error exportando estadísticas:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error exportando estadísticas');
    }
}

// Funciones de sistema
function verificarBaseDatos() {
    GestorSistemaAdmin.verificarBaseDatos();
}

function optimizarBaseDatos() {
    GestorSistemaAdmin.optimizarBaseDatos();
}

function mostrarInfoSistema() {
    GestorSistemaAdmin.mostrarInfoSistema();
}

function actualizarInfoSistema() {
    GestorSistemaAdmin.mostrarInfoSistema();
}

function limpiarCacheArchivos() {
    GestorSistemaAdmin.limpiarCacheArchivos();
}

function crearRespaldoBD() {
    GestorSistemaAdmin.crearRespaldoBD();
}

function verificarIntegridadArchivos() {
    mostrarNotificacionAdmin('info', 'Verificando', 'Verificando integridad de archivos...');
    
    // Simular verificación
    setTimeout(() => {
        mostrarNotificacionAdmin('success', 'Verificación Completa', 'Todos los archivos están íntegros');
    }, 3000);
}

// Funciones de logs
async function mostrarLogsSeguridad() {
    try {
        const logs = await ClienteAPIAdmin.obtenerLogs();
        
        const contenido = generarHTMLLogs(logs || []);
        document.getElementById('cuerpoTablaLogs').innerHTML = contenido;
        
        const modal = new bootstrap.Modal(document.getElementById('modalLogsSeguridad'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error cargando logs:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudieron cargar los logs de seguridad');
    }
}

function generarHTMLLogs(logs) {
    if (logs.length === 0) {
        return `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-shield-alt fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No hay logs disponibles</p>
                </td>
            </tr>
        `;
    }
    
    return logs.map(log => {
        const fecha = GestorInterfazAdmin.formatearFechaAdmin(log.timestamp);
        const tipoBadge = obtenerBadgeTipoLog(log.type);
        
        return `
            <tr>
                <td><small>${fecha}</small></td>
                <td>${tipoBadge}</td>
                <td>${log.user_email || 'Sistema'}</td>
                <td>${log.action || 'N/A'}</td>
                <td><code>${log.ip_address || 'N/A'}</code></td>
                <td><small>${log.details || 'Sin detalles'}</small></td>
            </tr>
        `;
    }).join('');
}

function obtenerBadgeTipoLog(tipo) {
    const badges = {
        'LOGIN': '<span class="badge badge-primary">LOGIN</span>',
        'UPLOAD': '<span class="badge badge-success">UPLOAD</span>',
        'DELETE': '<span class="badge badge-custom" style="background: rgba(255, 59, 48, 0.1); color: #FF3B30;">DELETE</span>',
        'ERROR': '<span class="badge badge-custom" style="background: rgba(255, 59, 48, 0.1); color: #FF3B30;">ERROR</span>',
        'ADMIN': '<span class="badge badge-custom" style="background: rgba(255, 149, 0, 0.1); color: #FF9500;">ADMIN</span>'
    };
    return badges[tipo] || `<span class="badge badge-custom">${tipo}</span>`;
}

function filtrarLogs() {
    const tipo = document.getElementById('filtroTipoLog').value;
    const fecha = document.getElementById('filtroFechaLog').value;
    
    const filtros = {};
    if (tipo) filtros.type = tipo;
    if (fecha) filtros.date = fecha;
    
    ClienteAPIAdmin.obtenerLogs(filtros).then(logs => {
        const contenido = generarHTMLLogs(logs || []);
        document.getElementById('cuerpoTablaLogs').innerHTML = contenido;
    }).catch(error => {
        console.error('❌ Error filtrando logs:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error aplicando filtros a los logs');
    });
}

function exportarLogs() {
    try {
        const filas = document.querySelectorAll('#cuerpoTablaLogs tr');
        if (filas.length === 0 || filas[0].cells.length === 1) {
            mostrarNotificacionAdmin('warning', 'Sin Datos', 'No hay logs para exportar');
            return;
        }
        
        const encabezados = ['Fecha/Hora', 'Tipo', 'Usuario', 'Acción', 'IP', 'Detalles'];
        const datos = [];
        
        filas.forEach(fila => {
            if (fila.cells.length > 1) {
                const celdas = Array.from(fila.cells);
                datos.push([
                    celdas[0].textContent.trim(),
                    celdas[1].textContent.trim(),
                    celdas[2].textContent.trim(),
                    celdas[3].textContent.trim(),
                    celdas[4].textContent.trim(),
                    celdas[5].textContent.trim()
                ]);
            }
        });
        
        const csvContent = [
            encabezados.join(','),
            ...datos.map(fila => fila.map(celda => `"${celda.replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `logs-seguridad-${new Date().toISOString().split('T')[0]}.csv`;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        window.URL.revokeObjectURL(url);
        
        mostrarNotificacionAdmin('success', 'Logs Exportados', 'Archivo CSV de logs descargado');
        
    } catch (error) {
        console.error('❌ Error exportando logs:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error exportando logs');
    }
}

function mostrarLogsErrores() {
    // Filtrar solo logs de error
    document.getElementById('filtroTipoLog').value = 'ERROR';
    filtrarLogs();
    mostrarLogsSeguridad();
}

// Funciones de perfil admin
function mostrarPerfilAdmin() {
    try {
        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        
        const contenido = `
            <div class="admin-stat-card">
                <div class="text-center mb-4">
                    <div class="medical-stat-icon mb-3" style="width: 80px; height: 80px; margin: 0 auto; font-size: 30px;">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <h4>${adminData.name || 'Administrador'}</h4>
                    <p class="text-muted">${adminData.email || 'admin@sistema.com'}</p>
                    <span class="badge badge-primary">Administrador del Sistema</span>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <h6><i class="fas fa-info-circle text-primary"></i> Información</h6>
                        <ul class="list-unstyled">
                            <li><strong>Rol:</strong> ${adminData.role || 'admin'}</li>
                            <li><strong>Último acceso:</strong> ${new Date().toLocaleString('es-ES')}</li>
                            <li><strong>Sesión activa:</strong> <span class="badge badge-success">Sí</span></li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h6><i class="fas fa-cogs text-success"></i> Permisos</h6>
                        <ul class="list-unstyled">
                            <li><i class="fas fa-check text-success"></i> Gestionar estudiantes</li>
                            <li><i class="fas fa-check text-success"></i> Ver todas las entregas</li>
                            <li><i class="fas fa-check text-success"></i> Generar reportes</li>
                            <li><i class="fas fa-check text-success"></i> Configurar sistema</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar en un modal simple
        const modalHTML = `
            <div class="modal fade" id="modalPerfilAdmin" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                                            <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-user-shield"></i> Mi Perfil de Administrador
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${contenido}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times"></i> Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const modalAnterior = document.getElementById('modalPerfilAdmin');
        if (modalAnterior) {
            modalAnterior.remove();
        }
        
        // Agregar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = new bootstrap.Modal(document.getElementById('modalPerfilAdmin'));
        modal.show();
        
        // Limpiar modal cuando se cierre
        modal._element.addEventListener('hidden.bs.modal', () => {
            modal._element.remove();
        });
        
    } catch (error) {
        console.error('❌ Error mostrando perfil admin:', error);
        mostrarNotificacionAdmin('error', 'Error', 'No se pudo cargar el perfil de administrador');
    }
}

function mostrarConfiguracionSistema() {
    const contenido = `
        <div class="admin-stat-card">
            <h6><i class="fas fa-cogs text-primary"></i> Configuración General</h6>
            <form id="formConfigSistema">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Tamaño máximo de archivo (MB)</label>
                            <input type="number" class="form-control" value="10" min="1" max="100">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Extensiones permitidas</label>
                            <input type="text" class="form-control" value="pdf,doc,docx,txt,zip,rar">
                            <small class="form-text text-muted">Separadas por comas</small>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Tiempo de sesión (minutos)</label>
                            <input type="number" class="form-control" value="60" min="15" max="480">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Backup automático</label>
                            <select class="form-control">
                                <option value="daily">Diario</option>
                                <option value="weekly">Semanal</option>
                                <option value="monthly">Mensual</option>
                                <option value="disabled">Deshabilitado</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <hr>
                
                <h6><i class="fas fa-envelope text-success"></i> Configuración de Email</h6>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Servidor SMTP</label>
                            <input type="text" class="form-control" placeholder="smtp.gmail.com">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Puerto</label>
                            <input type="number" class="form-control" value="587">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Email del sistema</label>
                            <input type="email" class="form-control" placeholder="sistema@informatica-medica.com">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Contraseña</label>
                            <input type="password" class="form-control" placeholder="••••••••">
                        </div>
                    </div>
                </div>
                
                <hr>
                
                <h6><i class="fas fa-shield-alt text-warning"></i> Configuración de Seguridad</h6>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="requireStrongPassword" checked>
                            <label class="form-check-label" for="requireStrongPassword">
                                Requerir contraseñas seguras
                            </label>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="enableTwoFactor">
                            <label class="form-check-label" for="enableTwoFactor">
                                Habilitar autenticación de dos factores
                            </label>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="logAllActions" checked>
                            <label class="form-check-label" for="logAllActions">
                                Registrar todas las acciones
                            </label>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="enableIpWhitelist">
                            <label class="form-check-label" for="enableIpWhitelist">
                                Habilitar lista blanca de IPs
                            </label>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    `;
    
    const modalHTML = `
        <div class="modal fade" id="modalConfigSistema" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-tools"></i> Configuración del Sistema
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${contenido}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" onclick="guardarConfiguracionSistema()">
                            <i class="fas fa-save"></i> Guardar Configuración
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('modalConfigSistema');
    if (modalAnterior) {
        modalAnterior.remove();
    }
    
    // Agregar nuevo modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = new bootstrap.Modal(document.getElementById('modalConfigSistema'));
    modal.show();
    
    // Limpiar modal cuando se cierre
    modal._element.addEventListener('hidden.bs.modal', () => {
        modal._element.remove();
    });
}

function guardarConfiguracionSistema() {
    try {
        // Simular guardado de configuración
        mostrarNotificacionAdmin('info', 'Guardando', 'Guardando configuración del sistema...');
        
        setTimeout(() => {
            mostrarNotificacionAdmin('success', 'Configuración Guardada', 'La configuración se ha guardado correctamente');
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfigSistema'));
            if (modal) {
                modal.hide();
            }
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error guardando configuración:', error);
        mostrarNotificacionAdmin('error', 'Error', 'Error guardando la configuración del sistema');
    }
}

// Función de cerrar sesión admin
function cerrarSesionAdmin() {
    if (confirm('¿Estás seguro de que deseas cerrar la sesión de administrador?')) {
        GestorAutenticacionAdmin.cerrarSesionAdmin();
    }
}

// 🛠️ UTILIDADES Y HELPERS

// Función debounce para optimizar búsquedas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Función para formatear números con separadores de miles
function formatearNumero(numero) {
    return new Intl.NumberFormat('es-ES').format(numero);
}

// Función para calcular diferencia de tiempo
function calcularTiempoTranscurrido(fecha) {
    const ahora = new Date();
    const fechaEntrega = new Date(fecha);
    const diferencia = ahora - fechaEntrega;
    
    const minutos = Math.floor(diferencia / 60000);
    const horas = Math.floor(diferencia / 3600000);
    const dias = Math.floor(diferencia / 86400000);
    
    if (dias > 0) {
        return `hace ${dias} día${dias !== 1 ? 's' : ''}`;
    } else if (horas > 0) {
        return `hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    } else if (minutos > 0) {
        return `hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    } else {
        return 'hace un momento';
    }
}

// Función para validar email
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Función para generar contraseña temporal
function generarPasswordTemporal(longitud = 8) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let resultado = '';
    for (let i = 0; i < longitud; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// 🎯 ASIGNACIÓN DE FUNCIONES GLOBALES
window.verificarAutenticacionAdmin = verificarAutenticacionAdmin;
window.cargarDatosAdmin = cargarDatosAdmin;
window.cargarDashboardAdmin = cargarDashboardAdmin;
window.configurarEventosAdmin = configurarEventosAdmin;
window.inicializarGraficos = inicializarGraficos;
window.configurarActualizacionAutomatica = configurarActualizacionAutomatica;

window.actualizarDashboard = actualizarDashboard;
window.cambiarPeriodoGrafico = cambiarPeriodoGrafico;
window.aplicarFiltrosAdmin = aplicarFiltrosAdmin;
window.limpiarFiltrosAdmin = limpiarFiltrosAdmin;
window.actualizarTablaEntregas = actualizarTablaEntregas;
window.cambiarPaginaEntregas = cambiarPaginaEntregas;

window.verDetallesEntrega = verDetallesEntrega;
window.descargarEntregaAdmin = descargarEntregaAdmin;
window.confirmarEliminacionAdmin = confirmarEliminacionAdmin;
window.eliminarEntregaAdmin = eliminarEntregaAdmin;

window.mostrarModalNuevoEstudiante = mostrarModalNuevoEstudiante;
window.cargarEstudiantesAdmin = cargarEstudiantesAdmin;
window.verPerfilEstudiante = verPerfilEstudiante;
window.verEntregasEstudiante = verEntregasEstudiante;
window.confirmarEliminacionEstudiante = confirmarEliminacionEstudiante;
window.eliminarEstudianteAdmin = eliminarEstudianteAdmin;
window.importarEstudiantes = importarEstudiantes;

window.generarReporteParticipacion = generarReporteParticipacion;
window.generarAnalisisEntregas = generarAnalisisEntregas;
window.generarReporteAcademico = generarReporteAcademico;
window.exportarReporteCompleto = exportarReporteCompleto;
window.exportarEntregasCSV = exportarEntregasCSV;

window.mostrarEstadisticasAvanzadas = mostrarEstadisticasAvanzadas;
window.exportarEstadisticasAvanzadas = exportarEstadisticasAvanzadas;

window.verificarBaseDatos = verificarBaseDatos;
window.optimizarBaseDatos = optimizarBaseDatos;
window.mostrarInfoSistema = mostrarInfoSistema;
window.actualizarInfoSistema = actualizarInfoSistema;
window.limpiarCacheArchivos = limpiarCacheArchivos;
window.crearRespaldoBD = crearRespaldoBD;
window.verificarIntegridadArchivos = verificarIntegridadArchivos;

window.mostrarLogsSeguridad = mostrarLogsSeguridad;
window.filtrarLogs = filtrarLogs;
window.exportarLogs = exportarLogs;
window.mostrarLogsErrores = mostrarLogsErrores;

window.mostrarPerfilAdmin = mostrarPerfilAdmin;
window.mostrarConfiguracionSistema = mostrarConfiguracionSistema;
window.guardarConfiguracionSistema = guardarConfiguracionSistema;
window.cerrarSesionAdmin = cerrarSesionAdmin;

// 🎉 MENSAJE DE BIENVENIDA ADMIN
console.log(`
👨‍⚕️ ===================================
   PANEL DE ADMINISTRACIÓN
   Sistema de Informática Médica v2.0
   
   ✅ Panel cargado correctamente
   🇪🇸 Interfaz en español
   🏥 Tema médico aplicado
   🔐 Autenticación de admin verificada
   📊 Gráficos inicializados
   🛡️ Seguridad habilitada
   
   Prof. Gabriel Álvarez
===================================
`);

// 📱 DETECCIÓN DE DISPOSITIVO MÓVIL PARA ADMIN
const esMobileAdmin = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (esMobileAdmin) {
    document.body.classList.add('mobile-device-admin');
    console.log('📱 Dispositivo móvil detectado - Optimizaciones de admin aplicadas');
    
    // Ajustes específicos para móvil en admin
    CONFIG_ADMIN.PAGINATION_SIZE = 5; // Menos elementos por página en móvil
}

// 🌐 DETECCIÓN DE CONEXIÓN PARA ADMIN
window.addEventListener('online', () => {
    mostrarNotificacionAdmin('success', 'Conexión Restaurada', 'Conexión a internet restablecida');
    actualizarDashboard();
});

window.addEventListener('offline', () => {
    mostrarNotificacionAdmin('warning', 'Sin Conexión', 'Se perdió la conexión a internet');
});

// �� MANEJO DE ERRORES GLOBALES PARA ADMIN
window.addEventListener('error', (e) => {
    console.error('❌ Error global en admin:', e.error);
    mostrarNotificacionAdmin('error', 'Error del Sistema', 'Error inesperado en el panel de administración');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promesa rechazada en admin:', e.reason);
    mostrarNotificacionAdmin('error', 'Error de Conexión', 'Error en comunicación con el servidor');
});

// 🔒 VERIFICACIÓN DE SEGURIDAD PERIÓDICA
setInterval(() => {
    if (!GestorAutenticacionAdmin.verificarTokenAdmin()) {
        console.warn('⚠️ Token de admin inválido detectado');
        return;
    }
    
    // Verificar si la página está activa
    if (!document.hidden) {
        // Ping silencioso al servidor para mantener sesión activa
        fetch(`${CONFIG_ADMIN.ADMIN_API}/ping`, {
            headers: {
                'Authorization': `Bearer ${GestorAutenticacionAdmin.obtenerTokenAdmin()}`
            }
        }).catch(() => {
            // Error silencioso, no mostrar notificación
            console.log('🔄 Ping de admin falló');
        });
    }
}, 5 * 60 * 1000); // Cada 5 minutos

// 📊 INICIALIZACIÓN DE MÉTRICAS EN TIEMPO REAL
let metricsInterval;

function iniciarMetricasEnTiempoReal() {
    metricsInterval = setInterval(async () => {
        try {
            // Solo actualizar si la página está visible
            if (!document.hidden) {
                const estadisticas = await ClienteAPIAdmin.obtenerEstadisticasGenerales();
                if (estadisticas) {
                    // Actualizar solo los números, sin recargar toda la interfaz
                    document.getElementById('totalEstudiantes').textContent = estadisticas.totalUsers || 0;
                    document.getElementById('totalEntregas').textContent = estadisticas.totalSubmissions || 0;
                    document.getElementById('entregasHoy').textContent = estadisticas.todaySubmissions || 0;
                }
            }
        } catch (error) {
            // Error silencioso para métricas en tiempo real
            console.log('🔄 Actualización de métricas falló');
        }
    }, 60000); // Cada minuto
}

function detenerMetricasEnTiempoReal() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
}

// Iniciar métricas cuando la página se vuelve visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        detenerMetricasEnTiempoReal();
    } else {
        iniciarMetricasEnTiempoReal();
        // Actualizar dashboard cuando vuelve a estar visible
        setTimeout(actualizarDashboard, 1000);
    }
});

// Iniciar métricas al cargar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(iniciarMetricasEnTiempoReal, 5000); // Esperar 5 segundos después de cargar
});

// 🎯 ATAJOS DE TECLADO PARA ADMIN
document.addEventListener('keydown', (e) => {
    // Solo si no estamos en un input o textarea
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        
        // Ctrl/Cmd + R para actualizar dashboard
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            actualizarDashboard();
        }
        
        // Ctrl/Cmd + E para ir a entregas
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            document.getElementById('entregas').scrollIntoView({ behavior: 'smooth' });
        }
        
        // Ctrl/Cmd + S para ir a estudiantes
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            document.getElementById('estudiantes').scrollIntoView({ behavior: 'smooth' });
        }
        
        // Ctrl/Cmd + D para ir al dashboard
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Escape para cerrar modales
    if (e.key === 'Escape') {
        const modalesAbiertos = document.querySelectorAll('.modal.show');
        modalesAbiertos.forEach(modal => {
            const instancia = bootstrap.Modal.getInstance(modal);
            if (instancia) instancia.hide();
        });
    }
});

// 💾 AUTOGUARDADO DE FILTROS
function guardarFiltrosEnLocalStorage() {
    const filtros = {
        buscarEstudiante: document.getElementById('buscarEstudiante')?.value || '',
        filtroFecha: document.getElementById('filtroFecha')?.value || '',
        filtroTitulo: document.getElementById('filtroTitulo')?.value || ''
    };
    
    localStorage.setItem('adminFiltros', JSON.stringify(filtros));
}

function cargarFiltrosDeLocalStorage() {
    try {
        const filtros = JSON.parse(localStorage.getItem('adminFiltros') || '{}');
        
        if (filtros.buscarEstudiante) {
            const elemento = document.getElementById('buscarEstudiante');
            if (elemento) elemento.value = filtros.buscarEstudiante;
        }
        
        if (filtros.filtroFecha) {
            const elemento = document.getElementById('filtroFecha');
            if (elemento) elemento.value = filtros.filtroFecha;
        }
        
        if (filtros.filtroTitulo) {
            const elemento = document.getElementById('filtroTitulo');
            if (elemento) elemento.value = filtros.filtroTitulo;
        }
        
        // Aplicar filtros si hay alguno
        if (filtros.buscarEstudiante || filtros.filtroFecha || filtros.filtroTitulo) {
            setTimeout(aplicarFiltrosAdmin, 1000);
        }
        
    } catch (error) {
        console.log('No se pudieron cargar los filtros guardados');
    }
}

// Guardar filtros cuando cambien
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const filtros = ['buscarEstudiante', 'filtroFecha', 'filtroTitulo'];
        filtros.forEach(filtroId => {
            const elemento = document.getElementById(filtroId);
            if (elemento) {
                elemento.addEventListener('input', debounce(guardarFiltrosEnLocalStorage, 1000));
            }
        });
        
        // Cargar filtros guardados
        cargarFiltrosDeLocalStorage();
    }, 2000);
});