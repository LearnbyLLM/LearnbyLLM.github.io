# Troubleshooting

Common problems and how to fix them.

---

## Source Won't Upload

**PDF won't process**
- Check if it's password protected (remove protection first)
- Try re-downloading the file
- Confirm it's not a scanned image (needs searchable text)
- Check file size (max 200MB)
- Try a different browser

**URL won't load**
- Check if content is behind a paywall
- Some sites block scraping
- Copy-paste content to Google Docs instead

**YouTube won't work**
- Video needs captions/transcript available
- Private videos won't work
- Check if it's region-restricted

---

## Bad or Confusing Answers

**Answer doesn't match what I asked**
- Rephrase the question more specifically
- Break complex questions into smaller parts
- Check if the information actually exists in your sources

**Getting wrong information**
- Click citations to verify
- Ask NotebookLM to quote exact text
- The information might not be in your sources

**Mixing up companies/years**
- Use clearer filenames
- Specify which company or year in your question
- Consider separate notebooks if confusion persists

---

## Number Problems

**Numbers seem wrong**
- They probably are — verify against original
- Tables are especially error-prone
- Ask for the specific source passage

**Getting calculated results when you asked for raw numbers**
- Be explicit: "What exact figure is reported, not calculated"
- NotebookLM sometimes hallucinates calculations

**Unit confusion (thousands vs millions)**
- Always verify
- Ask: "What units are these figures reported in?"

---

## Performance Issues

**Processing taking forever**
- Large PDFs take time (be patient)
- Very long documents (1000+ pages) can be slow
- Try refreshing if stuck for more than 5 minutes

**Slow responses**
- Normal during high-traffic times
- Complex queries take longer
- Try simpler questions first

---

## Citation Problems

**Citations point to wrong sections**
- This happens with synthesis across multiple sources
- Ask for quotes to get exact text
- Verify manually

**No citations provided**
- Ask explicitly: "Include source citations"
- If still no citations, the answer might be inferred (not directly stated)

---

## Audio Overview Issues

**Audio won't generate**
- Check you haven't hit generation limits
- Make sure sources are fully processed first
- Try with fewer/simpler sources

**Audio quality is poor**
- Content might be too technical
- Try adding focus instructions
- Some sources don't translate well to audio

---

## Account Issues

**Can't access NotebookLM**
- Requires Google account
- Check if your region is supported
- Try incognito mode to rule out extension issues

**Hit usage limits**
- Free tier has limits on sources, queries, audio
- Consider NotebookLM Plus for more capacity
- Wait until limit resets

---

## Still Stuck?

**NotebookLM Help Center:**
[support.google.com/notebooklm](https://support.google.com/notebooklm)

**Report bugs:**
Use the feedback button in NotebookLM interface

[Next: Changelog →](changelog.md)
