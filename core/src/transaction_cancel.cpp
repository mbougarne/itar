#include <itar/transaction.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include <algorithm>

namespace itar {

RequestResult Transactions::cancel(RequestId id) {
  if (!active_ || active_->id != id) { return {RequestStatus::unchanged, id}; }
  std::erase_if(effects_, [&](const Effect& e) { return e.token.request == id; });
  std::erase_if(operations_, [&](const Operation& op) {
    return op.effect.token.request == id && !op.issued;
  });
  // Emit may grow the vector; traverse only the original records by index.
  const auto count = operations_.size();
  for (std::size_t i = 0; i < count; ++i) {
    const auto token = operations_[i].effect.token;
    if (token.request == id && token.kind != EffectKind::cancel) { emit(EffectKind::cancel, token); }
  }
  active_.reset();
  return {resync_ ? RequestStatus::resync : RequestStatus::cancelled, id};
}

RequestResult Transactions::completeCancellation(EffectOutcome outcome) {
  const auto found = std::find_if(operations_.begin(), operations_.end(), [&](const Operation& op) {
    return op.issued && op.effect.token == outcome.token && op.effect.cancels;
  });
  if (found == operations_.end() || outcome.token.lifetime != lifetime_ ||
      (outcome.kind != OutcomeKind::cancelled && outcome.kind != OutcomeKind::already_finished &&
       outcome.kind != OutcomeKind::not_cancellable)) { return {RequestStatus::stale, outcome.token.request}; }
  const auto old = *found->effect.cancels;
  retire(outcome.token);
  if (outcome.kind != OutcomeKind::not_cancellable) {
    retire(old);
  }
  if (outcome.focus) { observeHost({lifetime_, *outcome.focus, old}); }
  return {RequestStatus::reconciled, outcome.token.request};
}

RequestResult Transactions::synchronize() {
  if (!active_) { return {RequestStatus::unchanged, {}}; }
  if (!authorized() ||
      (active_->phase == RequestPhase::focusing &&
       !usableGeometry(state_.snapshot(), state_.surface(), active_->target))) {
    return cancel(active_->id);
  }
  active_->revision = state_.snapshot().revision;
  return refresh();
}

ApplyResult Transactions::apply(Batch batch) {
  bool invalidates = false;
  if (active_) {
    const auto& registry = state_.snapshot().registry;
    for (const auto& mutation : batch.operations) {
      const auto node = registry.find(mutation.key);
      const auto* before = registry.lookup(node);
      const bool related = node == active_->target || node == active_->source.node ||
                           (before && (before->parent == targetContext_.parent ||
                            descendantOf(registry, active_->target, node) ||
                            descendantOf(registry, active_->source.node, node))) ||
                           (!node && registry.find(mutation.parent) == targetContext_.parent);
      if (!related) { continue; }
      auto next = mutation.record;
      if (before) {
        next.parent = registry.find(mutation.parent);
        next.mount = before->mount;
        next.mounted = before->mounted;
        next.geometry = before->geometry;
        next.invalidatedThrough = before->invalidatedThrough;
      }
      if (mutation.kind != MutationKind::update || !before || next != *before ||
          mutation.preferred) { invalidates = true; }
    }
  }
  auto result = state_.apply(batch);
  if (result.status == BatchStatus::valid) {
    if (invalidates && active_) { cancel(active_->id); }
    else { synchronize(); }
  }
  return result;
}

ObservationStatus Transactions::observeAvailability(AvailabilityObservation observation) {
  const auto inputBefore = state_.snapshot().inputFocus;
  const auto accessibilityBefore = state_.snapshot().accessibilityFocus;
  const auto result = state_.observeAvailability(observation);
  if (result == ObservationStatus::changed) {
    for (const auto channel : {FocusChannel::input, FocusChannel::accessibility}) {
      const auto before = channel == FocusChannel::input ? inputBefore : accessibilityBefore;
      const auto after = channel == FocusChannel::input ? state_.snapshot().inputFocus : state_.snapshot().accessibilityFocus;
      if (before == after) { continue; }
      if (notifications_.size() == limits_.notifications) {
        resync_ = true;
        if (active_) { cancel(active_->id); }
        break;
      }
      notifications_.push_back({{state_.surface(), channel, after}, {}});
    }
    synchronize();
  }
  return result;
}

void Transactions::dispose() noexcept {
  lifetime_ = {};
  active_.reset();
  operations_.clear();
  effects_.clear();
  notifications_.clear();
  held_.reset();
}

}  // namespace itar
