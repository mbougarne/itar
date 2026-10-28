# Itar Cinema — sidebar TV design pack

28 October 2026. Selected direction: the sidebar from the second exploration,
with the first exploration’s warm cinematic imagery. All current consumer
screens are covered in this design pass. App implementation is unchanged.

Open [the complete gallery](index.html) to review the set together. Each image
also opens separately at full resolution. [Design specifications](SPEC.md)
provide layout targets, exact state copy and focus/return behavior.

## Screens

| Screen | Design |
| --- | --- |
| Home | [Open](screens/01-home.png) |
| Movies | [Open](screens/02-movies.png) |
| Series | [Open](screens/03-series.png) |
| Search — results | [Open](screens/04-search.png) |
| Profile | [Open](screens/05-profile.png) |
| Settings | [Open](screens/06-settings.png) |
| Title details | [Open](screens/07-details.png) |
| Cast biography | [Open](screens/08-cast.png) |
| Search — no matches | [Open](screens/09-search-empty.png) |
| Catalogue — loading | [Open](screens/10-loading.png) |
| Catalogue — retry message | [Open](screens/11-error.png) |

The seven main screens are Home, Movies, Series, Search, Profile, Settings and
title details. Cast is an inline details state. No separate Messages route is
present in `ott/App.tsx`; message designs cover search feedback and catalogue
errors. The original development probe suite remains outside this consumer
redesign; its Settings entry is included.

## Use in implementation

Use this pack as the shared visual target for a later React Native redesign.
The images are composition references, not executable screens, production
artwork exports, a font package or evidence of native adapter capabilities.
See SPEC.md for requirements that generated images cannot represent exactly.

The requested canvas was 1920 × 1080. Actual output dimensions and SHA-256
checksums are listed in [screens.json](screens.json). Keep native artwork
proportions; do not stretch these references into pixel-exact measurements.

All displayed stories and people are fictional. Images are generated concepts,
not TMDB assets. Future provider integration must preserve the repository’s
server-side credential boundary and review applicable attribution/asset terms.
No live API, playback, accounts or persistent profiles were added.

## Verification and boundaries

Reviewed source routes, controls and states and visually inspected the generated
outputs. Corrected Home’s initial duplicate focus outline. Verified all 11
copies against originals, PNG dimensions, gallery/spec links, coverage and
whitespace. No native app, Metro, simulator, emulator or browser prototype was
run; remote input, typography on devices, readers, contrast over imagery and
performance remain unverified. This pack does not change the frozen architecture
or ticket status. It is one coherent design-only change; generated images and
manifest are separate from the small authored gallery and specifications.

## Earlier exploration

The original three alternatives remain available: [top navigation](01-atlas-cinema.png),
[sidebar exploration](02-signal-library.png), and [editorial layout](03-screening-room.png).
The `screens/` set is the selected design direction; these earlier images are history.
