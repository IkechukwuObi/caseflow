# Adding case documents

This tool searches and summarizes case documents (loan applications, account
opening forms, customer disputes, and similar case-file paperwork), the same
shape of problem Absa's own AI/OCR Gateway solves in their Debt Review unit,
generalized here as a portfolio build.

Three clearly-labeled **synthetic** sample cases ship in this folder so the
pipeline runs end-to-end out of the box. They are fictional, invented for
this demo, and must stay that way in anything public-facing — do not present
them as real bank data. Replace or extend them with your own realistic (but
still synthetic, unless you have explicit rights to real anonymized data)
case documents as you build this out.

Format, same frontmatter pattern as before:

```
---
title: Loan Application — J. Mokoena (SYNTHETIC DEMO DATA)
url: internal://synthetic-demo/loan-application-1
---

<case document text>
```

After adding or changing documents, run `npm run ingest` to rebuild the index.
