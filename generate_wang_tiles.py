import cv2
import numpy as np
import os

# Enter the path to the original image
input_path = 'assets/textures/sandy_gravel_02_diff_4k.jpg'
output_dir = 'assets/wang_tiles'
os.makedirs(output_dir, exist_ok=True)

# Setting parameters
TILE_SIZE = 256  # Size of each tile
OVERLAP = 32     # Overlapping sections for smooth edge transitions

# Load image
img = cv2.imread(input_path)
h, w = img.shape[:2]
tiles = []

# Cut 4x4 of 16 tiles
for y in range(4):
    for x in range(4):
        x0 = x * (TILE_SIZE - OVERLAP)
        y0 = y * (TILE_SIZE - OVERLAP)
        tile = img[y0:y0 + TILE_SIZE, x0:x0 + TILE_SIZE]
        tiles.append(tile)

# Save
for i, tile in enumerate(tiles):
    filename = os.path.join(output_dir, f'wang_{i}.png')
    cv2.imwrite(filename, tile)

print(f" Generated {len(tiles)} tile to {output_dir}")
