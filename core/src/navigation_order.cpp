#include <itar/navigation.hpp>

namespace itar {

bool orderedAxis(const NodeRecord& scope, Direction direction) noexcept {
  return (scope.navigation.layout == Layout::row &&
          (direction == Direction::left || direction == Direction::right)) ||
         (scope.navigation.layout == Layout::column &&
          (direction == Direction::up || direction == Direction::down));
}

NodeHandle orderedDestination(const State& state, NodeHandle source,
                              Direction direction, const InputContext& input) noexcept {
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(source);
  const auto* scope = record ? registry.lookup(record->parent) : nullptr;
  if (!scope || !orderedAxis(*scope, direction)) { return {}; }
  const bool forward = (direction == Direction::right || direction == Direction::down)
                       != (scope->navigation.layout == Layout::row && scope->navigation.rtl);
  NodeHandle best;
  for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
    const auto node = registry.handleAt(i);
    const auto* candidate = registry.lookup(node);
    if (!candidate || candidate->parent != record->parent || node == source ||
        !logicalTarget(state, node) || !withinBoundary(state, node, input)) { continue; }
    const bool after = stableBefore(registry, source, node);
    if (after != forward) { continue; }
    if (!best || (forward ? stableBefore(registry, node, best)
                          : stableBefore(registry, best, node))) { best = node; }
  }
  return best;
}

Proposal resolve(const State& state, Direction direction,
                 const InputContext& input) noexcept {
  auto result = resolveOverride(state, direction, input);
  if (result.kind != ProposalKind::ready || result.target) { return result; }
  const auto& registry = state.snapshot().registry;
  auto source = input.source.node;
  bool continued = false;
  for (std::size_t depth = 0; depth <= registry.size(); ++depth) {
    const auto* record = registry.lookup(source);
    if (!record) { break; }
    auto target = orderedDestination(state, source, direction, input);
    auto reason = ProposalReason::ordered;
    const auto* scope = registry.lookup(record->parent);
    if (!target && (!scope || !orderedAxis(*scope, direction))) {
      if (!regionBounds(state, source, input)) {
        result.kind = ProposalKind::unavailable;
        result.reason = ProposalReason::stale_geometry;
        return result;
      }
      target = geometricDestination(state, source, direction, input);
      reason = ProposalReason::geometric;
    }
    if (target) {
      result = proposeTarget(state, target, input);
      result.reason = continued ? ProposalReason::parent_continuation : reason;
      return result;
    }
    result = boundaryProposal(state, record->parent, direction, input, source);
    if (result.reason != ProposalReason::parent_continuation) { return result; }
    source = record->parent;
    continued = true;
  }
  result.kind = ProposalKind::boundary;
  result.reason = ProposalReason::stop;
  return result;
}

}  // namespace itar
