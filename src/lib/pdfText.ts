// Pull plain text out of a PDF, in the browser. Shared by the Debt page's
// import panel and the Credit Report page's uploader.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Rebuild line breaks: pdfjs flags the last piece of each line with hasEOL.
    for (const it of content.items) {
      if (!("str" in it)) continue;
      text += it.str + (it.hasEOL ? "\n" : " ");
    }
    text += "\n";
  }
  return text;
}
