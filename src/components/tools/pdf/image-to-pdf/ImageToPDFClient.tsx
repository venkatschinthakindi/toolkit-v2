"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  CheckCircle2,
  Download,
  Eye,
  GripVertical,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";

import { imagesToPDF, PageSize, Orientation } from "@/utility/imageFileToPdf";
import { getAcceptString } from "@/components/ui/DropZone";
import { formatBytes } from "@/sharedUI/formatBytes";
import { SliderCard } from "@/sharedUI/tool/sliderCard";
import { Props } from "@/types/props";
import { asyncGetFileSaverLib } from "@/lib/fileSaverUtility";
import CustomSelect from "@/components/ui/customSelect";

// Same shared kit ImageCompressorClient uses — confirmed by the screenshots,
// so reusing it here (not re-inventing markup) is what actually keeps the
// two tools visually identical.
import { ToolHero } from "@/components/ui/toolhero";
import { SectionHeader } from "@/sharedUI/sectionHeader";
import { ToolButton } from "@/components/ui/imageToolUI/toolButton";
import { SuccessBanner } from "@/components/ui/imageToolUI/successBanner";
import { ToolProgress } from "@/components/ui/imageToolUI/toolProgress";

const PdfViewerModal = dynamic(
  () => import("@/components/ui/pdf/pdfViewerModal"),
  { loading: () => null, ssr: false }
);

type ImageMeta = {
  file: File;
  preview: string;
  width: number;
  height: number;
  size: number;
};

type ModalVariant = "preview" | "download";

export default function ImageToPDFClient({ config }: Props) {
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const [pageSize, setPageSize] = useState<PageSize>("A4" as PageSize);
  const [orientation, setOrientation] = useState<Orientation>("portrait" as Orientation);
  const [margin, setMargin] = useState(20);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("preview");
  const [outputName] = useState("images-to-pdf.pdf");

  const files = useMemo(() => images.map((i) => i.file), [images]);
  const validFileTypes = getAcceptString(config.allowedFormats);
  const heroTitle = `Create a PDF from your image${validFileTypes.length === 1 ? "" : "s"}`;
  const totalSize = useMemo(() => images.reduce((sum, img) => sum + img.size, 0), [images]);

  // -- loading / cleanup --------------------------------------------------

  const loadImages = useCallback(async (newFiles: File[]) => {
    const accepted = newFiles.filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;

    try {
      const metas = await Promise.all(
        accepted.map(
          (file) =>
            new Promise<ImageMeta>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () =>
                  resolve({
                    file,
                    preview: String(reader.result),
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height,
                    size: file.size,
                  });
                img.onerror = reject;
                img.src = String(reader.result);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      );
      setError("");
      setImages((prev) => [...prev, ...metas]);
    } catch {
      setError("One of those files couldn't be read. Try a different image.");
    }
  }, []);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      void loadImages(newFiles);
      setDropzoneKey((prev) => prev + 1);
    },
    [loadImages]
  );

  const resetAll = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImages([]);
    setProgress(0);
    setProcessing(false);
    setShowModal(false);
    setPreviewUrl(null);
    setOutputSize(null);
    setError("");
    setDropzoneKey((prev) => prev + 1);
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // -- reordering / removing ----------------------------------------------

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const reordered = Array.from(images);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);
      setImages(reordered);
    },
    [images]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }, []);

  // -- generate / preview / download ---------------------------------------

  const runGeneration = useCallback(async () => {
    if (!files.length) return null;
    setProcessing(true);
    setError("");
    setProgress(8);

    const ticker = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.max(2, (85 - p) / 6) : p));
    }, 120);

    try {
      const pdfBytes = await imagesToPDF(files, { pageSize, orientation, margin });
      setProgress(100);
      const blob = new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
      return blob;
    } catch {
      setError("Couldn't build the PDF. Please try again.");
      return null;
    } finally {
      clearInterval(ticker);
      setTimeout(() => setProcessing(false), 250);
    }
  }, [files, pageSize, orientation, margin]);

  const generatePdf = useCallback(async () => {
    const blob = await runGeneration();
    if (!blob) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setOutputSize(blob.size);
  }, [runGeneration, previewUrl]);

  const handleDownload = useCallback(async () => {
    if (!previewUrl) return;
    const saveAs = await asyncGetFileSaverLib();
    saveAs(previewUrl, outputName);
    setTimeout(() => resetAll(), 500);
  }, [previewUrl, outputName, resetAll]);

  const hasImages = images.length > 0;
  const canGenerate = hasImages && !processing;
  const isDone = !!previewUrl && outputSize !== null && !processing;

  const pageOptions = [
    { value: "A4", label: "A4" },
    { value: "Letter", label: "Letter" },
  ];
  const orientationOptions = [
    { value: "portrait", label: "Portrait" },
    { value: "landscape", label: "Landscape" },
  ];
  const fitOptions = [
    { value: "contain", label: "Fit inside page" },
    { value: "cover", label: "Fill page" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 text-foreground sm:px-6 sm:py-3 lg:px-8">
      <ToolHero
        config={config}
        processing={processing}
        file={hasImages ? images[0].file : null}
        dropzoneKey={dropzoneKey}
        handleFiles={handleFiles}
        validFileTypes={validFileTypes}
        eyebrow="Private • Browser Based • Secure"
        title={heroTitle}
        titleAccent="in Seconds"
        description={(
            <>
              Drop in your photos, arrange them in the order you want, and export a clean{" "}
              <strong className="text-foreground">PDF</strong>. Everything happens securely inside your
              browser. No uploads. No waiting. No registration.
            </>
          )
        }
        badges={[
          { label: "⚡ Instant Merge", color: "blue" },
          { label: "🔒 100% Private", color: "green" },
          { label: "📤 No Upload", color: "purple" },
        ]}
        stats={[
          { label: "Input", value: (config.allowedFormats || []).join(", ").toUpperCase() || "IMAGE" },
          { label: "Mode", value: "MULTI-PAGE" },
          { label: "Processing", value: "Local Browser", color: "emerald" },
          { label: "Status", value: processing ? "Building" : hasImages ? "Ready" : "Waiting", color: "blue" },
        ]}
      />

      <div className="mt-8 space-y-8">
        {error && (
          <section className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </section>
        )}

        {hasImages && (
          <section className="grid gap-5 xl:grid-cols-[1.4fr_420px]">
            {/* ---------------- arrange pages ---------------- */}
            <div className="space-y-6">
              <div className="rounded-[24px] border border-border bg-surface-sunken backdrop-blur-xl">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Arrange pages</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Drag to reorder — this is the order pages come out in.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetAll}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground-secondary transition hover:border-blue-400/30 hover:bg-surface-raised"
                    >
                      Start Over
                    </button>
                  </div>
                </header>

                <div className="p-4 sm:p-5">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="pdf-pages" direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 justify-center gap-3"
                        >
                          {images.map((image, index) => (
                            <Draggable key={`${image.file.name}-${index}`} draggableId={`${image.file.name}-${index}`} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`group relative center overflow-hidden rounded-2xl border transition ${
                                    dragSnapshot.isDragging
                                      ? "border-blue-400/50 shadow-lg shadow-blue-500/10"
                                      : "border-border hover:border-blue-400/30"
                                  }`}
                                  style={{ aspectRatio: "3 / 4", ...dragProvided.draggableProps.style }}
                                >
                                  <img
                                    src={image.preview}
                                    alt={image.file.name}
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />

                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white"
                                  >
                                    <GripVertical className="h-3 w-3 opacity-70" />
                                    {index + 1}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                                    aria-label={`Remove ${image.file.name}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>

                                  <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[10px] text-white/80">
                                    {image.file.name}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </div>

            {/* ---------------- page setup (sticky sidebar) ---------------- */}
            <aside className="space-y-5">
              <section className="sticky top-12 rounded-[24px] border border-border bg-surface-sunken p-5 backdrop-blur-xl">
                <SectionHeader title="Page setup" subtitle="" icon={<Wand2 className="h-5 w-5" />} />

                <div className="mt-8 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Images</div>
                      <div className="mt-2 font-semibold text-foreground">{images.length}</div>
                    </div>
                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Total size</div>
                      <div className="mt-2 font-semibold text-foreground">{formatBytes(totalSize)}</div>
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="mb-2 text-sm text-muted-foreground">Page size</div>
                      <CustomSelect value={pageSize} callBackTrigger={(v)=>{
                        setPageSize(v as PageSize);
                      }} options={pageOptions} />
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="mb-2 text-sm text-muted-foreground">Orientation</div>
                      <CustomSelect value={orientation} callBackTrigger={(v)=>{
                        setOrientation(v as Orientation);
                      }} options={orientationOptions} />
                    </div>

                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="mb-2 text-sm text-muted-foreground">Image fit</div>
                      <CustomSelect value={fitMode} callBackTrigger={(v)=>{
                        setFitMode(v as any);
                      }} options={fitOptions} />
                    </div>

                    <SliderCard
                      label="Margin"
                      valueLabel={`${margin}px`}
                      value={margin}
                      min={0}
                      max={64}
                      onChange={setMargin}
                    />
                    {/* <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Processing</div>
                      <div className="mt-2 font-semibold text-emerald-300">Local Browser</div>
                    </div>
                    <div className="rounded-xl bg-surface-sunken p-4">
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="mt-2 font-semibold text-blue-300">
                        {processing ? "Building" : "Ready"}
                      </div>
                    </div> */}
                  </div>

                  

                  <ToolButton onClick={generatePdf} disabled={!canGenerate} variant="primary" icon={<Wand2 className="h-5 w-5" />}>
                    {processing ? "Building PDF..." : isDone ? "Regenerate PDF" : "Generate PDF"}
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

        {processing && <ToolProgress progress={progress} processingMessage="Laying out and rendering pages..." />}

        {isDone && (
          <div className="space-y-6">
            <SuccessBanner
              title="PDF Ready"
              subtitle={`${images.length} page${images.length === 1 ? "" : "s"} · ${formatBytes(outputSize || 0)}`}
              icon={<CheckCircle2 className="h-10 w-10" />}
            />

            <section className="grid gap-3 sm:grid-cols-2">
              <ToolButton
                variant="outline"
                icon={<Eye className="h-4 w-4" />}
                onClick={() => {
                  setModalVariant("preview");
                  setShowModal(true);
                }}
              >
                Preview PDF
              </ToolButton>

              <ToolButton
                variant="primary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => {
                  setModalVariant("download");
                  setShowModal(true);
                }}
              >
                Download PDF
              </ToolButton>
            </section>
          </div>
        )}
      </div>

      {showModal && previewUrl && (
        <PdfViewerModal
          url={previewUrl}
          onClose={() => setShowModal(false)}
          documentName="Images to PDF"
          variant={modalVariant}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}