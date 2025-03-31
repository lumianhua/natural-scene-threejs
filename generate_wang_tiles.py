import cv2
import numpy as np
import os

input_paths = {
    'diff': 'assets/textures/sandy_gravel_02_diff_4k.jpg',
    'rough': 'assets/textures/sandy_gravel_02_rough_4k.jpg',
    'ao': 'assets/textures/sandy_gravel_02_ao_4k.jpg',
    'disp': 'assets/textures/sandy_gravel_02_disp_4k.jpg',
    'normal': 'assets/textures/sandy_gravel_02_nor_gl_4k.jpg'
}

output_base = 'assets/wang_tiles'
TILE_SIZE = 256
OVERLAP = 32

os.makedirs(output_base, exist_ok=True)

for suffix, path in input_paths.items():
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]

    tiles = []
    for y in range(4):
        for x in range(4):
            x0 = x * (TILE_SIZE - OVERLAP)
            y0 = y * (TILE_SIZE - OVERLAP)
            tile = img[y0:y0 + TILE_SIZE, x0:x0 + TILE_SIZE]
            tiles.append(tile)

    # Save each tile with a suffix to distinguish channels
    for i, tile in enumerate(tiles):
        filename = os.path.join(output_base, f'wang_{i}_{suffix}.png')
        cv2.imwrite(filename, tile)

    print(f" Generated {len(tiles)} tiles for {suffix}")
