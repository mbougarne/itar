#include <itar/transaction.hpp>

#include <algorithm>

namespace itar {

Transactions::Transactions(State& state, SurfaceLifetime lifetime, TransactionLimits limits)
    : state_(state), lifetime_(lifetime), limits_(limits) {
  operations_.reserve(limits.operations);
  effects_.reserve(limits.effects);
  notifications_.reserve(limits.notifications);
}

bool Transactions::canEmit() const noexcept {
  return operations_.size() < limits_.operations && effects_.size() < limits_.effects &&
         nextEffect_ && nextEffect_ <= limits_.idCeiling;
}

bool Transactions::resourceBusy(const Effect& effect) const noexcept {
  if (!effect.resource) { return false; }
  return std::any_of(operations_.begin(), operations_.end(), [&](const Operation& op) {
    return op.issued && op.effect.token.kind != EffectKind::cancel &&
           op.effect.token != effect.token && op.effect.resource == effect.resource;
  });
}

void Transactions::retire(EffectToken token) {
  std::erase_if(operations_, [&](const Operation& op) {
    return op.effect.token == token || op.effect.cancels == token;
  });
  std::erase_if(effects_, [&](const Effect& effect) {
    return effect.token == token || effect.cancels == token;
  });
}

}  // namespace itar
