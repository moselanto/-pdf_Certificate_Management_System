"use client";

// ============================================================================
// Client-side PDF -> PNG raster, used to draw a template page as the editor
// background. We render with pdf.js in the browser so we don't need a native
// rendering binary on the server. The raster is ONLY a visual backdrop for
// drag-and-drop; the final certificate is always produced by the pdf-lib
// engine from the original uploaded PDF (no quality loss).
//
// pdf.js is loaded lazily so it never enters the server bundle.
// ============================================================================

export interface RasterResult {
  dataUrl: string;
  /** Natural page size in PDF points (origin top-left for the editor). */
  widthPt: number;
  heightPt: number;
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
  // Lazy import keeps pdf.js out of the server bundle.
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker.
  // @ts-expect-error - worker entry provided by pdfjs-dist
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;

  const data =
    typeof source === "string"
      ? new Uint8Array(await (await fetch(source)).arrayBuffer())
      : source;

  const doc = await pdfjs.getDocument({ data }).promise;
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
