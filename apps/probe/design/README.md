# Itar Cinema TV design exploration

28 October 2026. Design references for the existing `apps/probe/ott` app.
The requested “apps/props” path was interpreted as `apps/probe`; no such
`apps/props` folder was found. App source and native configuration are unchanged.

## Current stage

Three alternative Home concepts are ready for visual selection. These are
image-generated design proposals, not screenshots of the running app or final
screen specifications. Remaining screens await the chosen visual direction.

| Display order | Concept | Reference |
| --- | --- | --- |
| 1 | Atlas Cinema | [Home](01-atlas-cinema.png) |
| 2 | Signal Library | [Home](02-signal-library.png) |
| 3 | The Screening Room | [Home](03-screening-room.png) |

The requested canvas was 1920 × 1080; generated images are 1672 × 941.
Treat them as composition references, not pixel-exact exports or asset sheets.
Copy and image artifacts need refinement in the selected direction: concept 2
repeats “Featured story”; small footer text needs a TV readability pass.
The illustrative date in concept 3 is not a proposed product requirement.

## Complete screen inventory and next design coverage

Inventory derived from `ott/App.tsx` and `ott/src/{Browse,Search,Details,ui}.tsx`.

| Existing screen/state | Design coverage after selection |
| --- | --- |
| Home | Featured story, landscape rails, poster rails, current navigation vs focus |
| Movies | Movie-only landscape/poster rails and row-to-row navigation |
| Series | Series-only rails; no episode playback controls in current scope |
| Search | Empty query; A–Z keyboard; Space/Delete/Clear; query and result rails |
| Search feedback | Debouncing, pending, no matches, failed request and Retry |
| Title details | Artwork, title/year/type/genre/synopsis, Back, cast and crew |
| Cast biography | Selected person and biography inline within details; not a new route |
| Profile | Explorer/Stargazer selection; selected vs focused; session-only explanation |
| Settings | White accent, simulated delay, next-fetch failure, development probe entry |
| Catalogue feedback | Initial load, append load, retained rows on error, Retry, end/reload |
| Focus feedback | Unavailable-request notice; inactive background; restoration on Back |

The original development probe suite is a separate diagnostic UI, reachable
from development Settings; this exploration covers the consumer OTT screens.

## Shared design requirements

- Compose in a 1920 × 1080 reference viewport with an approximately 80–96 px
  safe area, 28–32 px body text, generous spacing and stable artwork proportions.
  These are design targets requiring device checks, not validated platform rules.
- Use one obvious observed-focus treatment; distinguish current route,
  selected profile, disabled action and input focus without relying on color alone.
- Keep focus rendering tied to observed host focus using the adapter-supported
  style subset. Rings in concepts are visual targets, not claims that the current
  native adapter can render them. Do not require scaling, glow or animation.
- Design a white/high-contrast alternative and a reduced-motion presentation.
- Preserve native reader semantics and host-owned input. Input focus and
  accessibility focus remain separate; image mockups cannot validate either.
- Define entry/exit and return behavior per scope, including search keyboard,
  result rails, details and cast. Loading must not replace a still-valid target.
- Loading skeletons are decorative; Retry remains an actionable control.
  Keep prior catalogue rows on append errors and avoid shifting navigation.
- Current content is fictional local data. Artwork in these references is
  generated concept imagery, not TMDB-sourced film material.
- Allow future title, overview, release/year, poster, backdrop and cast metadata;
  tolerate missing artwork, long titles and missing biographies.
- Keep credentials server-side under the existing documented proxy boundary.
  No API integration, provider terms review or attribution approval is completed
  by this design exercise. Reserve an About/credits location for provider credit.
- Do not introduce Play, trailers, subscriptions, watchlists or account persistence
  while the app only supports browsing fictional metadata and session profiles.

## Evidence and limitations

Reviewed current source, styles, catalogue, repository rules, local continuity
and existing artwork directly. Product Design context preflight found no saved
context. Each concept used the actual `0-landscape.png` reference attachment.
No native app, Metro, emulator, simulator, browser prototype or device was run.
No screen-reader, remote-navigation, contrast measurement or performance
acceptance is established. No architecture or ticket status was changed.

Choose one displayed concept before completing the remaining screen designs
and their focus/state specifications in this folder.
