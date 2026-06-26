// Compressione PDF portabile: usa Ghostscript se installato (compressione forte,
// es. in self-host/Docker), altrimenti un'ottimizzazione con pdf-lib. Restituisce
// sempre il file più piccolo (mai più grande dell'originale).

import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";

function gsBinary(): string | null {
  for (const b of ["gs", "gswin64c"]) {
    try {
      const r = spawnSync(b, ["--version"], { stdio: "ignore" });
      if (r.status === 0) return b;
    } catch {
      /* non disponibile */
    }
  }
  return null;
}

function viaGhostscript(gs: string, input: Buffer): Buffer | null {
  const inp = path.join(os.tmpdir(), `gsin-${Date.now()}.pdf`);
  const outp = path.join(os.tmpdir(), `gsout-${Date.now()}.pdf`);
  fs.writeFileSync(inp, input);
  try {
    const r = spawnSync(
      gs,
      [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.5",
        "-dPDFSETTINGS=/ebook", // ~150 dpi: buon compromesso leggibilità/peso
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${outp}`,
        inp,
      ],
      { stdio: "ignore" }
    );
    if (r.status === 0 && fs.existsSync(outp)) return fs.readFileSync(outp);
    return null;
  } finally {
    if (fs.existsSync(inp)) fs.unlinkSync(inp);
    if (fs.existsSync(outp)) fs.unlinkSync(outp);
  }
}

export async function compressPdf(input: Buffer): Promise<Buffer> {
  let best = input;

  const gs = gsBinary();
  if (gs) {
    try {
      const out = viaGhostscript(gs, input);
      if (out && out.length > 0 && out.length < best.length) best = out;
    } catch {
      /* fallback sotto */
    }
  }

  try {
    const doc = await PDFDocument.load(input, { ignoreEncryption: true });
    const bytes = await doc.save({ useObjectStreams: true });
    const buf = Buffer.from(bytes);
    if (buf.length > 0 && buf.length < best.length) best = buf;
  } catch {
    /* tieni best */
  }

  return best;
}
