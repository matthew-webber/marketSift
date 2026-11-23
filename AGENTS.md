# Repository Guidelines

## Project structure

MarketSift is a WXT, React, and TypeScript extension for Facebook Marketplace. Start in `src/entrypoints/marketplace.content/` for page behavior. Its `index.tsx` handles navigation and DOM changes, while `Widget.tsx` and `widget.css` define the shadow-root UI. The background entrypoint handles the toolbar action and serializes settings updates across tabs.

Keep listing detection, price extraction, filter matching, and sorting in `src/lib/`. Extension icons live in `public/icon/`. For context on running alongside SmartBrowse, read `docs/smartbrowse-focus-notes.md`.

## Development commands

- `bun install` installs dependencies and generates WXT types.
- `bun run dev` starts the WXT development browser with live rebuilding.
- `bun run compile` checks TypeScript without emitting files.
- `bun run test` runs the Vitest suite once.
- `bun run build` produces the Chrome extension in `.output/chrome-mv3/`. Use **Load unpacked** at `chrome://extensions` to test that build.

## Coding conventions

Match the surrounding TypeScript and TSX. Use two-space indentation, single quotes for TypeScript strings, camelCase for functions and library modules, and PascalCase for React components. Follow existing formatting when editing files. The project has no configured lint or format script.

Scope DOM changes to Marketplace listings. Prefix page attributes with `data-ms-` and use CSS order to sort cards while preserving Facebook’s DOM tree. Keep loading placeholders behind sorted results and ignore mutations from extension controls.

## Testing

Vitest runs `tests/**/*.test.ts` in jsdom. Use `tests/fixtures/marketplace.html` for listing regressions and `tests/widget.test.ts` for UI interactions. Run a focused suite with `bun run test tests/widget.test.ts`. Coverage has no configured percentage threshold. For layout or infinite-scroll changes, also exercise a real Marketplace search in Chrome with SmartBrowse enabled.

## Commits and pull requests

Recent commits use short, plain-language subjects. Name the specific behavior changed, for example `Keep loading placeholders behind sorted listings`. In a pull request, describe the user-visible effect and the checks you ran. Link the relevant issue when one exists and include a screenshot for visible widget changes.
