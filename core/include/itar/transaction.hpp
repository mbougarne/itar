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
  Transactions(State& state, SurfaceLifetime lifetime)
      : state_(state), lifetime_(lifetime) {}
  RequestResult begin(const Proposal& proposal, RequestOptions options);
  RequestResult requestFocus(const OccurrenceKey& key, const InputContext& input,
                             RequestOptions options);
  RequestResult issue(EffectToken token);  // Call immediately before host invocation.
  RequestResult realize(Realization realization);
  RequestResult refresh();  // After committing matching host geometry.
  const std::optional<RequestRecord>& active() const noexcept { return active_; }
  std::vector<Effect> drainEffects() { return drainValues(effects_); }
  std::vector<FocusNotification> drainNotifications() {
    return drainValues(notifications_);
  }

 private:
  struct Operation {
    Effect effect;
    bool issued{};
  };
  RequestResult start(const Proposal& proposal, RequestOptions options);
  bool authorized() const noexcept;
  EffectToken emit(EffectKind kind, std::optional<EffectToken> cancels = {});
  State& state_;
  SurfaceLifetime lifetime_;
  std::optional<RequestRecord> active_;
  NodeRecord targetContext_;
  bool realized_{}, revealComplete_{};
  std::uint64_t nextRequest_{1}, nextEffect_{1};
  std::vector<Operation> operations_;
  std::vector<Effect> effects_;
  std::vector<FocusNotification> notifications_;
};

}  // namespace itar
