#include <itar/transaction.hpp>

namespace itar {

std::optional<TimePoint> Transactions::nextDeadline() const noexcept {
  return active_ ? std::optional{active_->deadline} : std::nullopt;
}

RequestResult Transactions::advanceTo(TimePoint now) {
  if (now < now_) { return {RequestStatus::backward_time, active_ ? active_->id : RequestId{}}; }
  now_ = now;
  if (active_ && now_ >= active_->deadline) {
    const auto id = active_->id;
    cancel(id);
    return {RequestStatus::expired, id};
  }
  return {RequestStatus::unchanged, active_ ? active_->id : RequestId{}};
}

}  // namespace itar
