"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
Download,
Eye,
FileUp,
CheckCircle2,
Trash2,
Maximize2,
Gauge,
Ratio,
} from "lucide-react";

import { getAcceptString } from "@/components/ui/DropZone";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CompressorConfig } from "@/types/imageCompressor.types";
import { validateImage } from "@/features/imageConverter/validateImage";
import { normalizeFile } from "@/features/imageConverter/normalizeFile";
import { getImageMetadata } from "@/features/imageConverter/imageMetadata/getImageMetadata";
import { generateFileName } from "@/features/imageConverter/generateFileName";
import { ImageMetadata } from "@/types/imageMetadata";
import { asyncGetFileSaverLib } from "@/lib/fileSaverUtility";
import {
CompressionResult,
compressWithDimensionsImage,
} from "@/features/imageCompressor/compressWithDimensions";

import dynamic from "next/dynamic";

import { ToolHero } from "@/components/ui/toolhero";
import { StatCard } from "@/sharedUI/statCard";
import { SliderCard } from "@/sharedUI/tool/sliderCard";

const ImagePreviewModal = dynamic(
() =>
import("@/components/ui/image/imagePreviewModal").then(
(m) => m.ImagePreviewModal
),
{
ssr: false,
}
);

interface Props {
config: CompressorConfig;
}

type ModalVariant = "preview" | "download";

function premiumShellClass() {
return "relative flex flex-col overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950";
}

function GlassIcon({
icon: Icon,
}: {
icon: React.ComponentType<{ className?: string }>;
}) {
return ( <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-foreground"> <Icon className="h-4 w-4" /> </span>
);
}

function toKB(bytes: number) {
return `${(bytes / 1024).toFixed(2)} KB`;
}

function getImageDimensionsFromBlob(
blob: Blob
): Promise<{ width: number; height: number }> {
return new Promise((resolve, reject) => {
const url = URL.createObjectURL(blob);
const img = new Image();


img.onload = () => {
  resolve({ width: img.width, height: img.height });
  URL.revokeObjectURL(url);
};

img.onerror = () => {
  reject(new Error("Invalid image blob"));
  URL.revokeObjectURL(url);
};

img.src = url;


});
}

function getPrettyFormat(format?: string) {
return (format || "").toUpperCase() || "—";
}

function getOutputExtension(blob: Blob, fallback = "jpg") {
const mime = blob.type.toLowerCase();

if (mime.includes("png")) return "png";
if (mime.includes("webp")) return "webp";
if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
if (mime.includes("avif")) return "avif";

return fallback;
}

function clampDimension(value: number, min = 1) {
return Math.max(min, Math.floor(value || 0));
}

export default function PassportPhotoCompressorClient({ config }: Props) {
const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
const [file, setFile] = useState<File | null>(null);
const [quality, setQuality] = useState(config.defaultQuality ?? 80);
const [targetKB, setTargetKB] = useState(config.targetKB ?? 100);
const [progress, setProgress] = useState(0);
const [processing, setProcessing] = useState(false);
const [error, setError] = useState("");
const [outputUrl, setOutputUrl] = useState<string | null>(null);
const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
const [outputDimensions, setOutputDimensions] = useState<{
width: number;
height: number;
}>({
width: 0,
height: 0,
});
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [showModal, setShowModal] = useState(false);
const [modalVariant, setModalVariant] =
useState<ModalVariant>("preview");
const [dropzoneKey, setDropzoneKey] = useState(0);

const [resizeEnabled, setResizeEnabled] = useState(true);
const [targetWidth, setTargetWidth] = useState<number>(
config.targetWidth ?? 0
);
const [targetHeight, setTargetHeight] = useState<number>(
config.targetHeight ?? 0
);
const [lockAspectRatio, setLockAspectRatio] = useState(true);

const validFileTypes = useMemo(
() => getAcceptString(config.allowedFormats),
[config.allowedFormats]
);

const outputFormat = useMemo(() => {
if (outputBlob) return getOutputExtension(outputBlob, "jpg");
return "jpg";
}, [outputBlob]);

useEffect(() => {
if (!file) {
setPreviewUrl(null);
return;
}


const url = URL.createObjectURL(file);
setPreviewUrl(url);

return () => {
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

useEffect(() => {
if (!metadata) return;


setTargetWidth(metadata.width);
setTargetHeight(metadata.height);


}, [metadata]);

useEffect(() => {
let cancelled = false;


const run = async () => {
  if (!outputBlob) return;

  const dimensions = await getImageDimensionsFromBlob(outputBlob);

  if (!cancelled) {
    setOutputDimensions(dimensions);
  }
};

run();

return () => {
  cancelled = true;
};


}, [outputBlob]);

const resetTool = useCallback(() => {
if (outputUrl) URL.revokeObjectURL(outputUrl);


setMetadata(null);
setFile(null);
setProgress(0);
setProcessing(false);
setError("");
setOutputUrl(null);
setOutputBlob(null);
setPreviewUrl(null);
setShowModal(false);
setModalVariant("preview");
setDropzoneKey((p) => p + 1);
setResizeEnabled(true);
setTargetWidth(config.targetWidth ?? 0);
setTargetHeight(config.targetHeight ?? 0);
setLockAspectRatio(true);


}, [outputUrl, config.targetWidth, config.targetHeight]);

const handleFiles = useCallback(
async (files: File[]) => {
try {
const selected = files[0];


    if (!selected) return;

    validateImage(selected);

    const normalized = normalizeFile(selected);

    if (
      !!normalized.format &&
      config.allowedFormats?.length &&
      !config.allowedFormats.includes(normalized.format)
    ) {
      setError("Unsupported file format");
      return;
    }

    const imageMetadata = await getImageMetadata(selected);

    if (outputUrl) URL.revokeObjectURL(outputUrl);

    setOutputUrl(null);
    setOutputBlob(null);
    setFile(selected);
    setMetadata(imageMetadata);
    setError("");
    setProgress(0);
    setProcessing(false);
    setShowModal(false);
    setModalVariant("preview");
    setResizeEnabled(true);
    setTargetWidth(imageMetadata.width);
    setTargetHeight(imageMetadata.height);
    setLockAspectRatio(true);
  } catch (err) {
    if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Invalid file");
    }
  }
},
[outputUrl, config.allowedFormats]


);

const updateWidthFromHeight = useCallback(
(nextHeight: number) => {
const safeHeight = clampDimension(nextHeight);


  setTargetHeight(safeHeight);

  if (
    resizeEnabled &&
    lockAspectRatio &&
    metadata?.width &&
    metadata?.height
  ) {
    const nextWidth = Math.round(
      (metadata.width / metadata.height) * safeHeight
    );

    setTargetWidth(Math.max(1, nextWidth));
  }
},
[resizeEnabled, lockAspectRatio, metadata]


);

const updateHeightFromWidth = useCallback(
(nextWidth: number) => {
const safeWidth = clampDimension(nextWidth);


  setTargetWidth(safeWidth);

  if (
    resizeEnabled &&
    lockAspectRatio &&
    metadata?.width &&
    metadata?.height
  ) {
    const nextHeight = Math.round(
      (metadata.height / metadata.width) * safeWidth
    );

    setTargetHeight(Math.max(1, nextHeight));
  }
},
[resizeEnabled, lockAspectRatio, metadata]


);

const handleCompress = useCallback(async () => {
if (!file) return;


try {
  setProcessing(true);
  setError("");
  setProgress(10);

  validateImage(file);

  const safeWidth = clampDimension(targetWidth);
  const safeHeight = clampDimension(targetHeight);

  const compressionResult: CompressionResult =
    await compressWithDimensionsImage(file, {
      mode: config.mode ?? "quality",
      quality: quality / 100,
      targetKB: config.targetKB ?? targetKB,
      lockTarget: config.lockTarget,
      resize: resizeEnabled,
      width: safeWidth,
      height: safeHeight,
      lockAspectRatio,
      allowUpscale: true,
    });

  setProgress(85);

  if (outputUrl) URL.revokeObjectURL(outputUrl);

  const url = URL.createObjectURL(compressionResult.blob);

  setOutputUrl(url);
  setOutputBlob(compressionResult.blob);
  setProgress(100);
  setModalVariant("preview");
  setShowModal(true);
} catch {
  setError("Failed to compress image.");
} finally {
  setProcessing(false);
}


}, [
file,
config.mode,
config.targetKB,
config.lockTarget,
quality,
targetKB,
outputUrl,
resizeEnabled,
targetWidth,
targetHeight,
lockAspectRatio,
]);

const handleDownload = useCallback(async () => {
if (!outputUrl || !file || !outputBlob) return;


const extension = getOutputExtension(outputBlob, "jpg");
const fileName = generateFileName(
  file.name || "image",
  "compressed",
  extension
);

const saveAs = await asyncGetFileSaverLib();
saveAs(outputUrl, fileName);


}, [outputUrl, file, outputBlob]);

const isReady = !!file && !outputUrl;
const isDone = !!outputUrl && !!outputBlob;

const handleOpenPreview = () => {
setModalVariant("preview");
setShowModal(true);
};

const handleOpenDownload = () => {
setModalVariant("download");
setShowModal(true);
};

return ( <div className="mx-auto w-full max-w-6xl px-3 py-3 text-foreground sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
<ToolHero
config={config}
processing={processing}
file={file}
dropzoneKey={dropzoneKey}
handleFiles={handleFiles}
validFileTypes={validFileTypes}
eyebrow="Private • Browser Based • Secure"
title={config.topSectionHeader || "Compress Passport Photos"}
titleAccent="with Preview"
description={
config.topSectionDescription || (
<>
Upload, resize to the exact dimensions required, and compress
your photo — entirely inside your browser with a live{" "}
{config.mode === "quality" ? "quality" : "target-size"} preview.
</>
)
}
badges={[
{ label: "⚡ Instant Compression", color: "blue" },
{ label: "🔒 100% Private", color: "green" },
{ label: "📤 No Upload", color: "purple" },
]}
stats={[
{
label: "Input",
value: config.allowedFormats?.join(", ").toUpperCase() || "IMAGE",
},
{
label: "Mode",
value: getPrettyFormat(config.mode),
},
{
label: "Processing",
value: "Local Browser",
color: "emerald",
},
{
label: "Status",
value: processing
? "Working"
: file
? "Ready"
: "Waiting",
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

    {isReady && file && (
      <section className={premiumShellClass()}>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div className="min-w-0">
            <div className="flex gap-3">
              <GlassIcon icon={Eye} />
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                Confirm Before Compression
              </h2>
            </div>

            <p className="mt-1 text-xs text-foreground-secondary sm:text-sm">
              Preview the selected image before compressing. The optimized
              output will open in a modal after processing.
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

        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:p-5">
          <div className="rounded-2xl border border-border bg-surface-sunken p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  📄 {file.name}
                </div>
                <div className="mt-0.5 text-xs text-foreground-faint">
                  {file.type || "unknown"}
                </div>
              </div>

              <div className="rounded-full bg-blue-100 dark:bg-blue-500/10 px-3 py-1 text-xs text-blue-700 dark:text-blue-200">
                Preview
              </div>
            </div>

            <button
              type="button"
              onClick={() => previewUrl && handleOpenPreview()}
              className="overflow-hidden rounded-xl border border-border bg-surface-sunken text-left transition hover:border-blue-400 dark:hover:border-blue-400/30"
            >
              <div
                className="relative flex items-center justify-center bg-surface-sunken"
                style={{ aspectRatio: "4 / 3" }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="preview"
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

            {metadata && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <StatCard
                  label="Dimensions"
                  value={`${metadata.width} × ${metadata.height}`}
                  icon={<Maximize2 className="h-4 w-4" />}
                />

                <StatCard
                  label="Size"
                  value={toKB(metadata.size)}
                  icon={<FileUp className="h-4 w-4" />}
                />

                <StatCard
                  label="Type"
                  value={file.type || "unknown"}
                  icon={<FileUp className="h-4 w-4" />}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border bg-surface-sunken p-4">
              <div className="flex gap-3">
                <GlassIcon icon={Gauge} />
                <h3 className="text-sm font-semibold text-foreground">
                  Compression
                </h3>
              </div>

              <p className="mt-1 text-xs leading-5 text-foreground-faint">
                Compress locally in your browser. Use the controls below
                to balance quality and file size.
              </p>

              {config.mode === "quality" && (
                <SliderCard
                  label="Compression Quality"
                  valueLabel={`${quality}%`}
                  value={quality}
                  min={10}
                  max={100}
                  onChange={setQuality}
                  className="mt-4"
                />
              )}

              {config.mode === "target-size" && (
                <SliderCard
                  label="Target Size"
                  valueLabel={`${targetKB} KB`}
                  value={targetKB}
                  min={1}
                  max={10000}
                  disabled={config.lockTarget}
                  onChange={setTargetKB}
                  className="mt-4"
                />
              )}

              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <GlassIcon icon={Ratio} />
                  <h4 className="text-sm font-semibold text-foreground">
                    Resize Image
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-foreground-secondary">
                      Width
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={metadata?.width ?? undefined}
                      value={targetWidth || ""}
                      onChange={(e) =>
                        updateHeightFromWidth(
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none focus:border-blue-300 dark:border-blue-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-foreground-secondary">
                      Height
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={metadata?.height ?? undefined}
                      value={targetHeight || ""}
                      onChange={(e) =>
                        updateWidthFromHeight(
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none focus:border-blue-300 dark:border-blue-400/40"
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-foreground-secondary">
                  <input
                    type="checkbox"
                    checked={lockAspectRatio}
                    onChange={(e) =>
                      setLockAspectRatio(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-border-strong bg-transparent accent-blue-400"
                  />
                  Lock Aspect Ratio
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCompress}
              disabled={processing || !file}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-blue-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gauge className="h-4 w-4" />
              {processing ? "Compressing..." : "Compress Image"}
            </button>

            {processing && (
              <div className="rounded-2xl border border-border bg-surface-sunken p-3">
                <ProgressBar value={progress} />
                <p className="mt-2 text-xs text-foreground-faint">
                  Processing your image locally...
                </p>
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
              Your compressed image is ready
            </h2>
          </div>

          <p className="mt-1 text-xs text-foreground-secondary sm:text-sm">
            Preview the compressed result and download it directly.
          </p>
        </div>

        <div className="grid gap-4 p-3 sm:grid-cols-3 sm:p-4 lg:p-5">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-violet-400 hover:to-blue-400"
          >
            <Maximize2 className="h-4 w-4" />
            Preview Result
          </button>

          <button
            type="button"
            onClick={handleOpenDownload}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-emerald-400 hover:to-emerald-300"
          >
            <Download className="h-4 w-4" />
            Download Image
          </button>

          <button
            type="button"
            onClick={resetTool}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-emerald-700 px-4 py-3 text-sm font-semibold text-foreground transition hover:from-emerald-400 hover:to-emerald-300"
          >
            <Trash2 className="h-4 w-4" />
            Start Over
          </button>
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
          <div className="rounded-2xl border border-border bg-surface-sunken p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Compression Summary
              </h3>

              <span className="rounded-full border border-emerald-300 dark:border-emerald-400/20 bg-emerald-100 dark:bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                {getPrettyFormat(outputFormat)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <StatCard
                label="Original"
                value={file ? toKB(file.size) : "—"}
                icon={<FileUp className="h-4 w-4" />}
              />

              <StatCard
                label="Compressed"
                value={toKB(outputBlob.size)}
                icon={<Gauge className="h-4 w-4" />}
              />

              <StatCard
                label="Dimensions"
                value={`${outputDimensions.width} x ${outputDimensions.height}`}
                icon={<Maximize2 className="h-4 w-4" />}
              />

              <StatCard
                label="Savings"
                value={
                  file
                    ? `${Math.max(
                        0,
                        Math.round(
                          (1 -
                            outputBlob.size /
                              Math.max(file.size, 1)) *
                            100
                        )
                      )}%`
                    : "—"
                }
                icon={<Gauge className="h-4 w-4" />}
              />
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
      documentName={generateFileName(
        file?.name || "image",
        "compressed",
        outputFormat
      )}
      variant={modalVariant}
      onDownload={handleDownload}
    />
  )}
</div>


);
}
