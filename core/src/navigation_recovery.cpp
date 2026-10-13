#include <itar/navigation.hpp>
#include <itar/topology.hpp>

namespace itar {

std::optional<RecoveryOrigin> captureRecovery(const State& state) {
  const auto& snapshot = state.snapshot();
  if (!liveFocus(snapshot.registry, snapshot.inputFocus) ||
      !logicalTarget(state, snapshot.inputFocus.node)) { return {}; }
  const auto& registry = snapshot.registry;
  const auto* record = registry.lookup(snapshot.inputFocus.node);
  RecoveryOrigin result{state.surface(), snapshot.revision,
                        *registry.key(snapshot.inputFocus.node), record->order, {}};
  result.ancestors.reserve(registry.size());
  auto parent = record->parent;
  for (std::size_t depth = 0; parent && depth < registry.size(); ++depth) {
    result.ancestors.push_back({*registry.key(parent), parent});
    parent = registry.lookup(parent)->parent;
  }
  result.ancestors.push_back({{}, {}});  // Surface-root sibling recovery.
  return result;
}

Proposal resolveRecovery(const State& state, const RecoveryOrigin& origin,
                         const InputContext& input) noexcept {
  auto result = gateNavigation(state, input);
  if (origin.surface != state.surface()) {
    result.kind = ProposalKind::unavailable;
    result.reason = ProposalReason::stale_surface;
    return result;
  }
  if (result.kind == ProposalKind::ready) {
    result.kind = ProposalKind::boundary;
    result.reason = ProposalReason::host_reassigned;
    return result;
  }
  if (result.reason != ProposalReason::absent_source ||
      input.source != state.snapshot().inputFocus) { return result; }
  result.kind = ProposalKind::unavailable;
  result.reason = ProposalReason::no_recovery;
  const auto& registry = state.snapshot().registry;
  if (!origin.occurrence || origin.revision.value >= state.snapshot().revision.value ||
      origin.ancestors.size() > registry.limits().capacity) { return result; }
  if (registry.find(origin.occurrence)) {
    result.reason = ProposalReason::origin_present;
    return result;  // Unmount/replacement of the same logical occurrence is not deletion.
  }
  auto recoveryInput = input;
  for (const auto& ancestor : origin.ancestors) {
    const auto* record = registry.lookup(ancestor.handle);
    if (record && record->scope && record->navigation.trap) {
      if (!input.authority || input.authority == ancestor.handle ||
          descendantOf(registry, ancestor.handle, input.authority)) {
        recoveryInput.authority = ancestor.handle;
        result.authority = ancestor.handle;
      } else if (!descendantOf(registry, input.authority, ancestor.handle)) {
        result.reason = ProposalReason::no_authority;
        return result;
      }
      break;
    }
  }
  for (std::size_t depth = 0; depth < origin.ancestors.size(); ++depth) {
    const auto& ancestor = origin.ancestors[depth];
    const auto scope = registry.find(ancestor.key);
    const bool surfaceRoot = !ancestor.key && !ancestor.handle;
    if (!surfaceRoot && (!scope || scope != ancestor.handle)) { continue; }
    const auto* record = registry.lookup(scope);
    if (!surfaceRoot && (!record->scope || !record->navigation.entryReady)) { continue; }
    if (!surfaceRoot && (!record->enabled || !effectivelyActive(registry, scope))) {
      result.reason = ProposalReason::no_authority;
      return result;
    }
    if (depth == 0) {
      NodeHandle next, previous;
      for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
        const auto node = registry.handleAt(i);
        const auto* candidate = registry.lookup(node);
        if (!candidate || candidate->parent != scope || !logicalTarget(state, node) ||
            !withinBoundary(state, node, recoveryInput)) { continue; }
        const bool after = candidate->order > origin.order ||
            (candidate->order == origin.order && registry.key(node)->value() > origin.occurrence.value());
        auto& best = after ? next : previous;
        if (!best || (after ? stableBefore(registry, node, best)
                           : stableBefore(registry, best, node))) { best = node; }
      }
      if (const auto target = next ? next : previous) {
        // Absence is already validated; explicit entry shares eligibility/readiness.
        result.target = target;
        const auto geometry = regionBounds(state, target, recoveryInput);
        result.kind = geometry ? ProposalKind::ready : ProposalKind::reveal;
        result.mount = geometry ? registry.lookup(target)->mount : MountGeneration{};
        result.reason = ProposalReason::deletion_neighbor;
        return result;
      }
    }
    if (surfaceRoot) { continue; }
    result = resolveEntry(state, scope, recoveryInput, {EntryReason::returning});
    if (result.target) {
      result.reason = ProposalReason::recovery_fallback;
      return result;
    }
  }
  result.kind = ProposalKind::unavailable;
  result.reason = ProposalReason::no_recovery;
  return result;
}

}  // namespace itar
