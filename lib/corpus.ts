import fs from "fs";
import path from "path";
import { CorpusChunk } from "./types";

const DOCS_DIR = path.join(process.cwd(), "corpus", "documents");

/**
 * Each source document lives in corpus/documents/*.md with a small frontmatter
 * block identifying where it actually came from, e.g.:
 *
 * ---
 * title: Financial Intelligence Centre Act 38 of 2001, Section 21 (CDD)
 * url: https://www.gov.za/documents/financial-intelligence-centre-act
 * ---
 * <the real section text goes here>
 *
 * This loader deliberately does NOT ship with fabricated regulatory text.
 * See corpus/documents/README.md for where to source the real documents —
 * a compliance tool that hallucinates its own source material is worse
 * than having no corpus at all.
 */
function parseFrontmatter(raw: string): { title: string; url: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { title: "Untitled source", url: "", body: raw };
  }
  const [, fm, body] = match;
  const title = fm.match(/title:\s*(.+)/)?.[1]?.trim() ?? "Untitled source";
  const url = fm.match(/url:\s*(.+)/)?.[1]?.trim() ?? "";
  return { title, url, body: body.trim() };
}

function chunkText(text: string, maxChars = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      const overlapTail = current.slice(-overlap);
      current = overlapTail + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function loadCorpusChunks(): CorpusChunk[] {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");

  const chunks: CorpusChunk[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), "utf-8");
    const { title, url, body } = parseFrontmatter(raw);
    const pieces = chunkText(body);
    pieces.forEach((text, i) => {
      chunks.push({
        id: `${file}::${i}`,
        text,
        sourceTitle: title,
        sourceUrl: url,
      });
    });
  }

  return chunks;
}
