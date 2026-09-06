"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Download,
  Eye,
  CheckCircle2,
  Trash2,
  Maximize2,
  Loader2,
  Palette,
  Wand2,
  FileImage,
} from "lucide-react";

import { getAcceptString } from "@/components/ui/DropZone";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { premiumShellClass } from "@/sharedUI/tool/premiumShell";
import { GlassIcon } from "@/sharedUI/tool/GlassIcon";
import { generateFileName } from "@/features/imageConverter/generateFileName";
import { asyncGetFileSaverLib } from "@/lib/fileSaverUtility";

import dynamic from "next/dynamic";
import { ToolConfig } from "@/types/imageConverter.types";

// Same shared hero used across the other tools — confirmed real, reused
// instead of hand-rolling the top section again.
import { ToolHero } from "@/components/ui/toolhero";

const ImagePreviewModal = dynamic(
  () => import("@/components/ui/image/imagePreviewModal").then((m) => m.ImagePreviewModal),
  {
    ssr: false,
  }
);

type BackgroundMode = "transparent" | "color" | "image" | "blur";
type OutputFormat = "png" | "jpeg" | "webp";
type ModalVariant = "preview" | "download";

const DEFAULT_ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"];

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Studio Gray", value: "#7c7c7c" },
  { label: "Sky Blue", value: "#3b82f6" },
  { label: "Mint", value: "#10b981" },
  { label: "Sunset", value: "#f97316" },
  { label: "Rose", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
];

function toKB(bytes: number) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function getPrettyFormat(format?: string) {
  return (format || "").toUpperCase() || "—";
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

function getOutputExtension(blob: Blob, fallback = "png") {
  const mime = blob.type.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return fallback;
}

function getFileExtensionLabel(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toUpperCase();
  const fromMime = file.type.split("/").pop();
  return (fromMime || "—").toUpperCase();
}

interface Props {
  config: ToolConfig;
}

export default function BackgroundRemoverClient({ config }: Props) {
  const validFileTypes = useMemo(() => getAcceptString(config.inputFormats), [config.inputFormats]);
  const allowedFormats = config?.inputFormats ?? DEFAULT_ALLOWED_FORMATS;
  const maxFileMB = 25;

  const bgImageInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [dropzoneKey, setDropzoneKey] = useState(0);

  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("transparent");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [blurStrength, setBlurStrength] = useState(12);

  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputDimensions, setOutputDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("preview");
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setOriginalDimensions(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    let cancelled = false;
    loadImageFromUrl(url)
      .then((img) => {
        if (!cancelled) {
          setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        }
      })
      .catch(() => {
        if (!cancelled) setOriginalDimensions(null);
      });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  const resetTool = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null);
    setPreviewUrl(null);
    setOriginalDimensions(null);
    setCutoutUrl(null);
    setProcessing(false);
    setModelLoading(false);
    setProgress(0);
    setError("");
    setOutputUrl(null);
    setOutputBlob(null);
    setOutputDimensions({ width: 0, height: 0 });
    setShowModal(false);
    setModalVariant("preview");
    setHasAutoOpened(false);
    setBackgroundMode("transparent");
    setBackgroundImageUrl(null);
    setDropzoneKey((p) => p + 1);
  }, [outputUrl]);

  const removeBackground = useCallback(async (selected: File) => {
    setModelLoading(true);
    setProcessing(true);
    setProgress(0);
    setError("");
    try {
      const { removeBackground: runRemoval } = await import("@imgly/background-removal");
      setModelLoading(false);
      const blob = await runRemoval(selected, {
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) setProgress(Math.round((current / total) * 100));
        },
      });
      const url = URL.createObjectURL(blob);
      setCutoutUrl(url);
      setProgress(100);
    } catch {
      setError("Couldn't remove the background from this image. Try a different photo.");
    } finally {
      setProcessing(false);
      setModelLoading(false);
    }
  }, []);

  // File selection now only stages the file and shows its preview/details.
  // Background removal is kicked off explicitly by the "Remove Background" button.
  const handleFiles = useCallback(
    async (files: File[]) => {
      try {
        const selected = files[0];
        if (!selected) return;

        if (!selected.type.startsWith("image/")) {
          setError("Please upload a valid image file.");
          return;
        }
        if (selected.size > maxFileMB * 1024 * 1024) {
          setError(`File is larger than ${maxFileMB}MB. Try a smaller image.`);
          return;
        }

        if (outputUrl) URL.revokeObjectURL(outputUrl);

        setFile(selected);
        setError("");
        setCutoutUrl(null);
        setOutputUrl(null);
        setOutputBlob(null);
        setShowModal(false);
        setHasAutoOpened(false);
        setBackgroundMode("transparent");
        setBackgroundImageUrl(null);
      } catch {
        setError("Invalid file");
      }
    },
    [outputUrl, maxFileMB]
  );

  const handleStartProcessing = useCallback(() => {
    if (!file || processing) return;
    removeBackground(file);
  }, [file, processing, removeBackground]);

  // ---------------------------------------------------------------------
  // Compositing: cutout + chosen background -> final canvas
  // ---------------------------------------------------------------------
  const buildCompositeCanvas = useCallback(
    async (targetW: number, targetH: number) => {
      if (!cutoutUrl) return null;
      const cutout = await loadImageFromUrl(cutoutUrl);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      if (backgroundMode === "color") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (backgroundMode === "image" && backgroundImageUrl) {
        const bgImg = await loadImageFromUrl(backgroundImageUrl);
        const scale = Math.max(targetW / bgImg.naturalWidth, targetH / bgImg.naturalHeight);
        const w = bgImg.naturalWidth * scale;
        const h = bgImg.naturalHeight * scale;
        ctx.drawImage(bgImg, (targetW - w) / 2, (targetH - h) / 2, w, h);
      } else if (backgroundMode === "blur" && previewUrl) {
        const origImg = await loadImageFromUrl(previewUrl);
        ctx.filter = `blur(${blurStrength}px)`;
        ctx.drawImage(origImg, 0, 0, targetW, targetH);
        ctx.filter = "none";
      }
      // "transparent" mode: leave the background layer empty.

      ctx.drawImage(cutout, 0, 0, targetW, targetH);
      return canvas;
    },
    [cutoutUrl, backgroundMode, backgroundColor, backgroundImageUrl, previewUrl, blurStrength]
  );

  // Rebuild the output blob whenever the cutout or background settings change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cutoutUrl) return;
      const cutout = await loadImageFromUrl(cutoutUrl);
      const canvas = await buildCompositeCanvas(cutout.naturalWidth, cutout.naturalHeight);
      if (!canvas || cancelled) return;

      const mime =
        outputFormat === "png" ? "image/png" : outputFormat === "webp" ? "image/webp" : "image/jpeg";

      let finalCanvas = canvas;
      if (outputFormat === "jpeg" && backgroundMode === "transparent") {
        const flat = document.createElement("canvas");
        flat.width = canvas.width;
        flat.height = canvas.height;
        const fctx = flat.getContext("2d");
        if (fctx) {
          fctx.fillStyle = "#ffffff";
          fctx.fillRect(0, 0, flat.width, flat.height);
          fctx.drawImage(canvas, 0, 0);
        }
        finalCanvas = flat;
      }

      const blob = await canvasToBlob(finalCanvas, mime, outputFormat === "png" ? undefined : 0.92);
      if (!blob || cancelled) return;

      setOutputUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setOutputBlob(blob);
      setOutputDimensions({ width: finalCanvas.width, height: finalCanvas.height });

      // Auto-open the preview modal the first time a result is ready.
      if (!hasAutoOpened) {
        setModalVariant("preview");
        setShowModal(true);
        setHasAutoOpened(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoutUrl, backgroundMode, backgroundColor, backgroundImageUrl, blurStrength, outputFormat]);

  const handleDownload = useCallback(async () => {
    if (!outputUrl || !file || !outputBlob) return;
    const extension = getOutputExtension(outputBlob, "png");
    const fileName = generateFileName(file.name || "image", "no-bg", extension);
    const saveAs = await asyncGetFileSaverLib();
    saveAs(outputUrl, fileName);
  }, [outputUrl, file, outputBlob]);

  // Config section (background + export choices) shows as soon as a file is
  // staged — it no longer waits for the cutout to exist.
  const showConfigSection = !!file;
  const isDone = !!outputUrl && !!outputBlob;

  const handleOpenPreview = () => {
    setModalVariant("preview");
    setShowModal(true);
  };

  const handleOpenDownload = () => {
    setModalVariant("download");
    setShowModal(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 text-foreground sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <ToolHero
        config={config}
        processing={processing}
        file={file}
        dropzoneKey={dropzoneKey}
        handleFiles={handleFiles}
        validFileTypes={validFileTypes}
        eyebrow="Private • Browser Based • Secure"
        title="Remove Background"
        titleAccent="Instantly"
        description={
          <>
            Remove the background from any photo, then swap it for transparency, a solid
            color, a custom image, or a blurred version of the original — all processed
            locally in your browser.
          </>
        }
        badges={[
          { label: "⚡ Instant Removal", color: "blue" },
          { label: "🔒 100% Private", color: "green" },
          { label: "📤 No Upload", color: "purple" },
        ]}
        stats={[
          { label: "Input", value: allowedFormats.join(", ").toUpperCase() },
          { label: "Output", value: getPrettyFormat(outputFormat) },
          { label: "Processing", value: "Local Browser", color: "emerald" },
          {
            label: "Status",
            value: processing ? "Working" : isDone ? "Done" : file ? "Ready" : "Idle",
            color: "blue",
          },
        ]}
      />

      <div className="mt-6 space-y-4 sm:space-y-5">
        {error && (
          <section className="rounded-2xl border border-rose-300 dark:border-rose-400/20 bg-rose-100 dark:bg-rose-400/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
            {error}
          </section>
        )}

        {showConfigSection && file && (
          <section className={premiumShellClass()}>
            <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex gap-3">
                    <GlassIcon icon={Eye} />
                    <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                      {cutoutUrl ? "Background removed" : "Review your image"}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-foreground-secondary sm:text-sm">
                    {cutoutUrl
                      ? "Choose a background below — the preview and result update automatically."
                      : "Choose your background and export format, then remove the background."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground-secondary">
                    {toKB(file.size)}
                  </div>
                  <button
                    type="button"
                    onClick={resetTool}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-blue-400 dark:hover:border-blue-400/30 hover:bg-surface-raised"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                    Start Over
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:p-5">
              {/* Left: original preview before processing, cutout result after */}
              <div className="flex-[1.3] min-w-0 rounded-2xl border border-border bg-surface-sunken p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">📄 {file.name}</div>
                    <div className="mt-0.5 text-xs text-foreground-faint">{file.type || "unknown"}</div>
                  </div>
                  <div className="rounded-full bg-blue-100 dark:bg-blue-500/10 px-3 py-1 text-xs text-blue-700 dark:text-blue-200">
                    {cutoutUrl ? "Result preview" : "Original preview"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => outputUrl && handleOpenPreview()}
                  disabled={!outputUrl}
                  className="overflow-hidden rounded-xl border border-border bg-surface-sunken text-left transition hover:border-blue-400 dark:hover:border-blue-400/30 disabled:cursor-default"
                >
                  <div
                    className="relative flex items-center justify-center bg-surface-sunken"
                    style={{
                      aspectRatio: "4 / 3",
                      backgroundImage: outputUrl
                        ? "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)"
                        : undefined,
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                    }}
                  >
                    {outputUrl ? (
                      <img
                        src={outputUrl}
                        alt="preview"
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="original preview"
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-foreground-faint">
                        No preview available
                      </div>
                    )}
                  </div>
                </button>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Dimensions</div>
                    <div className="mt-1 font-medium">
                      {cutoutUrl
                        ? `${outputDimensions.width} × ${outputDimensions.height}`
                        : originalDimensions
                        ? `${originalDimensions.width} × ${originalDimensions.height}`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Size</div>
                    <div className="mt-1 font-medium">
                      {cutoutUrl && outputBlob ? toKB(outputBlob.size) : toKB(file.size)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Format</div>
                    <div className="mt-1 font-medium">
                      {cutoutUrl ? getPrettyFormat(outputFormat) : getFileExtensionLabel(file)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: background + export controls, then the process button */}
              <div className="flex-[1.3] min-w-0 flex flex-col gap-3">
                <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                  <div className="flex gap-3">
                    <GlassIcon icon={Palette} />
                    <h3 className="text-sm font-semibold text-foreground">Background</h3>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        { mode: "transparent", label: "Transparent" },
                        { mode: "color", label: "Color" },
                        { mode: "image", label: "Custom image" },
                        { mode: "blur", label: "Blur original" },
                      ] as { mode: BackgroundMode; label: string }[]
                    ).map(({ mode, label }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          if (mode === "image" && !backgroundImageUrl) {
                            bgImageInputRef.current?.click();
                            return;
                          }
                          setBackgroundMode(mode);
                        }}
                        aria-pressed={backgroundMode === mode}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                          backgroundMode === mode
                            ? "border-blue-300 dark:border-blue-400/35 bg-blue-100 dark:bg-blue-400/10 text-foreground"
                            : "border-border bg-card text-foreground hover:bg-surface-raised"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {backgroundMode === "color" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setBackgroundColor(preset.value)}
                          title={preset.label}
                          className={`h-8 w-8 rounded-full border-2 transition ${
                            backgroundColor.toLowerCase() === preset.value
                              ? "border-blue-300 dark:border-blue-400"
                              : "border-border-strong"
                          }`}
                          style={{ backgroundColor: preset.value }}
                        />
                      ))}
                      <label className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs text-foreground-secondary">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        Custom
                      </label>
                    </div>
                  )}

                  <input
                    ref={bgImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      setBackgroundImageUrl(url);
                      setBackgroundMode("image");
                    }}
                  />

                  {backgroundMode === "image" && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => bgImageInputRef.current?.click()}
                        className="rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground transition hover:bg-surface-raised"
                      >
                        {backgroundImageUrl ? "Change image" : "Upload image"}
                      </button>
                      {backgroundImageUrl && (
                        <img
                          src={backgroundImageUrl}
                          alt="Custom background"
                          className="h-9 w-9 rounded-lg border border-border object-cover"
                        />
                      )}
                    </div>
                  )}

                  {backgroundMode === "blur" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-foreground-secondary">
                        <span>Blur strength</span>
                        <span>{blurStrength}px</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={30}
                        value={blurStrength}
                        onChange={(e) => setBlurStrength(Number(e.target.value))}
                        className="w-full accent-blue-400"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                  <div className="flex gap-3">
                    <GlassIcon icon={FileImage} />
                    <h3 className="text-sm font-semibold text-foreground">Export format</h3>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["png", "webp", "jpeg"] as OutputFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setOutputFormat(fmt)}
                        aria-pressed={outputFormat === fmt}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-medium uppercase transition ${
                          outputFormat === fmt
                            ? "border-blue-300 dark:border-blue-400/35 bg-blue-100 dark:bg-blue-400/10 text-foreground"
                            : "border-border bg-card text-foreground hover:bg-surface-raised"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                  {outputFormat === "jpeg" && backgroundMode === "transparent" && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
                      JPEG doesn't support transparency — the exported file will have a white
                      background.
                    </p>
                  )}
                </div>

                {!cutoutUrl && !processing && (
                  <button
                    type="button"
                    onClick={handleStartProcessing}
                    disabled={!file}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-blue-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    Remove Background
                  </button>
                )}

                {processing && (
                  <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-700 dark:text-blue-300" />
                      {modelLoading ? "Loading model…" : "Removing background…"}
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={progress} />
                      <p className="mt-2 text-xs text-foreground-faint">Processing your image locally...</p>
                    </div>
                  </div>
                )}

                {cutoutUrl && !processing && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-400/20 bg-emerald-100 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Background removed successfully
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {isDone && outputUrl && outputBlob && (
          <section className={premiumShellClass()}>
            <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex gap-3">
                <GlassIcon icon={CheckCircle2} />
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  Your image is ready
                </h2>
              </div>
              <p className="mt-1 text-xs text-foreground-secondary sm:text-sm">
                Preview the result and download it directly.
              </p>
            </div>

            <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4 lg:p-5">
              <button
                onClick={handleOpenPreview}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-violet-400 hover:to-blue-400"
              >
                <Maximize2 className="h-4 w-4" />
                Preview Result
              </button>

              <button
                onClick={handleOpenDownload}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-emerald-400 hover:to-emerald-300"
              >
                <Download className="h-4 w-4" />
                Download Image
              </button>
            </div>

            <div className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
              <div className="rounded-2xl border border-border bg-surface-sunken p-3 sm:p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Original</div>
                    <div className="mt-1 font-medium">{file ? toKB(file.size) : "—"}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Output</div>
                    <div className="mt-1 font-medium">{toKB(outputBlob.size)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground-secondary">
                    <div className="text-[11px] text-foreground-faint">Dimensions</div>
                    <div className="mt-1 font-medium">
                      {outputDimensions.width} x {outputDimensions.height}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {showModal && outputUrl && (
        <ImagePreviewModal
          url={outputUrl}
          onClose={() => setShowModal(false)}
          documentName={generateFileName(file?.name || "image", "no-bg", outputFormat)}
          variant={modalVariant}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}