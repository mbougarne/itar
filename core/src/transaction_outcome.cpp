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
  const bool confirms = match != operations_.end() && active_ &&
                        active_->id == match->effect.token.request && authorized();
  const auto id = active_ ? active_->id : RequestId{};
  const auto status = state_.observeFocus(host.observation);
  if (status != ObservationStatus::changed && status != ObservationStatus::unchanged) {
    return {status == ObservationStatus::resource ? RequestStatus::resync : RequestStatus::stale, id};
  }
  if (match != operations_.end()) {
    match->observed = true;
    if (match->accepted) { operations_.erase(match); }
  }
  if (status == ObservationStatus::changed) {
    notifications_.push_back({host.observation, confirms ? std::optional{id} : std::nullopt});
  }
  if (confirms) {
    active_.reset();
    return {RequestStatus::confirmed, id};
  }
  if (active_ && host.observation.channel == FocusChannel::input &&
      state_.snapshot().inputFocus != active_->source) {
    active_.reset();
    return {RequestStatus::reconciled, id};
  }
  return {RequestStatus::unchanged, id};
}

RequestResult Transactions::complete(EffectOutcome outcome) {
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
    if (found->observed) { operations_.erase(found); }
    return {RequestStatus::waiting, outcome.token.request};
  }
  // Terminal focus outcomes may carry actual focus; reveal still needs realization.
  if (outcome.kind == OutcomeKind::rejected) { operations_.erase(found); }
  RequestResult observed{RequestStatus::unchanged, outcome.token.request};
  if (outcome.focus) {
    observed = observeHost({lifetime_, *outcome.focus,
                           outcome.token});
  }
  std::erase_if(operations_, [&](const Operation& op) { return op.effect.token == outcome.token; });
  if (observed.status == RequestStatus::confirmed) { return observed; }
  if (active_ && active_->id == outcome.token.request) {
    active_.reset();
    return {RequestStatus::reconciled, outcome.token.request};
  }
  return {RequestStatus::unchanged, outcome.token.request};
}

}  // namespace itar
