#pragma once

#include <itar/navigation.hpp>

namespace itar {

using RequestId = Identifier<struct RequestTag>;
using EffectId = Identifier<struct EffectTag>;
using SurfaceLifetime = Identifier<struct LifetimeTag>;
using DatasetRevision = Identifier<struct DatasetTag>;
using ResourceId = Identifier<struct ResourceTag>;
using TimePoint = std::uint64_t;  // Host monotonic units; no engine clock.

enum class RequestPhase { revealing, focusing };
enum class EffectKind { reveal, focus, cancel };
enum class OutcomeKind {
  accepted, rejected, completed, cancelled, already_finished, not_cancellable
};
enum class RequestStatus {
  started, joined, busy, unavailable, stale, invalid, cancelled, unchanged,
  confirmed, reconciled, expired, backward_time, exhausted, resync, disposed,
  issued, waiting
};

struct RequestResult {
  RequestStatus status;
  RequestId request;
  bool operator==(const RequestResult&) const = default;
};

struct EffectToken {
  SurfaceLifetime lifetime;
  RequestId request;
  EffectId effect;
  EffectKind kind;
  bool operator==(const EffectToken&) const = default;
};

struct RequestOptions {
  TimePoint deadline{};  // Original absolute deadline, in host units.
  DatasetRevision dataset;
  ResourceId resource;  // Adapter-declared list/scroll exclusion resource.
  std::optional<Direction> direction;
};

struct RequestRecord {
  RequestId id;
  SurfaceLifetime lifetime;
  SurfaceId surface;
  RequestPhase phase;
  FocusState source;  // Retained context; never activation authority.
  OccurrenceKey targetKey;
  NodeHandle target;
  std::optional<MountGeneration> mount;  // Empty for unrealized targets.
  NodeHandle authority;
  Revision revision;
  DatasetRevision dataset;
  TimePoint deadline;
  ResourceId resource;
  std::optional<Direction> direction;
};

struct Effect {
  EffectToken token;
  SurfaceId surface;
  NodeHandle target;
  std::optional<MountGeneration> mount;
  DatasetRevision dataset;
  ResourceId resource;
  std::optional<EffectToken> cancels;  // Exact issued operation, never a view.
  bool operator==(const Effect&) const = default;
};

struct FocusNotification {
  FocusObservation observation;
  std::optional<RequestId> confirmedRequest;
};

struct Realization {
  EffectToken reveal;
  SurfaceId surface;
  NodeHandle target;
  MountGeneration mount;
  DatasetRevision dataset;
  bool revealComplete{};
};

struct EffectOutcome {
  EffectToken token;
  OutcomeKind kind;
  std::optional<FocusObservation> focus;  // Current, verified host evidence only.
};

struct HostFocus {
  SurfaceLifetime lifetime;
  FocusObservation observation;
  std::optional<EffectToken> correlation;
};

struct TransactionLimits {
  std::size_t operations{32}, effects{32}, notifications{32};
  std::uint64_t idCeiling{std::numeric_limits<std::uint64_t>::max()};
};

struct TransactionUsage {
  std::size_t operations, effects, notifications;
};

// Value-only channels. Draining never performs a host or application operation.
template <class Value>
std::vector<Value> drainValues(std::vector<Value>& values) {
  std::vector<Value> drained;
  drained.swap(values);
  return drained;
}

// Borrowed State must outlive this owner; all calls use one serialized thread.
class Transactions {
 public:
  Transactions(State& state, SurfaceLifetime lifetime, TransactionLimits limits = {});
  RequestResult begin(const Proposal& proposal, RequestOptions options);
  RequestResult requestFocus(const OccurrenceKey& key, const InputContext& input,
                             RequestOptions options);
  RequestResult issue(EffectToken token);  // Call immediately before host invocation.
  RequestResult realize(Realization realization);
  RequestResult refresh();  // After committing matching host geometry.
  RequestResult complete(EffectOutcome outcome);
  RequestResult observeHost(HostFocus observation);
  RequestResult cancel(RequestId request);
  RequestResult synchronize();  // Revalidate after borrowed State mutation.
  ApplyResult apply(Batch batch);
  ObservationStatus observeAvailability(AvailabilityObservation observation);
  void dispose() noexcept;  // Host teardown releases its operations separately.
  RequestResult advanceTo(TimePoint now);
  std::optional<TimePoint> nextDeadline() const noexcept;
  RequestResult directionalInput(Direction direction, const InputContext& input,
                                  RequestOptions options);
  void releaseInput() noexcept { held_.reset(); }
  std::optional<Direction> heldDirection() const noexcept { return held_; }
  const std::optional<RequestRecord>& active() const noexcept { return active_; }
  bool resyncRequired() const noexcept { return resync_; }
  TransactionUsage usage() const noexcept {
    return {operations_.size(), effects_.size(), notifications_.size()};
  }
  std::vector<Effect> drainEffects() {
    auto output = effects_;
    effects_.clear();
    return output;
  }
  std::vector<FocusNotification> drainNotifications() {
    auto output = notifications_;
    notifications_.clear();
    return output;
  }

 private:
  struct Operation {
    Effect effect;
    bool issued{};
    bool accepted{}, observed{};
  };
  RequestResult start(const Proposal& proposal, RequestOptions options);
  RequestResult startKey(const OccurrenceKey& key, const InputContext& input,
                         RequestOptions options);
  bool authorized() const noexcept;
  EffectToken emit(EffectKind kind, std::optional<EffectToken> cancels = {});
  RequestResult completeCancellation(EffectOutcome outcome);
  bool canEmit() const noexcept;
  bool resourceBusy(const Effect& effect) const noexcept;
  void retire(EffectToken token);
  State& state_;
  SurfaceLifetime lifetime_;
  TransactionLimits limits_;
  bool resync_{};
  std::optional<RequestRecord> active_;
  NodeRecord targetContext_;
  bool realized_{}, revealComplete_{};
  TimePoint now_{};
  std::optional<Direction> held_;
  std::uint64_t nextRequest_{1}, nextEffect_{1};
  std::vector<Operation> operations_;
  std::vector<Effect> effects_;
  std::vector<FocusNotification> notifications_;
};

}  // namespace itar
