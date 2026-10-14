#include <itar/transaction.hpp>
#include <itar/geometry_view.hpp>

#include <algorithm>

namespace itar {

RequestResult Transactions::issue(EffectToken token) {
  const auto found = std::find_if(operations_.begin(), operations_.end(),
                                 [&](const Operation& op) { return op.effect.token == token; });
  if (found == operations_.end() || found->issued || token.lifetime != lifetime_ ||
      !active_ || active_->id != token.request || !authorized()) {
    return {RequestStatus::stale, token.request};
  }
  const auto expected = active_->phase == RequestPhase::focusing ? EffectKind::focus
                                                               : EffectKind::reveal;
  if (token.kind != expected ||
      (token.kind == EffectKind::focus &&
       !usableGeometry(state_.snapshot(), state_.surface(), active_->target))) {
    return {RequestStatus::stale, token.request};
  }
  found->issued = true;
  return {RequestStatus::issued, token.request};
}

RequestResult Transactions::realize(Realization realization) {
  const auto found = std::find_if(operations_.begin(), operations_.end(),
                                 [&](const Operation& op) {
                                   return op.effect.token == realization.reveal && op.issued;
                                 });
  if (found == operations_.end() || realization.reveal.kind != EffectKind::reveal ||
      !active_ || active_->id != realization.reveal.request || !authorized() ||
      realization.surface != active_->surface || realization.target != active_->target ||
      realization.dataset != active_->dataset) {
    return {RequestStatus::stale, realization.reveal.request};
  }
  const auto* record = state_.snapshot().registry.lookup(realization.target);
  if (!realization.mount || !record->mounted || record->mount != realization.mount ||
      (active_->mount && *active_->mount != realization.mount) ||
      (!active_->mount && targetContext_.mount == realization.mount)) {
    return {RequestStatus::stale, realization.reveal.request};
  }
  active_->mount = realization.mount;
  realized_ = true;
  revealComplete_ = realization.revealComplete;
  if (revealComplete_) { operations_.erase(found); }
  return refresh();
}

RequestResult Transactions::refresh() {
  if (!active_) { return {RequestStatus::unchanged, {}}; }
  if (!authorized()) { return {RequestStatus::stale, active_->id}; }
  if (active_->phase != RequestPhase::revealing || !realized_ || !revealComplete_ ||
      !usableGeometry(state_.snapshot(), state_.surface(), active_->target)) {
    return {RequestStatus::waiting, active_->id};
  }
  active_->phase = RequestPhase::focusing;
  emit(EffectKind::focus);
  return {RequestStatus::started, active_->id};
}

}  // namespace itar
