#include <itar/navigation.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

namespace itar {

Proposal gateNavigation(const State& state, const InputContext& input) noexcept {
  Proposal result;
  result.surface = state.surface();
  result.revision = state.snapshot().revision;
  result.authority = input.authority;
  result.source = input.source;
  if (!state.surface() || input.surface != state.surface()) {
    result.reason = ProposalReason::stale_surface;
  } else if (input.owner != InputOwner::engine ||
             state.snapshot().inputFocus.kind == FocusKind::unmanaged) {
    result.kind = ProposalKind::host_owned;
    result.reason = ProposalReason::host_input;
  } else if (input.authority &&
             (!state.snapshot().registry.lookup(input.authority) ||
              !state.snapshot().registry.lookup(input.authority)->scope ||
              !effectivelyActive(state.snapshot().registry, input.authority))) {
    result.reason = ProposalReason::no_authority;
  } else if (state.snapshot().inputFocus.kind == FocusKind::unknown) {
    result.reason = ProposalReason::unknown_source;
  } else if (state.snapshot().inputFocus.kind == FocusKind::absent) {
    result.reason = ProposalReason::absent_source;
  } else if (input.source != state.snapshot().inputFocus ||
             !liveFocus(state.snapshot().registry, input.source)) {
    result.reason = ProposalReason::stale_source;
  } else if (!logicalTarget(state, input.source.node) ||
             !withinBoundary(state, input.source.node, input)) {
    result.reason = ProposalReason::ineligible;
  } else {
    result.kind = ProposalKind::ready;
    result.reason = ProposalReason::selected;
  }
  return result;
}

bool logicalTarget(const State& state, NodeHandle node) noexcept {
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(node);
  if (!record || record->scope || !effectivelyActive(registry, node)) {
    return false;
  }
  for (std::size_t depth = 0; depth < registry.size(); ++depth) {
    const auto* ancestor = registry.lookup(node);
    if (!ancestor || !ancestor->enabled) {
      return false;
    }
    if (!ancestor->parent) {
      return true;
    }
    node = ancestor->parent;
  }
  return false;
}

bool withinBoundary(const State& state, NodeHandle target,
                    const InputContext& input) noexcept {
  const auto& registry = state.snapshot().registry;
  if (input.authority && !descendantOf(registry, target, input.authority)) {
    return false;
  }
  auto ancestor = input.source.node;
  for (std::size_t depth = 0; depth < registry.size() && ancestor; ++depth) {
    const auto* record = registry.lookup(ancestor);
    if (!record) { return false; }
    if (record->scope && record->navigation.trap &&
        !descendantOf(registry, target, ancestor)) { return false; }
    ancestor = record->parent;
  }
  return !ancestor;
}

Proposal proposeTarget(const State& state, NodeHandle target,
                       const InputContext& input) noexcept {
  auto result = gateNavigation(state, input);
  if (result.kind != ProposalKind::ready) {
    return result;
  }
  if (!withinBoundary(state, target, input)) {
    result.kind = ProposalKind::boundary;
    result.reason = ProposalReason::outside_boundary;
  } else if (!logicalTarget(state, target)) {
    result.kind = ProposalKind::unavailable;
    result.reason = ProposalReason::ineligible;
  } else {
    result.target = target;
    const auto* record = state.snapshot().registry.lookup(target);
    result.kind = usableGeometry(state.snapshot(), state.surface(), target)
                      ? ProposalKind::ready : ProposalKind::reveal;
    if (result.kind == ProposalKind::ready) {
      result.mount = record->mount;
    }
  }
  return result;
}

}  // namespace itar
