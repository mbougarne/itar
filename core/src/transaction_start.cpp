#include <itar/transaction.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include <new>

namespace itar {

EffectToken Transactions::emit(EffectKind kind, std::optional<EffectToken> cancels) {
  if (!canEmit()) { resync_ = true; return {}; }
  const auto& request = *active_;
  Effect effect{{lifetime_, request.id, EffectId{nextEffect_++}, kind},
                request.surface, request.target, request.mount, request.dataset,
                request.resource, cancels};
  operations_.push_back({effect, false});
  effects_.push_back(effect);
  return effect.token;
}

bool Transactions::authorized() const noexcept {
  if (!active_ || active_->lifetime != lifetime_ ||
      active_->surface != state_.surface()) { return false; }
  const auto& request = *active_;
  const auto& registry = state_.snapshot().registry;
  const auto* target = registry.lookup(request.target);
  const InputContext input{request.surface, request.authority,
                           InputOwner::engine, request.source};
  if (!target || registry.find(request.targetKey) != request.target ||
      !logicalTarget(state_, request.target) ||
      target->parent != targetContext_.parent || target->order != targetContext_.order ||
      (request.authority && (!registry.lookup(request.authority) ||
                            !registry.lookup(request.authority)->scope ||
                            !effectivelyActive(registry, request.authority))) ||
      !withinBoundary(state_, request.target, input)) { return false; }
  if (request.mount && (!target->mounted || target->mount != *request.mount)) {
    return false;
  }
  if (request.phase == RequestPhase::focusing &&
      !usableGeometry(state_.snapshot(), state_.surface(), request.target)) {
    return false;
  }
  return state_.snapshot().inputFocus == request.source;
}

RequestResult Transactions::start(const Proposal& proposal, RequestOptions options) {
  if (!lifetime_ || !state_.surface()) { return {RequestStatus::disposed, {}}; }
  if (resync_) { return {RequestStatus::resync, {}}; }
  if (active_) { return {RequestStatus::busy, active_->id}; }
  if (!options.deadline || !options.dataset) { return {RequestStatus::invalid, {}}; }
  if (options.deadline <= now_) { return {RequestStatus::expired, {}}; }
  if (!canEmit() || !nextRequest_ || nextRequest_ > limits_.idCeiling) {
    return {RequestStatus::exhausted, {}};
  }
  try {
  const auto* record = state_.snapshot().registry.lookup(proposal.target);
  RequestRecord request{RequestId{nextRequest_}, lifetime_, state_.surface(),
                        proposal.kind == ProposalKind::ready ? RequestPhase::focusing
                                                            : RequestPhase::revealing,
                        proposal.source, *state_.snapshot().registry.key(proposal.target),
                        proposal.target, {}, proposal.authority, proposal.revision,
                        options.dataset, options.deadline, options.resource, options.direction};
  if (record->mounted) { request.mount = record->mount; }
  targetContext_ = *record;
  realized_ = revealComplete_ = false;
  active_ = std::move(request);
  ++nextRequest_;
  emit(active_->phase == RequestPhase::focusing ? EffectKind::focus : EffectKind::reveal);
  return {RequestStatus::started, active_->id};
  } catch (const std::bad_alloc&) { return {RequestStatus::exhausted, {}}; }
}

RequestResult Transactions::begin(const Proposal& proposal, RequestOptions options) {
  if (proposal.surface != state_.surface() ||
      proposal.revision != state_.snapshot().revision ||
      proposal.policy != navigationPolicy) { return {RequestStatus::stale, {}}; }
  if (proposal.kind != ProposalKind::ready && proposal.kind != ProposalKind::reveal) {
    return {RequestStatus::unavailable, {}};
  }
  const auto* target = state_.snapshot().registry.lookup(proposal.target);
  if (!target || !logicalTarget(state_, proposal.target) ||
      (proposal.kind == ProposalKind::ready &&
       (target->mount != proposal.mount ||
        !usableGeometry(state_.snapshot(), state_.surface(), proposal.target)))) {
    return {RequestStatus::stale, {}};
  }
  const InputContext input{proposal.surface, proposal.authority,
                           InputOwner::engine, proposal.source};
  // Entry/recovery proposals may originate from confirmed absence.
  if (input.source != state_.snapshot().inputFocus ||
      (input.source.kind == FocusKind::managed &&
       gateNavigation(state_, input).kind != ProposalKind::ready)) {
    return {RequestStatus::stale, {}};
  }
  if (input.source.kind == FocusKind::unknown || input.source.kind == FocusKind::unmanaged) {
    return {RequestStatus::unavailable, {}};
  }
  return startKey(*state_.snapshot().registry.key(proposal.target), input, options);
}

RequestResult Transactions::startKey(const OccurrenceKey& key, const InputContext& input,
                                     RequestOptions options) {
  if (input.surface != state_.surface() || input.source != state_.snapshot().inputFocus) {
    return {RequestStatus::stale, {}};
  }
  const auto& registry = state_.snapshot().registry;
  const auto target = registry.find(key);
  if (input.owner != InputOwner::engine || !logicalTarget(state_, target) ||
      (input.authority && (!registry.lookup(input.authority) ||
                            !registry.lookup(input.authority)->scope ||
                            !effectivelyActive(registry, input.authority))) ||
      !withinBoundary(state_, target, input)) { return {RequestStatus::unavailable, {}}; }
  Proposal proposal;
  proposal.surface = state_.surface();
  proposal.revision = state_.snapshot().revision;
  proposal.source = input.source;
  proposal.authority = input.authority;
  proposal.target = target;
  proposal.kind = usableGeometry(state_.snapshot(), state_.surface(), target)
                      ? ProposalKind::ready : ProposalKind::reveal;
  return start(proposal, options);
}

}  // namespace itar
