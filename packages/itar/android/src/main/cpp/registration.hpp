#pragma once
#include <span>

#include "boundary.hpp"

namespace itar::android {

inline NodeHandle handle(std::span<const std::int64_t> v) noexcept {
  if (v.size() < 2 || v[0] <= 0 || v[0] > UINT32_MAX || v[1] <= 0 ||
      v[1] > UINT32_MAX)
    return {};
  return {NodeId{static_cast<std::uint32_t>(v[0])},
          Generation{static_cast<std::uint32_t>(v[1])}};
}

// Compact mounted-only records. All policy, validation and atomicity stay in
// core.
inline std::int64_t registration(Session& s, int operation,
                                 std::span<const std::int64_t> v,
                                 std::string_view key,
                                 std::span<std::int64_t> out) {
  auto& state = s.state;
  const auto& registry = state.snapshot().registry;
  if (operation == 5 && v.empty()) {
    const auto& focus = state.snapshot().inputFocus;
    out[1] = static_cast<std::int64_t>(focus.kind);
    out[2] = focus.node.slot.value;
    out[3] = focus.node.generation.value;
    out[4] = focus.mount.value;
    out[5] = state.snapshot().revision.value;
    out[6] = s.transactions.active() ? s.transactions.active()->id.value : 0;
    out[7] = s.transactions.usage().operations;
    out[8] = s.transactions.usage().effects;
    out[9] = s.transactions.usage().notifications;
    out[10] = s.transactions.nextDeadline().value_or(0);
    out[11] = s.transactions.resyncRequired();
    return ok;
  }
  if (operation == 1 && v.size() == 11 && !key.empty() && key.size() <= 512) {
    if (v[2] <= 0 || v[3] < INT32_MIN || v[3] > INT32_MAX || v[4] < 0 ||
        v[4] > 1 || v[5] <= 0 || v[6] < 0 || v[6] > 4 ||
        (v[0] == 0 && v[1] != 0))
      return conversion;
    for (std::size_t i = 7; i < 11; ++i)
      if (v[i] < INT32_MIN || v[i] > INT32_MAX) return conversion;
    Mutation mutation;
    mutation.key = OccurrenceKey{std::string(key)};
    mutation.expected = handle(v);
    if (v[0] != 0 && !mutation.expected) return conversion;
    mutation.kind =
        mutation.expected ? MutationKind::update : MutationKind::insert;
    auto& record = mutation.record;
    record.mount = MountGeneration{static_cast<std::uint64_t>(v[2])};
    record.mounted = true;
    record.order = static_cast<std::int32_t>(v[3]);
    record.enabled = v[4] != 0;
    if (const auto* old = registry.lookup(mutation.expected))
      record.invalidatedThrough = old->invalidatedThrough;
    record.geometry = {
        state.surface(),
        record.mount,
        LayoutRevision{static_cast<std::uint64_t>(v[5])},
        {double(v[7]), double(v[8]), double(v[9]), double(v[10])},
        static_cast<GeometryState>(v[6])};
    const auto result = s.transactions.apply(
        {state.surface(), state.snapshot().revision, std::span{&mutation, 1}});
    if (result.status != BatchStatus::valid)
      return -100 - static_cast<std::int64_t>(result.status);
    const auto node = registry.find(mutation.key);
    out[1] = node.slot.value;
    out[2] = node.generation.value;
    out[3] = v[2];
    return ok;
  }
  if ((operation == 2 || operation == 3) && v.size() == 4 && handle(v) &&
      v[2] > 0 && v[3] >= 0) {
    const auto node = handle(v);
    const auto kind = operation == 2 ? AvailabilityKind::mount_lost
                                     : AvailabilityKind::geometry_dirty;
    const auto status = s.transactions.observeAvailability(
        {state.surface(), node,
         MountGeneration{static_cast<std::uint64_t>(v[2])}, kind,
         LayoutRevision{static_cast<std::uint64_t>(v[3])}});
    if (status != ObservationStatus::changed &&
        status != ObservationStatus::unchanged)
      return stale;
    if (operation == 2) {
      const auto* keyValue = registry.key(node);
      if (!keyValue) return stale;
      Mutation mutation;
      mutation.kind = MutationKind::erase;
      mutation.key = *keyValue;
      mutation.expected = node;
      const auto result =
          s.transactions.apply({state.surface(), state.snapshot().revision,
                                std::span{&mutation, 1}});
      if (result.status != BatchStatus::valid)
        return -100 - static_cast<std::int64_t>(result.status);
    }
    return ok;
  }
  if (operation == 4 && v.size() == 5 && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 &&
      v[1] <= 3) {
    FocusState focus{static_cast<FocusKind>(v[1]), {}, {}};
    if (focus.kind == FocusKind::managed) {
      focus.node = handle(v.subspan(2));
      if (!focus.node || v[4] <= 0) return conversion;
      focus.mount = MountGeneration{static_cast<std::uint64_t>(v[4])};
    }
    const auto result = s.transactions.observeHost(
        {SurfaceLifetime{state.surface().value},
         {state.surface(), static_cast<FocusChannel>(v[0]), focus},
         {}});
    out[12] = static_cast<std::int64_t>(result.status);
    out[13] = result.request.value;
    return result.status == RequestStatus::stale ? stale : ok;
  }
  return conversion;
}

}  // namespace itar::android
