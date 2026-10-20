# Itar React API preview

The `itar/react` entrypoint connects React to the owned Android and tvOS native
components. API names remain provisional. Native registration, directional
ownership, supported feedback and semantics execute without a per-move JS callback.
The root `itar` entrypoint remains usable by the foundation tooling.

```tsx
import {FocusProvider, FocusScope, Focusable, occurrenceKey} from 'itar/react';

const first = occurrenceKey('home', 'favorites', 'entry-1');

<FocusProvider style={{flex: 1}}>
  <FocusScope id="home" layout="column">
    <FocusScope id="favorites" layout="row" boundary="parent">
      <Focusable occurrenceKey={first} contentId="movie-42"
        accessibilityLabel="A favorite movie" order={0}
        style={{width: 280, height: 80}}
        focusStyle={{accentColor: '#ff8800'}}
        onPress={event => { if (event.contentId) openMovie(event.contentId); }} />
    </FocusScope>
  </FocusScope>
</FocusProvider>
```

An occurrence key identifies a particular entry, not its movie. Use stable screen,
rail and entry IDs; the same movie in two rails requires two occurrence keys.
`occurrenceKey` preserves component boundaries, including delimiters and Unicode.
Avoid changing an occurrence key to represent another item. The native registry
checks generations independently of the application key.

Each provider owns one native surface. Ordinary rerenders preserve it. Scopes
configure logical ancestry, active state, row/column/spatial layout, stop/wrap/parent
boundaries, traps, entry readiness and an optional preferred occurrence. Inactive
scope descendants leave navigation and the accessibility tree. Scope IDs are
local to their parent; full scope paths address restoration.

The mounted preview retains inactive routes with positioning and opacity, while
`active` removes their native navigation and accessibility eligibility. Fabric can
recycle a scope hidden with `display: none`; unmounting or recycling a scope
disposes its native history. `restoreScope` does not persist history across a
recreated scope, so retain the scope for route return in this initial mounted API.

Android uses the engine's mounted directional policy. UIKit retains directional
selection and gestures, with explicit engine preferences and the owned directional
trap constraint. A layout/wrap declaration does not establish identical UIKit
destinations. Native controls and screen-reader navigation keep native ownership.

The initial `Focusable` is an owned button with a committed label, enabled state,
order and activation. Arbitrary native descendants/third-party attachment are
outside this API. Use `style` for layout. `focusStyle.accentColor` and
`baseAccentColor` configure Android text color or the tvOS border. The tvOS border
uses widths 1 and 5, coordinates with UIKit focus animation, and respects reduced
motion. Visual feedback follows observed host focus. Custom React visuals can use
subscriptions but may wait for JavaScript.

```tsx
import {useFocusCommands, useFocusReady, useIsFocused, useFocusState} from 'itar/react';

const {focusByKey, restoreScope, showDialog} = useFocusCommands();
const ready = useFocusReady();
const focused = useIsFocused(first); // Only this occurrence's transitions notify it.
const observed = useFocusState('input'); // Accessibility is a separate channel.

const request = focusByKey(first);
request.cancel(); // Cancels this command only; an issued native operation may still happen.
const outcome = await request.result;
// outcome.status: applied | cancelled | unavailable | unsupported

// After committing a returning route's active scope:
await restoreScope(['home', 'favorites']).result;
```

Wait for `ready` before issuing initial commands. Requests expose a client command
identity immediately and the native request/lifetime in their terminal outcome.
Host acceptance is pending; `applied` requires actual native confirmation. Each
caller resolves once. Cancellation cannot undo an already-dispatched operation;
late actual focus still updates observed state. A superseding request cancels its
predecessor without cancelling the replacement.

Unknown, disabled and inactive targets return unavailable; requests never activate
another route. Known-unmounted targets remain subject to native realization
capability. This mounted API rejects unsupported reveal work as unavailable.
Native requests currently have a 500ms deadline. Before native readiness, after
disposal, or when the 32-caller pending limit is reached, results are explicit
unavailable outcomes. Unselected runtimes return unsupported. Delayed events must
match provider, surface lifetime and monotonic sequence; stale records cannot
revive a disposed owner or overwrite newer observations.

`restoreScope` asks the engine for its observed scope history, then the declared
returning entry policy. It does not reconstruct an opener from JS focus callbacks
or implicitly activate an inactive scope. `showDialog`/`dismissDialog` exercise the
owned native dialog coordinator and opener restoration. They currently use the
native fixture contents; arbitrary React Native Modal content is separate work.

Activation includes the live occurrence, mount, lifetime, source and sequence.
Input Select targets confirmed input focus; accessibility activation addresses its
semantic target without transferring input focus. Duplicate transport reports and
retired React registrations are rejected. `contentId` is application metadata and
does not participate in focus identity.

`useScreenReaderEnabled()` returns `boolean | null` using RN AccessibilityInfo.
Applications may use it to control autoplay. Native input ownership never waits
for this hook, and the library does not synthesize per-key speech.

The reference app's **React API preview** screen runs inside Strict Mode and uses
two rails with repeated movies, an owned dialog, route return, selective status,
request cancellation and bounded JS load. Compilation and deterministic protocol
tests do not establish physical remote, VoiceOver, VoiceView, TalkBack, speech or
shipping support. Refer to the named runtime/device acceptance for those claims.

The first [virtualized collection API](virtualization.md) wraps fixed-extent TV
FlatList buttons and nested rails. Its bounded realization flow retains logical
membership across recycling, with native scrolling and confirmed focus. Native
fallback prevention and device/reader acceptance remain explicit limits.
