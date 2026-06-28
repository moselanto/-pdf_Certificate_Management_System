"use client";

// ============================================================================
// Client-side PDF -> PNG raster, used to draw a template page as the editor
// background and as list thumbnails. The raster is ONLY a visual aid; the final
// certificate is always produced by the pdf-lib engine from the original PDF.
//
// We use the pdfjs-dist LEGACY build and DISABLE the separate web worker
// (disableWorker / fake worker). Bundling the pdf.js worker reliably is
// fragile across hosts (e.g. Codespaces), and a missing/blocked worker makes
// rendering hang forever ("Loading preview…"). Running on the main thread is
// slightly slower but works everywhere — perfectly fine for one-page thumbnails.
// ============================================================================

export interface RasterResult {
  dataUrl: string;
  /** Natural page size in PDF points (origin top-left for the editor). */
  widthPt: number;
  heightPt: number;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      // Empty workerSrc + disableWorker forces main-thread rendering.
      pdfjs.GlobalWorkerOptions.workerSrc = "";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Render the first page of a PDF (given as bytes or a URL) to a PNG data URL.
 * @param source  Uint8Array of PDF bytes OR a URL string to fetch.
 * @param scale   Raster scale factor (2 = retina-sharp backdrop).
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

  const doc = await pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const page = await doc.getPage(1);

  // viewport at scale 1 gives us the page size in points.
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
