# PSD Learn — interactive design branch

This branch contains a Czech design preview of `/learn/`, the five-stage
navigation, Discover (5–11), and one complete fictional-budget activity.
Other lessons and stages are clearly labelled outlines. It is not a public
curriculum release. The page is `noindex`; nothing links to it from the main site.

Open `learn/index.html` through a static server. The page uses the repository's
native HTML/CSS/JavaScript stack. It needs no build step, data loading, package
installation, account, analytics, or additional service. Google Fonts is optional;
system fonts work offline. Choices persist only for the browser tab's session.

On this Mac, use the required bounded preview command from the worktree root:

```sh
/Users/johnwick/.codex/bin/resource-guard.py preview -- python3 -m http.server 4188 --bind 127.0.0.1
```

Stop the owned preview after verification and run the resource guard cleanup.
Do not launch an external browser. Use Codex's built-in browser.

## Files

- `index.html`: independent Learn shell and accessible screen content.
- `learn.css`: scoped styles and a local Discover illustration palette.
- `learn.js`: model choices, navigation, table, and canvas town illustration.
- `DESIGN.md`: learning progression, curriculum boundaries, and release decisions.

The canvas is an illustrative toy town, not a chart renderer. Both the town and
numeric table read the same selection model. No live data is represented.
Future statistical views should use the shared PSD chart components.

## Before production

The public route is proposed as `/learn/`; `/study/` can redirect there later.
Inner screens currently switch locally and have no independent route/history.
Add real routing, CS/EN content, curriculum review, and production accessibility
verification before release. Refactor lesson content into shared definitions when
the second actual activity is built; do not generalize a renderer from one game.

Design and module boundaries are independent. Production deployment remains with
the canonical site, through the existing Cloud Build and Cloud Run service.
Pushing this feature branch does not authorize merging or deploying it.
