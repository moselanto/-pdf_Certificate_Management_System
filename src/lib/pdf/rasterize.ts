"use client";

// ============================================================================
// Client-side PDF -> PNG raster, used for template thumbnails and the editor
// backdrop. The raster is ONLY a visual aid; the final certificate is always
// produced by the pdf-lib engine from the original PDF.
//
// Worker handling: pdf.js REQUIRES a workerSrc (an empty string throws
// "No GlobalWorkerOptions.workerSrc specified"). Bundling the worker file URL
// is fragile across hosts (Codespaces), so we instead fetch the worker script
// that ships inside pdfjs-dist, wrap it in a Blob, and point workerSrc at that
// Blob URL. This works in any browser without relying on the bundler resolving
// a `?url` import, and avoids the main-thread "no worker" error.
// ============================================================================

export interface RasterResult {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function getPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Build a Blob URL for the worker from the file shipped in pdfjs-dist.
    // import.meta.url lets us resolve the worker relative to the pdf.js module
    // in node_modules. We fetch it and wrap it in a Blob so no bundler magic
    // or external CDN is needed.
    try {
      const workerUrl = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      );
      const res = await fetch(workerUrl);
      const code = await res.text();
      const blob = new Blob([code], { type: "text/javascript" });
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch {
      // Last-resort fallback: pinned CDN worker matching the installed version.
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
    }

    return pdfjs;
  })();

  return pdfjsPromise;
}

/**
 * Render the first page of a PDF (bytes or URL) to a PNG data URL.
 */
export async function rasterizeFirstPage(
  source: Uint8Array | string,
  scale = 2,
): Promise<RasterResult> {
  const pdfjs = await getPdfjs();

  const data =
    typeof source === "string"
      ? new Uint8Array(await (await fetch(source)).arrayBuffer())
      : source;

  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not get 2d canvas context");

  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthPt: base.width,
    heightPt: base.height,
  };
}
