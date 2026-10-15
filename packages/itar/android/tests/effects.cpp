#include "../src/main/cpp/effects.hpp"
#include <cassert>

int main() {
  using namespace itar;
  using namespace itar::android;
  Session s{1};
  std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 11> view{0, 0, 1, 0, 1, 1, 2, 0, 0, 20, 20};
  assert(registration(s, 1, view, "a", out) == ok);
  const std::array<std::int64_t, 5> a{0, 0, out[1], out[2], 1};
  view[7] = 100;
  assert(registration(s, 1, view, "b", out) == ok);
  const std::array<std::int64_t, 5> b{0, 0, out[1], out[2], 1};
  assert(registration(s, 4, a, "", out) == ok);
  const std::array<std::int64_t, 3> command{0, 1, 100};
  assert(effects(s, 9, command, "b", out) == ok);
  const auto request = out[2];
  assert(effects(s, 10, {}, "", out) == ok && out[1] == 1);
  const std::array<std::int64_t, 4> issued{out[2], out[3], out[4], out[5]};
  assert(effects(s, 11, issued, "", out) == ok && out[3] == 1);
  const std::array<std::int64_t, 1> cancel{request};
  assert(effects(s, 13, cancel, "", out) == ok);
  assert(!s.transactions.active());
  // Late actual focus is reconciled without resurrecting the cancelled request.
  assert(registration(s, 4, b, "", out) == ok);
  const std::array<std::int64_t, 5> completed{issued[0], issued[1], issued[2], issued[3], 2};
  assert(effects(s, 12, completed, "", out) == ok);
  assert(effects(s, 12, completed, "", out) == ok);
  for (;;) {
    out = {};
    assert(effects(s, 15, {}, "", out) == ok);
    if (!out[1]) break;
    assert(out[7] == 0);
  }
  auto staleToken = issued; staleToken[0]++;
  assert(effects(s, 11, staleToken, "", out) == ok && out[3] == 0);
  assert(effects(s, 16, {}, "", out) == ok);
}
