# Adding Sources

Everything NotebookLM knows comes from your sources. Here's what you can add and the limits to know.

---

## Supported Source Types

| Type | Good For | Notes |
|------|----------|-------|
| **PDF** | 10-Ks, annual reports, research | Up to 200MB, ~2000 pages max |
| **Google Docs** | Notes, copied transcripts | Syncs if you update the doc |
| **Google Slides** | Investor presentations | Extracts text from slides |
| **URLs/Websites** | Articles, IR pages | Captures text at time of adding |
| **YouTube** | Earnings calls with video | Uses the transcript, not audio |
| **Text files** | Plain text, CSVs | Basic but works |
| **Audio files** | Podcasts, recordings | Auto-transcribes |

---

## Limits

- **50 sources** per notebook
- **500,000 words** per source (plenty for most documents)
- **200 MB** max file size

For investment research, these limits are rarely a problem. You can fit multiple years of 10-Ks, quarterly reports, and earnings transcripts in one notebook.

---

## What Works Well

**SEC filings as PDFs** — The standard format. Download from EDGAR, upload directly. Works consistently.

**Earnings call transcripts** — Copy from Seeking Alpha, FactSet, or company IR sites. Paste into Google Docs or save as text files.

**Investor presentations** — PDF or Google Slides. NotebookLM extracts the text (but not charts/images).

**News articles** — Add via URL. Good for context, but remember NotebookLM can't fact-check claims.

---

## What Doesn't Work Well

**Excel files** — Not supported. Convert key data to text/CSV if needed, but expect limited usefulness.

**Scanned PDFs** — If the PDF is just images of pages (not searchable text), NotebookLM can't read it. Most SEC filings are searchable, but check.

**Paywalled content** — URLs behind logins won't work. Copy-paste to Google Docs instead.

**Images and charts** — NotebookLM cannot see any visual content. A beautiful infographic contributes zero information.

---

## Source Organization Tips

**Name files clearly before uploading.** NotebookLM uses your filenames to identify sources. `AAPL_10K_FY2024.pdf` is better than `document(1).pdf`.

**Keep related sources together.** If you're analyzing a company, put all their filings in one notebook rather than spreading across multiple.

**Remove outdated sources.** If you upload a newer 10-K, consider removing the old one to avoid confusion in answers (unless you specifically want to compare).

---

## Adding vs. Replacing

When you add a new source, NotebookLM incorporates it alongside existing sources. It doesn't replace anything automatically.

If you upload an updated version of the same document, you'll have duplicates. Delete the old one manually if you don't need it.

---

## When Sources Fail to Process

Sometimes a PDF won't process correctly. Common causes:

- **Password protected** — Remove protection first
- **Corrupted file** — Try re-downloading
- **Scanned images** — Run OCR first, or find a searchable version
- **Too large** — Split into smaller files

[Next: Asking Good Questions →](core/asking-questions.md)
