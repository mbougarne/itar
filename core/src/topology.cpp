#include <itar/topology.hpp>

#include <algorithm>

namespace itar {

bool effectivelyActive(const Registry& registry, NodeHandle node) noexcept {
  for (std::size_t depth = 0; depth < registry.size(); ++depth) {
    const auto* record = registry.lookup(node);
    if (!record || !record->active) {
      return false;
    }
    if (!record->parent) {
      return true;
    }
    const auto* parent = registry.lookup(record->parent);
    if (!parent || !parent->scope) {
      return false;
    }
    node = record->parent;
  }
  return false;
}

bool descendantOf(const Registry& registry, NodeHandle node,
                  NodeHandle scope) noexcept {
  const auto* ancestor = registry.lookup(scope);
  if (!ancestor || !ancestor->scope) {
    return false;
  }
  for (std::size_t depth = 0; depth < registry.size(); ++depth) {
    const auto* record = registry.lookup(node);
    if (!record || !record->parent) {
      return false;
    }
    if (record->parent == scope) {
      return true;
    }
    node = record->parent;
  }
  return false;
}

std::vector<NodeHandle> orderedChildren(const Registry& registry,
                                      NodeHandle parent) {
  auto children = registry.handles();
  std::erase_if(children, [&](NodeHandle node) {
    return registry.lookup(node)->parent != parent;
  });
  std::sort(children.begin(), children.end(), [&](NodeHandle a, NodeHandle b) {
    const auto aOrder = registry.lookup(a)->order;
    const auto bOrder = registry.lookup(b)->order;
    return aOrder != bOrder ? aOrder < bOrder : a.slot.value < b.slot.value;
  });
  return children;
}

}  // namespace itar
