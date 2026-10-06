# Portable probe seam (ITAR-0005)

`itar::probe` is a separate CMake target containing a disposable two-target
fixture. Include `<itar/probe/surface.hpp>`. A sits below B: A/Up proposes B,
B/Down proposes A; all other valid directions stop at a boundary. This is not
production selection, registration, input ownership, or host focus control.
The production `itar::core` target does not link this implementation.

The native adapter owns one `Surface` on a serialized owner thread and passes
copied values. It assigns a nonzero surface lifetime unique across replacements,
nonzero occurrence IDs, and nonzero slot/generation pairs. IDs denote occurrences,
not content IDs or array indices. The numeric probe tokens do not freeze the
production key representation. Two simultaneous targets must have distinct
occurrences and slots. Invalid construction fails closed with `Status::invalid`.

`resolve(expectedLifetime, observation, direction)` is const, allocation-free,
and has no callbacks/effects. Managed observations require exact occurrence and
mount identity. Unmanaged, host-confirmed absent and unknown remain distinct
outcomes without targets. Missing registration or a detached source returns
unavailable, never absence. Accessibility focus remains separately host-owned.
An optional result target is a proposal, never confirmation or authority to
issue a delayed effect. Native probes must revalidate lifetime and mappings
immediately before dispatch, then capture actual host focus independently.

`invalidate` irreversibly removes availability for the matching mount. Repeated
invalidation is idempotent; old lifetimes/generations cannot affect live targets.
Remount/recycling experiments create fresh fixture values with new generations.
`dispose` immediately revokes the surface; the owner keeps the object alive until
active host calls unwind and queued callbacks can no longer dereference it.
Never call a destroyed object: lifetime tokens do not make dangling pointers safe.

No host views, borrowed strings/buffers, JNI objects or UIKit references cross
this C++ seam. Methods are noexcept and store only bounded inline values. Native
C/JNI conversion, opaque handle ownership and callback inbox guards belong to
ITAR-0007/0014; C++ types are not a C ABI or a direct Swift-import promise.
Use the [shared cases](native-probe-scenarios.md) for host experiments.

## Verification

Run the commands in [core/README.md](../core/README.md), optionally adding
`-DCMAKE_CXX_FLAGS='-Wall -Wextra -Wpedantic -Werror'`. The `probe.surface` case
covers A/B movement, repeatable queries, all observation states, boundaries,
stale lifetime/mount/occurrence tokens, invalid enums/configuration, detach,
idempotent invalidation/disposal, and replacement lifetimes. Tests use exit
status in Release, not assertions disabled by NDEBUG.

Local Apple Clang 21 / CMake 3.31.6 Release and ASan/UBSan passed 3/3 CTest cases each. Native round
trips, devices, source-removal prevention/recovery, visuals and readers have not
run; portable results establish none of those capabilities. This cohesive change
exceeds the 250-line target to keep identity/lifetime behavior and its regression
cases together; it remains below the 500-line ceiling.
