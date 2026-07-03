export type ProcessedPlanImage = {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  processedSizeBytes: number;
  mimeType: string;
};

type ProcessOptions = {
  maxDimension?: number;
  quality?: number;
};

export function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire l'image."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Impossible de convertir l'image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export async function processPlanImage(
  file: File,
  options: ProcessOptions = {}
): Promise<ProcessedPlanImage> {
  const maxDimension = options.maxDimension ?? 2200;
  const quality = options.quality ?? 0.86;

  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier doit être une image.");
  }

  const image = await loadImageFromFile(file);

  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  const largestSide = Math.max(originalWidth, originalHeight);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;

  const width = Math.round(originalWidth * scale);
  const height = Math.round(originalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Impossible de préparer l'image.");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const outputMimeType = "image/jpeg";
  const blob = await canvasToBlob(canvas, outputMimeType, quality);

  const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const processedFilename = `${baseName || "plan"}-processed.jpg`;

  const processedFile = new File([blob], processedFilename, {
    type: outputMimeType,
    lastModified: Date.now(),
  });

  return {
    file: processedFile,
    width,
    height,
    originalWidth,
    originalHeight,
    originalSizeBytes: file.size,
    processedSizeBytes: processedFile.size,
    mimeType: outputMimeType,
  };
}