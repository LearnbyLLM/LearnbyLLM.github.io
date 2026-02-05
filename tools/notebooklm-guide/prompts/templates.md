# Templates

Copy these templates for common research tasks. Fill in the brackets with your specifics.

---

## Notebook Guide (System Prompt)

Set this in the Notebook Guide panel for persistent context:

### For Single Company Research

```
This notebook contains SEC filings and earnings materials for [COMPANY NAME].

Focus areas:
- Financial performance and metrics
- Competitive positioning
- Risk factors and management outlook
- Strategic initiatives

Guidelines:
- Include source citations for all claims
- Flag forward-looking statements
- Use tables for numerical comparisons
- Note when information is uncertain or incomplete
```

### For Competitive Analysis

```
This notebook contains 10-K filings for [SECTOR] companies: [COMPANY A], [COMPANY B], [COMPANY C].

Focus areas:
- Comparative competitive positioning
- Shared vs. unique risk factors
- Strategic differentiation
- Market opportunity sizing

Guidelines:
- When comparing, address all companies
- Include source citations
- Note areas of agreement and disagreement
- Flag where disclosure approaches differ
```

---

## 10-K Analysis Sequence

Run through these in order for a complete analysis:

```
1. Give me a 5-sentence overview of [COMPANY]'s business based on this 10-K.
```

```
2. How does [COMPANY] make money? Break down the revenue streams and segments.
```

```
3. What does [COMPANY] describe as its competitive advantages?
```

```
4. List the top 10 risk factors, grouped by category.
```

```
5. What does management say about the competitive landscape?
```

```
6. Summarize the MD&A section. What does management emphasize about this year's performance?
```

```
7. What forward-looking statements does management make about growth?
```

```
8. Are there any related party transactions, legal proceedings, or internal control issues disclosed?
```

---

## Earnings Call Analysis Sequence

```
1. What were the key highlights from management's prepared remarks?
```

```
2. What specific guidance was provided for next quarter and full year?
```

```
3. Summarize the analyst Q&A. What themes emerged from analyst questions?
```

```
4. What did management say about [SPECIFIC TOPIC: margins/growth/competition]?
```

```
5. Were there any surprises or notable statements?
```

---

## Year-Over-Year Comparison

For notebooks with multiple years of filings:

```
Comparing the [YEAR A] and [YEAR B] 10-Ks:
1. What new risk factors were added?
2. What risk factors were removed?
3. How has the strategic narrative changed?
4. What new business developments are discussed?
```

---

## Competitive Comparison

For notebooks with multiple companies:

```
Comparing [COMPANY A], [COMPANY B], and [COMPANY C]:

1. How does each describe its competitive advantages?
```

```
2. What risk factors appear in all filings vs. unique to each company?
```

```
3. How does each company discuss [TOPIC: AI strategy / pricing / market position]?
```

```
4. Create a comparison table showing each company's:
   - Primary business description
   - Key segments
   - Main competitive positioning
```

---

## Due Diligence Checklist

```
Due diligence review. For each item, cite the relevant disclosure:

1. Related party transactions
2. Legal proceedings pending
3. Customer concentration (any single customer >10%)
4. Supplier concentration
5. Debt covenants and compliance
6. Material weaknesses in internal controls
7. Going concern language
8. Auditor qualifications
9. Changes in accounting policies
10. Recent management changes
```

---

## Quick Summary Templates

### Bullish/Bearish

```
Based on this 10-K:
1. What are the 3 strongest points supporting a bullish thesis?
2. What are the 3 biggest risks or concerns for a bearish thesis?
Include citations.
```

### Executive Summary

```
Create a one-paragraph executive summary of this company suitable for someone with 2 minutes to read it.
```

### Key Metrics Extraction

```
Extract and list all key financial metrics mentioned:
- Revenue and revenue growth
- Margins (gross, operating, net)
- Cash flow figures
- Debt levels
- Any guidance provided

Note: I will verify these numbers against the original document.
```

---

## Format Modifiers

Add to any prompt:

| Want | Add |
|------|-----|
| Bullet points | `Format as bullet points.` |
| Table | `Present in a table.` |
| Brief | `In 3 sentences or less.` |
| Detailed | `Be comprehensive.` |
| Citations | `Include source citations.` |
| Quotes | `Quote the exact language.` |

[Next: Critical Limitations →](limits/limitations.md)
