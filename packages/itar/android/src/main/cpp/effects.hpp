#pragma once
#include "input.hpp"

namespace itar::android {

inline EffectToken token(std::span<const std::int64_t> v) {
  if (v.size() < 4 || v[0] <= 0 || v[1] <= 0 || v[2] <= 0 || v[3] < 0 ||
      v[3] > 2)
    return {};
  return {SurfaceLifetime{static_cast<std::uint64_t>(v[0])},
          RequestId{static_cast<std::uint64_t>(v[1])},
          EffectId{static_cast<std::uint64_t>(v[2])},
          static_cast<EffectKind>(v[3])};
}

inline std::int64_t effects(Session& s, int operation,
                            std::span<const std::int64_t> v,
                            std::string_view key, std::span<std::int64_t> out) {
  auto& tx = s.transactions;
  RequestResult result{RequestStatus::unchanged, {}};
  if (operation == 9 && v.size() == 3 && !key.empty() && v[0] >= 0 &&
      v[0] <= 4 && v[1] >= 0 && v[2] > v[1]) {
    if (tx.advanceTo(v[1]).status == RequestStatus::backward_time)
      return conversion;
    result = tx.requestFocus(
        OccurrenceKey{std::string(key)}, inputContext(s, v[0]),
        {static_cast<TimePoint>(v[2]), DatasetRevision{1}, ResourceId{1}, {}});
  } else if (operation == 10 && v.empty()) {
    if (s.effectIndex == s.effects.size()) {
      s.effects = tx.drainEffects();
      s.effectIndex = 0;
    }
    if (s.effectIndex == s.effects.size()) return ok;
    const auto& e = s.effects[s.effectIndex++];
    out[1] = 1;
    out[2] = e.token.lifetime.value;
    out[3] = e.token.request.value;
    out[4] = e.token.effect.value;
    out[5] = static_cast<std::int64_t>(e.token.kind);
    out[6] = e.target.slot.value;
    out[7] = e.target.generation.value;
    out[8] = e.mount ? e.mount->value : 0;
    if (e.cancels) {
      out[9] = e.cancels->request.value;
      out[10] = e.cancels->effect.value;
    }
    return ok;
  } else if (operation == 11 && v.size() == 4) {
    result = tx.issue(token(v));
    out[3] = result.status == RequestStatus::issued;
  } else if (operation == 12 && v.size() == 5 && v[4] >= 0 && v[4] <= 5) {
    result = tx.complete({token(v), static_cast<OutcomeKind>(v[4]), {}});
  } else if (operation == 13 && v.size() == 1 && v[0] > 0) {
    result = tx.cancel(RequestId{static_cast<std::uint64_t>(v[0])});
  } else if (operation == 14 && v.size() == 1 && v[0] >= 0) {
    result = tx.advanceTo(v[0]);
  } else if (operation == 15 && v.empty()) {
    if (s.notificationIndex == s.notifications.size()) {
      s.notifications = tx.drainNotifications();
      s.notificationIndex = 0;
    }
    if (s.notificationIndex == s.notifications.size()) return ok;
    const auto& n = s.notifications[s.notificationIndex++];
    const auto& f = n.observation.focus;
    out[1] = 1;
    out[2] = static_cast<std::int64_t>(n.observation.channel);
    out[3] = static_cast<std::int64_t>(f.kind);
    out[4] = f.node.slot.value;
    out[5] = f.node.generation.value;
    out[6] = f.mount.value;
    out[7] = n.confirmedRequest ? n.confirmedRequest->value : 0;
    return ok;
  } else if (operation == 16 && v.empty()) {
    if (tx.active()) result = tx.cancel(tx.active()->id);
    tx.releaseInput();
  } else
    return conversion;
  out[1] = static_cast<std::int64_t>(result.status);
  out[2] = result.request.value;
  return ok;
}

}  // namespace itar::android
