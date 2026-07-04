import cv2

def draw_circles(image_path, coords, output_path="output.png"):
    """
    image_path : chemin de l'image
    coords : liste de tuples (x, y, rayon)
    output_path : image de sortie
    """

    # Charger l'image
    img = cv2.imread(image_path)

    if img is None:
        raise ValueError("Impossible de charger l'image")

    # Dessiner les cercles
    for (x, y) in coords:
        r = 40
        cv2.circle(
            img,
            center=(int(x), int(y+20)),
            radius=int(r),
            color=(0, 0, 255),  # rouge en BGR
            thickness=2
        )

    # Sauvegarder le résultat
    print("Image shape:", img.shape)
    cv2.imwrite(output_path, img)


# Exemple d'utilisation
coords = [(700, 1142), (859, 1245), (859, 1310), (355, 1408), (435, 1470)]

draw_circles("test.png", coords, "result.png")