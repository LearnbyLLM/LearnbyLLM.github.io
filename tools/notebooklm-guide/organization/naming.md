# Naming Conventions

Clear naming prevents confusion. NotebookLM uses your filenames to identify sources in citations.

---

## File Naming

### SEC Filings

```
[TICKER]_[FORM]_[PERIOD].pdf

AAPL_10K_FY2024.pdf
MSFT_10Q_Q1FY2025.pdf
NVDA_8K_20250115.pdf
GOOGL_DEF14A_2024.pdf
```

### Earnings Materials

```
[TICKER]_Earnings_[QUARTER][YEAR].pdf

AAPL_Earnings_Q1FY2025.pdf
AMZN_Earnings_Q4FY2024_Transcript.pdf
```

### Other Documents

```
[TICKER]_[DOCTYPE]_[DATE].pdf

AAPL_InvestorDay_2024.pdf
MSFT_AnalystPresentation_Mar2025.pdf
Industry_AI_Report_2024.pdf
```

---

## Notebook Naming

### Company-Focused

```
[TICKER] Research
[TICKER] Deep Dive
[COMPANY NAME] Analysis
```

Examples:
- `AAPL Research`
- `Nvidia Deep Dive`
- `Microsoft Analysis`

### Sector/Comparative

```
[SECTOR] Comparison
[THEME] Analysis
```

Examples:
- `Semiconductor Comparison`
- `Cloud Infrastructure Analysis`
- `Retail Q4 2024`

### Project-Based

```
[THESIS/PROJECT NAME]
```

Examples:
- `AI Infrastructure Thesis`
- `Consumer Discretionary Screen`
- `Dividend Stocks Due Diligence`

---

## Why This Matters

When NotebookLM cites sources, it shows the filename:

> According to the risk factors in **NVDA_10K_FY2024** [1]...

vs.

> According to the risk factors in **document(3)** [1]...

Clear names make verification faster and answers easier to understand.

---

## Quick Reference

| Document Type | Format |
|--------------|--------|
| 10-K | `TICKER_10K_FYXXXX` |
| 10-Q | `TICKER_10Q_QXFYXXXX` |
| 8-K | `TICKER_8K_YYYYMMDD` |
| Proxy | `TICKER_DEF14A_XXXX` |
| Earnings | `TICKER_Earnings_QXFYXXXX` |
| Transcript | `TICKER_Transcript_QXFYXXXX` |
| Presentation | `TICKER_[Type]_YYYY` |

---

## Rename Before Upload

Most downloaded SEC filings have terrible names like `0000320193-24-000081.pdf`.

Take 10 seconds to rename before uploading. Future you will be grateful.

[Next: Troubleshooting →](troubleshooting.md)
