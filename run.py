#!/usr/bin/env python
import subprocess
import sys
import os
import webbrowser
import time

def main():
    print("=" * 50)
    print("Iniciando Web Scanner")
    print("=" * 50)
    
    # Verificar si estamos en el directorio correcto
    if not os.path.exists('backend'):
        print("Error: Ejecuta este script desde la raíz del proyecto")
        sys.exit(1)
    
    # Instalar dependencias si es necesario
    print("\n📦 Instalando dependencias del backend...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'backend/requirements.txt'])
    
    # Iniciar backend en segundo plano
    print("\n🚀 Iniciando servidor backend...")
    backend_process = subprocess.Popen(
        [sys.executable, 'backend/app.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Esperar a que el backend esté listo
    print("⏳ Esperando a que el servidor esté listo...")
    time.sleep(3)
    
    # Abrir frontend en el navegador
    print("\n🌐 Abriendo aplicación en el navegador...")
    frontend_path = os.path.abspath('frontend/index.html')
    webbrowser.open(f'file://{frontend_path}')
    
    print("\n✅ Aplicación iniciada correctamente!")
    print("📝 Presiona Ctrl+C para detener el servidor")
    print("=" * 50)
    
    try:
        # Mantener el script corriendo
        backend_process.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 Deteniendo servidor...")
        backend_process.terminate()
        print("👋 ¡Hasta luego!")

if __name__ == '__main__':
    main()