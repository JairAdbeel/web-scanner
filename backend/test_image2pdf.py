import img2pdf
import os

# Crear una imagen de prueba
import cv2
import numpy as np

# Crear una imagen blanca simple
img = np.ones((100, 100, 3), dtype=np.uint8) * 255
test_img_path = "test.jpg"
cv2.imwrite(test_img_path, img)

# Intentar convertir a PDF
try:
    with open("test.pdf", "wb") as f:
        f.write(img2pdf.convert(test_img_path))
    print("✅ img2pdf funciona correctamente")
    os.remove("test.jpg")
    os.remove("test.pdf")
except Exception as e:
    print(f"❌ Error con img2pdf: {e}")