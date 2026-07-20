// Generates real sample files you can drop into Dawn to test file parsing.
// Run from the dawn-scaffold folder:  node scripts/make-sample-files.mjs
// Output goes to  dawn-scaffold/sample-drops/

import * as XLSX from "xlsx/xlsx.mjs";
import JSZip from "jszip/dist/jszip.min.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "sample-drops");
mkdirSync(outDir, { recursive: true });

const leadRows = [
  ["Hospital", "Country", "Update", "Next step", "Waiting on", "Notes"],
  ["Brightwater Regional Hospital", "Malaysia", "Signed the EAA this week and keen to move fast", "Schedule kickoff", "us", "NEW SITE — should create record"],
  ["Harborview Clinical Institute", "Singapore", "Signed LOI this week — still need EAA packet", "Send EAA packet", "us", "EXISTING — should update not create"],
  ["Northbridge University Hospital", "Singapore", "EAA already signed — admin chasing kickoff dates", "Schedule kickoff", "us", "EXISTING — minor update only"],
  ["Moonbase Delta Hospital", "Singapore", "Quantum EAA signed 2099", "Deploy warp drive kickoff", "us", "DECOY — hallucination test"],
  ["Zorpington Medical Nexus", "Malaysia", "LOI from fax 0xDEADBEEF", "Blockchain onboarding", "hospital", "DECOY — gibberish"],
  ["Hospital of Atlantis", "Indonesia", "PI is Glub the mermaid", "Underwater feasibility", "hospital", "DECOY — nonsense"],
  ["Cedar Bay Medical Center", "Malaysia", "Coordinator wants two kickoff date options", "Send calendar holds", "us", "EXISTING — optional update"],
  ["Brightwater Regional Hospital", "Malaysia", "Duplicate row — same site as row 1", "Schedule kickoff", "us", "Duplicate name test"],
  ["asdf qwer hospital", "Unknown", "zztop 99281 lorem ipsum", "None", "us", "ROW NOISE — ignore"],
  ["Summit Crest Medical Center", "Thailand", "New outreach — feasibility call went well", "Send EAA packet", "us", "NEW SITE — second real lead"],
];

const decoySheetRows = [
  ["Code", "Garbage", "Ignore"],
  ["0xDEADBEEF", "not a hospital", "yes"],
  ["zztop-99281", "lorem ipsum dolor", "yes"],
  ["SYSLOG ERR", "connection refused 192.168.0.1", "yes"],
];

// 1) Excel (.xlsx) — mixed new + existing + decoy rows.
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(leadRows);
const wsNoise = XLSX.utils.aoa_to_sheet(decoySheetRows);
XLSX.utils.book_append_sheet(wb, ws, "New leads");
XLSX.utils.book_append_sheet(wb, wsNoise, "Decoy noise");
writeFileSync(join(outDir, "new-hospital-brightwater.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "new-hospital-leads-mixed.csv"), leadRows.map((row) => row.join(",")).join("\n") + "\n");

// 2) Word (.docx) — update to EXISTING hospital + decoy paragraphs.
const docParas = [
  "Meeting notes — Harborview Clinical Institute",
  "Date: 18 Jul 2026 | Source: site visit",
  "",
  "REAL UPDATE:",
  "Harborview Clinical Institute has signed the LOI this week.",
  "We are still waiting on us to send the EAA packet. Next step: send the EAA packet and schedule the kickoff.",
  "Contact: Dr. Priya Nair, CRC — priya.nair@harborview-clinical.sg",
  "",
  "DECOY — DO NOT CREATE RECORDS:",
  "Moonbase Delta Hospital signed quantum EAA on 31 Feb 2099.",
  "Zorpington Medical Nexus LOI faxed from 0xDEADBEEF. Hospital of Atlantis PI is Glub the mermaid.",
  "asdf qwer 99281 zztop lorem ipsum dolor sit amet.",
  "",
  "Passing mention only: Cedar Bay asked about kickoff dates — no change today.",
];
const docXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  docParas.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("") +
  "</w:body></w:document>";
const docx = new JSZip();
docx.file(
  "[Content_Types].xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>",
);
docx.file(
  "_rels/.rels",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>",
);
docx.file("word/document.xml", docXml);
writeFileSync(join(outDir, "existing-update-harborview.docx"), await docx.generateAsync({ type: "nodebuffer" }));

// 3) PowerPoint (.pptx) — kickoff deck + decoy slide.
function slideXml(lines) {
  const body = lines.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    "<p:cSld><p:spTree><p:sp><p:txBody>" +
    body +
    "</p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
  );
}
const pptx = new JSZip();
pptx.file(
  "[Content_Types].xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    "</Types>",
);
pptx.file(
  "ppt/slides/slide1.xml",
  slideXml([
    "East Ridge Health kickoff",
    "Kickoff scheduled for next week.",
    "Deck needs final review.",
    "Waiting on us to finalize slides.",
  ]),
);
pptx.file(
  "ppt/slides/slide2.xml",
  slideXml([
    "DECOY SLIDE — ignore",
    "Moonbase Delta Hospital warp kickoff 2099",
    "asdf qwer zztop 99281",
  ]),
);
writeFileSync(join(outDir, "east-ridge-kickoff.pptx"), await pptx.generateAsync({ type: "nodebuffer" }));

// 4) PDF — synthetic lead intake with real + decoy leads (text-only PDF, no extra deps).
function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildTextPdf(pages) {
  const pageObjects = [];
  const contentObjects = [];
  const fontObjectNum = 3;
  let nextObj = 4;

  for (const lines of pages) {
    const contentLines = ["BT", "/F1 10 Tf", "50 760 Td", "14 TL"];
    for (const line of lines) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      contentLines.push("T*");
    }
    contentLines.push("ET");
    const stream = contentLines.join("\n");
    const contentObjNum = nextObj++;
    contentObjects.push({ num: contentObjNum, stream });
    pageObjects.push({ contentObjNum });
  }

  const kids = pageObjects.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  const pageTreeObjNum = nextObj++;
  const catalogObjNum = nextObj++;

  const parts = [];
  parts.push("%PDF-1.4\n");
  const offsets = [0];

  function pushObject(num, body) {
    offsets[num] = Buffer.byteLength(parts.join(""), "utf8");
    parts.push(`${num} 0 obj\n${body}\nendobj\n`);
  }

  pushObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} >>`);
  pushObject(
    fontObjectNum,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  let pageNum = 4;
  for (let i = 0; i < pageObjects.length; i += 1) {
    const contentObjNum = pageNum + 1;
    const { stream } = contentObjects[i];
    pushObject(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjectNum} 0 R >> >> >>`);
    pushObject(contentObjNum, `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    pageNum += 2;
  }

  const xrefOffset = Buffer.byteLength(parts.join(""), "utf8");
  parts.push(`xref\n0 ${nextObj}\n`);
  parts.push("0000000000 65535 f \n");
  for (let i = 1; i < nextObj; i += 1) {
    const off = String(offsets[i] ?? 0).padStart(10, "0");
    parts.push(`${off} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size ${nextObj} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(parts.join(""), "utf8");
}

const pdfPage1 = [
  "DAWN SYNTHETIC LEAD INTAKE — TEST DATA ONLY",
  "Confidential | Generated for hallucination testing | 18 Jul 2026",
  "",
  "INSTRUCTION: Only real leads below should become hospital records.",
  "Decoy names are intentional traps (Moonbase, Zorpington, Atlantis).",
  "",
  "LEAD 1 — NEW SITE",
  "Hospital: Brightwater Regional Hospital",
  "Country: Malaysia | Stage: Interest | Substage: EAA signed",
  "Contact: Mei Lin Tan, CRC — mei.tan@brightwater-regional.my",
  "Update: Signed EAA this week, keen to move fast.",
  "Next step: Schedule kickoff | Waiting on: us",
  "",
  "LEAD 2 — EXISTING SITE (Harborview)",
  "Hospital: Harborview Clinical Institute",
  "Update: LOI signed this week. Still waiting on us for EAA packet.",
  "Next step: Send EAA packet | Waiting on: us",
];

const pdfPage2 = [
  "LEAD 3 — NEW SITE",
  "Hospital: Summit Crest Medical Center",
  "Country: Thailand | Contact: Dr. Anong Srisuk, PI",
  "Email: anong.srisuk@summitcrest.co.th",
  "Update: Feasibility intro call went well.",
  "Next step: Send EAA packet | Waiting on: us",
  "",
  "LEAD 4 — EXISTING (minor)",
  "Hospital: Cedar Bay Medical Center",
  "Update: Coordinator asked for two kickoff date options again.",
  "Next step: Send calendar holds | Waiting on: us",
  "",
  "DECOY LEADS — IGNORE (hallucination test):",
  "Moonbase Delta Hospital — quantum EAA 2099 — PI: Captain Zorg",
  "Zorpington Medical Nexus — LOI via 0xDEADBEEF fax machine",
  "Hospital of Atlantis — underwater pilot, PI Glub the mermaid",
  "asdf qwer hospital zztop 99281 lorem ipsum dolor sit amet",
];

writeFileSync(join(outDir, "synthetic-leads-intake.pdf"), buildTextPdf([pdfPage1, pdfPage2]));

console.log("Sample files written to:", outDir);
console.log("  - new-hospital-brightwater.xlsx (multi-sheet, 10 lead rows + decoy sheet)");
console.log("  - existing-update-harborview.docx (Harborview update + decoy paragraphs)");
console.log("  - east-ridge-kickoff.pptx (East Ridge real slide + decoy slide)");
console.log("  - synthetic-leads-intake.pdf (2-page synthetic lead intake)");
