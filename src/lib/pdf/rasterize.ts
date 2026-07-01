"use client";

// ============================================================================
// Client-side PDF -> PNG raster, used for template thumbnails and the editor
// backdrop. The raster is ONLY a visual aid; the final certificate is always
// produced by the pdf-lib engine from the original PDF.
//
// Worker handling: pdf.js REQUIRES a workerSrc (an empty string throws
// "No GlobalWorkerOptions.workerSrc specified"). We point workerSrc at the
// pinned CDN copy of the worker matching the installed pdfjs-dist version.
//
// IMPORTANT: do NOT resolve the worker via
//   new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url)
// That makes webpack copy the pre-minified .mjs worker into the build output,
// where Next.js's production Terser pass re-parses it as a script and fails
// with "'import' and 'export' cannot be used outside of module code",
// breaking `next build`. The CDN URL avoids the bundler touching the worker.
// ============================================================================

// Pinned to the installed pdfjs-dist version (see package.json: 4.0.379).
const PDF_WORKER_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

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

    // Point the worker at the pinned CDN build. This is resolved at runtime by
    // the browser, so the bundler never processes (and Terser never chokes on)
    // the pre-minified .mjs worker file.
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;

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
