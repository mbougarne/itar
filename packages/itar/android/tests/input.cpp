#include "../src/main/cpp/input.hpp"
#include <cassert>

int main() {
  using namespace itar;
  using namespace itar::android;
  Session s{1};
  std::array<std::int64_t, 64> out{}, before{};
  std::array<std::int64_t, 11> v{0, 0, 1, 0, 1, 1, 2, 0, 0, 20, 20};
  assert(registration(s, 1, v, "a", out) == ok);
  const std::array<std::int64_t, 5> focus{0, 0, out[1], out[2], 1};
  v[7] = 100;
  assert(registration(s, 1, v, "b", out) == ok);
  const auto destination = out[1];
  assert(registration(s, 4, focus, "", out) == ok);
  assert(registration(s, 5, {}, "", before) == ok);
  const std::array<std::int64_t, 2> query{1, 0};
  for (int i = 0; i < 100; ++i) {
    assert(input(s, 6, query, out) == ok);
    assert(out[1] == 0 && out[2] == destination);
  }
  out = {};
  assert(registration(s, 5, {}, "", out) == ok && out == before);
  const std::array<std::int64_t, 4> press{1, 0, 1, 100};
  assert(input(s, 7, press, out) == ok);
  const auto request = s.transactions.active()->id;
  for (int i = 0; i < 1000; ++i) assert(input(s, 7, press, out) == ok);
  assert(s.transactions.active()->id == request && s.transactions.active()->deadline == 100);
  assert(input(s, 8, {}, out) == ok && !s.transactions.heldDirection());
  const std::array<std::int64_t, 2> nativeControl{1, 2};
  assert(input(s, 6, nativeControl, out) == ok);
  assert(out[1] == static_cast<std::int64_t>(ProposalKind::host_owned));
}
