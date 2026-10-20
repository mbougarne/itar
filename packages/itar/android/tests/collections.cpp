#include "../src/main/cpp/scopes.hpp"
#include "../src/main/cpp/effects.hpp"
#include "../../../../core/tests/check.hpp"

using namespace itar;
using namespace itar::android;

int main() {
  Session s{1};
  const std::array<CollectionNode, 3> nodes{{
      {OccurrenceKey{"list"}, {}, 0, true, true, Layout::row, 100},
      {OccurrenceKey{"a"}, OccurrenceKey{"list"}, 0},
      {OccurrenceKey{"b"}, OccurrenceKey{"list"}, 1}}};
  CHECK(s.collections.apply(DatasetRevision{5}, nodes).status == CollectionStatus::applied);
  const auto scopeNode = s.state.snapshot().registry.find(OccurrenceKey{"list"});
  std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 15> mount{0, 0, 1, 0, 1, 1, 2, 0, 0, 80, 60, 0,
      scopeNode.slot.value, scopeNode.generation.value, 4};
  CHECK(registration(s, 1, mount, "a", out) == stale);
  mount[14] = 5;
  CHECK(registration(s, 1, mount, "a", out) == ok);
  const auto a = s.state.snapshot().registry.find(OccurrenceKey{"a"});
  CHECK(registration(s, 4, std::array<std::int64_t, 5>{0, 0, a.slot.value, a.generation.value, 1}, "", out) == ok);
  CHECK(input(s, 7, std::array<std::int64_t, 4>{1, 0, 1, 500}, out) == ok);
  CHECK(s.transactions.active() && s.transactions.active()->targetKey == OccurrenceKey{"b"});
  const auto effect = s.transactions.drainEffects()[0];
  CHECK(effect.dataset == DatasetRevision{5} && s.transactions.issue(effect.token).status == RequestStatus::issued);
  mount[0] = a.slot.value; mount[1] = a.generation.value; mount[11] = 1; mount[3] = 1;
  CHECK(registration(s, 1, mount, "b", out) == stale); // A recycled cell cannot rename logical A into B.
  mount[0] = mount[1] = mount[11] = 0; mount[2] = 2;
  CHECK(registration(s, 1, mount, "b", out) == ok);
  const auto b = s.state.snapshot().registry.find(OccurrenceKey{"b"});
  CHECK(s.transactions.active() && s.transactions.active()->id == effect.token.request);
  CHECK(registration(s, 2, std::array<std::int64_t, 4>{b.slot.value, b.generation.value, 2, 1}, "", out) == ok);
  CHECK(registration(s, 19, std::array<std::int64_t, 4>{b.slot.value, b.generation.value, 2, 1}, "", out) == ok);
  CHECK(s.state.snapshot().registry.find(OccurrenceKey{"b"}) == b);
  CHECK(!s.state.snapshot().registry.lookup(b)->mounted);
  CHECK(s.transactions.realize({effect.token, s.state.surface(), b, MountGeneration{2}, DatasetRevision{5}, true}).status == RequestStatus::stale);
}
