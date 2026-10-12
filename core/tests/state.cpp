#include <itar/state.hpp>

#include <array>

#include "check.hpp"

using namespace itar;

int main() {
  State state{SurfaceId{1}, {2}, 3};
  Mutation parent;
  parent.key = OccurrenceKey{"scope"};
  parent.record.scope = true;
  Mutation child;
  child.key = OccurrenceKey{"item"};
  child.parent = parent.key;
  auto operations = std::array{child, parent};
  auto result = state.apply({state.surface(), {}, operations});
  CHECK(result.status == BatchStatus::valid && result.revision == Revision{1});
  CHECK(result.changed.size() == 2 && state.snapshot().registry.size() == 2);
  const auto item = state.snapshot().registry.find(child.key);
  const auto scope = state.snapshot().registry.find(parent.key);
  CHECK(state.snapshot().registry.lookup(item)->parent == scope);
  auto oldSnapshot = state.snapshot();  // Value copy for observer evidence.
  operations[0].kind = MutationKind::update;
  operations[0].expected = item;
  operations[0].record.enabled = false;
  operations[1].key = OccurrenceKey{"too many"};
  result = state.apply({state.surface(), Revision{1}, operations});
  CHECK(result.status == BatchStatus::capacity && result.changed.empty());
  CHECK(state.snapshot().revision == Revision{1});
  CHECK(state.snapshot().registry.lookup(item)->enabled);
  operations[1] = parent;
  operations[1].kind = MutationKind::replace;
  operations[1].expected = scope;
  result = state.apply({state.surface(), Revision{1}, operations});
  CHECK(result.status == BatchStatus::valid && result.revision == Revision{2});
  CHECK(result.changed.size() == 2);
  CHECK(!state.snapshot().registry.lookup(scope));
  CHECK(!state.snapshot().registry.lookup(item)->enabled);
  CHECK(oldSnapshot.registry.lookup(scope) &&
        oldSnapshot.registry.lookup(item)->enabled);
  // Unchanged child is included when replacing its scope changes the parent
  // handle.
  parent.expected = state.snapshot().registry.find(parent.key);
  parent.kind = MutationKind::replace;
  result = state.apply({state.surface(), Revision{2}, std::span{&parent, 1}});
  CHECK(result.changed.size() == 2 && result.revision == Revision{3});
  parent.expected = state.snapshot().registry.find(parent.key);
  result = state.apply({state.surface(), Revision{3}, std::span{&parent, 1}});
  CHECK(result.status == BatchStatus::revision_exhausted &&
        result.changed.empty());
  CHECK(state.snapshot().revision == Revision{3});
  CHECK(state.apply({state.surface(), Revision{3}, {}}).revision ==
        Revision{3});
  CHECK(state.apply({state.surface(), Revision{2}, {}}).status ==
        BatchStatus::revision_mismatch);
}
