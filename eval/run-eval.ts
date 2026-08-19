import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { retrieve } from "../lib/retrieve";

interface EvalQuestion {
  question: string;
  expectedSourceTitle: string;
  expectedKeywords: string[];
}

async function main() {
  const datasetPath = path.join(process.cwd(), "eval", "dataset.json");
  const { questions } = JSON.parse(fs.readFileSync(datasetPath, "utf-8")) as {
    questions: EvalQuestion[];
  };

  if (questions.length === 0) {
    console.error(
      "\neval/dataset.json has no questions yet. Add real questions with " +
        "expectedSourceTitle values that match documents in corpus/documents/ " +
        "before running this.\n"
    );
    process.exit(1);
  }

  let hits = 0;
  for (const q of questions) {
    const results = await retrieve(q.question, 5);
    const found = results.some((r) => r.chunk.sourceTitle === q.expectedSourceTitle);
    const keywordHit = results.some((r) =>
      q.expectedKeywords.every((kw) => r.chunk.text.toLowerCase().includes(kw.toLowerCase()))
    );
    const pass = found && keywordHit;
    if (pass) hits++;
    console.log(`[${pass ? "PASS" : "FAIL"}] ${q.question}`);
    if (!pass) {
      console.log(`  expected source: ${q.expectedSourceTitle}`);
      console.log(`  top result was:  ${results[0]?.chunk.sourceTitle ?? "none"}`);
    }
  }

  console.log(`\n${hits}/${questions.length} passed (${Math.round((hits / questions.length) * 100)}%)`);
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
