# Apple engine boundary

`packages/itar/ItarEngineNative.podspec` packages the production C++20 engine and its Swift
owner with a declared tvOS 15.1 deployment target. Add the local pod to the consumer's tvOS target:

```ruby
pod 'ItarEngineCore', :path => '<repository-root>'
pod 'ItarEngineNative', :path => '<repository-root>/packages/itar'
```

The pod uses Swift language mode 5 and contains its C++20 settings. It does not
require application-wide Swift/C++ interoperability. Only `ItarEngine.h` is
public in the core module. The Swift pod imports that C module; the C++ sources
compile in the repository-root core pod. `ComponentViews.mm` registers the shared Fabric carriers
and forwards props, commands and events to Swift. The existing `ItarProbeHost`
remains a separate disposable fixture.

Each `EngineConnection` owns one production surface's registry and transactions.
The native surface owner supplies nonzero surface/lifetime identities and keeps
creation, use and destruction on the main thread. Lifetimes must distinguish
replacement surfaces. Registry slots/generations identify logical registrations;
mount generations independently identify successive host attachments.

The C facade reports transport failure independently from engine batch/request
status. A successful C call does not imply a committed batch or confirmed focus.
Inspect batch `code == 0` before publishing corresponding host props. Issue a
copied effect only after `ITAR_REQUEST_ISSUED`; report UIKit acceptance separately
from a real focus observation. Cancellation names its original request/effect.
Late host changes still need observation after cancellation.

Buffers passed to C are borrowed for that call only. Keys are length-delimited,
copied and limited to 512 bytes. The registry has a configured capacity of
1–4096 records; atomic batches permit at most twice that capacity. Effect and
notification outputs use caller-owned 32-record buffers. Insufficient output
capacity consumes nothing. The facade returns no C++ containers or view pointers
and invokes no callbacks. Resource failures escaping engine preparation revoke
the owner; create a new surface instead of retrying a potentially partial call.

Disposal is idempotent and revokes authority. Destruction frees storage exactly
once; no caller may use the pointer afterward. Swift clears its pointer on close.
A host dispatcher must defer destruction until active host calls unwind and must
queue copied callbacks rather than recursively mutating the engine. Time is an
explicit monotonic host input; the snapshot exposes the next absolute deadline.

Import `AppleSurface`, `AppleTarget` and `AppleCommands` from `itar/apple` for the
mounted carrier. Targets require a unique occurrence key and committed label;
their role is button, with enabled/disabled state and native activation.
`baseColor` and `focusColor` configure the native border: width 1 at rest, 5 while
actually focused. UIKit keeps its native scale/parallax. Reduced motion applies
the border immediately; otherwise it uses the focus animation coordinator.

UIKit chooses mounted directional destinations and owns gestures, text and player
controls. Explicit engine effects use focus preferences. The selected virtualized
list also owns cold-path arrow presses while a collection transfer is pending;
gesture and momentum parity is unverified. Actual callbacks and queried focus
supply confirmation. Missing registration does not imply absent host focus.

Geometry is committed in surface coordinates. Detach/reuse invalidates the old
mount independently of prop batches. Layout and observed owned scroll offsets
invalidate measurements before replacement publication. Transforms, invalid
bounds and partial clipping make a target unavailable. The fixed-extent
`itar/react` list prepares bounded render regions before token-checked,
nonanimated native scrolling and committed-geometry realization. See the
[collection API](../virtualization.md) for its limits.
The owned carrier bounds traversal to 4096 views and 256 targets; exceeding a
limit revokes the surface. Detach retains logical identity until recycle, while
retired mounts cannot delete a newer attachment with the same occurrence key.

Owned dialog commands suspend the opener before presentation, hide covered
semantics, and create an independent managed root in the existing UIKit window.
Dismissal reconciles native restoration before consuming a value-only engine
opener token. The core chooses deletion recovery; unmanaged or unknown native
focus suppresses restoration. Arbitrary RN Modal and separate-window routing
remain separate work.

VoiceOver state and focus observations stay native and separate from input focus.
Reader ownership cancels pending managed intent. Accessibility activation uses
the live semantic target without an input-focus transfer or custom announcement.
The carrier and reference screen are provisional; the later provider/hooks API,
physical remote/VoiceOver acceptance and release support are separate gates.
