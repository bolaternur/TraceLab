# Local presentation verification

Checked on 9 October 2026. This report covers the presentation website only; it does not verify the main Iznera application or its database.

The final Playwright run passed 41 browser assertions across the home, demo, research and materials routes. Desktop width: 1440px. Mobile width: 390px. Additional home check: 1117px, matching the observed in-app viewport.

Verified:

- All four routes load their images and have no horizontal document overflow or duplicate element IDs.
- The homepage contains no remaining Powder text.
- FAQ disclosure, four-stage selection, linked-record inspection and arrow-key navigation work.
- Replay advances to the next record and can be paused.
- Missing evidence produces an explicit message rather than an invented explanation.
- Actual HTML and JSON downloads complete. Their saved content retains the synthetic educational label; JSON contains four stages and four evidence links.
- Mobile navigation opens and closes with Escape; stage switching works on mobile.
- Research separates the prepared protocol from unpublished pilot results.
- The Materials page has five original source documents.
- Every declared link and resource on the four active pages resolves to an existing local file or route. No external URLs are declared in the active pages.

Screenshots are retained in `.impeccable/review/`. Final captures use reduced motion so intermediate animation frames do not obscure content. The independent review is recorded separately.

The one mechanical design-detector pass flagged the retained template font, small labels and a conservative hero contrast estimate. Functional labels were raised to at least 11px and work-surface padding was corrected before final captures. Inter is intentionally retained from the user-selected template. The original hero-gradient estimate used its lightest bottom color rather than the dark area behind the copy; rendered readability is assessed in the final review.

Run the saved browser workflow with the installed Playwright CLI and `verify-browser.js`. The workflow is a QA harness, not a runtime dependency.
