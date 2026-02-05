# Critical Limitations

This might be the most important page in this guide. Know what NotebookLM can't do before you rely on it.

---

## The Big Three

### 1. NotebookLM Cannot Do Math

This is absolute. It cannot:
- Calculate financial ratios
- Compute growth rates
- Add up numbers
- Verify that figures sum correctly
- Convert currencies
- Do any arithmetic at all

If NotebookLM gives you a calculated result, it's either:
- A number it found in the source (lucky)
- A number it made up (not lucky)

**Rule:** Extract the raw numbers, do calculations yourself.

---

### 2. NotebookLM Cannot See Images

Anything visual is invisible:
- Charts and graphs
- Infographics
- Logos
- Scanned text that wasn't OCR'd
- Embedded images in PDFs

A beautiful revenue growth chart contributes zero information. NotebookLM doesn't know it exists.

**Rule:** If important data is only in a chart, you need to read it yourself.

---

### 3. NotebookLM Makes Mistakes with Tables

This is the sneakiest problem. NotebookLM can *kind of* read tables, but often:
- Misaligns columns
- Confuses row headers
- Mixes up time periods (puts 2023 numbers in 2024's column)
- Misreads multi-level headers
- Gets confused by merged cells
- Misinterprets formatting (thousands vs. millions vs. billions)
- Reads parentheses as negative numbers inconsistently

**Rule:** Never trust a number from NotebookLM without checking the original.

---

## Other Important Limitations

### No Internet Access

NotebookLM only knows what's in your sources. It cannot:
- Look up current stock prices
- Check what happened after your documents were filed
- Verify claims against external sources
- Access analyst reports you haven't uploaded

### No Memory Between Notebooks

Each notebook is isolated. NotebookLM doesn't remember:
- What you researched in other notebooks
- Patterns across your research history
- Your preferences from past sessions

### Forward-Looking Statement Warnings

NotebookLM will quote management's forward-looking statements. It won't:
- Flag them as predictions vs. facts
- Assess their reliability
- Track whether past predictions came true

That's your job.

### Source Quality Pass-Through

NotebookLM treats all sources equally. If you upload:
- A biased press release
- An outdated document
- An inaccurate article

NotebookLM will cite it confidently. It has no way to assess source credibility.

---

## Hallucination: Reduced, Not Eliminated

NotebookLM's citation system dramatically reduces hallucination compared to ChatGPT. But it's not zero.

**Ways NotebookLM can still mislead:**

**Synthesis errors.** Combines information from multiple sources incorrectly.

**Inference leaps.** Draws conclusions not explicitly stated, presenting them as facts.

**Citation mismatch.** Points to a relevant passage, but the summary doesn't quite match what the passage says.

**Paraphrasing drift.** Rephrases in a way that subtly changes meaning.

**Confidence without certainty.** States things confidently even when sources are ambiguous.

---

## The Verification Habit

For investment research, make this automatic:

| Type of Information | Verification Level |
|--------------------|-------------------|
| Qualitative themes | Trust with cited spot-checks |
| Management quotes | Click citation, verify wording |
| Financial numbers | Always check original source |
| Calculated metrics | Do the math yourself |
| Comparisons | Verify each source separately |

---

## What NotebookLM is NOT Suitable For

- **Precision financial analysis** requiring exact figures
- **Any math** (DCF, ratio analysis, trend calculations)
- **Chart or graph interpretation**
- **Real-time decisions** based on current prices/data
- **Compliance/regulatory** work where errors have legal consequences
- **Automated workflows** without human verification

---

## The Right Mental Model

Think of NotebookLM as a **very fast research assistant with reading comprehension issues**.

It can:
- Scan 500 pages in seconds
- Find relevant passages
- Summarize themes
- Point you to the right sections

It cannot:
- Think critically about what it reads
- Verify accuracy
- Do arithmetic
- Interpret visual data
- Know anything beyond your sources

Use it as an accelerator, not a replacement for your own analysis.

[Next: What to Always Verify →](limits/verification.md)
