#include "../src/main/cpp/registration.hpp"
#include <cassert>

int main() {
  using namespace itar;
  using namespace itar::android;
  Session s{1};
  std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 11> v{0, 0, 1, 0, 1, 1, 2, 0, 0, 20, 20};
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  const NodeHandle first{NodeId{static_cast<std::uint32_t>(out[1])}, Generation{static_cast<std::uint32_t>(out[2])}};
  assert(registration(s, 1, v, "rail-b/movie", out) == ok);
  assert(s.state.snapshot().registry.size() == 2);
  assert(registration(s, 1, v, "rail-a/movie", out) < 0);
  const std::array<std::int64_t, 4> lost{first.slot.value, first.generation.value, 1, 1};
  assert(registration(s, 2, lost, "", out) == ok);
  assert(!s.state.snapshot().registry.lookup(first));
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  assert(out[1] != first.slot.value || out[2] != first.generation.value);
  assert(registration(s, 2, lost, "", out) == stale);
  v[0] = out[1]; v[1] = out[2];
  const std::array<std::int64_t, 4> dirty{v[0], v[1], 1, 2};
  assert(registration(s, 3, dirty, "", out) == ok);
  assert(registration(s, 1, v, "rail-a/movie", out) < 0); // Old layout cannot revive it.
  v[5] = 3;
  assert(registration(s, 1, v, "rail-a/movie", out) == ok);
  const auto revision = s.state.snapshot().revision;
  v[9] = -1;
  assert(registration(s, 1, v, "rail-a/movie", out) < 0);
  assert(s.state.snapshot().revision == revision);
  v[9] = 20; v[2] = -1;
  assert(registration(s, 1, v, "rail-a/movie", out) == conversion);
}
