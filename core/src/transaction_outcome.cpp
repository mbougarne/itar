#include <itar/transaction.hpp>

#include <algorithm>

namespace itar {

RequestResult Transactions::observeHost(HostFocus host) {
  if (host.lifetime != lifetime_ || !lifetime_) { return {RequestStatus::stale, {}}; }
  const auto& focus = host.observation.focus;
  auto match = std::find_if(operations_.begin(), operations_.end(), [&](const Operation& op) {
    return op.issued && op.effect.token.kind == EffectKind::focus &&
           (!host.correlation || *host.correlation == op.effect.token) &&
           host.observation.channel == FocusChannel::input && focus.kind == FocusKind::managed &&
           focus.node == op.effect.target && op.effect.mount == focus.mount;
  });
  const bool confirms = !resync_ && match != operations_.end() && active_ &&
                        active_->id == match->effect.token.request && authorized();
  const auto id = active_ ? active_->id : RequestId{};
  const auto status = state_.observeFocus(host.observation);
  if (status != ObservationStatus::changed && status != ObservationStatus::unchanged) {
    if (status == ObservationStatus::resource) { resync_ = true; }
    return {status == ObservationStatus::resource ? RequestStatus::resync : RequestStatus::stale, id};
  }
  if (match != operations_.end()) {
    match->observed = true;
    if (match->accepted) { retire(match->effect.token); }
  }
  if (status == ObservationStatus::changed) {
    if (notifications_.size() == limits_.notifications) {
      resync_ = true;
      if (active_) { cancel(active_->id); }
      return {RequestStatus::resync, id};
    }
    auto canonical = host.observation;
    canonical.focus = canonical.channel == FocusChannel::input
                          ? state_.snapshot().inputFocus : state_.snapshot().accessibilityFocus;
    notifications_.push_back({canonical, confirms ? std::optional{id} : std::nullopt});
  }
  if (confirms) {
    active_.reset();
    return {RequestStatus::confirmed, id};
  }
  if (active_ && active_->accessibilitySource && host.observation.channel == FocusChannel::accessibility &&
      focus.kind == FocusKind::managed && focus.node == active_->target &&
      active_->mount && focus.mount == *active_->mount) {
    // Once the reader reaches the destination, returning to the old source is a competing move.
    active_->accessibilitySource = focus;
  }
  if (active_ && ((host.observation.channel == FocusChannel::input &&
                  state_.snapshot().inputFocus != active_->source) ||
                 (host.observation.channel == FocusChannel::accessibility &&
                  active_->accessibilitySource && !authorized()))) {
    cancel(id);
    return {RequestStatus::reconciled, id};
  }
  return {RequestStatus::unchanged, id};
}

RequestResult Transactions::complete(EffectOutcome outcome) {
  if (outcome.token.kind == EffectKind::cancel) { return completeCancellation(outcome); }
  auto found = std::find_if(operations_.begin(), operations_.end(), [&](const Operation& op) {
    return op.issued && op.effect.token == outcome.token;
  });
  if (found == operations_.end() || outcome.token.lifetime != lifetime_ ||
      (outcome.kind != OutcomeKind::accepted && outcome.kind != OutcomeKind::rejected &&
       outcome.kind != OutcomeKind::completed) ||
      (outcome.kind == OutcomeKind::accepted && found->accepted)) {
    return {RequestStatus::stale, outcome.token.request};
  }
  if (outcome.kind == OutcomeKind::accepted) {
    found->accepted = true;
    if (outcome.focus) {
      return observeHost({lifetime_, *outcome.focus, outcome.token});
    }
    if (found->observed) { retire(outcome.token); }
    return {RequestStatus::waiting, outcome.token.request};
  }
  // Terminal focus outcomes may carry actual focus; reveal still needs realization.
  if (outcome.kind == OutcomeKind::rejected) { retire(outcome.token); }
  RequestResult observed{RequestStatus::unchanged, outcome.token.request};
  if (outcome.focus) {
    observed = observeHost({lifetime_, *outcome.focus,
                           outcome.token});
  }
  retire(outcome.token);
  if (observed.status == RequestStatus::confirmed) { return observed; }
  if (active_ && active_->id == outcome.token.request) {
    active_.reset();
    return {RequestStatus::reconciled, outcome.token.request};
  }
  return {RequestStatus::unchanged, outcome.token.request};
}

}  // namespace itar
