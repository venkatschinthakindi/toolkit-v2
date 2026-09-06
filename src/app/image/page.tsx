import Link from "next/link";
import { Footer } from "@/app/footer/footer";
import { serverConfig } from "@/config/server";
import { FilterToolHubPage } from "@/sharedUI/filterToolHubPage";

const siteUrl = serverConfig.siteUrl;
const siteName = serverConfig.siteName;
const title = "Free Online Image Tools – Convert, Compress & Edit Images";
const description = "Free online image tools to convert, compress, resize, optimize, and edit JPG, PNG, WebP, SVG and other image formats in your browser. Fast, private and easy to use.";

export const metadata = {
  title,
  description,
  alternates: { canonical: `${siteUrl}/image` },
  openGraph: { title, description, url: `${siteUrl}/image`, siteName, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const converterTools = [
  ["JPG to PNG Converter", "/tools/image/jpg-to-png", "Convert JPG and JPEG images to PNG for lossless graphics, screenshots and editing workflows."],
  ["PNG to JPG Converter", "/tools/image/png-to-jpg", "Convert PNG images to JPG when compact photographic output or compatibility is more important."],
  ["JPG to WebP Converter", "/tools/image/jpg-to-webp", "Convert JPG photographs to WebP for modern web delivery and smaller image payloads."],
  ["PNG to WebP Converter", "/tools/image/png-to-webp", "Convert PNG graphics to WebP when you want a modern web-friendly image format."],
  ["WebP to JPG Converter", "/tools/image/webp-to-jpg", "Convert WebP images to JPG for workflows and applications that require JPEG."],
  ["WebP to PNG Converter", "/tools/image/webp-to-png", "Convert WebP images to PNG when you need lossless output or PNG compatibility."],
  ["SVG to PNG Converter", "/tools/image/svg-to-png", "Convert scalable SVG artwork to raster PNG images."],
  ["SVG to JPG Converter", "/tools/image/svg-to-jpg", "Convert SVG graphics to JPG when a raster JPEG output is required."],
];

const compressionTools = [
  ["Image Compressor", "/tools/image/compress-image", "Reduce image file size while balancing compression quality and visual detail."],
  ["Compress Image to 20 KB", "/tools/image/compress-image-to-20kb", "Prepare supported images for forms and portals with a strict 20 KB maximum."],
  ["Compress Image to 50 KB", "/tools/image/compress-image-to-50kb", "Target a 50 KB image size for upload limits while keeping useful image quality."],
  ["Compress Image to 100 KB", "/tools/image/compress-image-to-100kb", "Reduce supported images toward a 100 KB target for common online upload limits."],
];

export default function Page() {
  return (
    <div className="app-shell">
      <div className="app-container page-section pt-12">
        <FilterToolHubPage filterKey="image" title={title} />

        <main className="mx-auto mt-10 max-w-6xl space-y-10 px-4 pb-12 text-foreground sm:px-5 lg:px-6">
          <section aria-labelledby="image-tools-overview" className="space-y-4">
            <h2 id="image-tools-overview" className="text-2xl font-bold tracking-tight sm:text-3xl">Free Online Image Tools for Conversion, Compression and Editing</h2>
            <p className="max-w-4xl text-sm leading-relaxed text-foreground-secondary sm:text-base">Atoolix provides browser-based tools for converting, compressing and working with common image formats including JPG, JPEG, PNG, WebP and SVG. Choose a dedicated converter when you know the source and target format, or use an image compressor when reducing file size is the main goal.</p>
            <p className="max-w-4xl text-sm leading-relaxed text-foreground-secondary sm:text-base">The image tools are designed for common workflows such as preparing website assets, changing formats for applications, reducing upload sizes, converting vector graphics to raster images, and creating image files that work with a specific editing or publishing workflow.</p>
          </section>

          <section aria-labelledby="image-conversion-tools" className="space-y-5">
            <div>
              <h2 id="image-conversion-tools" className="text-xl font-bold tracking-tight sm:text-2xl">Image Format Converters</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground-secondary sm:text-base">Use the converter that matches your source and required output format. Keeping these links together creates a clear conversion hierarchy for both visitors and search engines.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {converterTools.map(([name, href, text]) => (
                <Link key={href} href={href} className="rounded-2xl border border-border bg-card p-5 transition hover:bg-surface-raised">
                  <h3 className="font-semibold text-foreground">{name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{text}</p>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="image-compression-tools" className="space-y-5">
            <div>
              <h2 id="image-compression-tools" className="text-xl font-bold tracking-tight sm:text-2xl">Image Compression and File-Size Tools</h2>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-foreground-secondary sm:text-base">Use the general compressor when you want to balance file size and quality, or choose a target-size tool when a website, application, exam form, government portal, or upload service specifies a maximum file size.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {compressionTools.map(([name, href, text]) => (
                <Link key={href} href={href} className="rounded-2xl border border-border bg-card p-5 transition hover:bg-surface-raised">
                  <h3 className="font-semibold text-foreground">{name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{text}</p>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="choose-image-tool" className="space-y-4">
            <h2 id="choose-image-tool" className="text-xl font-bold tracking-tight sm:text-2xl">Which Image Tool Should You Use?</h2>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border"><tr><th scope="col" className="px-4 py-3 font-semibold text-foreground">Goal</th><th scope="col" className="px-4 py-3 font-semibold text-foreground">Recommended tool</th></tr></thead>
                <tbody className="text-foreground-secondary">
                  <tr className="border-b border-border"><td className="px-4 py-3">Change image format</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/image">Browse image format converters</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Convert JPG to WebP for a website</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/jpg-to-webp">JPG to WebP Converter</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Reduce image file size</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/compress-image">Image Compressor</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Meet a 20 KB upload limit</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/compress-image-to-20kb">Compress Image to 20 KB</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Meet a 50 KB upload limit</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/compress-image-to-50kb">Compress Image to 50 KB</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Meet a 100 KB upload limit</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/compress-image-to-100kb">Compress Image to 100 KB</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Prepare a passport or ID photo</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/passport-photo-resizer">Passport Photo Resizer</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Resize a signature for an upload</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/resize-signature-for-upload">Signature Resizer</Link></td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Remove a background</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/background-remover">Background Remover</Link></td></tr>
                  <tr><td className="px-4 py-3">Create a PDF from images</td><td className="px-4 py-3"><Link className="text-blue-700 dark:text-blue-300 underline" href="/tools/image/image-to-pdf">Image to PDF</Link></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="format-guide" className="space-y-4">
            <h2 id="format-guide" className="text-xl font-bold tracking-tight sm:text-2xl">JPG, PNG, WebP and SVG: When to Use Each Format</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">JPG / JPEG</h3><p className="mt-2 text-sm leading-relaxed text-foreground-secondary">Commonly used for photographs where compact file size matters.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">PNG</h3><p className="mt-2 text-sm leading-relaxed text-foreground-secondary">Useful for screenshots, graphics and workflows that need lossless output or transparency support.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">WebP</h3><p className="mt-2 text-sm leading-relaxed text-foreground-secondary">Useful for modern web workflows where image delivery efficiency is important.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">SVG</h3><p className="mt-2 text-sm leading-relaxed text-foreground-secondary">A vector format suited to logos, icons and scalable graphics; convert it to PNG or JPG when raster output is required.</p></div>
            </div>
          </section>

          <section aria-labelledby="image-processing" className="space-y-4">
            <h2 id="image-processing" className="text-xl font-bold tracking-tight sm:text-2xl">Browser-Based Image Processing</h2>
            <p className="max-w-4xl text-sm leading-relaxed text-foreground-secondary sm:text-base">Atoolix is designed around browser-based image workflows. For tools that process files locally, images can be handled on your device rather than uploaded to a remote conversion service. This can be useful for private photos, screenshots and other files you do not want to send to a third-party server.</p>
          </section>

          <section aria-labelledby="image-faq" className="space-y-4">
            <h2 id="image-faq" className="text-xl font-bold tracking-tight sm:text-2xl">Common Image Tool Questions</h2>
            <div className="space-y-5 text-sm leading-relaxed text-foreground-secondary sm:text-base">
              <div><h3 className="font-semibold text-foreground">What is the best image format for a website?</h3><p className="mt-1">It depends on the image and requirements. WebP is often useful for modern web delivery, JPG works well for many photographs, PNG is useful for graphics and transparency, and SVG is suited to scalable vector artwork.</p></div>
              <div><h3 className="font-semibold text-foreground">Should I convert an image or compress it?</h3><p className="mt-1">Convert when you need a different file format. Compress when the main goal is reducing file size. Some workflows benefit from both operations.</p></div>
              <div><h3 className="font-semibold text-foreground">Does converting an image improve its quality?</h3><p className="mt-1">Changing formats does not restore detail already lost by a lossy source format. Conversion changes how the image is encoded for a different workflow.</p></div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
