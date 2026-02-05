# Asking Good Questions

NotebookLM's usefulness depends heavily on how you ask questions. This isn't like Googling — different approaches get dramatically different results.

---

## The Key Difference from ChatGPT

With ChatGPT, you might say "Act as a financial analyst..." or give elaborate instructions. 

**Don't do this with NotebookLM.** It's already constrained to your sources. Role-playing prompts add nothing and can actually confuse the output.

Just ask what you want to know, directly.

---

## Good Question Types

### Extraction Questions
Pull specific information from your sources.

```
What revenue did the company report for fiscal year 2024?
```

```
List all the executive officers mentioned and their titles.
```

### Synthesis Questions
Combine information across sources or sections.

```
Summarize the main themes in the MD&A section.
```

```
What does management say about competition across all uploaded documents?
```

### Comparison Questions
When you have multiple sources, these are powerful.

```
How has the description of risk factors changed between the 2023 and 2024 10-K?
```

```
Compare how Company A and Company B describe their competitive advantages.
```

### Follow-up Questions
Drill down from broad to specific.

```
You mentioned supply chain risks. What specific suppliers or regions are discussed?
```

---

## The Funnel Approach

Start broad, then narrow. This works better than jumping straight to specific questions.

1. **Broad:** "Give me an overview of this 10-K"
2. **Narrower:** "Focus on the risk factors section"
3. **Specific:** "Which risk factors relate to international operations?"
4. **Verify:** "Quote the exact language about currency exposure"

---

## Request Specific Formats

NotebookLM follows format instructions well.

```
List the risk factors as bullet points, grouped by category (operational, financial, regulatory).
```

```
Create a table comparing the three companies' revenue growth rates.
```

```
Summarize in 3 sentences or less.
```

---

## Ask for Citations Explicitly

NotebookLM provides citations automatically, but you can emphasize this:

```
What are the main competitive threats? Include source citations for each point.
```

```
Quote the specific passages that discuss AI strategy.
```

---

## Questions That Don't Work

**Calculations:** "Calculate the 3-year revenue CAGR" — NotebookLM can't do math. Ask for the numbers, then calculate yourself.

**Outside knowledge:** "What's Apple's current stock price?" — It only knows what's in your sources.

**Image/chart data:** "What does the revenue chart show?" — It can't see images.

**Too vague:** "Summary" — Give it context. Summary of what? What aspects?

---

## Iterating on Answers

If an answer isn't quite right:

- **Too long?** Ask to "summarize more concisely" or "give me the top 3 points"
- **Missing something?** Ask specifically: "You didn't mention X. What do the sources say about X?"
- **Wrong focus?** Rephrase with clearer scope: "Focus only on the segment reporting section"

---

## Using the Notebook Guide

Before asking questions, configure the Notebook Guide (on the right side panel) with persistent instructions:

```
This notebook contains SEC filings for semiconductor companies. 
Focus on: financial metrics, competitive positioning, and forward-looking statements.
Always: include citations, note when statements are forward-looking.
Format: use tables for numerical comparisons.
```

This saves you from repeating context in every question.

[Next: Understanding Citations →](core/citations.md)
