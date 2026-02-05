# Prompts That Fail

Learn from these mistakes. These prompts don't work well with NotebookLM — save yourself the frustration.

---

## Math and Calculations

❌ **Don't ask:**
```
Calculate the company's debt-to-equity ratio.
```

```
What's the 3-year revenue CAGR?
```

```
What's the gross margin trend over the last 5 years?
```

**Why it fails:** NotebookLM cannot do math. Period. It might give you a number, but it's either pulled directly from the source (if you're lucky) or fabricated (if you're not).

✅ **Do instead:** Ask for the raw numbers, then calculate yourself:
```
What debt and equity figures are reported?
```

---

## Real-Time or External Information

❌ **Don't ask:**
```
What's the current stock price?
```

```
How does this compare to what analysts are saying?
```

```
What happened to the stock after this earnings call?
```

**Why it fails:** NotebookLM only knows what's in your uploaded sources. No internet access, no real-time data.

✅ **Do instead:** Keep your questions within the scope of your documents, or add analyst reports as sources if you want that perspective included.

---

## Visual Content

❌ **Don't ask:**
```
What does the revenue growth chart on page 15 show?
```

```
Describe the pie chart of revenue by segment.
```

```
What's in that infographic about market share?
```

**Why it fails:** NotebookLM cannot see images, charts, or graphs. They don't exist as far as it's concerned.

✅ **Do instead:** Look at charts yourself. If the data is in tables, ask about those — but verify extracted table data carefully.

---

## Vague or Single-Word Prompts

❌ **Don't ask:**
```
Summary
```

```
Analysis
```

```
Risks
```

**Why it fails:** Too vague. NotebookLM doesn't know what aspect you want or how much detail.

✅ **Do instead:** Add context:
```
Summarize the risk factors section, focusing on regulatory risks.
```

---

## Role-Playing Instructions

❌ **Don't ask:**
```
Act as a senior equity analyst and evaluate this company.
```

```
You are Warren Buffett. What would you think of this investment?
```

**Why it fails:** Unlike ChatGPT, NotebookLM doesn't benefit from role-playing. It's already grounded to your sources. The persona adds nothing and can sometimes make outputs worse.

✅ **Do instead:** Just ask directly what you want:
```
What would be the strongest bull case and bear case for this company based on the 10-K?
```

---

## Creative Generation

❌ **Don't ask:**
```
Write an investment memo for this company.
```

```
Create a pitch deck for why someone should buy this stock.
```

**Why it fails:** NotebookLM is optimized for information retrieval, not creative writing. It can summarize and synthesize, but long-form persuasive content isn't its strength.

✅ **Do instead:** Extract the information first, then write your own memo:
```
What key points would support a bullish thesis on this company?
What are the main counterarguments or risks?
```

---

## Questions Requiring Judgment

❌ **Don't ask:**
```
Should I buy this stock?
```

```
Is this a good investment?
```

```
What's the fair value of this company?
```

**Why it fails:** NotebookLM won't give you investment advice (and shouldn't). Even if it tried, it can't do valuation math or weigh your personal situation.

✅ **Do instead:** Ask for information to support *your* judgment:
```
What factors would support a bullish thesis?
What risks might make this a poor investment?
```

---

## Asking About What Isn't There

❌ **Don't ask:**
```
What do industry experts say about this company's strategy?
```

(Unless you've uploaded industry reports)

```
How does this compare to the industry average?
```

(Unless industry benchmarks are in your sources)

**Why it fails:** NotebookLM only knows what's in your notebook. It can't fill gaps with external knowledge.

✅ **Do instead:** Either add relevant external sources, or limit questions to what's actually in your documents.

---

## The Pattern

Most failures come from expecting NotebookLM to be something it's not:
- It's not a calculator
- It's not connected to the internet
- It's not an image reader
- It's not a creative writing tool
- It's not a financial advisor

Use it for what it's good at: **finding and synthesizing information from your sources, with citations you can verify.**

[Next: Templates →](prompts/templates.md)
