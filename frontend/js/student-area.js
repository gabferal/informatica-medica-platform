// 🏥 SISTEMA DE INFORMÁTICA MÉDICA - ÁREA DEL ESTUDIANTE
// Versión: 2.0 - Completamente en Español
// Autor: Prof. Gabriel Álvarez

// �� CONFIGURACIÓN GLOBAL
const CONFIG = {
    API_BASE: '/api',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar'],
    TOAST_DURATION: 5000,
    REFRESH_INTERVAL: 30000, // 30 segundos
    LANGUAGE: 'es'
};

// 🎨 MENSAJES EN ESPAÑOL
const MENSAJES = {
    CARGANDO: 'Cargando...',
    ERROR_CONEXION: 'Error de conexión con el servidor',
    ERROR_AUTENTICACION: 'Error de autenticación',
    ARCHIVO_SUBIDO: 'Archivo subido exitosamente',
    ARCHIVO_ELIMINADO: 'Entrega eliminada correctamente',
    ARCHIVO_DEMASIADO_GRANDE: 'El archivo es demasiado grande (máx. 10MB)',
    FORMATO_NO_PERMITIDO: 'Formato de archivo no permitido',
    CAMPOS_REQUERIDOS: 'Por favor completa todos los campos requeridos',
    SESION_EXPIRADA: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente',
    EXPORTACION_EXITOSA: 'Datos exportados exitosamente',
    SIN_ENTREGAS: 'No tienes entregas registradas',
    CONFIRMACION_ELIMINACION: '¿Estás seguro de que deseas eliminar esta entrega?'
};

// 🔐 GESTIÓN DE AUTENTICACIÓN
class GestorAutenticacion {
    static verificarToken() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.redirigirLogin();
            return false;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const ahora = Date.now() / 1000;
            
            if (payload.exp < ahora) {
                this.cerrarSesion();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error verificando token:', error);
            this.cerrarSesion();
            return false;
        }
    }
    
    static obtenerToken() {
        return localStorage.getItem('token');
    }
    
    static cerrarSesion() {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        this.redirigirLogin();
    }
    
    static redirigirLogin() {
        mostrarNotificacion('warning', 'Sesión Expirada', MENSAJES.SESION_EXPIRADA);
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
}

// 📡 CLIENTE API
class ClienteAPI {
    static async realizarPeticion(endpoint, opciones = {}) {
        const token = GestorAutenticacion.obtenerToken();
        
        const configuracionPorDefecto = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        // Si es FormData, no establecer Content-Type
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
            const respuesta = await fetch(`${CONFIG.API_BASE}${endpoint}`, configuracionFinal);
            
            if (respuesta.status === 401) {
                GestorAutenticacion.cerrarSesion();
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
            console.error(`❌ Error en petición ${endpoint}:`, error);
            mostrarNotificacion('error', 'Error de Conexión', MENSAJES.ERROR_CONEXION);
            throw error;
        }
    }
    
    static async obtenerEntregas() {
        return await this.realizarPeticion('/submissions');
    }
    
    static async subirEntrega(formData) {
        return await this.realizarPeticion('/submissions', {
            method: 'POST',
            body: formData
        });
    }
    
    static async eliminarEntrega(id) {
        return await this.realizarPeticion(`/submissions/${id}`, {
            method: 'DELETE'
        });
    }
    
    static async obtenerEstadisticasUsuario() {
        return await this.realizarPeticion('/submissions/stats');
    }
    
    static async exportarDatos() {
        return await this.realizarPeticion('/submissions/export');
    }
}

// 🎨 GESTOR DE INTERFAZ
class GestorInterfaz {
    static mostrarCargando(elemento, mostrar = true) {
        if (mostrar) {
            elemento.classList.add('loading');
            elemento.style.pointerEvents = 'none';
        } else {
            elemento.classList.remove('loading');
            elemento.style.pointerEvents = 'auto';
        }
    }
    
    static animarElemento(elemento, animacion = 'medical-bounce') {
        elemento.classList.add(animacion);
        setTimeout(() => {
            elemento.classList.remove(animacion);
        }, 1000);
    }
    
    static formatearFecha(fecha) {
        const opciones = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(fecha).toLocaleDateString('es-ES', opciones);
    }
    
    static formatearTamano(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const tamaños = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + tamaños[i];
    }
    
    static obtenerIconoArchivo(nombreArchivo) {
        const extension = nombreArchivo.toLowerCase().split('.').pop();
        const iconos = {
            'pdf': 'fas fa-file-pdf text-danger',
            'doc': 'fas fa-file-word text-primary',
            'docx': 'fas fa-file-word text-primary',
            'txt': 'fas fa-file-alt text-secondary',
            'zip': 'fas fa-file-archive text-warning',
            'rar': 'fas fa-file-archive text-warning'
        };
        return iconos[extension] || 'fas fa-file text-muted';
    }
}

// 🔔 SISTEMA DE NOTIFICACIONES
function mostrarNotificacion(tipo, titulo, mensaje, duracion = CONFIG.TOAST_DURATION) {
    const toast = document.getElementById('toastNotificacion');
    const iconoToast = document.getElementById('iconoToast');
    const tituloToast = document.getElementById('tituloToast');
    const mensajeToast = document.getElementById('mensajeToast');
    const tiempoToast = document.getElementById('tiempoToast');
    
    // Configurar iconos y colores según el tipo
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
    
    // Mostrar toast
    const bsToast = new bootstrap.Toast(toast, {
        delay: duracion
    });
    bsToast.show();
    
    // Efecto de sonido (opcional)
    if (tipo === 'success') {
        // Aquí podrías agregar un sonido de éxito
    }
}

// 📊 GESTOR DE ESTADÍSTICAS
class GestorEstadisticas {
    static async cargarEstadisticas() {
        try {
            const entregas = await ClienteAPI.obtenerEntregas();
            if (!entregas) return;
            
            const estadisticas = this.calcularEstadisticas(entregas);
            this.actualizarInterfazEstadisticas(estadisticas);
            
        } catch (error) {
            console.error('❌ Error cargando estadísticas:', error);
        }
    }
    
    static calcularEstadisticas(entregas) {
        const ahora = new Date();
        const inicioSemana = new Date(ahora.setDate(ahora.getDate() - ahora.getDay()));
        
        const estadisticas = {
            total: entregas.length,
            estaSemana: 0,
            espacioTotal: 0,
            ultimaEntrega: null,
            porTipo: {},
            porMes: {}
        };
        
        entregas.forEach(entrega => {
            const fechaEntrega = new Date(entrega.submitted_at);
            
            // Entregas de esta semana
            if (fechaEntrega >= inicioSemana) {
                estadisticas.estaSemana++;
            }
            
            // Espacio total
            estadisticas.espacioTotal += entrega.file_size || 0;
            
            // Última entrega
            if (!estadisticas.ultimaEntrega || fechaEntrega > new Date(estadisticas.ultimaEntrega.submitted_at)) {
                estadisticas.ultimaEntrega = entrega;
            }
            
            // Por tipo de archivo
            const extension = entrega.filename ? entrega.filename.split('.').pop().toLowerCase() : 'desconocido';
            estadisticas.porTipo[extension] = (estadisticas.porTipo[extension] || 0) + 1;
            
            // Por mes
            const mes = fechaEntrega.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
            estadisticas.porMes[mes] = (estadisticas.porMes[mes] || 0) + 1;
        });
        
        return estadisticas;
    }
    
    static actualizarInterfazEstadisticas(estadisticas) {
        // Actualizar cards de estadísticas
        document.getElementById('totalEntregas').textContent = estadisticas.total;
        document.getElementById('entregasSemana').textContent = estadisticas.estaSemana;
        document.getElementById('espacioTotal').textContent = GestorInterfaz.formatearTamano(estadisticas.espacioTotal);
        
        const ultimaEntregaElement = document.getElementById('ultimaEntrega');
        if (estadisticas.ultimaEntrega) {
            const fecha = new Date(estadisticas.ultimaEntrega.submitted_at);
            ultimaEntregaElement.textContent = fecha.toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short' 
            });
        } else {
            ultimaEntregaElement.textContent = 'Ninguna';
        }
        
        // Animar las estadísticas
        document.querySelectorAll('.medical-stat-card').forEach(card => {
            GestorInterfaz.animarElemento(card, 'fade-in-up');
        });
    }
    
    static async mostrarEstadisticasDetalladas() {
        try {
            const entregas = await ClienteAPI.obtenerEntregas();
            if (!entregas) return;
            
            const estadisticas = this.calcularEstadisticas(entregas);
            const contenido = this.generarHTMLEstadisticasDetalladas(estadisticas);
            
            document.getElementById('contenidoEstadisticas').innerHTML = contenido;
            
            const modal = new bootstrap.Modal(document.getElementById('modalEstadisticas'));
            modal.show();
            
        } catch (error) {
            console.error('❌ Error mostrando estadísticas detalladas:', error);
            mostrarNotificacion('error', 'Error', 'No se pudieron cargar las estadísticas detalladas');
        }
    }
    
    static generarHTMLEstadisticasDetalladas(estadisticas) {
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="medical-stat-card">
                        <h5><i class="fas fa-chart-bar text-primary"></i> Resumen General</h5>
                        <ul class="list-unstyled">
                            <li><strong>Total de entregas:</strong> ${estadisticas.total}</li>
                            <li><strong>Esta semana:</strong> ${estadisticas.estaSemana}</li>
                            <li><strong>Espacio utilizado:</strong> ${GestorInterfaz.formatearTamano(estadisticas.espacioTotal)}</li>
                            <li><strong>Promedio por entrega:</strong> ${estadisticas.total > 0 ? GestorInterfaz.formatearTamano(estadisticas.espacioTotal / estadisticas.total) : '0 Bytes'}</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="medical-stat-card">
                        <h5><i class="fas fa-file-alt text-success"></i> Tipos de Archivo</h5>
                        <ul class="list-unstyled">
                            ${Object.entries(estadisticas.porTipo).map(([tipo, cantidad]) => 
                                `<li><span class="badge badge-primary me-2">${tipo.toUpperCase()}</span> ${cantidad} archivo${cantidad !== 1 ? 's' : ''}</li>`
                            ).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <div class="medical-stat-card">
                        <h5><i class="fas fa-calendar text-info"></i> Entregas por Mes</h5>
                        <div class="row">
                            ${Object.entries(estadisticas.porMes).map(([mes, cantidad]) => 
                                `<div class="col-md-4 mb-2">
                                    <div class="d-flex justify-content-between">
                                        <span>${mes}:</span>
                                        <span class="fw-bold">${cantidad}</span>
                                    </div>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// 📁 GESTOR DE ARCHIVOS
class GestorArchivos {
    static configurarDragAndDrop() {
        const zonaArrastre = document.getElementById('zonaArrastre');
        const inputArchivo = document.getElementById('archivo');
        
        // Eventos de drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evento => {
            zonaArrastre.addEventListener(evento, this.prevenirDefecto, false);
        });
        
        ['dragenter', 'dragover'].forEach(evento => {
            zonaArrastre.addEventListener(evento, () => {
                zonaArrastre.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(evento => {
            zonaArrastre.addEventListener(evento, () => {
                zonaArrastre.classList.remove('dragover');
            }, false);
        });
        
        zonaArrastre.addEventListener('drop', (e) => {
            const archivos = e.dataTransfer.files;
            if (archivos.length > 0) {
                this.manejarArchivoSeleccionado(archivos[0]);
                inputArchivo.files = archivos;
            }
        }, false);
        
        // Click en zona de arrastre
        zonaArrastre.addEventListener('click', () => {
            inputArchivo.click();
        });
        
        // Cambio en input de archivo
        inputArchivo.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.manejarArchivoSeleccionado(e.target.files[0]);
            }
        });
    }
    
    static prevenirDefecto(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    static manejarArchivoSeleccionado(archivo) {
        // Validar tamaño
        if (archivo.size > CONFIG.MAX_FILE_SIZE) {
            mostrarNotificacion('error', 'Archivo Demasiado Grande', MENSAJES.ARCHIVO_DEMASIADO_GRANDE);
            return false;
        }
        
        // Validar extensión
        const extension = '.' + archivo.name.split('.').pop().toLowerCase();
        if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
            mostrarNotificacion('error', 'Formato No Permitido', MENSAJES.FORMATO_NO_PERMITIDO);
            return false;
        }
        
        // Mostrar información del archivo
        this.mostrarInformacionArchivo(archivo);
        
        // Animar zona de arrastre
        const zonaArrastre = document.getElementById('zonaArrastre');
        GestorInterfaz.animarElemento(zonaArrastre, 'medical-bounce');
        
        return true;
    }
    
    static mostrarInformacionArchivo(archivo) {
        const infoArchivo = document.getElementById('infoArchivo');
        const nombreArchivo = document.getElementById('nombreArchivo');
        const tamanoArchivo = document.getElementById('tamanoArchivo');
        const tipoArchivo = document.getElementById('tipoArchivo');
        
        nombreArchivo.textContent = archivo.name;
        tamanoArchivo.textContent = GestorInterfaz.formatearTamano(archivo.size);
        tipoArchivo.textContent = archivo.type || 'Desconocido';
        
        infoArchivo.classList.remove('d-none');
        GestorInterfaz.animarElemento(infoArchivo, 'fade-in-up');
    }
    
    static limpiarInformacionArchivo() {
        const infoArchivo = document.getElementById('infoArchivo');
        infoArchivo.classList.add('d-none');
    }
}

// 📋 GESTOR DE ENTREGAS
class GestorEntregas {
    static entregas = [];
    static entregasFiltradas = [];
    
    static async cargarEntregas() {
        try {
            const contenedor = document.getElementById('contenedorEntregas');
            GestorInterfaz.mostrarCargando(contenedor, true);
            
            this.entregas = await ClienteAPI.obtenerEntregas();
            
            if (!this.entregas) {
                this.entregas = [];
            }
            
            this.entregasFiltradas = [...this.entregas];
            this.renderizarEntregas();
            
            // Cargar estadísticas
            await GestorEstadisticas.cargarEstadisticas();
            
        } catch (error) {
            console.error('❌ Error cargando entregas:', error);
            this.mostrarErrorCarga();
        } finally {
            const contenedor = document.getElementById('contenedorEntregas');
            GestorInterfaz.mostrarCargando(contenedor, false);
        }
    }
    
    static renderizarEntregas() {
        const contenedor = document.getElementById('contenedorEntregas');
        const sinEntregas = document.getElementById('sinEntregas');
        
        if (this.entregasFiltradas.length === 0) {
            contenedor.innerHTML = '';
            sinEntregas.classList.remove('d-none');
            return;
        }
        
        sinEntregas.classList.add('d-none');
        
        const html = this.entregasFiltradas.map(entrega => this.generarHTMLEntrega(entrega)).join('');
        contenedor.innerHTML = html;
        
        // Animar entregas
        setTimeout(() => {
            document.querySelectorAll('.submission-item').forEach((item, index) => {
                setTimeout(() => {
                    GestorInterfaz.animarElemento(item, 'fade-in-up');
                }, index * 100);
            });
        }, 100);
    }
    
    static generarHTMLEntrega(entrega) {
        const fechaFormateada = GestorInterfaz.formatearFecha(entrega.submitted_at);
        const tamanoFormateado = GestorInterfaz.formatearTamano(entrega.file_size || 0);
        const iconoArchivo = GestorInterfaz.obtenerIconoArchivo(entrega.original_name || entrega.filename);
        
        return `
            <div class="submission-item" data-id="${entrega.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <i class="${iconoArchivo} fa-lg me-3"></i>
                            <div>
                                <h5 class="mb-1 fw-bold">${entrega.title}</h5>
                                <p class="text-muted mb-0">${entrega.description || 'Sin descripción'}</p>
                            </div>
                        </div>
                        
                        <div class="submission-meta">
                            <span>
                                <i class="fas fa-calendar-alt text-primary"></i>
                                ${fechaFormateada}
                            </span>
                            <span>
                                <i class="fas fa-file text-info"></i>
                                ${entrega.original_name || entrega.filename}
                            </span>
                            <span>
                                <i class="fas fa-weight text-success"></i>
                                ${tamanoFormateado}
                            </span>
                        </div>
                    </div>
                    
                    <div class="d-flex gap-2 ms-3">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="descargarEntrega(${entrega.id})"
                                title="Descargar archivo">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" 
                                onclick="previsualizarEntrega(${entrega.id})"
                                title="Previsualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" 
                                onclick="confirmarEliminacion(${entrega.id}, '${entrega.title}')"
                                title="Eliminar entrega">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    static async subirEntrega(formData) {
        try {
            const formulario = document.getElementById('formularioEntrega');
            GestorInterfaz.mostrarCargando(formulario, true);
            
            const resultado = await ClienteAPI.subirEntrega(formData);
            
            if (resultado && resultado.success) {
                mostrarNotificacion('success', 'Éxito', MENSAJES.ARCHIVO_SUBIDO);
                
                // Limpiar formulario
                formulario.reset();
                GestorArchivos.limpiarInformacionArchivo();
                
                // Recargar entregas
                await this.cargarEntregas();
                
                // Scroll a la sección de entregas
                document.getElementById('entregas').scrollIntoView({ 
                    behavior: 'smooth' 
                });
                
            } else {
                throw new Error(resultado?.message || 'Error desconocido');
            }
            
        } catch (error) {
            console.error('❌ Error subiendo entrega:', error);
            mostrarNotificacion('error', 'Error', `Error al subir la entrega: ${error.message}`);
        } finally {
            const formulario = document.getElementById('formularioEntrega');
            GestorInterfaz.mostrarCargando(formulario, false);
        }
    }
    
    static async eliminarEntrega(id) {
        try {
            const resultado = await ClienteAPI.eliminarEntrega(id);
            
            if (resultado && resultado.success !== false) {
                mostrarNotificacion('success', 'Eliminado', MENSAJES.ARCHIVO_ELIMINADO);
                
                // Remover de la lista local
                this.entregas = this.entregas.filter(entrega => entrega.id !== id);
                this.aplicarFiltros();
                
                // Recargar estadísticas
                await GestorEstadisticas.cargarEstadisticas();
                
            } else {
                throw new Error(resultado?.message || 'Error eliminando entrega');
            }
            
        } catch (error) {
            console.error('❌ Error eliminando entrega:', error);
            mostrarNotificacion('error', 'Error', `Error al eliminar la entrega: ${error.message}`);
        }
    }
    
    static filtrarEntregas(termino) {
        if (!termino.trim()) {
            this.entregasFiltradas = [...this.entregas];
        } else {
            const terminoLower = termino.toLowerCase();
            this.entregasFiltradas = this.entregas.filter(entrega => 
                entrega.title.toLowerCase().includes(terminoLower) ||
                (entrega.description && entrega.description.toLowerCase().includes(terminoLower)) ||
                (entrega.original_name && entrega.original_name.toLowerCase().includes(terminoLower))
            );
        }
        
        this.renderizarEntregas();
    }
    
    static ordenarEntregas(criterio) {
        const [campo, direccion] = criterio.split('-');
        
        this.entregasFiltradas.sort((a, b) => {
            let valorA, valorB;
            
            switch (campo) {
                case 'fecha':
                    valorA = new Date(a.submitted_at);
                    valorB = new Date(b.submitted_at);
                    break;
                case 'titulo':
                    valorA = a.title.toLowerCase();
                    valorB = b.title.toLowerCase();
                    break;
                case 'tamano':
                    valorA = a.file_size || 0;
                    valorB = b.file_size || 0;
                    break;
                default:
                    return 0;
            }
            
            if (direccion === 'asc') {
                return valorA > valorB ? 1 : -1;
            } else {
                return valorA < valorB ? 1 : -1;
            }
        });
        
        this.renderizarEntregas();
    }
    
    static aplicarFiltros() {
        const termino = document.getElementById('campoBusqueda').value;
        const orden = document.getElementById('selectorOrden').value;
        
        this.filtrarEntregas(termino);
        this.ordenarEntregas(orden);
    }
    
    static mostrarErrorCarga() {
        const contenedor = document.getElementById('contenedorEntregas');
        contenedor.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h4 class="text-muted">Error al cargar las entregas</h4>
                <p class="text-muted">Hubo un problema al conectar con el servidor</p>
                <button class="btn btn-primary" onclick="cargarEntregas()">
                    <i class="fas fa-redo"></i> Intentar de nuevo
                </button>
            </div>
        `;
    }
}

// 👤 GESTOR DE USUARIO
class GestorUsuario {
    static async cargarDatosUsuario() {
        try {
            const token = GestorAutenticacion.obtenerToken();
            if (!token) return;
            
            const payload = JSON.parse(atob(token.split('.')[1]));
            const nombreUsuario = payload.name || payload.email || 'Usuario';
            
            // Actualizar interfaz
            document.getElementById('userName').textContent = nombreUsuario;
            document.getElementById('userNameNav').textContent = nombreUsuario;
            
            // Guardar datos del usuario
            localStorage.setItem('userData', JSON.stringify({
                name: nombreUsuario,
                email: payload.email,
                userId: payload.userId
            }));
            
        } catch (error) {
            console.error('❌ Error cargando datos del usuario:', error);
        }
    }
}

// 📤 FUNCIONES DE EXPORTACIÓN
async function exportarDatosUsuario() {
    try {
        mostrarNotificacion('info', 'Exportando', 'Preparando datos para exportación...');
        
        const entregas = await ClienteAPI.obtenerEntregas();
        if (!entregas || entregas.length === 0) {
            mostrarNotificacion('warning', 'Sin Datos', MENSAJES.SIN_ENTREGAS);
            return;
        }
        
        const datosCSV = generarCSV(entregas);
        descargarArchivo(datosCSV, 'mis-entregas-informatica-medica.csv', 'text/csv');
        
        mostrarNotificacion('success', 'Exportado', MENSAJES.EXPORTACION_EXITOSA);
        
    } catch (error) {
        console.error('❌ Error exportando datos:', error);
        mostrarNotificacion('error', 'Error', 'No se pudieron exportar los datos');
    }
}

function generarCSV(entregas) {
    const encabezados = [
        'ID',
        'Título',
        'Descripción',
        'Nombre del Archivo',
        'Tamaño (Bytes)',
        'Tamaño Formateado',
        'Fecha de Entrega',
        'Tipo de Archivo'
    ];
    
    const filas = entregas.map(entrega => [
        entrega.id,
        `"${entrega.title.replace(/"/g, '""')}"`,
        `"${(entrega.description || '').replace(/"/g, '""')}"`,
        `"${(entrega.original_name || entrega.filename).replace(/"/g, '""')}"`,
        entrega.file_size || 0,
        GestorInterfaz.formatearTamano(entrega.file_size || 0),
        GestorInterfaz.formatearFecha(entrega.submitted_at),
        (entrega.original_name || entrega.filename).split('.').pop().toUpperCase()
    ]);
    
    const csvContent = [encabezados.join(','), ...filas.map(fila => fila.join(','))].join('\n');
    return '\uFEFF' + csvContent; // BOM para UTF-8
}

function descargarArchivo(contenido, nombreArchivo, tipoMIME) {
    const blob = new Blob([contenido], { type: tipoMIME });
    const url = window.URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.style.display = 'none';
    
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    
    window.URL.revokeObjectURL(url);
}

// 🔍 FUNCIONES DE PREVISUALIZACIÓN
async function previsualizarEntrega(id) {
    try {
        const entrega = GestorEntregas.entregas.find(e => e.id === id);
        if (!entrega) {
            mostrarNotificacion('error', 'Error', 'Entrega no encontrada');
            return;
        }
        
        const contenido = generarHTMLPrevisualizacion(entrega);
        document.getElementById('contenidoPrevisualizacion').innerHTML = contenido;
        
        const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizacion'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error en previsualización:', error);
        mostrarNotificacion('error', 'Error', 'No se pudo previsualizar el archivo');
    }
}

function generarHTMLPrevisualizacion(entrega) {
    const fechaFormateada = GestorInterfaz.formatearFecha(entrega.submitted_at);
    const tamanoFormateado = GestorInterfaz.formatearTamano(entrega.file_size || 0);
    const iconoArchivo = GestorInterfaz.obtenerIconoArchivo(entrega.original_name || entrega.filename);
    
    return `
        <div class="medical-stat-card">
            <div class="row">
                <div class="col-md-8">
                    <h4 class="medical-gradient-text mb-3">
                        <i class="${iconoArchivo} me-2"></i>
                        ${entrega.title}
                    </h4>
                    
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
                            <h6><i class="fas fa-hashtag text-secondary"></i> ID de entrega:</h6>
                            <p class="text-muted">#${entrega.id}</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4 text-center">
                    <div class="medical-stat-icon mb-3" style="width: 100px; height: 100px; margin: 0 auto; font-size: 40px;">
                        <i class="${iconoArchivo.split(' ')[1]}"></i>
                    </div>
                    
                    <div class="d-grid gap-2">
                        <button class="btn btn-primary" onclick="descargarEntrega(${entrega.id})">
                            <i class="fas fa-download"></i> Descargar
                        </button>
                        <button class="btn btn-outline-danger" onclick="confirmarEliminacion(${entrega.id}, '${entrega.title}')">
                            <i class="fas fa-trash-alt"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function previsualizarArchivo() {
    const inputArchivo = document.getElementById('archivo');
    const archivo = inputArchivo.files[0];
    
    if (!archivo) {
        mostrarNotificacion('warning', 'Sin Archivo', 'Por favor selecciona un archivo primero');
        return;
    }
    
    const contenido = `
        <div class="medical-stat-card">
            <div class="text-center">
                <i class="${GestorInterfaz.obtenerIconoArchivo(archivo.name)} fa-4x mb-3"></i>
                <h4>${archivo.name}</h4>
                <p class="text-muted">
                    <strong>Tamaño:</strong> ${GestorInterfaz.formatearTamano(archivo.size)}<br>
                    <strong>Tipo:</strong> ${archivo.type || 'Desconocido'}<br>
                    <strong>Última modificación:</strong> ${new Date(archivo.lastModified).toLocaleDateString('es-ES')}
                </p>
                
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    Este archivo está listo para ser enviado. Asegúrate de completar el título y la descripción antes de enviar.
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('contenidoPrevisualizacion').innerHTML = contenido;
    
    const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizacion'));
    modal.show();
}

// 📥 FUNCIONES DE DESCARGA
async function descargarEntrega(id) {
    try {
        const token = GestorAutenticacion.obtenerToken();
        const url = `${CONFIG.API_BASE}/submissions/download/${id}?token=${token}`;
        
        mostrarNotificacion('info', 'Descargando', 'Iniciando descarga del archivo...');
        
        // Crear enlace temporal para descarga
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        setTimeout(() => {
            mostrarNotificacion('success', 'Descarga Iniciada', 'El archivo se está descargando');
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error descargando archivo:', error);
        mostrarNotificacion('error', 'Error', 'No se pudo descargar el archivo');
    }
}

// 🗑️ FUNCIONES DE ELIMINACIÓN
function confirmarEliminacion(id, titulo) {
    document.getElementById('tituloEliminar').textContent = titulo;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminacion');
    btnConfirmar.onclick = () => eliminarEntrega(id);
    
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmarEliminacion'));
    modal.show();
}

async function eliminarEntrega(id) {
    try {
        // Cerrar modal de confirmación
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmarEliminacion'));
        modal.hide();
        
        await GestorEntregas.eliminarEntrega(id);
        
    } catch (error) {
        console.error('❌ Error eliminando entrega:', error);
    }
}

// 📊 FUNCIONES DE ESTADÍSTICAS
async function mostrarEstadisticasUsuario() {
    await GestorEstadisticas.mostrarEstadisticasDetalladas();
}

async function exportarEstadisticas() {
    try {
        const entregas = await ClienteAPI.obtenerEntregas();
        if (!entregas || entregas.length === 0) {
            mostrarNotificacion('warning', 'Sin Datos', MENSAJES.SIN_ENTREGAS);
            return;
        }
        
        const estadisticas = GestorEstadisticas.calcularEstadisticas(entregas);
        const datosJSON = JSON.stringify(estadisticas, null, 2);
        
        descargarArchivo(datosJSON, 'estadisticas-informatica-medica.json', 'application/json');
        mostrarNotificacion('success', 'Exportado', 'Estadísticas exportadas exitosamente');
        
    } catch (error) {
        console.error('❌ Error exportando estadísticas:', error);
        mostrarNotificacion('error', 'Error', 'No se pudieron exportar las estadísticas');
    }
}

// 🔄 FUNCIONES DE ACTUALIZACIÓN
function limpiarFiltros() {
    document.getElementById('campoBusqueda').value = '';
    document.getElementById('selectorOrden').value = 'fecha-desc';
    GestorEntregas.aplicarFiltros();
    
    mostrarNotificacion('info', 'Filtros Limpiados', 'Se han restablecido todos los filtros');
}

async function actualizarEntregas() {
    mostrarNotificacion('info', 'Actualizando', 'Cargando entregas más recientes...');
    await GestorEntregas.cargarEntregas();
    mostrarNotificacion('success', 'Actualizado', 'Lista de entregas actualizada');
}

// 🚪 FUNCIÓN DE CERRAR SESIÓN
function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        GestorAutenticacion.cerrarSesion();
    }
}

// 📋 CONFIGURACIÓN DE EVENTOS
function configurarEventos() {
    // Formulario de entrega
    const formulario = document.getElementById('formularioEntrega');
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(formulario);
        
        // Validar campos requeridos
        const titulo = formData.get('title');
        const archivo = formData.get('file');
        
        if (!titulo || !archivo || archivo.size === 0) {
            mostrarNotificacion('warning', 'Campos Requeridos', MENSAJES.CAMPOS_REQUERIDOS);
            return;
        }
        
        await GestorEntregas.subirEntrega(formData);
    });
    
    // Búsqueda en tiempo real
    const campoBusqueda = document.getElementById('campoBusqueda');
    let timeoutBusqueda;
    campoBusqueda.addEventListener('input', (e) => {
        clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(() => {
            GestorEntregas.aplicarFiltros();
        }, 300);
    });
    
    // Selector de orden
    const selectorOrden = document.getElementById('selectorOrden');
    selectorOrden.addEventListener('change', () => {
        GestorEntregas.aplicarFiltros();
    });
    
    // Configurar drag and drop
    GestorArchivos.configurarDragAndDrop();
    
    // Actualización automática cada 30 segundos
    setInterval(async () => {
        try {
            await GestorEstadisticas.cargarEstadisticas();
        } catch (error) {
            console.log('🔄 Actualización automática fallida:', error.message);
        }
    }, CONFIG.REFRESH_INTERVAL);
    
    // Detectar cuando la ventana vuelve a estar activa
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            actualizarEntregas();
        }
    });
    
    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R para actualizar
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            actualizarEntregas();
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
}

// 🚀 FUNCIONES DE INICIALIZACIÓN
async function verificarAutenticacion() {
    if (!GestorAutenticacion.verificarToken()) {
        return false;
    }
    return true;
}

async function cargarDatosUsuario() {
    await GestorUsuario.cargarDatosUsuario();
}

async function cargarEntregas() {
    await GestorEntregas.cargarEntregas();
}

// 🎯 FUNCIONES GLOBALES PARA COMPATIBILIDAD
window.mostrarEstadisticasUsuario = mostrarEstadisticasUsuario;
window.exportarDatosUsuario = exportarDatosUsuario;
window.cerrarSesion = cerrarSesion;
window.descargarEntrega = descargarEntrega;
window.previsualizarEntrega = previsualizarEntrega;
window.confirmarEliminacion = confirmarEliminacion;
window.eliminarEntrega = eliminarEntrega;
window.limpiarFiltros = limpiarFiltros;
window.actualizarEntregas = actualizarEntregas;
window.previsualizarArchivo = previsualizarArchivo;
window.exportarEstadisticas = exportarEstadisticas;
window.mostrarEstadisticasDetalladas = () => GestorEstadisticas.mostrarEstadisticasDetalladas();
window.verificarAutenticacion = verificarAutenticacion;
window.cargarDatosUsuario = cargarDatosUsuario;
window.cargarEntregas = cargarEntregas;
window.configurarEventos = configurarEventos;

// 🎉 MENSAJE DE BIENVENIDA
console.log(`
🏥 ===================================
   SISTEMA DE INFORMÁTICA MÉDICA
   Área del Estudiante v2.0
   
   ✅ Sistema cargado correctamente
   🇪🇸 Interfaz en español
   🎨 Tema médico aplicado
   🔐 Autenticación verificada
   
   Prof. Gabriel Álvarez
===================================
`);

// 📱 DETECCIÓN DE DISPOSITIVO MÓVIL
const esMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (esMobile) {
    document.body.classList.add('mobile-device');
    console.log('📱 Dispositivo móvil detectado - Optimizaciones aplicadas');
}

// 🌐 DETECCIÓN DE CONEXIÓN
window.addEventListener('online', () => {
    mostrarNotificacion('success', 'Conexión Restaurada', 'La conexión a internet se ha restablecido');
    actualizarEntregas();
});

window.addEventListener('offline', () => {
    mostrarNotificacion('warning', 'Sin Conexión', 'Se ha perdido la conexión a internet');
});

// 🔄 MANEJO DE ERRORES GLOBALES
window.addEventListener('error', (e) => {
    console.error('❌ Error global capturado:', e.error);
    mostrarNotificacion('error', 'Error del Sistema', 'Se ha producido un error inesperado');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promesa rechazada no manejada:', e.reason);
    mostrarNotificacion('error', 'Error de Conexión', 'Error en la comunicación con el servidor');
});

// 💾 AUTOGUARDADO DE FORMULARIO
let autoguardadoInterval;

function iniciarAutoguardado() {
    autoguardadoInterval = setInterval(() => {
        const titulo = document.getElementById('titulo').value;
        const descripcion = document.getElementById('descripcion').value;
        
        if (titulo || descripcion) {
            localStorage.setItem('formulario_borrador', JSON.stringify({
                titulo,
                descripcion,
                timestamp: Date.now()
            }));
        }
    }, 10000); // Cada 10 segundos
}

function cargarBorrador() {
    const borrador = localStorage.getItem('formulario_borrador');
    if (borrador) {
        try {
            const datos = JSON.parse(borrador);
            const tiempoTranscurrido = Date.now() - datos.timestamp;
            
            // Si el borrador es de menos de 1 hora
            if (tiempoTranscurrido < 3600000) {
                if (confirm('Se encontró un borrador guardado. ¿Deseas recuperarlo?')) {
                    document.getElementById('titulo').value = datos.titulo || '';
                    document.getElementById('descripcion').value = datos.descripcion || '';
                    
                    mostrarNotificacion('info', 'Borrador Recuperado', 'Se ha restaurado el contenido del formulario');
                }
            }
            
            localStorage.removeItem('formulario_borrador');
        } catch (error) {
            console.error('❌ Error cargando borrador:', error);
        }
    }
}

// Iniciar autoguardado cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(cargarBorrador, 1000);
    iniciarAutoguardado();
});

// Limpiar autoguardado al enviar formulario
document.getElementById('formularioEntrega').addEventListener('submit', () => {
    localStorage.removeItem('formulario_borrador');
    clearInterval(autoguardadoInterval);
});