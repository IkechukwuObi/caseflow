# Adding real source documents

This directory is intentionally empty of regulatory content at scaffold time.
Do not fill it with AI-generated "sample circulars" or invented statute text —
this tool answers compliance questions, and made-up source material is the one
failure mode that can't be papered over with a caveat later.

Add real, current documents as `.md` files with this frontmatter format:

```
---
title: Financial Intelligence Centre Act 38 of 2001 — Section 21 (Customer Due Diligence)
url: https://www.gov.za/documents/financial-intelligence-centre-act
---

<the actual text of the section, copied from the official source>
```

Good starting sources for the initial corpus:

- Financial Intelligence Centre Act (FICA) and amendments — gov.za / financialintelligencecentre.gov.za
- SARB Prudential Authority guidance notes and directives — resbank.co.za (Prudential Authority section)
- POPIA (Protection of Personal Information Act), especially the cross-border transfer provisions (Chapter 9) — justice.gov.za / info.gov.za
- The Joint Standard on Cybersecurity and Cyber Resilience (2025) — referenced in Absa's own Integrated Report as an active compliance requirement

Keep each source document focused (one Act, one circular, one standard per file)
so citations in the app point to something specific rather than a 200-page PDF.

After adding documents, run `npm run ingest` to (re)build the retrieval index.
