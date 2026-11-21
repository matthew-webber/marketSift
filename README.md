# MarketSift

MarketSift adds a floating funnel to Facebook Marketplace in Chrome. Click it to sort loaded listings by price or filter their titles or whole-card text. Sorting runs within each listing container. Listings with an unknown price come last in either direction.

Enter a term and press Enter to add it. Every enabled Show term must match, and any matching Hide term hides the listing. Click a term to toggle it, its mode to switch between Show and Hide, or its × to remove it. Clear all removes the terms.

Drag the funnel or use the corner buttons to dock it. The header ×, Escape, or a click outside closes the panel and keeps your sort and filters active. Right-click the funnel and choose **Remove** to pause MarketSift and restore the native layout across tabs. Choose **Cancel** to dismiss the menu. Click the Chrome toolbar action to resume with your saved settings.

## Load in Chrome

1. Run `bun install` and `bun run build`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select `.output/chrome-mv3`, then open or refresh a Marketplace tab.

## Development

Use `bun run dev` for WXT development, `bun run compile` for TypeScript checks, and `bun run test` for the Vitest suite. Settings are stored in Chrome's local extension storage under `marketsift`.
