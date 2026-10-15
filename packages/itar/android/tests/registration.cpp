#include "../src/main/cpp/registration.hpp"

#include <cassert>

int main() {
  using namespace itar;
  using namespace itar::android;
  Session s{1};
  std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 12> v{0, 0, 1, 0, 1, 1, 2, 0, 0, 20, 20};
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  const NodeHandle first{NodeId{static_cast<std::uint32_t>(out[1])},
                         Generation{static_cast<std::uint32_t>(out[2])}};
  assert(registration(s, 1, v, "rail-b/movie", out) == ok);
  assert(s.state.snapshot().registry.size() == 2);
  assert(registration(s, 1, v, "rail-a/movie", out) < 0);
  const std::array<std::int64_t, 4> lost{first.slot.value,
                                         first.generation.value, 1, 1};
  assert(registration(s, 2, lost, "", out) == ok);
  assert(s.state.snapshot().registry.lookup(first));
  assert(!s.state.snapshot().registry.lookup(first)->mounted);
  auto revival = v;
  revival[0] = first.slot.value;
  revival[1] = first.generation.value;
  revival[11] = 1;
  assert(registration(s, 1, revival, "rail-a/movie", out) < 0);
  v[2] = 2;
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  assert(out[1] == first.slot.value && out[2] == first.generation.value);
  assert(out[3] == 2);
  assert(registration(s, 2, lost, "", out) == stale);
  v[0] = out[1];
  v[1] = out[2];
  v[11] = 2;
  const std::array<std::int64_t, 4> dirty{v[0], v[1], 2, 2};
  assert(registration(s, 3, dirty, "", out) == ok);
  assert(registration(s, 1, v, "rail-a/movie", out) <
         0); // Old layout cannot revive it.
  v[5] = 3;
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  const auto revision = s.state.snapshot().revision;
  v[9] = -1;
  assert(registration(s, 1, v, "rail-a/movie", out) < 0);
  assert(s.state.snapshot().revision == revision);
  v[9] = 20;
  const auto logical =
      s.state.snapshot().registry.find(OccurrenceKey{"rail-a/movie"});
  const std::array<std::int64_t, 4> detached{logical.slot.value,
                                             logical.generation.value, 2, 3};
  assert(registration(s, 2, detached, "", out) == ok);
  const auto beforeRename = s.state.snapshot().revision;
  v[2] = 3;
  v[11] = 1;
  assert(registration(s, 1, v, "rail-c/movie", out) == stale);
  v[11] = 2;
  assert(registration(s, 1, v, "rail-b/movie", out) < 0);
  assert(s.state.snapshot().revision == beforeRename);
  assert(s.state.snapshot().registry.find(OccurrenceKey{"rail-a/movie"}) ==
         logical);
  assert(!s.state.snapshot().registry.lookup(logical)->mounted);
  assert(registration(s, 1, v, "rail-c/movie", out) == ok);
  assert(!s.state.snapshot().registry.find(OccurrenceKey{"rail-a/movie"}));
  const std::array<std::int64_t, 4> drop{out[1], out[2], 3, 3};
  assert(registration(s, 19, drop, "", out) == ok);
  assert(registration(s, 19, drop, "", out) == stale);
  assert(!s.state.snapshot().registry.find(OccurrenceKey{"rail-c/movie"}));
  v[2] = -1;
  assert(registration(s, 1, v, "rail-a/movie", out) == conversion);
}
