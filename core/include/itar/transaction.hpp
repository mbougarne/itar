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
  confirmed, reconciled, expired, backward_time, exhausted, resync, disposed
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

// Value-only channels. Draining never performs a host or application operation.
template <class Value>
std::vector<Value> drainValues(std::vector<Value>& values) {
  std::vector<Value> drained;
  drained.swap(values);
  return drained;
}

}  // namespace itar
