# SmartBrowse Focus listings

SmartBrowse’s flipper-only Focus listings action is a 44 px floating funnel. Left-click toggles focus mode. Right-click opens its checklist. The enabled Just listed, Within radius, and In state conditions combine with AND. The quick-action configuration uses the storage key `quickActionButton`, and the active state uses `quickAction:active`.

When focus takes over, SmartBrowse calls `clearAllEffects` to hand control of listing visibility over from the regular effects pipeline. Focus applies a CSS class to collapse failing cards and sizes a trailing spacer to the height freed by the pass. Facebook retains ownership of the listing nodes, and its infinite-scroll sentinel stays near its original position.

Just-listed, radius, and state filters are possible future additions to MarketSift.
