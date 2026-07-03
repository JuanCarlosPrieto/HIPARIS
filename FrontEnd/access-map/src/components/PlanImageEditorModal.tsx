"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, RotateCw, X } from "lucide-react";

export type EditedPlanImageResult = {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalName: string;
  originalSizeBytes: number;
  processedSizeBytes: number;
  mimeType: string;
  realWidthMeters: number;
  realHeightMeters: number;
  metersPerPixelX: number;
  metersPerPixelY: number;
  rotationDegrees: number;
  cropPercent: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (result: EditedPlanImageResult) => Promise<void> | void;
};

type CropPercent = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const MAX_OUTPUT_DIMENSION = 2200;
const OUTPUT_QUALITY = 0.88;

export default function PlanImageEditorModal({
  file,
  onCancel,
  onConfirm,
}: Props) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  const [crop, setCrop] = useState<CropPercent>({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });

  const [realWidthMeters, setRealWidthMeters] = useState("");
  const [realHeightMeters, setRealHeightMeters] = useState("");

  const [loadingImage, setLoadingImage] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoadingImage(true);
    setImage(null);
    setErrorMessage(null);

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Le fichier sélectionné n'est pas une image.");
      setLoadingImage(false);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setImage(img);
      setErrorMessage(null);
      setLoadingImage(false);
    };

    img.onerror = () => {
      setImage(null);
      setErrorMessage(
        "Impossible de lire cette image. Essayez avec un fichier PNG, JPG ou WebP."
      );
      setLoadingImage(false);
    };

    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  useEffect(() => {
    if (!image) return;

    renderPreview({
      image,
      rotationDegrees,
      crop,
      canvas: previewCanvasRef.current,
    });
  }, [image, rotationDegrees, crop]);

  function updateCropValue(key: keyof CropPercent, value: string) {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) return;

    setCrop((current) => {
      const next = {
        ...current,
        [key]: Math.min(45, Math.max(0, numericValue)),
      };

      const horizontalTotal = next.left + next.right;
      const verticalTotal = next.top + next.bottom;

      if (horizontalTotal >= 90 || verticalTotal >= 90) {
        return current;
      }

      return next;
    });
  }

  async function handleConfirm() {
    if (!image) return;

    setProcessing(true);
    setErrorMessage(null);

    const widthMeters = Number.parseFloat(realWidthMeters);
    const heightMeters = Number.parseFloat(realHeightMeters);

    if (
      Number.isNaN(widthMeters) ||
      Number.isNaN(heightMeters) ||
      widthMeters <= 0 ||
      heightMeters <= 0
    ) {
      setProcessing(false);
      setErrorMessage("Indiquez des dimensions réelles positives en mètres.");
      return;
    }

    try {
      const editedCanvas = createEditedCanvas({
        image,
        rotationDegrees,
        crop,
      });

      const finalCanvas = resizeCanvasIfNeeded(
        editedCanvas,
        MAX_OUTPUT_DIMENSION
      );

      const blob = await canvasToBlob(
        finalCanvas,
        "image/jpeg",
        OUTPUT_QUALITY
      );

      const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
      const outputName = `${baseName || "plan"}-edited.jpg`;

      const editedFile = new File([blob], outputName, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      await onConfirm({
        file: editedFile,
        width: finalCanvas.width,
        height: finalCanvas.height,
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        originalName: file.name,
        originalSizeBytes: file.size,
        processedSizeBytes: editedFile.size,
        mimeType: "image/jpeg",
        realWidthMeters: widthMeters,
        realHeightMeters: heightMeters,
        metersPerPixelX: widthMeters / finalCanvas.width,
        metersPerPixelY: heightMeters / finalCanvas.height,
        rotationDegrees,
        cropPercent: crop,
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erreur inconnue pendant le traitement de l'image.");
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-3 text-white backdrop-blur">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl lg:h-[calc(100vh-1.5rem)] lg:min-h-0 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="min-h-0 overflow-auto bg-slate-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Préparer le plan</h2>
              <p className="mt-1 text-sm text-slate-400">
                Recadrez, corrigez la rotation et vérifiez l'image finale.
              </p>
            </div>

            <button
              onClick={onCancel}
              className="rounded-2xl border border-white/10 p-3 text-slate-300 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {loadingImage ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-3xl bg-slate-950">
              <div className="flex items-center gap-3 text-slate-300">
                <Loader2 className="animate-spin" size={20} />
                Chargement de l'image...
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-slate-950 p-4 lg:min-h-[520px]">
              <canvas
                ref={previewCanvasRef}
                className="max-h-[55vh] max-w-full rounded-2xl border border-white/10 bg-white object-contain lg:max-h-[70vh]"
              />
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-white/10 p-5">
          <h3 className="text-xl font-semibold">Réglages</h3>

          <div className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Rotation fine: {rotationDegrees}°
              </label>

              <input
                type="range"
                min="-15"
                max="15"
                step="0.5"
                value={rotationDegrees}
                onChange={(event) =>
                  setRotationDegrees(Number(event.target.value))
                }
                className="w-full"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setRotationDegrees((current) => current - 90)
                  }
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
                >
                  <RotateCcw size={16} />
                  -90°
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRotationDegrees((current) => current + 90)
                  }
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
                >
                  <RotateCw size={16} />
                  +90°
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <h4 className="mb-4 font-medium">Recadrage</h4>

              <CropSlider
                label="Gauche"
                value={crop.left}
                onChange={(value) => updateCropValue("left", value)}
              />

              <CropSlider
                label="Droite"
                value={crop.right}
                onChange={(value) => updateCropValue("right", value)}
              />

              <CropSlider
                label="Haut"
                value={crop.top}
                onChange={(value) => updateCropValue("top", value)}
              />

              <CropSlider
                label="Bas"
                value={crop.bottom}
                onChange={(value) => updateCropValue("bottom", value)}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <h4 className="mb-2 font-medium">Dimensions réelles du piso</h4>

              <p className="mb-4 text-sm leading-6 text-slate-400">
                Indiquez les dimensions approximatives du plan après recadrage.
                Elles serviront à estimer les distances réelles.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Largeur réelle en mètres
                  </label>
                  <input
                    value={realWidthMeters}
                    onChange={(event) => setRealWidthMeters(event.target.value)}
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                    placeholder="Ex: 42"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Hauteur réelle en mètres
                  </label>
                  <input
                    value={realHeightMeters}
                    onChange={(event) =>
                      setRealHeightMeters(event.target.value)
                    }
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                    placeholder="Ex: 28"
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-3 border-t border-white/10 bg-slate-950 p-5">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={processing}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                    Annuler
                </button>

                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={processing || loadingImage}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                >
                    {processing ? (
                    <Loader2 className="animate-spin" size={16} />
                    ) : (
                    <Check size={16} />
                    )}
                    Valider
                </button>
                </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CropSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-slate-300">{label}</label>
        <span className="text-xs text-slate-500">{value}%</span>
      </div>

      <input
        type="range"
        min="0"
        max="45"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      />
    </div>
  );
}

function renderPreview({
  image,
  rotationDegrees,
  crop,
  canvas,
}: {
  image: HTMLImageElement;
  rotationDegrees: number;
  crop: CropPercent;
  canvas: HTMLCanvasElement | null;
}) {
  if (!canvas) return;

  const editedCanvas = createEditedCanvas({
    image,
    rotationDegrees,
    crop,
  });

  const maxPreviewWidth = 1100;
  const maxPreviewHeight = 720;

  const scale = Math.min(
    maxPreviewWidth / editedCanvas.width,
    maxPreviewHeight / editedCanvas.height,
    1
  );

  canvas.width = Math.max(1, Math.round(editedCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(editedCanvas.height * scale));

  const context = canvas.getContext("2d");

  if (!context) return;

  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(editedCanvas, 0, 0, canvas.width, canvas.height);
}

function createEditedCanvas({
  image,
  rotationDegrees,
  crop,
}: {
  image: HTMLImageElement;
  rotationDegrees: number;
  crop: CropPercent;
}) {
  const rotatedCanvas = createRotatedCanvas(image, rotationDegrees);

  const left = Math.round((crop.left / 100) * rotatedCanvas.width);
  const right = Math.round((crop.right / 100) * rotatedCanvas.width);
  const top = Math.round((crop.top / 100) * rotatedCanvas.height);
  const bottom = Math.round((crop.bottom / 100) * rotatedCanvas.height);

  const cropWidth = Math.max(1, rotatedCanvas.width - left - right);
  const cropHeight = Math.max(1, rotatedCanvas.height - top - bottom);

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;

  const context = croppedCanvas.getContext("2d");

  if (!context) {
    throw new Error("Impossible de préparer le recadrage.");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, cropWidth, cropHeight);

  context.drawImage(
    rotatedCanvas,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  return croppedCanvas;
}

function createRotatedCanvas(
  image: HTMLImageElement,
  rotationDegrees: number
) {
  const radians = (rotationDegrees * Math.PI) / 180;

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const rotatedWidth = Math.ceil(width * cos + height * sin);
  const rotatedHeight = Math.ceil(width * sin + height * cos);

  const canvas = document.createElement("canvas");
  canvas.width = rotatedWidth;
  canvas.height = rotatedHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Impossible de préparer la rotation.");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, rotatedWidth, rotatedHeight);

  context.translate(rotatedWidth / 2, rotatedHeight / 2);
  context.rotate(radians);
  context.drawImage(image, -width / 2, -height / 2);

  return canvas;
}

function resizeCanvasIfNeeded(
  sourceCanvas: HTMLCanvasElement,
  maxDimension: number
) {
  const largestSide = Math.max(sourceCanvas.width, sourceCanvas.height);

  if (largestSide <= maxDimension) {
    return sourceCanvas;
  }

  const scale = maxDimension / largestSide;

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = Math.round(sourceCanvas.width * scale);
  resizedCanvas.height = Math.round(sourceCanvas.height * scale);

  const context = resizedCanvas.getContext("2d");

  if (!context) {
    throw new Error("Impossible de redimensionner l'image.");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);

  context.drawImage(
    sourceCanvas,
    0,
    0,
    resizedCanvas.width,
    resizedCanvas.height
  );

  return resizedCanvas;
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

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}