#include <itar/topology.hpp>

#include "check.hpp"

using namespace itar;

int main() {
  Registry registry;
  NodeRecord scope;
  scope.scope = true;
  const auto root = registry.insert(OccurrenceKey{"root"}, scope).handle;
  scope.parent = root;
  const auto nested = registry.insert(OccurrenceKey{"nested"}, scope).handle;
  scope.parent = {};
  const auto independent =
      registry.insert(OccurrenceKey{"other"}, scope).handle;
  NodeRecord item;
  item.parent = nested;
  item.order = 20;
  const auto a = registry.insert(OccurrenceKey{"a"}, item).handle;
  item.order = 10;
  const auto b = registry.insert(OccurrenceKey{"b"}, item).handle;
  CHECK(effectivelyActive(registry, a));
  CHECK(descendantOf(registry, a, root) && descendantOf(registry, a, nested));
  CHECK(!descendantOf(registry, a, independent));
  CHECK((orderedChildren(registry, nested) == std::vector<NodeHandle>{b, a}));
  CHECK(orderedChildren(registry, independent).empty());
  auto rootRecord = *registry.lookup(root);
  rootRecord.active = false;
  CHECK(registry.replace(root, rootRecord));
  CHECK(!effectivelyActive(registry, a) &&
        !effectivelyActive(registry, nested));
  CHECK(effectivelyActive(registry, independent));
  item.parent = independent;
  CHECK(registry.replace(a, item));
  CHECK(effectivelyActive(registry, a) &&
        descendantOf(registry, a, independent));
  CHECK(!descendantOf(registry, a, root));
  CHECK((orderedChildren(registry, nested) == std::vector<NodeHandle>{b}));
  CHECK(!effectivelyActive(registry, {}));
  CHECK(!descendantOf(registry, {}, root));
  rootRecord.parent =
      nested;  // Defensive bounded behavior on a malformed cycle.
  CHECK(registry.replace(root, rootRecord));
  CHECK(!effectivelyActive(registry, nested));
}
