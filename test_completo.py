import requests
import json

# 1. Primero, subir una imagen de prueba
files = {
    'images': ('test.jpg', open('ruta/a/una/imagen.jpg', 'rb'), 'image/jpeg')
}

print("1. Subiendo imagen...")
response = requests.post('http://localhost:5000/api/upload', files=files)
data = response.json()
print(f"Respuesta: {data}")

if response.status_code == 200:
    session_id = data['session_id']
    image_path = data['images'][0]['path']
    
    print(f"\n2. Procesando imagen...")
    # Puntos de ejemplo (ajusta según tu imagen)
    process_data = {
        'session_id': session_id,
        'images': [{
            'path': image_path,
            'points': [10, 10, 100, 10, 100, 100, 10, 100]  # 4 puntos
        }]
    }
    
    response = requests.post(
        'http://localhost:5000/api/process',
        json=process_data
    )
    print(f"Respuesta: {response.json()}")