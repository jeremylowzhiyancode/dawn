import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type ExtractedFileText = {
  text: string;
  note: string;
};

const TEXT_EXTENSIONS = ["txt", "md", "csv", "json"];
const SPREADSHEET_EXTENSIONS = ["xlsx", "xls"];
const OFFICE_XML_EXTENSIONS = ["docx", "pptx"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

export async function extractTextFromFile(file: File): Promise<ExtractedFileText> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  try {
    if (TEXT_EXTENSIONS.includes(extension)) {
      return { text: await file.text(), note: "Text extracted locally." };
    }

    if (SPREADSHEET_EXTENSIONS.includes(extension)) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const text = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      }).join("\n\n");
      return { text, note: "Spreadsheet text extracted locally." };
    }

    if (OFFICE_XML_EXTENSIONS.includes(extension)) {
      const archive = await JSZip.loadAsync(await file.arrayBuffer());
      const paths =
        extension === "docx"
          ? ["word/document.xml"]
          : Object.keys(archive.files)
              .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
              .sort();
      const parts = await Promise.all(paths.map(async (path) => xmlToText((await archive.file(path)?.async("text")) ?? "")));
      return {
        text: parts.filter(Boolean).join("\n\n"),
        note: extension === "docx" ? "Word text extracted locally." : "PowerPoint slide text extracted locally.",
      };
    }

    if (extension === "pdf") {
      return extractPdfText(file);
    }

    if (IMAGE_EXTENSIONS.includes(extension) || file.type.startsWith("image/")) {
      return extractImageText(file);
    }

    if (extension === "canva") {
      return { text: "", note: "Export this Canva design as PDF, PPTX, or PNG, then upload that export for extraction." };
    }

    return { text: "", note: "This file was stored, but its text format is not yet supported." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return { text: "", note: `Could not read this file yet (${message}). It is still stored for traceability.` };
  }
}

async function extractPdfText(file: File): Promise<ExtractedFileText> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) pages.push(line);
    }

    const text = pages.join("\n\n").trim();
    if (text) {
      return { text, note: "PDF text extracted locally." };
    }

    // Scanned / image-only PDF: OCR the first page so the demo still works.
    const ocrText = await ocrPdfFirstPage(pdf);
    if (ocrText) {
      return { text: ocrText, note: "Scanned PDF read with on-device OCR (first page)." };
    }

    return { text: "", note: "This PDF has no readable text yet. Try a text PDF or a clearer scan." };
  } catch {
    const fallback = extractEmbeddedPdfText(bytes);
    return {
      text: fallback,
      note: fallback
        ? "PDF text extracted with a simple local reader."
        : "This PDF could not be read yet. Try exporting again as a text PDF.",
    };
  }
}

async function ocrPdfFirstPage(pdf: PDFDocumentProxy) {
  if (typeof document === "undefined") return "";
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return "";
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "";
  return (await runOcr(blob)).trim();
}

async function extractImageText(file: File): Promise<ExtractedFileText> {
  const text = (await runOcr(file)).trim();
  return {
    text,
    note: text ? "Image text read with on-device OCR." : "Image stored. No clear text was found for OCR.",
  };
}

async function runOcr(source: File | Blob) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(source);
    return text;
  } finally {
    await worker.terminate();
  }
}

function xmlToText(xml: string) {
  return xml
    .replace(/<w:tab\/>|<a:br\/>|<w:br\/>/g, " ")
    .replace(/<\/w:p>|<\/a:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmbeddedPdfText(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  const fragments = [...raw.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)].map((match) =>
    match[0].replace(/^\(|\)\s*Tj$/g, "").replace(/\\([()\\])/g, "$1"),
  );
  const tjArrays = [...raw.matchAll(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*TJ/g)].flatMap((match) =>
    [...match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((piece) => piece[0].slice(1, -1).replace(/\\([()\\])/g, "$1")),
  );
  return [...fragments, ...tjArrays].join(" ").replace(/\s+/g, " ").trim();
}
