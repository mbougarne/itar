#pragma once
#include "effects.hpp"

namespace itar::android {

inline std::int64_t presentation(Session& s, int operation,
                                 std::span<const std::int64_t> v) {
  if (operation == 17 && v.empty()) {
    s.recovery = captureRecovery(s.state);
    return ok;
  }
  if (operation == 18 && v.size() == 2 && v[0] >= 0 && v[1] > v[0]) {
    if (!s.recovery) return ok;
    if (s.transactions.advanceTo(v[0]).status == RequestStatus::backward_time)
      return conversion;
    const auto proposal =
        resolveRecovery(s.state, *s.recovery, inputContext(s, 0));
    s.transactions.begin(
        proposal,
        {static_cast<TimePoint>(v[1]), DatasetRevision{1}, ResourceId{1}, {}});
    s.recovery.reset();
    return ok;
  }
  return conversion;
}

}  // namespace itar::android
