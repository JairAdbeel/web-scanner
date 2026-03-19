// Configuración
const API_URL = window.location.origin + '/api';
console.log('🌐 Conectando a:', API_URL);// Para verificar // Cambia TU_USUARIO cuando despliegues

// Estado de la aplicación
let state = {
    sessionId: null,
    images: [],
    currentImageIndex: 0,
    stage: null,
    layer: null,
    konvaImage: null,
    scale: 1,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
};

// Variables para el nombre del archivo
let selectedFilename = 'documento_escaneado';

// Elementos del DOM
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const selectFilesBtn = document.getElementById('selectFilesBtn');
const previewList = document.getElementById('previewList');
const continueBtn = document.getElementById('continueBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const processBtn = document.getElementById('processBtn');
const canvasContainer = document.getElementById('canvasContainer');
const imageCounter = document.getElementById('imageCounter');
const totalImagesSpan = document.getElementById('totalImages');
const pointsStatus = document.getElementById('pointsStatus');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const processingStatus = document.getElementById('processingStatus');
const pageCount = document.getElementById('pageCount');
const downloadLink = document.getElementById('downloadLink');
const newScanBtn = document.getElementById('newScanBtn');

// Elementos para el nombre del archivo
const pdfFilename = document.getElementById('pdfFilename');
const filenameDisplay = document.getElementById('filenameDisplay');
const renameFilename = document.getElementById('renameFilename');
const renameBtn = document.getElementById('renameBtn');

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

// Sanitizar nombre de archivo
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // Reemplazar caracteres no válidos
        .replace(/\s+/g, '_')              // Espacios a guión bajo
        .substring(0, 50);                  // Limitar longitud
}

// Sugerir nombre con fecha
function suggestFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `escaneo_${year}${month}${day}`;
}

// Mostrar toast
function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// ============================================
// FUNCIONES DE ZOOM (MÓVIL)
// ============================================

function addZoomControls() {
    if (!state.isMobile) return;
    
    const zoomDiv = document.createElement('div');
    zoomDiv.className = 'zoom-controls';
    zoomDiv.innerHTML = `
        <button class="zoom-btn" id="zoomIn">+</button>
        <button class="zoom-btn" id="zoomOut">-</button>
        <button class="zoom-btn" id="zoomReset">⟲</button>
    `;
    
    canvasContainer.parentNode.insertBefore(zoomDiv, canvasContainer.nextSibling);
    
    document.getElementById('zoomIn').addEventListener('click', () => zoom(1.2));
    document.getElementById('zoomOut').addEventListener('click', () => zoom(0.8));
    document.getElementById('zoomReset').addEventListener('click', resetZoom);
}

function zoom(factor) {
    if (!state.stage) return;
    
    const oldScale = state.stage.scaleX();
    const newScale = oldScale * factor;
    
    if (newScale < 0.5 || newScale > 3) return;
    
    state.stage.scale({ x: newScale, y: newScale });
    
    const container = canvasContainer;
    const stageWidth = state.stage.width() * newScale;
    const stageHeight = state.stage.height() * newScale;
    
    container.scrollLeft = (stageWidth - container.clientWidth) / 2;
    container.scrollTop = (stageHeight - container.clientHeight) / 2;
    
    showToast(`Zoom: ${Math.round(newScale * 100)}%`);
}

function resetZoom() {
    if (!state.stage) return;
    state.stage.scale({ x: 1, y: 1 });
    canvasContainer.scrollLeft = 0;
    canvasContainer.scrollTop = 0;
    showToast('Zoom restaurado');
}

// ============================================
// MANEJO DE ARCHIVOS
// ============================================

// Event Listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#667eea';
    uploadArea.style.background = '#f0f3ff';
});
uploadArea.addEventListener('dragleave', () => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ccc';
    uploadArea.style.background = '#f9f9f9';
});
uploadArea.addEventListener('drop', handleDrop);
selectFilesBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
continueBtn.addEventListener('click', goToStep2);
prevBtn.addEventListener('click', showPreviousImage);
nextBtn.addEventListener('click', showNextImage);
processBtn.addEventListener('click', processImages);
newScanBtn.addEventListener('click', resetApp);

// Touch events para móvil
if (state.isMobile) {
    uploadArea.addEventListener('touchstart', () => {
        uploadArea.style.background = '#f0f3ff';
    });
    uploadArea.addEventListener('touchend', () => {
        uploadArea.style.background = '#f9f9f9';
    });
}

// Manejar drop de archivos
function handleDrop(e) {
    e.preventDefault();
    uploadArea.style.borderColor = '#ccc';
    uploadArea.style.background = '#f9f9f9';
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
}

// Manejar selección de archivos
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

// Procesar archivos seleccionados
async function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('Por favor selecciona archivos de imagen válidos');
        return;
    }
    
    showToast(`📸 ${imageFiles.length} imágenes seleccionadas`);
    
    for (const file of imageFiles) {
        const preview = await createPreview(file);
        state.images.push({
            file: file,
            preview: preview,
            points: []
        });
    }
    
    updatePreviewList();
    continueBtn.disabled = false;
}

// Crear preview de imagen
function createPreview(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

// Actualizar lista de previews
function updatePreviewList() {
    previewList.innerHTML = '';
    state.images.forEach((img, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${img.preview}" alt="Preview ${index + 1}">
            <button class="remove-btn" onclick="removeImage(${index})">×</button>
        `;
        previewList.appendChild(previewItem);
    });
}

// Eliminar imagen de la lista
window.removeImage = (index) => {
    state.images.splice(index, 1);
    updatePreviewList();
    if (state.images.length === 0) {
        continueBtn.disabled = true;
    }
    showToast('Imagen eliminada');
};

// ============================================
// PASO 2 - SELECCIÓN DE PUNTOS
// ============================================

// Ir al paso 2
async function goToStep2() {
    step1.classList.remove('active');
    step2.classList.add('active');
    
    totalImagesSpan.textContent = state.images.length;
    
    // Sugerir nombre con fecha
    if (pdfFilename) {
        pdfFilename.value = suggestFilename();
        selectedFilename = suggestFilename();
    }
    
    // Añadir controles de zoom en móvil
    addZoomControls();
    
    await uploadImages();
    state.currentImageIndex = 0;
    loadImageToCanvas(0);
}

// Subir imágenes al servidor
async function uploadImages() {
    const formData = new FormData();
    state.images.forEach(img => {
        formData.append('images', img.file);
    });
    
    try {
        showToast('Subiendo imágenes...');
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        state.sessionId = data.session_id;
        
        data.images.forEach((imgData, index) => {
            state.images[index].path = imgData.path;
        });
        
        showToast('✅ Imágenes listas');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al subir las imágenes');
    }
}

// Cargar imagen al canvas
function loadImageToCanvas(index) {
    const img = state.images[index];
    
    const imageObj = new Image();
    imageObj.onload = () => {
        if (state.stage) {
            state.stage.destroy();
        }
        
        const containerWidth = canvasContainer.clientWidth;
        const containerHeight = canvasContainer.clientHeight;
        
        const scale = Math.min(
            1,
            containerWidth / imageObj.width,
            containerHeight / imageObj.height
        );
        
        state.stage = new Konva.Stage({
            container: 'canvasContainer',
            width: imageObj.width,
            height: imageObj.height,
            draggable: state.isMobile
        });
        
        state.layer = new Konva.Layer();
        
        state.konvaImage = new Konva.Image({
            image: imageObj,
            x: 0,
            y: 0,
            width: imageObj.width,
            height: imageObj.height
        });
        
        state.layer.add(state.konvaImage);
        state.stage.add(state.layer);
        
        state.stage.scale({ x: scale, y: scale });
        
        if (img.points.length > 0) {
            img.points.forEach(point => {
                drawPoint(point.x, point.y, true);
            });
        }
        
        state.stage.on('click tap', handleCanvasClick);
        
        updateImageCounter();
        updatePointsStatus();
    };
    
    imageObj.src = img.preview;
}

// Manejar clics en el canvas
function handleCanvasClick(e) {
    const img = state.images[state.currentImageIndex];
    
    if (img.points.length >= 4) {
        showToast('Ya seleccionaste 4 puntos');
        return;
    }
    
    const pos = state.stage.getPointerPosition();
    const scale = state.stage.scaleX();
    const originalX = Math.round(pos.x / scale);
    const originalY = Math.round(pos.y / scale);
    
    img.points.push({ x: originalX, y: originalY });
    
    drawPoint(originalX, originalY);
    
    if (state.isMobile && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }
    
    updatePointsStatus();
    checkAllImagesCompleted();
    
    showToast(`Punto ${img.points.length} de 4 seleccionado`);
}

// Dibujar punto en el canvas
function drawPoint(x, y, isExisting = false) {
    const scale = state.stage.scaleX();
    
    const circle = new Konva.Circle({
        x: x,
        y: y,
        radius: isExisting ? 8 : (state.isMobile ? 12 : 8),
        fill: 'green',
        stroke: 'white',
        strokeWidth: 3,
        shadowColor: 'black',
        shadowBlur: 10,
        shadowOpacity: 0.3,
        draggable: state.isMobile
    });
    
    circle.on('dragend', function() {
        const newPos = this.position();
        const img = state.images[state.currentImageIndex];
        const pointIndex = img.points.findIndex(p => 
            Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5
        );
        
        if (pointIndex !== -1) {
            img.points[pointIndex] = { 
                x: Math.round(newPos.x), 
                y: Math.round(newPos.y) 
            };
            showToast('Punto ajustado');
        }
    });
    
    const pointNumber = state.images[state.currentImageIndex].points.length;
    const text = new Konva.Text({
        x: x + (state.isMobile ? 15 : 10),
        y: y - (state.isMobile ? 20 : 15),
        text: pointNumber.toString(),
        fontSize: state.isMobile ? 16 : 14,
        fill: 'white',
        stroke: 'black',
        strokeWidth: 2,
        padding: 5
    });
    
    state.layer.add(circle);
    state.layer.add(text);
    state.layer.batchDraw();
}

// Actualizar contador de puntos
function updatePointsStatus() {
    const pointsCount = state.images[state.currentImageIndex].points.length;
    pointsStatus.textContent = `Puntos seleccionados: ${pointsCount}/4`;
    
    if (pointsCount === 4) {
        pointsStatus.style.color = '#28a745';
        pointsStatus.style.background = '#e8f5e9';
    } else {
        pointsStatus.style.color = '#667eea';
        pointsStatus.style.background = 'white';
    }
}

// Actualizar contador de imágenes
function updateImageCounter() {
    imageCounter.textContent = `Imagen ${state.currentImageIndex + 1} de ${state.images.length}`;
    
    prevBtn.disabled = state.currentImageIndex === 0;
    nextBtn.disabled = state.currentImageIndex === state.images.length - 1;
}

// Mostrar imagen anterior
function showPreviousImage() {
    if (state.currentImageIndex > 0) {
        state.currentImageIndex--;
        loadImageToCanvas(state.currentImageIndex);
        showToast(`Imagen ${state.currentImageIndex + 1}`);
    }
}

// Mostrar imagen siguiente
function showNextImage() {
    if (state.currentImageIndex < state.images.length - 1) {
        state.currentImageIndex++;
        loadImageToCanvas(state.currentImageIndex);
        showToast(`Imagen ${state.currentImageIndex + 1}`);
    }
}

// Verificar si todas las imágenes tienen puntos
function checkAllImagesCompleted() {
    const allCompleted = state.images.every(img => img.points.length === 4);
    processBtn.disabled = !allCompleted;
    
    if (allCompleted) {
        processBtn.classList.add('btn-primary');
        showToast('✅ Todas las imágenes listas');
    }
}

// ============================================
// PASO 3 - PROCESAR Y DESCARGAR
// ============================================

// Procesar imágenes y generar PDF
async function processImages() {
    step2.classList.remove('active');
    step3.classList.add('active');
    
    // Ocultar campo de nombre durante procesamiento
    document.getElementById('filenameSection').style.display = 'none';
    
    loading.style.display = 'block';
    result.style.display = 'none';
    processingStatus.textContent = 'Procesando imágenes...';
    
    const imagesData = state.images.map(img => ({
        path: img.path,
        points: img.points.map(p => [p.x, p.y]).flat()
    }));
    
    try {
        const response = await fetch(`${API_URL}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: state.sessionId,
                images: imagesData
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loading.style.display = 'none';
            result.style.display = 'block';
            pageCount.textContent = data.pages;
            
            const pdfUrl = data.pdf_url;
            
            // Mostrar nombre elegido
            filenameDisplay.textContent = `📄 ${selectedFilename}.pdf`;
            renameFilename.value = selectedFilename;
            
            // Configurar botones de descarga
            setupDownloadButtons(pdfUrl, selectedFilename);
            
            showToast('✅ PDF generado - Listo para descargar');
        } else {
            throw new Error(data.error || 'Error al procesar');
        }
        
    } catch (error) {
        loading.style.display = 'none';
        result.style.display = 'block';
        result.innerHTML = `
            <h3 style="color: #dc3545;">❌ Error</h3>
            <p>${error.message}</p>
            <button class="btn-primary" onclick="resetApp()">Intentar de nuevo</button>
        `;
    }
}

// Configurar botones de descarga
function setupDownloadButtons(pdfUrl, defaultName) {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadLink = document.getElementById('downloadLink');
    const renameBtn = document.getElementById('renameBtn');
    const renameInput = document.getElementById('renameFilename');
    
    const fullUrl = `${API_URL.replace('/api', '')}${pdfUrl}`;
    
    // Descargar con nombre actual
    downloadBtn.onclick = () => {
        const currentName = renameInput.value || defaultName;
        downloadPdfWithName(fullUrl, sanitizeFilename(currentName));
    };
    
    // Link alternativo
    downloadLink.onclick = (e) => {
        e.preventDefault();
        downloadPdfWithName(fullUrl, defaultName);
    };
    
    // Botón de renombrar
    renameBtn.onclick = () => {
        const newName = sanitizeFilename(renameInput.value);
        if (newName) {
            renameInput.value = newName;
            filenameDisplay.textContent = `📄 ${newName}.pdf`;
            showToast(`Nombre cambiado a: ${newName}.pdf`);
        }
    };
    
    // Enter en el input de renombrar
    renameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            renameBtn.click();
        }
    });
}

// Descargar PDF con nombre personalizado
async function downloadPdfWithName(pdfUrl, filename) {
    try {
        showToast(`⏬ Descargando ${filename}.pdf...`);
        
        const response = await fetch(pdfUrl);
        
        if (!response.ok) {
            throw new Error('Error al descargar');
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
        
        showToast(`✅ ${filename}.pdf descargado`);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ Error en descarga');
    }
}

// ============================================
// REINICIAR APLICACIÓN
// ============================================

function resetApp() {
    state = {
        sessionId: null,
        images: [],
        currentImageIndex: 0,
        stage: null,
        layer: null,
        konvaImage: null,
        scale: 1,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    };
    
    canvasContainer.innerHTML = '';
    fileInput.value = '';
    
    step3.classList.remove('active');
    step1.classList.add('active');
    
    previewList.innerHTML = '';
    continueBtn.disabled = true;
    result.style.display = 'none';
    loading.style.display = 'block';
    
    // Mostrar campo de nombre
    document.getElementById('filenameSection').style.display = 'block';
    pdfFilename.value = suggestFilename();
    selectedFilename = suggestFilename();
    
    // Eliminar controles de zoom si existen
    const zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) zoomControls.remove();
    
    showToast('Nuevo escaneo');
}

// ============================================
// VALIDACIÓN DE NOMBRE DE ARCHIVO
// ============================================

if (pdfFilename) {
    pdfFilename.addEventListener('input', (e) => {
        let value = e.target.value;
        
        if (value.includes(' ')) {
            showToast('⚠️ Los espacios serán reemplazados por _', 2000);
        }
        
        value = value.replace(/[^a-zA-Z0-9_-]/g, '_');
        value = value.replace(/\s+/g, '_');
        
        if (value.length === 0) value = 'documento_escaneado';
        
        if (value.length > 50) {
            value = value.substring(0, 50);
            showToast('⚠️ Nombre muy largo, se truncará', 2000);
        }
        
        pdfFilename.value = value;
        selectedFilename = value;
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    showToast('👆 Web Scanner listo', 1500);
});