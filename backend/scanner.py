import cv2
import numpy as np
import os
from pathlib import Path
import traceback

def procesar_imagen_con_puntos(image_path, puntos, output_folder):
    """
    Procesa una imagen con los 4 puntos seleccionados y guarda el resultado
    
    Args:
        image_path: Ruta de la imagen original
        puntos: Lista de 8 números [x1,y1, x2,y2, x3,y3, x4,y4]
        output_folder: Carpeta donde guardar la imagen procesada
    
    Returns:
        Ruta de la imagen procesada o None si hay error
    """
    try:
        print(f"\n🔍 Procesando: {image_path}")
        print(f"📌 Puntos recibidos: {puntos}")
        print(f"📁 Carpeta salida: {output_folder}")
        
        # 1. Verificar que la imagen existe
        if not os.path.exists(image_path):
            print(f"❌ ERROR: La imagen no existe en la ruta: {image_path}")
            return None
        
        # 2. Leer la imagen
        image = cv2.imread(image_path)
        if image is None:
            print(f"❌ ERROR: No se pudo leer la imagen. Formato no soportado o archivo corrupto")
            return None
        
        print(f"✅ Imagen cargada correctamente. Dimensiones: {image.shape}")
        
        # 3. Verificar que tenemos 8 puntos (4 coordenadas)
        if len(puntos) != 8:
            print(f"❌ ERROR: Se esperaban 8 puntos, se recibieron {len(puntos)}")
            return None
        
        # 4. Convertir puntos a numpy array
        pts_src = np.array([
            [puntos[0], puntos[1]],  # Punto 1
            [puntos[2], puntos[3]],  # Punto 2
            [puntos[4], puntos[5]],  # Punto 3
            [puntos[6], puntos[7]]   # Punto 4
        ], dtype="float32")
        
        print(f"✅ Puntos convertidos: {pts_src}")
        
        # 5. Verificar que los puntos están dentro de la imagen
        h, w = image.shape[:2]
        for i, (x, y) in enumerate(pts_src):
            if x < 0 or x > w or y < 0 or y > h:
                print(f"⚠️  ADVERTENCIA: Punto {i+1} ({x}, {y}) está fuera de la imagen ({w}x{h})")
                # Ajustar puntos fuera de rango
                pts_src[i][0] = max(0, min(w, x))
                pts_src[i][1] = max(0, min(h, y))
        
        # 6. Calcular dimensiones del documento
        ancho1 = np.linalg.norm(pts_src[0] - pts_src[1])
        ancho2 = np.linalg.norm(pts_src[2] - pts_src[3])
        alto1 = np.linalg.norm(pts_src[0] - pts_src[3])
        alto2 = np.linalg.norm(pts_src[1] - pts_src[2])
        
        width = int(max(ancho1, ancho2))
        height = int(max(alto1, alto2))
        
        print(f"📐 Dimensiones calculadas: {width} x {height}")
        
        # 7. Verificar dimensiones válidas
        if width <= 0 or height <= 0:
            print(f"❌ ERROR: Dimensiones inválidas: {width} x {height}")
            return None
        
        # 8. Puntos de destino
        pts_dst = np.array([
            [0, 0],
            [width, 0],
            [width, height],
            [0, height]
        ], dtype="float32")
        
        # 9. Calcular matriz de transformación
        try:
            matrix = cv2.getPerspectiveTransform(pts_src, pts_dst)
            print("✅ Matriz de transformación calculada")
        except cv2.error as e:
            print(f"❌ ERROR en getPerspectiveTransform: {e}")
            return None
        
        # 10. Aplicar transformación
        try:
            warped = cv2.warpPerspective(image, matrix, (width, height))
            print(f"✅ Transformación aplicada. Resultado: {warped.shape}")
        except cv2.error as e:
            print(f"❌ ERROR en warpPerspective: {e}")
            return None
        
        # 11. Crear carpeta de salida si no existe
        os.makedirs(output_folder, exist_ok=True)
        
        # 12. Generar nombre único
        nombre_base = Path(image_path).stem
        import random
        output_filename = f"scan_{nombre_base}_{random.randint(1000, 9999)}.jpg"
        output_path = os.path.join(output_folder, output_filename)
        
        # 13. Guardar imagen
        success = cv2.imwrite(output_path, warped)
        if not success:
            print(f"❌ ERROR: No se pudo guardar la imagen en {output_path}")
            return None
        
        print(f"✅ Imagen guardada: {output_path}")
        
        # 14. Verificar que el archivo se creó
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"📊 Tamaño del archivo: {file_size} bytes")
            if file_size == 0:
                print(f"❌ ERROR: El archivo está vacío")
                return None
        else:
            print(f"❌ ERROR: El archivo no se creó")
            return None
        
        return output_path
        
    except Exception as e:
        print(f"❌ ERROR inesperado: {str(e)}")
        print(traceback.format_exc())  # Esto imprime el error completo
        return None