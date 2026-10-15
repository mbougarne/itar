#pragma once
#include "registration.hpp"

namespace itar::android {

inline InputContext inputContext(Session& s, std::int64_t owner) {
  return {s.state.surface(),
          {},
          static_cast<InputOwner>(owner),
          s.state.snapshot().inputFocus};
}

inline std::int64_t input(Session& s, int operation,
                          std::span<const std::int64_t> v,
                          std::span<std::int64_t> out) {
  if (operation == 8 && v.empty()) {
    s.transactions.releaseInput();
    return ok;
  }
  if ((operation != 6 && operation != 7) ||
      v.size() != (operation == 6 ? 2 : 4) || v[0] < 0 || v[0] > 3 ||
      v[1] < 0 || v[1] > 4)
    return conversion;
  const auto direction = static_cast<Direction>(v[0]);
  const auto context = inputContext(s, v[1]);
  if (operation == 6) {
    const auto proposal = resolve(s.state, direction, context);
    out[1] = static_cast<std::int64_t>(proposal.kind);
    out[2] = proposal.target.slot.value;
    out[3] = proposal.target.generation.value;
    out[4] = proposal.mount.value;
  } else {
    if (v[2] < 0 || v[3] <= 0) return conversion;
    if (s.transactions.advanceTo(v[2]).status == RequestStatus::backward_time)
      return conversion;
    const auto result = s.transactions.directionalInput(
        direction, context,
        {static_cast<TimePoint>(v[3]), DatasetRevision{1}, ResourceId{1},
         direction});
    out[1] = static_cast<std::int64_t>(result.status);
    out[2] = result.request.value;
  }
  return ok;
}

}  // namespace itar::android
