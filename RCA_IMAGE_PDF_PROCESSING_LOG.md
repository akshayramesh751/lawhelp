# RCA & Fix Log — PDFs Containing Images Fail with "Error processing PDF natively"

**Date:** 2026-10-11  
**Symptom:** Uploading `os hdkote prema documents.pdf` showed the file as **0.00 MB** and failed with the generic
message *"Error processing PDF natively"*.
**Status:** Code changes made; **not yet verified** with the user's file or an automated test.

## Findings

| # | Where | Problem | Evidence / Reasoning |
|---|-------|---------|----------------------|
| 1 | Input file | File is probably empty/truncated (e.g. cloud placeholder not downloaded). | `AIAnalysisPage.tsx` shows `size/1024/1024` → "0.00 MB" means < ~5 KB; a real image PDF is far larger. Python would reply 400 "empty or unreadable". |
| 2 | `server/controllers/aiController.js` | Python's real error was discarded: only `statusText` was logged and the client always got a generic 500 message. | Hid the cause (#1) from the user and the logs. |
| 3 | `ai-service/main.py` `process_pdf` | OCR fallback triggered only if the **whole document** had < 50 chars of text. Mixed PDFs (typed header + scanned/image pages) took the text-only path and image content was silently lost. | Single global threshold. |
| 4 | `aiController.js` OCR branch | After OCR, **native text was discarded** and only OCR text used. | Lost clean text where it existed. |
| 5 | `main.py` | OCR capped at first 10 pages at 150 dpi. | Pages beyond 10 ignored; low dpi hurts small legal print. |
| 6 | Environment | Only `eng.traineddata` is in the repo root; Kannada OCR falls back to English. | Possible poor output for Kannada scans (not changed). |

## Changes (with reasoning)

1. **`main.py` `process_pdf`** — per-page analysis: a page with < 150 chars of text that carries images
   (or the doc is almost textless) is an OCR candidate. New helper `has_substantial_images` ignores pages
   whose images cover < 15 % of the page (logos/stamps) to avoid pointless OCR. Candidate pages rendered at
   **200 dpi**, cap **20 pages**. The 422 payload now includes `page_indices`, `native_pages`, `truncated`.
   Unexpected errors print a traceback and return `ExceptionType: message`. (fixes #3, #5)
2. **`aiController.js` OCR branch** — OCR results are keyed by page and **merged with each page's native
   text**; logs a warning if pages were truncated. (fixes #4)
3. **`aiController.js` error path** — logs Python's response body and returns its detail to the client
   (`400` preserved for bad input). (fixes #2)
4. **`aiController.js` empty-file guard** — uploads < 100 bytes are rejected immediately with an actionable
   message (check OneDrive/Drive download, re-upload). (addresses #1)

## Not changed / follow-ups
- Verify with the actual file; check `uvicorn`/`node` consoles for the now-detailed error.
- Provide `kan.traineddata` if Kannada scans are expected (#6).
- Add an automated test with a synthetic mixed text+image PDF.
- Thresholds (150 chars, 15 % area, 20 pages) are heuristics to tune on real documents.
