import cv2
import numpy as np
import random

# Load Images & Basic Settings
img = cv2.imread('assets/textures/sand_01_diff_4k.jpg')
img = cv2.resize(img, (1024, 1024))


TILE_SIZE = 100
OVERLAP = 20
OUTPUT_SIZE = 2048

tiles_x = (OUTPUT_SIZE - OVERLAP) // (TILE_SIZE - OVERLAP)
tiles_y = (OUTPUT_SIZE - OVERLAP) // (TILE_SIZE - OVERLAP)
output = np.zeros((OUTPUT_SIZE, OUTPUT_SIZE, 3), dtype=np.uint8)

# Shortest path for splice seam optimisation
def min_cut_path(error):
    h, w = error.shape
    cost = error.copy()
    path = np.zeros((h, w), dtype=np.int32)

    for i in range(1, h):
        for j in range(w):
            min_idx = j
            if j > 0 and cost[i-1, j-1] < cost[i-1, min_idx]:
                min_idx = j - 1
            if j < w - 1 and cost[i-1, j+1] < cost[i-1, min_idx]:
                min_idx = j + 1
            cost[i, j] += cost[i-1, min_idx]
            path[i, j] = min_idx

    seam = np.zeros(h, dtype=np.int32)
    seam[-1] = np.argmin(cost[-1])
    for i in range(h-2, -1, -1):
        seam[i] = path[i+1, seam[i+1]]
    return seam

# Splice blocks
def quilt_patch(target, patch, x, y, vertical):
    if vertical:
        overlap = target[y:y+OVERLAP, x:x+TILE_SIZE]
        diff = np.sum((overlap - patch[:OVERLAP])**2, axis=2)
        seam = min_cut_path(diff)
        for i in range(OVERLAP):
            for j in range(TILE_SIZE):
                if j < seam[i]:
                    target[y+i, x+j] = patch[i, j]
        target[y+OVERLAP:y+TILE_SIZE, x:x+TILE_SIZE] = patch[OVERLAP:]
    else:
        overlap = target[y:y+TILE_SIZE, x:x+OVERLAP]
        diff = np.sum((overlap - patch[:, :OVERLAP])**2, axis=2).T
        seam = min_cut_path(diff)
        for j in range(OVERLAP):
            for i in range(TILE_SIZE):
                if i < seam[j]:
                    target[y+i, x+j] = patch[i, j]
        target[y:y+TILE_SIZE, x+OVERLAP:x+TILE_SIZE] = patch[:, OVERLAP:]

# Find the perfect splice block
def best_patch(overlap_v=None, overlap_h=None):
    best_score = float('inf')
    best_patch = None
    for _ in range(100):
        x = random.randint(0, img.shape[1] - TILE_SIZE)
        y = random.randint(0, img.shape[0] - TILE_SIZE)
        patch = img[y:y+TILE_SIZE, x:x+TILE_SIZE]

        score = 0
        if overlap_v is not None:
            diff_v = overlap_v - patch[:OVERLAP, :]
            score += np.sum(diff_v.astype(np.float32) ** 2)
        if overlap_h is not None:
            diff_h = overlap_h - patch[:, :OVERLAP]
            score += np.sum(diff_h.astype(np.float32) ** 2)

        if score < best_score:
            best_score = score
            best_patch = patch

    return best_patch

# Start synthesising
for i in range(tiles_y):
    for j in range(tiles_x):
        x_out = j * (TILE_SIZE - OVERLAP)
        y_out = i * (TILE_SIZE - OVERLAP)

        if i == 0 and j == 0:
            x = random.randint(0, img.shape[1] - TILE_SIZE)
            y = random.randint(0, img.shape[0] - TILE_SIZE)
            output[y_out:y_out+TILE_SIZE, x_out:x_out+TILE_SIZE] = img[y:y+TILE_SIZE, x:x+TILE_SIZE]
        elif i == 0:
            left = output[y_out:y_out+TILE_SIZE, x_out:x_out+OVERLAP]
            patch = best_patch(overlap_h=left)
            quilt_patch(output, patch, x_out, y_out, vertical=False)
        elif j == 0:
            top = output[y_out:y_out+OVERLAP, x_out:x_out+TILE_SIZE]
            patch = best_patch(overlap_v=top)
            quilt_patch(output, patch, x_out, y_out, vertical=True)
        else:
            left = output[y_out:y_out+TILE_SIZE, x_out:x_out+OVERLAP]
            top = output[y_out:y_out+OVERLAP, x_out:x_out+TILE_SIZE]
            patch = best_patch(overlap_v=top, overlap_h=left)

            # Piece the left side first by the horizontal seams, then the seam area
            quilt_patch(output, patch, x_out, y_out, vertical=True)
            quilt_patch(output, patch, x_out, y_out, vertical=False)


# save
cv2.imwrite('result_texture_quilted.png', output)
print("Saved result_texture_quilted.png")
