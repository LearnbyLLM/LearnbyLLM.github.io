# Analyzing 10-K Filings

The 10-K is the most comprehensive public document about a company. It's also 100-300 pages long. NotebookLM makes it usable.

---

## Setup

**Get the filing:** Download from [SEC EDGAR](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-K) as PDF. Use "Complete submission text file" for the full document.

**Create a notebook:** One company per notebook, or group competitors together for comparison.

**Upload:** Add the PDF. Wait for processing (~1 minute for a typical 10-K).

---

## Section-by-Section Analysis

A 10-K has standard sections. Here's how to extract value from each:

### Item 1: Business Description

```
Summarize what this company does and how it makes money.
```

```
What are the main products/services and customer segments?
```

```
How does the company describe its competitive advantages?
```

### Item 1A: Risk Factors

This is gold for understanding what could go wrong.

```
List all risk factors, grouped by category.
```

```
Which risk factors are new compared to last year's filing?
```

```
What does management say about [specific risk: supply chain / regulation / competition]?
```

### Item 7: Management Discussion & Analysis (MD&A)

Management's narrative about performance and outlook.

```
Summarize management's explanation of this year's financial results.
```

```
What forward-looking statements does management make?
```

```
How does management explain changes in profitability?
```

### Item 8: Financial Statements

> ⚠️ **Caution:** NotebookLM struggles with tables. Use these questions for context, but verify all numbers manually.

```
What were the reported revenue and net income figures?
```

```
What accounting policies are described in the notes?
```

Don't trust extracted numbers. Open the PDF and confirm.

---

## Year-Over-Year Analysis

This is where NotebookLM really shines. Upload 2-3 consecutive 10-Ks to one notebook:

```
What new risk factors appeared this year that weren't in last year's filing?
```

```
How has management's strategic narrative evolved over these three years?
```

```
Compare the competitive landscape descriptions across years.
```

Changes in language often signal important shifts before they show up in numbers.

---

## Extracting Specific Information

For due diligence checklists:

```
What related party transactions are disclosed?
```

```
What legal proceedings are mentioned?
```

```
What are the terms of the company's debt agreements?
```

```
Who are the company's largest customers? Any concentration risk?
```

---

## Sample Workflow: Full 10-K Analysis

Here's a complete questioning sequence:

1. **Orientation:** "Give me a 5-sentence overview of this company based on the 10-K"

2. **Business model:** "How does this company make money? What are the revenue streams?"

3. **Competitive position:** "What does management say about competition?"

4. **Risks:** "What are the top 5 risk factors I should care about as an investor?"

5. **Recent changes:** "What significant changes happened this year?"

6. **Outlook:** "What does management say about future growth expectations?"

7. **Red flags:** "Are there any related party transactions, legal proceedings, or accounting changes mentioned?"

---

## What to Always Verify

After using NotebookLM:

- [ ] Actual revenue/profit figures from financial statements
- [ ] Any percentages or growth rates mentioned
- [ ] Dates and time periods
- [ ] Names and titles of executives
- [ ] Specific dollar amounts for debt, acquisitions, etc.

NotebookLM helps you find where to look. Your eyes confirm what it says.

[Next: Earnings Calls →](workflows/earnings-calls.md)
