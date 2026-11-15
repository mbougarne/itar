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

Set `restoreOnEntry` on a menu scope to use engine history when entering with a
direction. Valid history takes precedence over `preferredKey`, then deterministic
fallback. The default remains geometric/anchor entry for ordinary content rails.
This affects input focus, not screen-reader navigation.

For a controlled route/content replacement, commit `entryReady={false}` before
removing the focused source. This blocks automatic native input-focus entry into
that scope, including nested scopes, without preventing collection publication
or explicit `focusByKey` requests. Request the intended key once its logical
collection is published, then reopen entry when the request settles (including
failure/cancellation). Existing focus is not evicted. Screen-reader ownership and
unmanaged native controls are not suppressed. This is an explicit handoff
contract, not a guarantee against arbitrary uncoordinated host removals.

The mounted preview retains inactive routes with positioning and opacity, while
`active` removes their native navigation and accessibility eligibility. Fabric can
recycle a scope hidden with `display: none`; unmounting or recycling a scope
disposes its native history. `restoreScope` does not persist history across a
recreated scope, so retain the scope for route return in this initial mounted API.

`FocusVirtualizedRails active={false}` releases logical catalogue ownership but
keeps its existing FlatList viewport mounted. Its normal virtualization window
remains bounded; it does not render the entire catalogue. Reactivation republishes
before `onReady`, preserving scroll position during a retained route's Details
handoff. Unmounting the component still disposes that viewport.

Android uses the engine's mounted directional policy. UIKit retains directional
selection and gestures, with explicit engine preferences and the owned directional
trap constraint. A layout/wrap declaration does not establish identical UIKit
destinations. Native controls and screen-reader navigation keep native ownership.

`Focusable` is an owned button with a committed label, enabled state, order and
activation. It also accepts presentation-only `children`, such as an image and
text. Supply an explicit outer size using `style`; the content fills those bounds.
The outer host owns focus, accessibility, native feedback and `onPress`. The
children are hidden from accessibility and cannot independently receive input.
Do not nest interactive controls, `Focusable` or `FocusScope` inside it; owned
focus declarations reject nesting. Put activation on the outer host. Attaching
Itar to an existing third-party native control remains outside this API.

```tsx
<Focusable occurrenceKey={first} accessibilityLabel="A favorite movie"
  style={{width: 280, height: 180}} onPress={() => openMovie('movie-42')}>
  <View style={{flex: 1}}>
    <Image source={poster} style={{width: 280, height: 140}} />
    <Text>Movie title</Text>
  </View>
</Focusable>
```

Import `View`, `Image` and `Text` from React Native. Omitting `children` (or passing
null) keeps the existing `displayLabel`/label mode. Custom child text uses its own
styles; `focusStyle` continues to configure the owned host's native feedback.
The React API preview contains an image/text card and a label/custom toggle.
Collection renderer callbacks remain separate work. Physical reader/input
acceptance is deferred for joint testing after implementation.
 Use `style` for layout. `focusStyle.accentColor` and
`baseAccentColor` configure Android text color or the tvOS border. The tvOS border
uses widths 1 and 5, coordinates with UIKit focus animation, and respects reduced
motion. Visual feedback follows observed host focus. Custom React visuals can use
subscriptions but may wait for JavaScript.

For an adjustable control, supply `onAdjust(delta)` where delta is `-1` or `1`.
The native target consumes horizontal input and keeps focus; Up/Down still use
normal navigation. Accessibility increment/decrement actions use the same callback.
The application owns the value, step size, bounds and descriptive label. Adjustment
records use activation's lifetime/registration/sequence validation; `onPress`
remains a separate Select action. See the showcase [timeline](../../docs/ott-playback.md).
Android remote behavior is checked on the emulator; tvOS gesture and screen-reader
acceptance require device testing.

```tsx
import {useFocusCommands, useFocusReady, useIsFocused, useFocusState} from 'itar/react';

const {focusByKey, restoreFocusByKey, restoreScope, showDialog} = useFocusCommands();
const ready = useFocusReady();
const focused = useIsFocused(first); // Only this occurrence's transitions notify it.
const observed = useFocusState('input'); // Accessibility is a separate channel.

const request = focusByKey(first);
request.cancel(); // Cancels this command only; an issued native operation may still happen.
const outcome = await request.result;
// outcome.status: applied | cancelled | unavailable | unsupported

// After committing a returning route's active scope:
await restoreScope(['home', 'favorites']).result;
// Android: restore the exact saved activation occurrence after its route is ready.
await restoreFocusByKey(first).result;
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
Deadlines are native and platform-specific; Android commands retain a 3s deadline. Before native readiness, after
disposal, or when the 32-caller pending limit is reached, results are explicit
unavailable outcomes. Unselected runtimes return unsupported. Delayed events must
match provider, surface lifetime and monotonic sequence; stale records cannot
revive a disposed owner or overwrite newer observations.

`restoreScope` asks the engine for its observed scope history, then the declared
returning entry policy. It does not reconstruct an opener from JS focus callbacks
or implicitly activate an inactive scope. `showDialog`/`dismissDialog` exercise the
owned native dialog coordinator and opener restoration. They currently use the
native fixture contents; arbitrary React Native Modal content is separate work.

`restoreFocusByKey` expresses application restoration separately from generic
focus intent. Save the activated occurrence key rather than sampling input focus.
The Android adapter permits reader-owned restoration only to mounted, visible,
eligible targets; it does not reveal or scroll for the reader. `restoreScope`
retains input-history/preference semantics. Both confirm **input focus only**;
TalkBack owns accessibility focus and speech. Generic reader-owned focus and
directional requests remain rejected. Apple and web currently return unavailable
for keyed restoration; the reference app uses this path only on Android.

Activation includes the live occurrence, mount, lifetime, source and sequence.
Input Select targets confirmed input focus; accessibility activation addresses its
semantic target without transferring input focus. Duplicate transport reports and
retired React registrations are rejected. `contentId` is application metadata and
does not participate in focus identity.

Android and the web probe accept `accessibilityRole="switch"` with
`accessibilityState={{checked: boolean}}` for Boolean controls. Ordinary buttons
can omit both props; changing back to a button clears checked semantics. Explicit
button/switch roles cannot also be adjustable. Android preserves the Switch class
after AppCompatButton initializes its node. Keep accessible labels free of decorative symbols;
`displayLabel` retains the visual text. Apple checked semantics are not implemented
by this contract and remain unverified. Native/DOM properties do not establish
spoken output or physical-device accessibility acceptance.

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
