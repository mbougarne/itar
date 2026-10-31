#include <itar/navigation.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include <cmath>
#include <limits>

namespace itar {

bool entryCandidate(const State& state, NodeHandle node, NodeHandle scope,
                    const InputContext& input) noexcept {
  const auto& registry = state.snapshot().registry;
  if (!logicalTarget(state, node) || !descendantOf(registry, node, scope) ||
      !withinBoundary(state, node, input)) { return false; }
  auto parent = registry.lookup(node)->parent;
  for (std::size_t depth = 0; parent && depth < registry.size(); ++depth) {
    const auto* ancestor = registry.lookup(parent);
    if (!ancestor || !ancestor->navigation.entryReady) { return false; }
    if (parent == scope) { return true; }
    parent = ancestor->parent;
  }
  return false;
}

bool selectableDestination(const State& state, NodeHandle node,
                           const InputContext& input) noexcept {
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(node);
  if (!record) { return false; }
  if (!record->scope) { return logicalTarget(state, node) && withinBoundary(state, node, input); }
  for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
    if (entryCandidate(state, registry.handleAt(i), node, input)) { return true; }
  }
  return false;
}

Proposal resolveEntry(const State& state, NodeHandle scope,
                      const InputContext& input, EntryContext entry) noexcept {
  auto result = gateNavigation(state, input);
  const auto& registry = state.snapshot().registry;
  const auto* region = registry.lookup(scope);
  const auto focus = state.snapshot().inputFocus;
  // Explicit entry can start from confirmed absence, never from unknown host focus.
  if (result.kind != ProposalKind::ready && result.reason != ProposalReason::absent_source) {
    return result;
  }
  if (input.source != focus) {
    result.kind = ProposalKind::unavailable;
    result.reason = ProposalReason::stale_source;
    return result;
  }
  result.kind = ProposalKind::unavailable;
  result.reason = ProposalReason::no_entry;
  if (!region || !region->scope || !region->enabled || !effectivelyActive(registry, scope)) {
    return result;
  }
  if (!region->navigation.entryReady) {
    result.reason = ProposalReason::entry_not_ready;
    return result;
  }
  if (entry.reason != EntryReason::first && entry.reason != EntryReason::returning &&
      entry.reason != EntryReason::adjacent) { return result; }
  if (static_cast<std::size_t>(entry.direction) >= 4) {
    result.reason = ProposalReason::invalid_direction;
    return result;
  }
  if (entry.anchor && !std::isfinite(*entry.anchor)) {
    result.reason = ProposalReason::invalid_anchor;
    return result;
  }
  const auto eligible = [&](NodeHandle node) {
    return entryCandidate(state, node, scope, input);
  };
  if (focus.kind == FocusKind::managed &&
      (entry.reason == EntryReason::first || eligible(focus.node))) {
    result.kind = ProposalKind::boundary;
    result.reason = ProposalReason::existing_focus;
    return result;
  }
  if (entry.reason == EntryReason::adjacent && focus.kind != FocusKind::managed) {
    return result;
  }
  NodeHandle best;
  const bool restore = entry.reason == EntryReason::returning ||
      (entry.reason == EntryReason::adjacent && region->navigation.restoreOnEntry);
  const bool anchored = entry.reason == EntryReason::adjacent && !restore;
  if (restore) {
    if (const auto* history = state.history(scope)) { best = registry.find(*history); }
  }
  if (!eligible(best)) { best = {}; }
  if (!best && !anchored) {
    if (const auto* preferred = registry.preferred(scope)) {
      const auto candidate = registry.find(*preferred);
      if (eligible(candidate)) { best = candidate; }
      else if (entry.reason == EntryReason::first) { return result; }
    }
  }
  const bool horizontal = entry.direction == Direction::left || entry.direction == Direction::right;
  if (!entry.anchor && anchored) {
    if (const auto source = usableGeometry(state.snapshot(), state.surface(), input.source.node)) {
      const auto r = source->bounds;
      entry.anchor = horizontal ? r.y + r.height / 2 : r.x + r.width / 2;
    }
  }
  long double distance = std::numeric_limits<long double>::infinity();
  if (!best) {
    for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
      const auto node = registry.handleAt(i);
      if (!eligible(node)) { continue; }
      auto rank = std::numeric_limits<long double>::infinity();
      if (anchored && entry.anchor) {
        if (const auto geometry = usableGeometry(state.snapshot(), state.surface(), node)) {
          const auto r = geometry->bounds;
          const long double center = horizontal ? static_cast<long double>(r.y) + r.height / 2
                                                : static_cast<long double>(r.x) + r.width / 2;
          rank = std::abs(center - *entry.anchor);
        }
      }
      if (!best || rank < distance || (rank == distance && stableBefore(registry, node, best))) {
        best = node;
        distance = rank;
      }
    }
  }
  if (!best) { return result; }
  result.target = best;
  result.kind = usableGeometry(state.snapshot(), state.surface(), best)
                    ? ProposalKind::ready : ProposalKind::reveal;
  result.mount = result.kind == ProposalKind::ready ? registry.lookup(best)->mount : MountGeneration{};
  result.reason = entry.reason == EntryReason::first ? ProposalReason::first_entry
                  : restore ? ProposalReason::restoration
                                                          : ProposalReason::anchor_entry;
  return result;
}

Proposal enterDestination(const State& state, NodeHandle target, Direction direction,
                          const InputContext& input) noexcept {
  const auto* record = state.snapshot().registry.lookup(target);
  return record && record->scope
             ? resolveEntry(state, target, input, {EntryReason::adjacent, direction, {}})
             : proposeTarget(state, target, input);
}

}  // namespace itar
