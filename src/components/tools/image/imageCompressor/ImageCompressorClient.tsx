"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Download,
  Eye,
  FileUp,
  Image as ImageIcon,
  CheckCircle2,
  ShieldCheck,
  Maximize2,
  Gauge,
  FileIcon,
  ArrowRight,
} from "lucide-react";
import dynamic from "next/dynamic";

import { getAcceptString } from "@/components/ui/DropZone";
import { formatBytes } from "@/sharedUI/formatBytes";
import { SliderCard } from "@/sharedUI/tool/sliderCard";
import { CompressorConfig } from "@/types/imageCompressor.types";
import { validateImage } from "@/features/imageConverter/validateImage";
import { normalizeFile } from "@/features/imageConverter/normalizeFile";
import { getImageMetadata } from "@/features/imageConverter/imageMetadata/getImageMetadata";
import { generateFileName } from "@/features/imageConverter/generateFileName";
import { compressImage } from "@/features/imageCompressor/compressImage";
import { ImageMetadata } from "@/types/imageMetadata";
import { CompressionResult } from "@/types/compression.types";
import { asyncGetFileSaverLib } from "@/lib/fileSaverUtility";

import { ToolHero } from "@/components/ui/toolhero";
import { WorkspaceCard } from "@/components/ui/imageToolUI/workspaceCard";
import { MetadataGrid } from "@/components/ui/imageToolUI/metadataGrid";
import { StatCard } from "@/sharedUI/statCard";
import { SectionHeader } from "@/components/ui/imageToolUI/sectionHeader";
import { ToolButton } from "@/components/ui/imageToolUI/toolButton";
import { EmptyState } from "@/components/ui/imageToolUI/emptyState";
import { SuccessBanner } from "@/components/ui/imageToolUI/successBanner";
import { ToolProgress } from "@/components/ui/imageToolUI/toolProgress";

interface Props {
  config: CompressorConfig;
}

type ModalVariant = "preview" | "download";

const ESTIMATE_DEBOUNCE_MS = 450;

function getImageDimensionsFromBlob(
  blob: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
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

function savingsPercentOf(originalSize: number, newSize: number) {
  if (!originalSize) return null;

  return Math.max(
    0,
    Math.round((1 - newSize / originalSize) * 100)
  );
}

function progressStageLabel(progress: number) {
  if (progress <= 0) return "Preparing your image";
  if (progress < 35) return "Analyzing image";
  if (progress < 75) return "Reducing size";
  if (progress < 100) return "Finalizing output";

  return "Done";
}

export default function ImageCompressorClient({ config }: Props) {
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

  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const estimateRequestId = useRef(0);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] =
    useState<ModalVariant>("preview");
  const [dropzoneKey, setDropzoneKey] = useState(0);

  const validFileTypes = useMemo(
    () => getAcceptString(config.allowedFormats),
    [config.allowedFormats]
  );

  const outputFormat = useMemo(() => {
    if (outputBlob) {
      return getOutputExtension(outputBlob, "jpg");
    }

    return "jpg";
  }, [outputBlob]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!outputBlob) return;

      try {
        const dimensions = await getImageDimensionsFromBlob(outputBlob);

        if (!cancelled) {
          setOutputDimensions(dimensions);
        }
      } catch {
        // Dimensions are non-critical.
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [outputBlob]);

  useEffect(() => {
    if (!file) {
      setEstimatedSize(null);
      return;
    }

    if (estimateTimer.current) {
      clearTimeout(estimateTimer.current);
    }

    const requestId = ++estimateRequestId.current;
    setEstimating(true);

    estimateTimer.current = setTimeout(async () => {
      try {
        const result: CompressionResult = await compressImage(file, {
          mode: config.mode ?? "quality",
          quality: quality / 100,
          targetKB: config.targetKB ?? targetKB,
          lockTarget: config.lockTarget,
        });

        if (estimateRequestId.current === requestId) {
          setEstimatedSize(result.blob.size);
        }
      } catch {
        if (estimateRequestId.current === requestId) {
          setEstimatedSize(null);
        }
      } finally {
        if (estimateRequestId.current === requestId) {
          setEstimating(false);
        }
      }
    }, ESTIMATE_DEBOUNCE_MS);

    return () => {
      if (estimateTimer.current) {
        clearTimeout(estimateTimer.current);
      }
    };
  }, [
    file,
    quality,
    targetKB,
    config.mode,
    config.targetKB,
    config.lockTarget,
  ]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      try {
        const selected = files[0];

        if (!selected) return;

        validateImage(selected);

        const normalized = normalizeFile(selected);

        if (
          normalized.format &&
          config.allowedFormats?.length &&
          !config.allowedFormats.includes(normalized.format)
        ) {
          setError("Unsupported file format");
          return;
        }

        const imageMetadata = await getImageMetadata(selected);

        if (outputUrl) {
          URL.revokeObjectURL(outputUrl);
        }

        setOutputUrl(null);
        setOutputBlob(null);
        setEstimatedSize(null);
        setFile(selected);
        setMetadata(imageMetadata);
        setError("");
        setProgress(0);
        setProcessing(false);
        setShowModal(false);
        setModalVariant("preview");
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

  const handleCompress = useCallback(async () => {
    if (!file) return;

    try {
      setProcessing(true);
      setError("");
      setProgress(10);

      validateImage(file);

      const compressionResult: CompressionResult =
        await compressImage(file, {
          mode: config.mode ?? "quality",
          quality: quality / 100,
          targetKB: config.targetKB ?? targetKB,
          lockTarget: config.lockTarget,
        });

      setProgress(85);

      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }

      const url = URL.createObjectURL(compressionResult.blob);

      setOutputUrl(url);
      setOutputBlob(compressionResult.blob);
      setProgress(100);

      setModalVariant("preview");
      setShowModal(true);
    } catch {
      setError(
        "Failed to compress image. Please try again or use a different file."
      );
    } finally {
      setProcessing(false);
    }
  }, [file, config, quality, targetKB, outputUrl]);

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

  const resetTool = useCallback(() => {
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    setMetadata(null);
    setFile(null);
    setProgress(0);
    setProcessing(false);
    setError("");
    setOutputUrl(null);
    setOutputBlob(null);
    setEstimatedSize(null);
    setPreviewUrl(null);
    setShowModal(false);
    setModalVariant("preview");
    setDropzoneKey((previous) => previous + 1);
  }, [outputUrl]);

  const canCompress = !!file && !processing;

  const finalSavingsPercent = useMemo(() => {
    if (!file || !outputBlob) return null;

    return savingsPercentOf(file.size, outputBlob.size);
  }, [file, outputBlob]);

  const estimatedSavingsPercent = useMemo(() => {
    if (!file || estimatedSize == null) return null;

    return savingsPercentOf(file.size, estimatedSize);
  }, [file, estimatedSize]);

  const ImagePreviewModal = dynamic(
    () =>
      import("@/components/ui/image/imagePreviewModal").then(
        (module) => module.ImagePreviewModal
      ),
    { ssr: false }
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 text-foreground sm:px-6 sm:py-3 lg:px-8">
      <ToolHero
        config={config}
        processing={processing}
        file={file}
        dropzoneKey={dropzoneKey}
        handleFiles={handleFiles}
        validFileTypes={validFileTypes}
        eyebrow="Private • Browser Based • Secure"
        title={config.topSectionHeader || "Compress Images"}
        titleAccent="in Seconds"
        description={
          config.topSectionDescription || (
            <>
              Shrink{" "}
              <strong className="text-foreground">
                {(config.allowedFormats || []).join(", ").toUpperCase()}
              </strong>{" "}
              files without losing the quality that matters. Everything
              happens securely inside your browser. No uploads. No waiting.
              No registration.
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
            value:
              (config.allowedFormats || []).join(", ").toUpperCase() ||
              "IMAGE",
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
              ? "Processing"
              : file
                ? "Ready"
                : "Waiting",
            color: "blue",
          },
        ]}
      />

      <div className="mt-8 space-y-8">
        {error && (
          <section className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </section>
        )}

        {file && (
          <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_420px]">
            <div className="space-y-6">
              <WorkspaceCard>
                <header className="border-b border-border px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        Preview
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Original image before compression.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetTool}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground-secondary transition hover:border-blue-400/30 hover:bg-surface-raised"
                    >
                      Start Over
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <div className="flex justify-center rounded-[24px] p-3 sm:p-4">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="preview"
                        draggable={false}
                        className="max-h-[420px] max-w-full object-contain"
                      />
                    ) : (
                      <EmptyState
                        title="No preview available"
                        description="This file type does not expose a preview here."
                        icon={<ImageIcon className="h-6 w-6" />}
                      />
                    )}
                  </div>

                  <div className="m-4 rounded-[24px] bg-surface-sunken px-6 py-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      File Information
                    </h3>

                    <div className="flex items-center gap-2 py-4">
                      <MetadataGrid>
                        <StatCard
                          label="File Name"
                          value={file.name}
                          icon={<FileIcon className="h-4 w-4" />}
                        />

                        <StatCard
                          label="Dimensions"
                          value={
                            metadata
                              ? `${metadata.width} × ${metadata.height}`
                              : "—"
                          }
                          icon={<Maximize2 className="h-4 w-4" />}
                        />

                        <StatCard
                          label="File Size"
                          value={
                            metadata
                              ? formatBytes(metadata.size)
                              : "—"
                          }
                          icon={<FileUp className="h-4 w-4" />}
                        />

                        <StatCard
                          label="Format"
                          value={(file.type || "unknown").toUpperCase()}
                          icon={<ImageIcon className="h-4 w-4" />}
                        />

                        <StatCard
                          label="Privacy"
                          value="Local Processing"
                          icon={<ShieldCheck className="h-4 w-4" />}
                        />
                      </MetadataGrid>
                    </div>
                  </div>
                </div>
              </WorkspaceCard>
            </div>

            <aside className="space-y-5">
              <section className="sticky top-12 rounded-[24px] border border-border bg-surface-sunken p-5 backdrop-blur-xl">
                <SectionHeader
                  title="Compression"
                  subtitle=""
                  icon={<Gauge className="h-5 w-5" />}
                />

                <div className="mt-8 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Input</div>
                      <div className="mt-2 font-semibold text-foreground">
                        {(config.allowedFormats || [])
                          .join(", ")
                          .toUpperCase() || "IMAGE"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Mode</div>
                      <div className="mt-2 font-semibold text-foreground">
                        {getPrettyFormat(config.mode)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">
                        Processing
                      </div>
                      <div className="mt-2 font-semibold text-emerald-300">
                        Local Browser
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="mt-2 font-semibold text-blue-300">
                        {processing
                          ? "Processing"
                          : file
                            ? "Ready"
                            : "Waiting"}
                      </div>
                    </div>
                  </div>

                  {config.mode === "quality" && (
                    <SliderCard
                      label="Compression Quality"
                      valueLabel={`${quality}%`}
                      value={quality}
                      min={10}
                      max={100}
                      onChange={setQuality}
                    >
                      <EstimateRow
                        estimating={estimating}
                        estimatedSize={estimatedSize}
                        estimatedSavingsPercent={estimatedSavingsPercent}
                      />
                    </SliderCard>
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
                    >
                      <EstimateRow
                        estimating={estimating}
                        estimatedSize={estimatedSize}
                        estimatedSavingsPercent={estimatedSavingsPercent}
                      />
                    </SliderCard>
                  )}

                  <ToolButton
                    onClick={handleCompress}
                    disabled={!canCompress}
                    variant="primary"
                    icon={<Gauge className="h-5 w-5" />}
                  >
                    {processing
                      ? "Compressing..."
                      : "Compress Image"}
                  </ToolButton>

                  <div className="rounded-[24px] border border-border bg-surface-sunken p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-blue-500/10 p-3">
                        <ShieldCheck className="h-5 w-5 text-blue-400" />
                      </div>

                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Privacy first
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          No server upload. No account needed.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        )}

        {processing && (
          <ToolProgress
            progress={progress}
            processingMessage={`${progressStageLabel(progress)}...`}
          />
        )}

        {outputUrl && outputBlob && file && (
          <div className="space-y-6">
            <SuccessBanner
              title="Image Ready"
              subtitle="Your image has been compressed successfully."
              icon={<CheckCircle2 className="h-10 w-10" />}
            />

            <section className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-4 text-2xl font-bold sm:text-3xl">
                <span className="text-muted-foreground line-through decoration-slate-600">
                  {formatBytes(file.size)}
                </span>

                <ArrowRight className="h-6 w-6 text-emerald-400" />

                <span className="text-foreground">
                  {formatBytes(outputBlob.size)}
                </span>
              </div>

              {finalSavingsPercent !== null && (
                <div className="mt-2 text-lg font-semibold text-emerald-300">
                  {finalSavingsPercent}% smaller
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-sunken p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Original</span>
                  <span>{formatBytes(file.size)}</span>
                </div>

                <div
                  className="flex items-center justify-center overflow-hidden rounded-xl bg-surface-sunken"
                  style={{ aspectRatio: "4 / 3" }}
                >
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="original"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-surface-sunken p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-emerald-300/80">
                  <span>Compressed</span>
                  <span>{formatBytes(outputBlob.size)}</span>
                </div>

                <div
                  className="flex items-center justify-center overflow-hidden rounded-xl bg-surface-sunken"
                  style={{ aspectRatio: "4 / 3" }}
                >
                  <img
                    src={outputUrl}
                    alt="compressed"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            </section>

            <div className="grid gap-5 md:grid-cols-4">
              <StatCard
                label="Output"
                value={getPrettyFormat(outputFormat)}
                icon={<ImageIcon className="h-4 w-4" />}
              />

              <StatCard
                label="File Size"
                value={formatBytes(outputBlob.size)}
                icon={<FileUp className="h-4 w-4" />}
              />

              <StatCard
                label="Resolution"
                value={
                  outputDimensions.width
                    ? `${outputDimensions.width}×${outputDimensions.height}`
                    : "—"
                }
                icon={<Maximize2 className="h-4 w-4" />}
              />

              <StatCard
                label="Savings"
                value={
                  finalSavingsPercent !== null
                    ? `${finalSavingsPercent}%`
                    : "—"
                }
                icon={<Gauge className="h-4 w-4" />}
              />
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <ToolButton
                variant="outline"
                onClick={() => {
                  setModalVariant("preview");
                  setShowModal(true);
                }}
                icon={<Eye className="h-4 w-4" />}
              >
                Preview Result
              </ToolButton>

              <ToolButton
                variant="primary"
                onClick={() => {
                  setModalVariant("download");
                  setShowModal(true);
                }}
                icon={<Download className="h-4 w-4" />}
              >
                Download Image
              </ToolButton>
            </section>
          </div>
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

function EstimateRow({
  estimating,
  estimatedSize,
  estimatedSavingsPercent,
}: {
  estimating: boolean;
  estimatedSize: number | null;
  estimatedSavingsPercent: number | null;
}) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-3 py-2 text-xs">
      <span className="text-muted-foreground">Estimated result</span>

      {estimating ? (
        <span className="text-slate-400">Calculating…</span>
      ) : estimatedSize != null ? (
        <span className="font-medium text-emerald-300">
          {formatBytes(estimatedSize)}
          {estimatedSavingsPercent !== null
            ? ` · ${estimatedSavingsPercent}% smaller`
            : ""}
        </span>
      ) : (
        <span className="text-slate-500">—</span>
      )}
    </div>
  );
}