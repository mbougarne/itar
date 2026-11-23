# How the focus engine works

[العربية](../ar/guides/architecture.md)

Consider a viewer moving Right from the last visible card in a rail. The next title has an entry in the catalogue, but the virtualizer may have recycled its view. Itar keeps the logical destination while the host mounts, scrolls and measures a view for it. The viewer can change direction during that work. The engine has to remember which request is still relevant and which view actually received focus.

The same C++ engine runs behind different host focus systems. The following contracts describe how those systems work together. For an individual runtime’s build and hardware observations, see the [device guides](../devices/README.md).

## Who owns a move

| Layer | Responsibility | Source |
| --- | --- | --- |
| React API | Declares stable keys, scopes, labels and styles. Sends explicit commands and routes their outcomes. Exposes observed state to selected subscribers. | [Public components](../../packages/itar/src/react.tsx), [store](../../packages/itar/src/api/store.ts) |
| React Native Fabric components | Carry props, commands and native events for a surface, scope and target. Native mount and layout callbacks establish the host facts. | [Codegen specs](../../packages/itar/src/specs) |
| C++20 core | Owns a surface's registry, logical topology, geometry records, navigation and request state. Computes proposals from committed data on a serialized owner. | [Public headers](../../core/include/itar), [implementation](../../core/src) |
| Collections | Publish logical membership, request render regions, acknowledge commits and retain source/target cells. The core selects the logical destination. The platform performs scrolling. | [React lists](../../packages/itar/src/virtualized.tsx), [collection store](../../packages/itar/src/api/collections.ts), [core collection model](../../core/include/itar/collection.hpp) |
| Android TV host | Kotlin owns Android views, input, accessibility, native focus and UI-thread dispatch. JNI copies bounded records between the host and C++. | [Kotlin adapter](../../packages/itar/android/src/main/java/com/itar/adapter), [JNI boundary](../../packages/itar/android/src/main/cpp), [Android host guide](../devices/android-tv.md) |
| Apple TV host | Swift owns the UIKit views and dispatcher. Objective-C++ integrates Fabric. Swift calls the C facade into the C++ owner. UIKit chooses ordinary mounted directions and gestures. Engine preferences and owned collection entry/reveal cooperate with UIKit. | [Apple adapter and C facade](../../packages/itar/apple), [Apple boundary](../../packages/itar/apple/README.md) |
| Browser demo host | The example build aliases `@bougarnem/itar/react` to DOM components. The C++ engine compiles to Wasm. JavaScript owns DOM input, rendering, measurement, scroll and focus. | [Browser host](../../apps/probe/web), [Wasm binding](../../apps/probe/web/engine), [Wasm boundary](../../apps/probe/web/engine/binding.cpp) |

The Android and tvOS hosts can perform supported native focus work without asking JavaScript to select a candidate on each key press. Rendering an offscreen React cell can still require JS. In the browser demo the DOM and Wasm share browser scheduling. The standalone `probes/` directories contain small experiments for specific host questions. The package's native implementation lives in `packages/itar/`. [Host probes](../../probes)

## Identity and state

An **occurrence key** identifies an application placement such as the opening title in Featured. Its content ID can also appear in other rails. A **node handle** contains the slot and registration generation. Removing and reinserting an entry can reuse its slot with a new generation. The **mount generation** distinguishes the host views that have displayed that registration over time. A **surface lifetime** separates completely different owners, including a replacement that uses the same application keys. [Identity types](../../core/include/itar/identity.hpp) · [Transaction types](../../core/include/itar/transaction.hpp)

`State` commits related declarative changes as one revision. A batch names its surface and expected revision, and the core validates the proposed topology before publishing. The native host can report a detach independently. A later rejected batch must preserve the fact that the old view is gone. Geometry carries surface, mount and layout identities so stale measurements cannot satisfy a new request. [Mutation protocol](../../core/include/itar/batch.hpp) · [Registry](../../core/include/itar/registry.hpp)

There are separate input and accessibility focus observations. **Managed** means Itar can identify the live target. **Unmanaged** means a foreign control has focus. **Absent** requires observation that the host has no focused target. **Unknown** means the adapter cannot currently determine it. Navigation, scope history, and activation rely on these distinctions. A screen reader may activate an accessible control other than the one that has input focus. [Focus and history](../../core/include/itar/focus.hpp)

## How a direction chooses a destination

A row walks its declared order for horizontal moves, and a column does the same for vertical moves. Disabled entries are skipped. Offscreen entries retain their position in the order. At an edge, the scope can stop, wrap to an eligible endpoint, or continue into a parent scope. A trap restricts movement to the active scope. Stable ties use declared order and occurrence key, so recycling a view cannot change a tie simply by giving it a new slot. [Order policy](../../core/src/navigation_order.cpp) · [Boundary policy](../../core/src/navigation_boundary.cpp)

For a spatial move, both edges of a candidate must advance along the requested axis. For instance, a row underneath a Search keyboard can extend farther to the right while starting farther left. Pressing Right in the keyboard should not select that row solely because its center is farther right. Among eligible rectangles, the engine ranks the forward gap, perpendicular separation and center offset. It requires fresh, visible geometry to issue a mounted move. [Geometry policy](../../core/src/navigation_geometry.cpp) · [Region regression tests](../../core/tests/navigation_regions.cpp)

When a move continues into a parent scope, its spatial search starts at the focused target. Moving another child within the scope leaves that starting point unchanged. In a column of rows, the column orders the rows vertically. Transposing the layout gives the same behavior for columns ordered horizontally.

When you press Down from the genre filters above a grid, Itar enters the first eligible row, then chooses the card whose center is closest to the filter’s horizontal position. Pressing Up into the same grid from below enters its last eligible row. A scope configured to restore focus on entry can return to a remembered card. [Scope entry and regression test](../../core/tests/navigation_entry.cpp)

## Follow one offscreen move

1. **Observe input.** The host identifies the source, input owner and active surface. A native control, text editor or reader may own that input. In that case the adapter leaves it to the host.
2. **Select a logical target.** The core reads a committed snapshot. Rows and columns can use declared order. Spatial navigation uses measured bounds and deterministic tie-breaking. Boundary, trap and scope-entry policies constrain the search. A query has no focus or scrolling side effects. [Navigation policy](../../core/include/itar/navigation.hpp)
3. **Start a transaction.** The engine records a request, original deadline, dataset, source and target. If the target lacks a usable view, the first effect asks for reveal. Consecutive same-direction repeats can join the request. Reversal resolves from observed focus.
4. **Realize and dispatch.** The host revalidates the effect before doing work. For a nested rail the collection can prepare the row and then its item. A matching committed view and fresh measurements allow the engine to issue a focus effect. Native callbacks can be synchronous, so the host queues copied observations and drains them on its owner thread. [Collection flow](collections.md#what-happens-offscreen)
5. **Confirm or revoke.** An accepted host API call alone leaves the request pending. A matching host observation can confirm input focus. Timeout, cancellation, disposal or a superseding request revokes authority. A late real observation may still update current focus. Its old request stays finished. [Transaction replay tests](../../core/tests/transaction_replay.cpp)

Native styling follows actual host focus. Labels, roles and enabled state have to be committed when a target becomes eligible. To investigate a jump, capture the source occurrence, its mount, request/effect IDs, dataset and the eventual host observation. Compare the input and accessibility channels independently. A view appearing onscreen proves it was rendered. The host observation tells you whether it received focus.

## Try the core without React

The core can run on a development machine with CMake 3.20+ and a C++20 compiler. These commands run the repository's deterministic tests, including host simulations for ordered navigation, stale mounts, repeat input and cancellation.

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure
```

For a minimal C++ consumer, save these two files in a new directory. This example commits a logical title and looks up its handle. The record starts unmounted, which is a valid state for a known offscreen title.

**main.cpp**

```cpp
#include <itar/state.hpp>
#include <iostream>
#include <span>

int main() {
  itar::State state{itar::SurfaceId{1}};
  itar::Mutation title;
  title.key = itar::OccurrenceKey::compose("home", "featured", "opening");

  const auto result = state.apply({
      state.surface(), state.snapshot().revision, std::span{&title, 1}});
  if (result.status != itar::BatchStatus::valid) {
    return 1;
  }

  const auto& registry = state.snapshot().registry;
  const auto handle = registry.find(title.key);
  const auto* record = registry.lookup(handle);
  if (!record) {
    return 1;
  }
  std::cout << "Registered " << registry.size()
            << " title, mounted = " << std::boolalpha << record->mounted << '\n';
}
```

**CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.20)
project(itar_example LANGUAGES C CXX)
add_subdirectory("${ITAR_SOURCE_DIR}/core" itar-core)
add_executable(example main.cpp)
target_link_libraries(example PRIVATE itar::core)
```

```sh
cmake -S . -B build -DITAR_SOURCE_DIR=/absolute/path/to/itar -DBUILD_TESTING=OFF
cmake --build build --target example
./build/example
```

Expected output is `Registered 1 title, mounted = false`. For the next step, [the transaction fixture](../../core/tests/transaction_fixture.hpp) registers a row, observes focus on entry 19 and can leave entry 20 unmounted. [Reveal tests](../../core/tests/transaction_reveal.cpp) drive the sequence from logical selection through realization. [Outcome tests](../../core/tests/transaction_outcome.cpp) exercise host confirmation and callback order. For a full host, keep the state alive for the transaction owner, supply monotonic time, and dispose the owner on teardown. [Independent core build](../../core/README.md)
