# Competitive Analysis

This is where NotebookLM's multi-source capability really pays off. Upload 10-Ks from 3-5 competitors and ask comparative questions that would take days to research manually.

---

## Setup

**Choose competitors wisely.** Pick companies that actually compete (similar products, same customers, comparable size). The 10-K business descriptions should overlap.

**Use the same filing years.** Compare FY2024 10-Ks to FY2024 10-Ks. Mixing years creates noise.

**Name files clearly.** `NVDA_10K_FY2024.pdf`, `AMD_10K_FY2024.pdf`, `INTC_10K_FY2024.pdf` — not `document.pdf`.

**One notebook.** Put all competitors in a single notebook for cross-company queries.

---

## High-Value Comparative Questions

### Competitive Positioning

```
How does each company describe its competitive advantages?
```

```
Compare how these companies describe their main competitors.
```

```
What differentiation strategies does each company emphasize?
```

### Shared vs. Unique Risks

```
Which risk factors appear in all companies' filings?
```

```
What risks are unique to each company?
```

```
How do they each discuss regulatory risk?
```

### Strategic Direction

```
Compare the R&D focus areas mentioned by each company.
```

```
How does each company discuss AI/machine learning in their strategy?
```

```
What growth strategies does each company outline?
```

### Business Model Differences

```
Compare the revenue breakdown by segment across companies.
```

```
How does each company describe its customer concentration?
```

```
What geographic revenue exposure does each company have?
```

---

## Example: Semiconductor Sector

**Sources:** NVDA 10-K, AMD 10-K, INTC 10-K, QCOM 10-K

**Comparative questions:**

```
How does each company describe the data center market opportunity?
```

```
Compare manufacturing strategies (fabless vs. integrated).
```

```
What does each company say about supply chain and manufacturing risks?
```

```
How do they each position themselves in the AI/ML chip market?
```

---

## Example: Retail Sector

**Sources:** WMT 10-K, TGT 10-K, COST 10-K

**Comparative questions:**

```
Compare e-commerce strategies across these retailers.
```

```
How does each describe labor costs and workforce challenges?
```

```
What supply chain strategies does each company discuss?
```

```
Compare store footprint strategies and real estate approaches.
```

---

## Tables and Structured Output

For side-by-side comparison:

```
Create a table comparing these companies on: revenue, main business segments, and geographic exposure.
```

```
Make a comparison table of the top 3 risk factors each company emphasizes.
```

> Remember: Numbers in tables should be verified. NotebookLM might misread figures.

---

## Finding Interesting Divergences

The most valuable insights are often where companies disagree:

```
Where do these companies' strategies diverge most significantly?
```

```
What risks does Company A emphasize that Company B downplays?
```

```
How do their views on the competitive landscape differ?
```

---

## Limitations for Competitive Analysis

**NotebookLM can't compare actual performance** — it doesn't calculate market share, relative growth rates, or financial ratios. It compares *what companies say about themselves*.

**Management narratives are biased** — Every company positions itself favorably. Comparing narratives shows positioning, not objective reality.

**What's not said matters** — If one company discusses a risk that competitors ignore, that's interesting either way.

---

## Workflow Example

1. **Add sources:** Upload 10-Ks for your sector (3-5 companies)

2. **Orient:** "Give me a one-sentence description of each company's primary business"

3. **Positioning:** "Compare how each describes competitive advantages"

4. **Risks:** "What risks are shared vs. unique to each company?"

5. **Strategy:** "Compare strategic priorities for the next few years"

6. **Divergences:** "Where do these companies disagree about market direction?"

7. **Deep dive:** Pick interesting divergences and ask follow-up questions

[Next: Due Diligence →](workflows/due-diligence.md)
