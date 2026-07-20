"use client";

import JSZip from "jszip";
import * as XLSX from "xlsx";

export type ExtractedKind =
  | "pdf"
  | "spreadsheet"
  | "slides"
  | "document"
  | "image"
  | "text"
  | "unknown";

export type ExtractedFile = {
  text: string;
  kind: ExtractedKind;
  method: string;
  ok: boolean;
};

function tidy(text: string): string {
  return text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function classify(file: File): ExtractedKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.includes("spreadsheet") || type.includes("excel") || /\.(xlsx|xlsm|xls|csv|tsv)$/.test(name)) return "spreadsheet";
  if (type.includes("presentation") || name.endsWith(".pptx")) return "slides";
  if (type.includes("wordprocessing") || name.endsWith(".docx")) return "document";
  if (type.startsWith("text/") || /\.(txt|md|markdown|rtf|json|log)$/.test(name)) return "text";
  return "unknown";
}

async function extractSpreadsheet(file: File): Promise<string> {
  if (/\.(csv|tsv)$/.test(file.name.toLowerCase())) return await file.text();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return `Sheet: ${name}\n${csv}`;
  }).join("\n\n");
}

function pullTags(xml: string, tag: string): string {
  const matches = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"));
  if (!matches) return "";
  return matches
    .map((chunk) => chunk.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function extractSlides(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });
  const slides = await Promise.all(slidePaths.map((path) => zip.files[path].async("string")));
  return slides.map((xml, index) => `Slide ${index + 1}: ${pullTags(xml, "a:t")}`).join("\n");
}

async function extractDocument(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docEntry = zip.files["word/document.xml"];
  if (!docEntry) return "";
  const xml = await docEntry.async("string");
  return pullTags(xml, "w:t");
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  try {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= doc.numPages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(line);
  }
  await doc.cleanup();
  return pages.join("\n");
}

async function extractImage(file: File): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "eng");
  return data.text ?? "";
}

export async function extractFileContent(file: File): Promise<ExtractedFile> {
  const kind = classify(file);
  const methodByKind: Record<ExtractedKind, string> = {
    pdf: "Read the PDF text",
    spreadsheet: "Read the spreadsheet rows",
    slides: "Read the slide text",
    document: "Read the document text",
    image: "Read the image with OCR",
    text: "Read the note text",
    unknown: "Read the file",
  };
  try {
    let text = "";
    if (kind === "spreadsheet") text = await extractSpreadsheet(file);
    else if (kind === "slides") text = await extractSlides(file);
    else if (kind === "document") text = await extractDocument(file);
    else if (kind === "pdf") text = await extractPdf(file);
    else if (kind === "image") text = await extractImage(file);
    else text = await file.text();
    const cleaned = tidy(text);
    return { text: cleaned, kind, method: methodByKind[kind], ok: cleaned.length > 0 };
  } catch {
    return { text: "", kind, method: methodByKind[kind], ok: false };
  }
}
