import os
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import img2pdf
import shutil
from werkzeug.utils import secure_filename
import uuid
from scanner import procesar_imagen_con_puntos

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Detectar entorno
IS_PRODUCTION = os.environ.get('PYTHONANYWHERE_DOMAIN') is not None

if IS_PRODUCTION:
    # Rutas para PythonAnywhere
    UPLOAD_FOLDER = '/tmp/uploads'
    TEMP_FOLDER = '/tmp/temp_scans'
    print("🌍 EN MODO PRODUCCIÓN - PythonAnywhere")
else:
    # Rutas para desarrollo local
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    TEMP_FOLDER = os.path.join(BASE_DIR, 'temp_scans')
    print("💻 EN MODO DESARROLLO LOCAL")

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'clave-desarrollo-local')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['TEMP_FOLDER'] = TEMP_FOLDER

# Crear carpetas
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Extensiones permitidas
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Servidor funcionando'})

@app.route('/api/upload', methods=['POST'])
def upload_images():
    """
    Endpoint para subir imágenes
    """
    if 'images' not in request.files:
        return jsonify({'error': 'No se enviaron imágenes'}), 400
    
    files = request.files.getlist('images')
    session_id = str(uuid.uuid4())
    session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
    os.makedirs(session_folder, exist_ok=True)
    
    uploaded_files = []
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(session_folder, filename)
            file.save(filepath)
            uploaded_files.append({
                'original_name': filename,
                'path': filepath,
                'session_id': session_id,
                'id': len(uploaded_files)
            })
    
    if not uploaded_files:
        return jsonify({'error': 'No se subieron archivos válidos'}), 400
    
    return jsonify({
        'message': f'Se subieron {len(uploaded_files)} imágenes',
        'images': uploaded_files,
        'session_id': session_id
    })

@app.route('/api/process', methods=['POST'])
def process_images():
    """
    Endpoint para procesar todas las imágenes y generar PDF
    """
    data = request.json
    session_id = data.get('session_id')
    images_data = data.get('images', [])
    
    print(f"\n📥 RECIBIDA PETICIÓN DE PROCESADO")
    print(f"🆔 Session ID: {session_id}")
    print(f"🖼️ Imágenes a procesar: {len(images_data)}")
    
    if not session_id or not images_data:
        print("❌ Datos incompletos")
        return jsonify({'error': 'Datos incompletos'}), 400
    
    session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
    temp_folder = os.path.join(app.config['TEMP_FOLDER'], session_id)
    os.makedirs(temp_folder, exist_ok=True)
    
    print(f"📁 Carpeta temporal: {temp_folder}")
    
    processed_images = []
    errors = []
    
    try:
        # Procesar cada imagen con sus puntos
        for i, img_data in enumerate(images_data):
            print(f"\n--- Procesando imagen {i+1}/{len(images_data)} ---")
            image_path = img_data['path']
            puntos = img_data['points']  # Lista de 8 números
            
            print(f"Ruta: {image_path}")
            print(f"Puntos: {puntos}")
            
            # Verificar que la imagen existe
            if not os.path.exists(image_path):
                error_msg = f"La imagen no existe: {image_path}"
                print(f"❌ {error_msg}")
                errors.append(error_msg)
                continue
            
            # Procesar imagen
            processed_path = procesar_imagen_con_puntos(
                image_path, 
                puntos,
                temp_folder
            )
            
            if processed_path:
                processed_images.append(processed_path)
                print(f"✅ Procesada correctamente: {processed_path}")
            else:
                error_msg = f"Error procesando imagen {i+1}"
                print(f"❌ {error_msg}")
                errors.append(error_msg)
        
        print(f"\n📊 RESULTADO FINAL:")
        print(f"✅ Procesadas: {len(processed_images)}")
        print(f"❌ Errores: {len(errors)}")
        
        if not processed_images:
            error_detail = ", ".join(errors) if errors else "No se pudo procesar ninguna imagen"
            return jsonify({'error': error_detail}), 500
        
        # Generar PDF con todas las imágenes procesadas
        pdf_filename = f"scanned_document_{session_id}.pdf"
        pdf_path = os.path.join(temp_folder, pdf_filename)
        
        print(f"\n📄 Generando PDF: {pdf_path}")
        
        try:
            with open(pdf_path, "wb") as f:
                f.write(img2pdf.convert(processed_images))
            print(f"✅ PDF generado con {len(processed_images)} páginas")
        except Exception as e:
            print(f"❌ Error generando PDF: {e}")
            return jsonify({'error': f'Error generando PDF: {str(e)}'}), 500
        
        return jsonify({
            'message': 'PDF generado exitosamente',
            'pdf_url': f'/api/download/{session_id}/{pdf_filename}',
            'pages': len(processed_images)
        })
        
    except Exception as e:
        print(f"❌ ERROR GENERAL: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<session_id>/<filename>', methods=['GET'])
def download_pdf(session_id, filename):
    """
    Endpoint para descargar el PDF generado
    """
    pdf_path = os.path.join(app.config['TEMP_FOLDER'], session_id, filename)
    
    print(f"📥 Descargando: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    
    try:
        # Forzar descarga con nombre amigable
        return send_file(
            pdf_path,
            as_attachment=True,  # Esto fuerza la descarga
            download_name=f'documento_escaneado_{session_id[:8]}.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup/<session_id>', methods=['POST'])
def cleanup_session(session_id):
    """
    Endpoint para limpiar archivos temporales
    """
    try:
        # Eliminar carpeta de uploads
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        if os.path.exists(upload_folder):
            shutil.rmtree(upload_folder)
        
        # Eliminar carpeta temporal
        temp_folder = os.path.join(app.config['TEMP_FOLDER'], session_id)
        if os.path.exists(temp_folder):
            shutil.rmtree(temp_folder)
        
        return jsonify({'message': 'Limpieza completada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)