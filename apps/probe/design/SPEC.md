# Sidebar TV design specifications

Design intent for `apps/probe/ott`, 28 October 2026. These presentation targets
do not supersede accepted engine/platform contracts or prove runtime behavior.

## Shared visual system

| Element | Target at 1920 × 1080 reference size |
| --- | --- |
| Base / raised surface | #0D141D / #1D2C3C |
| Text / secondary text | #F4EEE4 / #BDC8D3 |
| Focus / white-accent alternative | #26D9F2 / #FFFFFF |
| Sidebar | Approximately 360 px wide; fixed expanded labels |
| Safe area / content gap | 80–96 px outer reference margin; 48 px after sidebar |
| Typography | System sans; 56–72 px page titles, 34–40 headings, 28–32 body |
| Artwork | Landscape 16:9; poster 2:3; avatar 1:1; approximately 8 px corners |
| Focus | Single 4 px exterior ring with 6 px gap; no required scaling or glow |
| Current route | Steady narrow marker plus heavier label; distinct from ring |
| Current profile | Checkmark and explicit Current profile text |

Values are reference pixels, not React Native point values. Derive a common
scale from actual runtime viewport and validate at viewing distance. Images
contain minor variation: use one consistent sidebar geometry, icon set, baseline
and type scale in implementation. Use installed system fonts and a licensed icon
library; generated glyphs/poster lettering are not reusable production assets.

The cyan focus treatment is a proposed replacement for the current gold accent.
Use only the native adapter’s verified style subset. If an exterior ring is not
supported, establish equivalent contrast with the supported accent treatment;
additional native styling is separate implementation work. No per-move React
render or JS animation is required by this design. White-accent mode replaces
focus cyan with white; keep the ring/shape distinction from selected state.
Respect native focus effects and reduced motion; skeletons remain static.

## Navigation and scope behavior

Keep route entry consistent with current source: activating a sidebar item
opens its page with focus on that navigation item. The catalogue images depict
subsequent browsing, not a request to auto-focus newly loaded content.
Directional movement should connect sidebar, rails and keyboard through the
existing scopes; resolve exact platform movement/reveal through device checks.
Sidebar focus and route selection are separate. Do not activate a route merely
because its menu item is focused. Do not assume wraparound.

Open details with Back to catalogue focused, matching the current request.
Background page and sidebar remain inactive. Back returns to the original
catalogue occurrence and scroll position when still valid; use accepted recovery
rules if it disappeared. Do not invent a new recovery policy in the UI layer.
Keep biography inline; selecting a cast member changes the text below its rail.
Do not auto-move focus to biography text. Reveal the text without hiding its
source where practical. Hardware Back retains the existing details/page rules.

Profile switching resets catalogue/search routes as the current app does.
Profiles and settings remain session-only. Development probes are only exposed
when the existing development condition and callback permit them.

## State copy and layout variants

| Trigger | Presentation and action |
| --- | --- |
| Search, empty query | Same keyboard layout as 04; placeholder Choose letters below; right area Find a title or genre; Delete/Clear disabled |
| Query edit | Limit 36 characters; existing 250 ms debounce; do not steal focus when results arrive |
| Search pending | Show Searching local stories… in results region; keyboard remains available |
| No results | 09; No matching stories; Try a different title or genre; preserve query |
| First catalogue request | 10; add readable Loading local stories… status; skeletons decorative, sidebar active |
| Append pending | Keep all loaded rows; trailing Loading more local stories…; no replacement of focused content |
| Initial request failure | Same message hierarchy as 11 without retained row; Couldn’t load stories; Retry local fetch |
| Append failure | 11; Couldn’t load more stories; Your loaded stories are still here; Retry local fetch |
| Retry pending | Retain action identity/geometry and the current focus when valid; do not introduce a second focus ring |
| Catalogue complete | End of this catalogue; Reload local catalogue in the existing trailing action position |
| Failure armed | Settings value Armed; existing action can disarm; next applicable request consumes it |
| Slow requests enabled | Settings value On / 650 ms; normal value Off / 180 ms |
| Focus request unavailable | Quiet footer: Focus request unavailable. Continue with your remote. No new focus target |
| Profile switched | Quiet footer: Using Explorer or Using Stargazer; no modal |
| Unsupported runtime | Plain full-screen message from current app: This consumer requires the Itar native adapter on tvOS or Android TV. No fake working navigation |

The loading image omits its textual status; include the exact status above.
Details must retain the existing Fictional metadata only. No video is attached.
notice even though its image omits it. These explicit text requirements complete
the visual references. The error image highlights Retry after the user moves to
it; an error arriving must not automatically pull focus away from a valid card.
An append error must retain every prior row, not just the illustrative row shown.

## Accessibility and future metadata

Expose one semantic action per artwork card, labelled with title and type.
Decorative artwork and skeletons are not extra navigation stops. Preserve native
roles, selected/disabled states and committed labels. Input focus, accessibility
focus and activation are distinct; permit host/readers to own their navigation.
Never force reader focus or duplicate host speech for these visual states.

Allow title wrapping, missing portraits/backdrops and long synopsis text with
stable geometry and readable scrims. Do not fit long titles by shrinking below
body readability. Use textual title fallback when artwork is unavailable.
TMDB field mapping, provider attribution, licensed images and proxy integration
are future work, not supplied by these fictional visual references. No Play,
trailers, watchlists, season controls or login flows are introduced here.

Before implementation acceptance, verify actual supported tvOS/Android runtime,
remote navigation and reveal, reader semantics, inactive backgrounds, restoration,
white-accent mode, reduced motion and text contrast over each real image.
