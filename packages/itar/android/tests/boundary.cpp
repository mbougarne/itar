#include "../src/main/cpp/boundary.hpp"
#include <cassert>
#include <stdexcept>

int main() {
  using namespace itar::android;
  Boundary boundary;
  const auto first = boundary.create();
  assert(first > 0);
  assert(boundary.access(first, [](Session& s) {
    return s.state.surface().value > 0 ? ok : failure;
  }) == ok);
  assert(boundary.access(first, [](Session&) -> int { throw std::bad_alloc{}; }) == resource);
  assert(boundary.access(first, [](Session&) -> int { throw std::runtime_error("contained"); }) == failure);
  std::thread other([&] {
    assert(boundary.create() == wrong_thread);
    assert(boundary.close(first) == wrong_thread);
    assert(boundary.access(first, [](Session&) { return ok; }) == wrong_thread);
  });
  other.join();
  assert(boundary.close(first) == ok);
  assert(boundary.close(first) == stale);
  const auto second = boundary.create();
  assert(second > first);
  assert(boundary.access(first, [](Session&) { return ok; }) == stale);
  for (int i = 0; i < 7; ++i) assert(boundary.create() > 0);
  assert(boundary.create() == resource);
  assert(boundary.close(second) == ok);
  assert(boundary.create() > second);
}
