"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Eye,
  FileUp,
  Image as ImageIcon,
  CheckCircle2,
  ShieldCheck,
  Wand2,
  Maximize2,
  RefreshCw,
  FileIcon,
} from "lucide-react";

import { DropZone, getAcceptString } from "@/components/ui/DropZone";
import { formatBytes } from "@/sharedUI/formatBytes";
import { ToolConfig } from "@/types/imageConverter.types";
import { convertImage } from "@/features/imageConverter/converters/convertImage";
import { validateImage } from "@/features/imageConverter/validateImage";
import { getImageMetadata } from "@/features/imageConverter/imageMetadata/getImageMetadata";
import { ImageMetadata } from "@/types/imageMetadata";
import { generateFileName } from "@/features/imageConverter/generateFileName";
import { normalizeFile } from "@/features/imageConverter/normalizeFile";
import { asyncGetFileSaverLib } from "@/lib/fileSaverUtility";
import { FeatureBadge } from "../../../ui/featureBadge";
import { WorkspaceCard } from "../../../ui/imageToolUI/workspaceCard";
import { MetadataGrid } from "../../../ui/imageToolUI/metadataGrid";
import { StatCard } from "@/sharedUI/statCard";
import { EmptyState } from "../../../ui/imageToolUI/emptyState";
import { ToolButton } from "../../../ui/imageToolUI/toolButton";
import { SuccessBanner } from "../../../ui/imageToolUI/successBanner";
import { SectionHeader } from "../../../ui/imageToolUI/sectionHeader";
import { ToolProgress } from "../../../ui/imageToolUI/toolProgress";

const ImagePreviewModal = dynamic(
  () => import("@/components/ui/image/imagePreviewModal").then((m) => m.ImagePreviewModal),
  { ssr: false }
);

interface Props {
  config: ToolConfig;
}

type ModalVariant = "preview" | "download";

function getPrettyFormat(format?: string) {
  return (format || "").toUpperCase() || "—";
}

function ToolHero({
  config,
  processing,
  file,
  dropzoneKey,
  handleFiles,
  validFileTypes
}: {
  config: ToolConfig;
  processing: boolean;
  file: File | null;
  dropzoneKey: number;
  handleFiles: (files: File[]) => void;
  validFileTypes: string;
}) {
  const outputFormat = config.outputFormats?.[0] || "png";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0">
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative px-6 py-8 lg:px-12 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_420px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Private • Browser Based • Secure
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
              Convert Images
              <span className="block bg-gradient-to-r from-blue-400 via-[var(--foreground)] to-violet-400 bg-clip-text text-transparent">
                in Seconds
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground-secondary">
              Convert{" "}
              <strong className="text-foreground">{config.inputFormats.join(", ").toUpperCase()}</strong>{" "}
              to <strong className="text-foreground">{outputFormat.toUpperCase()}</strong>. Everything happens
              securely inside your browser. No uploads. No waiting. No registration.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <FeatureBadge color="blue">⚡ Instant Conversion</FeatureBadge>
              <FeatureBadge color="green">🔒 100% Private</FeatureBadge>
              <FeatureBadge color="purple">📤 No Upload</FeatureBadge>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface-sunken p-4 backdrop-blur">
            <div className="text-lg font-semibold text-foreground">Quick Overview</div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Input</span>
                <span className="font-medium text-foreground">{config.inputFormats.join(", ").toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Output</span>
                <span className="font-medium text-foreground">{outputFormat.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processing</span>
                <span className="text-emerald-300">Local Browser</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className="text-blue-300">{processing ? "Processing" : file ? "Ready" : "Waiting"}</span>
              </div>
            </div>

            <DropZone
              key={dropzoneKey}
              allowMultiple={false}
              onFiles={handleFiles}
              validFileTypes={validFileTypes}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ImageConverterClient({ config }: Props) {
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("preview");
  const [dropzoneKey] = useState(0);

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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  const validFileTypes = useMemo(() => getAcceptString(config.inputFormats), [config.inputFormats]);
  const outputFormat = config.outputFormats?.[0] || "png";
  const canConvert = !!file && !processing;

  const handleFiles = useCallback(
    async (files: File[]) => {
      try {
        const selected = files[0];
        if (!selected) return;

        validateImage(selected);

        const normalized = normalizeFile(selected);
        if (!normalized.format) {
          setError("Unsupported file format");
          return;
        }

        const imageMetadata = await getImageMetadata(selected);

        if (outputUrl) URL.revokeObjectURL(outputUrl);

        setOutputUrl(null);
        setFile(selected);
        setMetadata(imageMetadata);
        setError("");
        setProgress(0);
        setProcessing(false);
        setShowModal(false);
        setModalVariant("preview");
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Invalid file");
      }
    },
    [outputUrl]
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;

    try {
      setProcessing(true);
      setError("");
      setProgress(10);

      validateImage(file);

      const blob = await convertImage(file, {
        targetFormat: config.outputFormats[0],
        quality: 0.92,
      });

      setProgress(85);

      if (outputUrl) URL.revokeObjectURL(outputUrl);

      const url = URL.createObjectURL(blob);
      setOutputUrl(url);

      setProgress(100);
      setModalVariant("preview");
      setShowModal(true);
    } catch {
      setError("Failed to convert image.");
    } finally {
      setProcessing(false);
    }
  }, [file, config.outputFormats, outputUrl]);

  const handleDownload = useCallback(async () => {
    if (!outputUrl || !file) return;

    const fileName = generateFileName(file.name || "image", "converted", config.outputFormats[0]);
    const saveAs = await asyncGetFileSaverLib();
    saveAs(outputUrl, fileName);
  }, [outputUrl, file, config.outputFormats]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 text-foreground sm:px-6 sm:py-3 lg:px-8">
      <ToolHero config={config} processing={processing} file={file} 
      dropzoneKey={dropzoneKey} handleFiles={handleFiles} validFileTypes={validFileTypes} />

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
                  <h2 className="text-xl font-semibold text-foreground">Preview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Original image before conversion.</p>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                  Ready
                </span>
              </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="flex rounded-[24px] justify-center  p-3 sm:p-4">
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
            <div className="px-6 py-3 rounded-[24px] m-4 bg-surface-sunken">
              <h3 className="text-lg font-semibold text-foreground">File Information</h3>
              <div className="flex items-center gap-2 py-4">
                <MetadataGrid>
                    <StatCard
                      label="File Name"
                      value={file.name}
                      icon={<FileIcon className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Dimensions"
                      value={metadata ? `${metadata.width} × ${metadata.height}` : "—"}
                      icon={<Maximize2 className="h-4 w-4" />}
                    />
                    <StatCard
                      label="File Size"
                      value={metadata ? formatBytes(metadata.size) : "—"}
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
              title="Conversion"
              subtitle=""
              icon={<RefreshCw className="h-5 w-5" />}
            />

            <div className="mt-8 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-sunken p-4">
                  <div className="text-sm text-muted-foreground">Input</div>
                  <div className="mt-2 font-semibold text-foreground">
                    {config.inputFormats.join(", ").toUpperCase()}
                  </div>
                </div>
                <div className="rounded-xl bg-surface-sunken p-4">
                  <div className="text-sm text-muted-foreground">Output</div>
                  <div className="mt-2 font-semibold text-foreground">
                    {config.outputFormats[0].toUpperCase()}
                  </div>
                </div>
                <div className="rounded-xl bg-surface-sunken p-4">
                  <div className="text-sm text-muted-foreground">Processing</div>
                  <div className="mt-2 font-semibold text-emerald-300">Local Browser</div>
                </div>
                <div className="rounded-xl bg-surface-sunken p-4">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="mt-2 font-semibold text-blue-300">
                    {processing ? "Processing" : file ? "Ready" : "Waiting"}
                  </div>
                </div>
              </div>

              <ToolButton
                onClick={handleConvert}
                disabled={!canConvert}
                variant="primary"
                icon={<Wand2 className="h-5 w-5" />}
              >
                {processing ? "Converting..." : `Convert to ${config.outputFormats[0].toUpperCase()}`}
              </ToolButton>

              <div className="rounded-[24px] border border-border bg-surface-sunken p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-500/10 p-3">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Privacy first</div>
                    <div className="mt-1 text-sm text-muted-foreground">No server upload. No account needed.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </section>
    )}

        {processing && <ToolProgress progress={progress} processingMessage='Converting your image' />}

        {outputUrl && (
          <div className="space-y-6">
            <SuccessBanner
              title="Image Ready"
              subtitle="Your image has been converted successfully."
              icon={<CheckCircle2 className="h-10 w-10" />}
            />

            <div className="grid gap-5 md:grid-cols-4">
              <StatCard label="Output" value={getPrettyFormat(outputFormat)} icon={<ImageIcon className="h-4 w-4" />} />
              <StatCard label="File Size" value={metadata ? formatBytes(metadata.size) : "—"} icon={<FileUp className="h-4 w-4" />} />
              <StatCard
                label="Resolution"
                value={metadata ? `${metadata.width}×${metadata.height}` : "—"}
                icon={<Maximize2 className="h-4 w-4" />}
              />
              <StatCard label="Private" value="100%" icon={<ShieldCheck className="h-4 w-4" />} />
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
          documentName={generateFileName(file?.name || "image", "converted", config.outputFormats[0])}
          variant={modalVariant}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}