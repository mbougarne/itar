#include <itar/transaction.hpp>

namespace itar {

RequestResult Transactions::directionalInput(Direction direction, const InputContext& input,
                                             RequestOptions options, std::optional<Proposal> proposal) {
  if (direction != Direction::left && direction != Direction::right &&
      direction != Direction::up && direction != Direction::down) {
    return {RequestStatus::invalid, {}};
  }
  const auto gate = gateNavigation(state_, input);
  if (gate.kind != ProposalKind::ready) {
    if (active_) { cancel(active_->id); }
    held_.reset();
    return {RequestStatus::unavailable, {}};
  }
  synchronize();
  if (resync_) { return {RequestStatus::resync, {}}; }
  held_ = direction;
  if (active_ && active_->direction == direction) {
    return {RequestStatus::joined, active_->id};
  }
  if (active_) { cancel(active_->id); }
  options.direction = direction;
  return begin(proposal.value_or(resolve(state_, direction, input)), options);
}

RequestResult Transactions::requestFocus(const OccurrenceKey& key, const InputContext& input,
                                         RequestOptions options) {
  if (active_) { cancel(active_->id); }
  held_.reset();
  options.direction.reset();
  return startKey(key, input, options);
}

RequestResult Transactions::restoreFocus(const OccurrenceKey& key, const InputContext& input,
                                         RequestOptions options) {
  if (active_) { cancel(active_->id); }
  held_.reset();
  options.direction.reset();
  return startKey(key, input, options, true);
}

}  // namespace itar
