#include <itar/navigation.hpp>

namespace itar {

bool stableBefore(const Registry& registry, NodeHandle a, NodeHandle b) noexcept {
  const auto aOrder = registry.lookup(a)->order;
  const auto bOrder = registry.lookup(b)->order;
  return aOrder != bOrder ? aOrder < bOrder
                         : registry.key(a)->value() < registry.key(b)->value();
}

Proposal resolveOverride(const State& state, Direction direction,
                         const InputContext& input) noexcept {
  auto result = gateNavigation(state, input);
  if (result.kind != ProposalKind::ready) { return result; }
  const auto index = static_cast<std::size_t>(direction);
  if (index >= 4) {
    result.kind = ProposalKind::unavailable;
    result.reason = ProposalReason::invalid_direction;
    return result;
  }
  const auto target = state.snapshot().registry.lookup(input.source.node)
                          ->navigation.overrides[index];
  if (!target) { return result; }  // No override; caller continues ordinary selection.
  if (target == input.source.node || !state.snapshot().registry.lookup(target)) {
    result.kind = ProposalKind::unavailable;
    result.reason = ProposalReason::invalid_override;
    return result;
  }
  result = proposeTarget(state, target, input);
  if (result.target) { result.reason = ProposalReason::override_target; }
  return result;
}

Proposal boundaryProposal(const State& state, NodeHandle scope,
                          Direction direction, const InputContext& input) noexcept {
  auto result = gateNavigation(state, input);
  if (result.kind != ProposalKind::ready) { return result; }
  result.kind = ProposalKind::boundary;
  result.reason = ProposalReason::stop;
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(scope);
  if (!record || !record->scope) { return result; }
  if (record->navigation.boundary == Boundary::parent) {
    if (scope != input.authority && !record->navigation.trap) {
      result.reason = ProposalReason::parent_continuation;
    }
  } else if (record->navigation.boundary == Boundary::wrap) {
    if (static_cast<std::size_t>(direction) >= 4) {
      result.reason = ProposalReason::invalid_direction;
      return result;
    }
    if (!orderedAxis(*record, direction)) { return result; }
    const bool forward = direction == Direction::right || direction == Direction::down;
    const bool first = forward != (record->navigation.layout == Layout::row &&
                                    record->navigation.rtl);
    NodeHandle best;
    for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
      const auto node = registry.handleAt(i);
      const auto* child = registry.lookup(node);
      if (!child || child->parent != scope || node == input.source.node ||
          !logicalTarget(state, node) || !withinBoundary(state, node, input)) { continue; }
      if (!best || (first ? stableBefore(registry, node, best)
                          : stableBefore(registry, best, node))) { best = node; }
    }
    if (best) {
      result = proposeTarget(state, best, input);
      result.reason = ProposalReason::wrapped;
    }
  }
  return result;
}

}  // namespace itar
