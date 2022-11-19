"""
批量将icns文件转成png文件
Batch convert ICNS files to PNG files
"""
import os

try:
    from PIL import Image
except ImportError:
    os.system("pip install Pillow")
    from PIL import Image


if __name__ == "__main__":
    now_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(now_dir, "src-tauri", "icons")
    png_dir = os.path.join(now_dir, "src-tauri", "png")
    if not os.path.exists(png_dir):
        os.mkdir(png_dir)
    file_list = os.listdir(icons_dir)
    file_list = [file for file in file_list if file.endswith(".icns")]
    for file in file_list:
        icns_path = os.path.join(icons_dir, file)
        image = Image.open(icns_path)
        image_512 = image.copy().resize((512, 512))
        image_32 = image.copy().resize((32, 32))
        image_name = os.path.splitext(file)[0]
        image_512_path = os.path.join(png_dir, image_name + "_512.png")
        image_32_path = os.path.join(png_dir, image_name + "_32.ico")
        image_512.save(image_512_path, "PNG")
        image_32.save(image_32_path, "ICO")
    print("png file write success.")
    print(f"There are {len(os.listdir(png_dir))} png picture in ", png_dir)


