# Apple engine boundary

`ItarEngineNative.podspec` packages the production C++20 engine and its Swift
owner for tvOS 15.1 or later. Add the local pod to the consumer's tvOS target:

```ruby
pod 'ItarEngineNative', :path => '<repository-root>'
```

The pod uses Swift language mode 5 and contains its C++20 settings. It does not
require application-wide Swift/C++ interoperability. Only `ItarEngine.h` is
public to the module. No React registration glue is needed for this value-only
increment. The existing `ItarProbeHost` remains a separate disposable fixture.

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

This boundary exposes explicit focus requests, observations and invalidation.
Directional UIKit cooperation, Codegen view registration, reveal execution,
presentation lifecycle, styles and VoiceOver host behavior are separate adapter
increments. This pod alone does not provide a React target component or a
complete Apple TV adapter.
