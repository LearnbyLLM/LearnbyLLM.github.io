# Understanding Citations

Citations are NotebookLM's killer feature. They're what make it actually useful for research where accuracy matters.

---

## How Citations Work

Every claim in NotebookLM's answers has a numbered citation like [1] or [2]. Click it, and you see:

- The exact passage in your source
- Which document it came from
- A link to view it in context

This is the verification layer that makes NotebookLM better than "trust me bro" AI answers.

---

## What Citations Look Like

When NotebookLM answers:

> Apple's Services segment generated $85.2 billion in revenue [1], representing approximately 22% of total revenue [2]. Management attributed growth to increased subscriptions and App Store revenue [1].

The [1] and [2] are clickable. They take you to the relevant passages in your uploaded 10-K.

---

## Why This Matters for Investing

When you're making investment decisions, "the AI said so" isn't good enough. You need to:

1. Verify the source is reliable
2. Confirm the AI interpreted it correctly
3. See the full context (not just the snippet)

Citations make all three possible without re-reading entire documents.

---

## When Citations Are Accurate

NotebookLM is generally reliable when:

- Citing qualitative information (descriptions, strategies, narratives)
- Pointing to specific named sections
- Quoting text directly

---

## When Citations Can Mislead

Be more skeptical when:

**Numbers are involved.** The citation might point to the right area, but NotebookLM could have misread the table or confused rows/columns.

**Synthesis across sources.** If an answer combines information from multiple sources, verify each citation separately.

**Paraphrasing.** The cited passage might say something *similar* but not *exactly* what NotebookLM claimed. Check the actual wording.

---

## Verification Workflow

Make this a habit:

1. Read NotebookLM's answer
2. Click the citation for any claim that matters to your analysis
3. Read the actual source passage
4. Confirm it says what NotebookLM says it says
5. Consider the context around that passage

This takes 30 seconds per claim. Worth it for anything you might act on.

---

## When Citations Are Missing

If NotebookLM makes a claim without a citation, or says "based on the sources generally," treat it with skepticism. It's likely:

- Synthesizing across multiple passages (ask it to cite specific ones)
- Making an inference that goes beyond what sources explicitly state
- Or (rarely) hallucinating

Ask: "Can you provide specific citations for that claim?"

---

## Pro Tip: Request Direct Quotes

If you really need precision:

```
Quote the exact text where management discusses AI investments.
```

This forces NotebookLM to copy-paste rather than paraphrase, reducing interpretation errors.

[Next: Audio Overviews →](core/audio-overviews.md)
