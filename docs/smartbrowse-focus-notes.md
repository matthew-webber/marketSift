# SmartBrowse Focus listings

SmartBrowse’s flipper-only Focus listings action is a 44 px floating funnel. Left-click toggles focus mode. Right-click opens its checklist. The enabled Just listed, Within radius, and In state conditions combine with AND. The quick-action configuration uses the storage key `quickActionButton`, and the active state uses `quickAction:active`.

When focus takes over, SmartBrowse calls `clearAllEffects` to hand control of listing visibility over from the regular effects pipeline. Focus applies a CSS class to collapse failing cards and sizes a trailing spacer to the height freed by the pass. Facebook retains ownership of the listing nodes, and its infinite-scroll sentinel stays near its original position.

MarketSift ports the three conditions as panel toggles under **Show only**, rather than as a separate focus button. They combine with AND alongside the text filters and use MarketSift's existing `.ms-hidden` and spacer pass. Radius and state lookups use SmartBrowse's Census place list, copied to `public/us-places.json` from `api-smartbrowse-for-marketplace/data/us-places.json` and served by the background worker instead of the SmartBrowse API.
