#pragma once

#include <itar/registry.hpp>

namespace itar {

// Read-only queries over a valid snapshot; malformed ancestry fails closed.
bool effectivelyActive(const Registry& registry, NodeHandle node) noexcept;
bool descendantOf(const Registry& registry, NodeHandle node,
                  NodeHandle scope) noexcept;
std::vector<NodeHandle> orderedChildren(const Registry& registry,
                                      NodeHandle parent);

}  // namespace itar
