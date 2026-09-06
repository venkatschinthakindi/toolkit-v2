"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Props } from "@/types/props";
import {
  RotateCcw,
  Download,
  FileArchive,
  Gauge,
  Minus,
  AlertCircle,
  CircleCheck,
  Loader2,
  Eye,
  Info,
  TrendingDown,
} from "lucide-react";
import { asyncGetPdfLib } from "@/lib/pdfLibUtility";

// Same shared hero used across the image tools — confirmed real, reused
// here instead of hand-rolling the top section again.
import { ToolHero } from "@/components/ui/toolhero";
import { formatBytes } from "@/sharedUI/formatBytes";
import { premiumShellClass } from "@/sharedUI/tool/premiumShell";
import { GlassIcon } from "@/sharedUI/tool/GlassIcon";

const PdfViewerModal = dynamic(
  () => import("@/components/ui/pdf/pdfViewerModal"),
  { loading: () => null, ssr: false }
);

type CompressionLevel = "low" | "medium" | "high";

interface LevelConfig {
  scale: number;
  quality: number;
  label: string;
  desc: string;
  icon: string;
  expectedRange: string;
}

const LEVELS: Record<CompressionLevel, LevelConfig> = {
  low: {
    scale: 1.0,
    quality: 0.85,
    label: "Light",
    desc: "Re-encode at 85% JPEG — minimal quality loss",
    icon: "🪶",
    expectedRange: "20–40%",
  },
  medium: {
    scale: 0.9,
    quality: 0.75,
    label: "Balanced",
    desc: "90% resolution + 75% JPEG quality",
    icon: "⚖️",
    expectedRange: "40–65%",
  },
  high: {
    scale: 0.75,
    quality: 0.6,
    label: "Aggressive",
    desc: "75% resolution + 60% JPEG — max savings",
    icon: "🚀",
    expectedRange: "60–80%",
  },
};

function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

async function compressPdf(
  buffer: ArrayBuffer,
  scale: number,
  quality: number,
  onPage: (current: number, total: number) => void
): Promise<Uint8Array> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: false,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const total = pdfDoc.numPages;
  const jpegs: Uint8Array[] = [];

  const PDFDocument = await asyncGetPdfLib();
  for (let i = 1; i <= total; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = jpegDataUrl.split(",")[1];
    jpegs.push(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));

    page.cleanup();
    await new Promise<void>((r) => setTimeout(r, 0));
    onPage(i, total);
  }

  const outDoc = await PDFDocument.create();
  for (const jpegBytes of jpegs) {
    const image = await outDoc.embedJpg(jpegBytes);
    const p = outDoc.addPage([image.width, image.height]);
    p.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  return outDoc.save({ useObjectStreams: true, addDefaultPage: false });
}

function LevelCard({
  level,
  active,
  onClick,
}: {
  level: CompressionLevel;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = LEVELS[level];
  return (
    <button
      className={`flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-blue-400/35 bg-blue-400/10"
          : "border-border bg-card hover:border-border-strong hover:bg-surface-raised"
      }`}
      onClick={onClick}
      aria-pressed={active}
      type="button"
    >
      <span className="text-sm font-semibold text-foreground">
        {cfg.label} {cfg.icon}
      </span>
      <span className="text-xs leading-5 text-muted-foreground">{cfg.desc}</span>
      <span className="mt-auto text-xs font-medium text-blue-200">
        ~{cfg.expectedRange} reduction
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SizeComparison — the payoff moment. Leads with a big hero percentage, then
// two proportional bars (original vs. compressed) so the size drop is SEEN,
// not just read as a number in a pill.
// ---------------------------------------------------------------------------
function SizeComparison({ before, after }: { before: number; after: number }) {
  const ratio = before > 0 ? Math.min(after / before, 1) : 1;
  const savedPct = Math.round((1 - ratio) * 100);
  // Keep a visible sliver on the compressed bar even at extreme reduction,
  // so the bar doesn't disappear and look like a rendering bug.
  const compressedBarPct = Math.max(4, Math.round(ratio * 100));

  return (
    <div className={premiumShellClass()}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5 md:px-5 md:py-4">
        <div className="flex gap-3">
          <GlassIcon icon={TrendingDown} />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Compression result</p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">File size comparison</h3>
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          {savedPct > 0 ? `Saved ${savedPct}%` : "No change"}
        </span>
      </div>

      {/* Hero number — the moment that's meant to land */}
      <div className="border-b border-border px-4 py-6 text-center sm:px-5 md:px-6">
        <p className="bg-gradient-to-r from-emerald-300 via-[var(--foreground)] to-blue-300 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          {savedPct > 0 ? `${savedPct}%` : "0%"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {savedPct > 0
            ? "smaller than the original — ready to share or store"
            : "Size unchanged — PDF may already be optimized"}
        </p>
      </div>

      {/* Two proportional bars so the shrink is visible, not just numeric */}
      <div className="space-y-4 px-4 py-4 sm:px-5 md:px-6">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Original</span>
            <span className="font-medium text-foreground-secondary">{formatBytes(before)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full w-full rounded-full bg-foreground/30" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Compressed</span>
            <span className="font-medium text-emerald-200">{formatBytes(after)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-500"
              style={{ width: `${compressedBarPct}%` }}
            />
          </div>
        </div>
      </div>

      <p className="px-4 pb-4 text-sm text-foreground-secondary sm:px-5 md:px-6 md:pb-5">
        {savedPct > 0
          ? `Reduced by ${formatBytes(before - after)} — down from ${formatBytes(before)} to ${formatBytes(after)}.`
          : "Size unchanged — PDF may be text-only or already optimised."}
      </p>
    </div>
  );
}

export default function CompressClient({ config }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("medium");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ page: 0, total: 0 });
  const [sizes, setSizes] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileReducedPercent, setFileReducedPercent] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<"preview" | "download">("preview");

  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropzoneKey, setDropzoneKey] = useState(0);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const acceptFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    setFile(f);
    setSizes(null);
    setError(null);
    setStatus("idle");
    setProgress({ page: 0, total: 0 });
    setCompressedBlob(null);
    setFileReducedPercent(null);
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      const f = Array.from(files)[0];
      if (f) acceptFile(f);
    },
    [acceptFile]
  );

  const openPreview = useCallback((blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setModalVariant("preview");
    setShowModal(true);
  }, [previewUrl]);

  const openDownloadModal = useCallback((blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setModalVariant("download");
    setShowModal(true);
  }, [previewUrl]);

  const handleDownload = useCallback(async () => {
    if (!compressedBlob || !file) return;
    saveBlobAs(compressedBlob, file.name.replace(/\.pdf$/i, "_compressed.pdf"));
    reset();
  }, [compressedBlob, file]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const handleCompress = async () => {
    if (!file || status === "working") return;

    cancelledRef.current = false;
    setStatus("working");
    setError(null);
    setSizes(null);
    setProgress({ page: 0, total: 0 });
    setCompressedBlob(null);
    setFileReducedPercent(null);

    try {
      const buffer = await file.arrayBuffer();
      const { scale, quality } = LEVELS[level];

      const result = await compressPdf(buffer, scale, quality, (current, total) => {
        if (!cancelledRef.current) {
          setProgress({ page: current, total });
        }
      });

      if (cancelledRef.current) return;

      const blob = new Blob([Uint8Array.from(result)], { type: "application/pdf" });
      setCompressedBlob(blob);
      setSizes({ before: file.size, after: blob.size });

      const ratio = Math.min(blob.size / file.size, 1);
      const savedPct = Math.round((1 - ratio) * 100);
      setFileReducedPercent(`${savedPct}`);

      setStatus("done");
      openPreview(blob);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : "Compression failed. Try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    cancelledRef.current = true;
    setFile(null);
    setSizes(null);
    setError(null);
    setStatus("idle");
    setProgress({ page: 0, total: 0 });
    setCompressedBlob(null);
    setFileReducedPercent(null);
    setDropzoneKey((k) => k + 1);
    if (inputRef.current) inputRef.current.value = "";
    handleCloseModal();
  };

  const isWorking = status === "working";
  const isDone = status === "done";
  const pct = progress.total > 0 ? Math.round((progress.page / progress.total) * 100) : 0;
  const hasFile = !!file;
  const canBuild = !!file && !isWorking;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 text-foreground sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <ToolHero
        config={config}
        processing={isWorking}
        file={file}
        dropzoneKey={dropzoneKey}
        handleFiles={handleFiles}
        validFileTypes=".pdf"
        eyebrow="Private • Browser Based • Secure"
        title="Compress PDFs with"
        titleAccent="Precision Control"
        description={
          <>
            Reduce file size locally, choose how aggressive the compression should be, and keep the
            workflow fast and simple.
          </>
        }
        badges={[
          { label: "⚡ Instant Compression", color: "blue" },
          { label: "🔒 100% Private", color: "green" },
          { label: "📤 No Upload", color: "purple" },
        ]}
        stats={[
          { label: "File", value: hasFile ? "Selected" : "None" },
          {
            label: "Progress",
            value: isWorking ? `${pct}%` : fileReducedPercent ? `Saved ${fileReducedPercent}%` : "—",
          },
          {
            label: "Status",
            value: status === "done" ? "Done" : status === "error" ? "Error" : "Ready",
            color: "blue",
          },
          { label: "Secure", value: "Local", color: "emerald" },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          <section className={premiumShellClass()} aria-labelledby="levels-heading">
            <div className="relative flex flex-col flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5 md:px-5 md:py-4">
              <div>
                <div className="flex flex-col gap-3">
                  <GlassIcon icon={Gauge} />
                  <h2 id="levels-heading" className="flex flex-col items-center gap-2 text-base font-semibold tracking-tight sm:text-md">
                    Compression level
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Choose a trade-off between file size and visual fidelity.
                </p>
              </div>

              {file && (
                <div className="flex flex-col items-center gap-2">
                  <div className="min-w-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground-secondary">
                    <span className="max-w-[160px] truncate align-middle" title={file.name}>
                      {file.name}
                    </span>
                    <span className="ml-1.5 text-muted-foreground">· {formatBytes(file.size)}</span>
                  </div>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground-secondary transition hover:bg-surface-raised hover:text-foreground"
                    onClick={reset}
                    aria-label="Remove file"
                    type="button"
                    title="Remove file"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 sm:mx-5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 p-3 sm:grid-cols-3 sm:p-4 md:p-5">
              {(["low", "medium", "high"] as CompressionLevel[]).map((l) => (
                <LevelCard key={l} level={l} active={level === l} onClick={() => setLevel(l)} />
              ))}
            </div>
            {file && (
            <div className="space-y-4 p-3 sm:p-4 md:p-5">
              {isWorking && (
                <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground-secondary">
                      {progress.total > 0 ? `Rendering page ${progress.page} of ${progress.total}…` : "Loading PDF…"}
                    </span>
                    <span className="text-sm font-medium text-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {!isDone ? (
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-4 text-sm font-semibold text-white transition hover:from-blue-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canBuild}
                  onClick={handleCompress}
                  aria-busy={isWorking}
                  type="button"
                >
                  {isWorking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Compressing…
                    </>
                  ) : (
                    <>
                      <FileArchive className="h-4 w-4" />
                      Compress PDF
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-4 text-sm font-semibold text-white transition hover:from-violet-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => compressedBlob && openPreview(compressedBlob)}
                      type="button"
                      disabled={!compressedBlob}
                    >
                      <Eye className="h-4 w-4" />
                      Preview PDF
                    </button>

                    <button
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-4 text-sm font-semibold text-white transition hover:from-emerald-400 hover:to-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => compressedBlob && openDownloadModal(compressedBlob)}
                      type="button"
                      disabled={!compressedBlob}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground transition hover:bg-surface-raised"
                      onClick={reset}
                      type="button"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Compress another file / Reset all
                    </button>

                    <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-sunken px-5 py-4 text-sm text-foreground-secondary">
                      <CircleCheck className="mr-2 h-4 w-4 text-emerald-300" />
                      Ready
                    </div>
                  </div>
                </>
              )}
            </div>
            )}
          </section>
        </div>
        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          {isDone && sizes && <SizeComparison before={sizes.before} after={sizes.after} />}
        </div>

        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          {!isDone && !!file && (
            <section className={premiumShellClass()} aria-labelledby="workflow-heading">
              <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-3.5 md:px-5 md:py-4">
                <div className="flex gap-3">
                  <GlassIcon icon={Info} />
                  <h2 id="workflow-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-md">
                    Compression notes
                  </h2>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-sm leading-6 text-foreground-secondary">
                  Each page is re-rendered as a JPEG image — no data leaves your device. Text-heavy PDFs:
                  ~20–40% smaller. Image-heavy PDFs: 50–80% smaller. On <em>Aggressive</em>, text won't be
                  selectable in the output.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

      {showModal && previewUrl && (
        <PdfViewerModal
          url={previewUrl}
          onClose={handleCloseModal}
          documentName={file?.name.replace(/\.pdf$/i, "_compressed.pdf") || "Compressed PDF"}
          variant={modalVariant}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}