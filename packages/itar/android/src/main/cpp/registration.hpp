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

// Compact host records retain logical membership across physical unmounts.
// All policy, validation and atomicity stay in core.
inline std::int64_t registration(Session &s, int operation,
                                 std::span<const std::int64_t> v,
                                 std::string_view key,
                                 std::span<std::int64_t> out) {
  auto &state = s.state;
  const auto &registry = state.snapshot().registry;
  if (operation == 5 && v.empty()) {
    const auto &focus = state.snapshot().inputFocus;
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
    out[14] = s.collections.dataset().value;
    return ok;
  }
  if (operation == 1 && (v.size() == 12 || v.size() == 14 || v.size() == 15) && !key.empty() && key.size() <= 512) {
    if (v[2] <= 0 || v[3] < INT32_MIN || v[3] > INT32_MAX || v[4] < 0 ||
        v[4] > 1 || v[5] <= 0 || v[6] < 0 || v[6] > 4 ||
        (v[0] == 0 && v[1] != 0))
      return conversion;
    for (std::size_t i = 7; i < 11; ++i)
      if (v[i] < INT32_MIN || v[i] > INT32_MAX)
        return conversion;
    Mutation mutation;
    if (v.size() >= 14 && (v[12] || v[13])) {
      const auto parent = handle(v.subspan(12));
      if (!parent || !registry.lookup(parent) || !registry.lookup(parent)->scope) return stale;
      mutation.parent = *registry.key(parent);
    }
    mutation.key = OccurrenceKey{std::string(key)};
    const auto *collection = s.collections.find(mutation.key);
    if ((collection && (v.size() != 15 || v[14] <= 0 ||
                        static_cast<std::uint64_t>(v[14]) != s.collections.dataset().value)) ||
        (!collection && v.size() == 15 && v[14] != 0)) return stale;
    mutation.expected = handle(v);
    if (v[0] != 0 && !mutation.expected)
      return conversion;
    if ((mutation.expected && v[11] <= 0) || (!mutation.expected && v[11] != 0))
      return conversion;
    const auto *previous = registry.lookup(mutation.expected);
    if (mutation.expected &&
        (!previous ||
         previous->mount.value != static_cast<std::uint64_t>(v[11])))
      return stale;
    if (!mutation.expected) {
      const auto existing = registry.find(mutation.key);
      previous = registry.lookup(existing);
      if (previous && !previous->mounted)
        mutation.expected = existing;
    }
    const bool rename = previous && mutation.expected &&
                        *registry.key(mutation.expected) != mutation.key;
    if (rename && (collection || s.collections.find(*registry.key(mutation.expected)))) return stale;
    mutation.kind =
        mutation.expected ? MutationKind::update : MutationKind::insert;
    auto &record = mutation.record;
    record.mount = MountGeneration{static_cast<std::uint64_t>(v[2])};
    record.mounted = true;
    record.order = collection ? collection->order : static_cast<std::int32_t>(v[3]);
    record.enabled = v[4] != 0 && (!collection || collection->enabled);
    if (previous && mutation.kind == MutationKind::update)
      record.invalidatedThrough = previous->invalidatedThrough;
    record.geometry = {
        state.surface(),
        record.mount,
        LayoutRevision{static_cast<std::uint64_t>(v[5])},
        {double(v[7]), double(v[8]), double(v[9]), double(v[10])},
        static_cast<GeometryState>(v[6])};
    std::array<Mutation, 2> operations;
    std::size_t count = 1;
    if (rename) {
      operations[0].kind = MutationKind::erase;
      operations[0].key = *registry.key(mutation.expected);
      operations[0].expected = mutation.expected;
      mutation.kind = MutationKind::insert;
      mutation.expected = {};
      operations[1] = mutation;
      count = 2;
    } else
      operations[0] = mutation;
    const auto result =
        s.transactions.apply({state.surface(), state.snapshot().revision,
                              std::span{operations}.first(count)});
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

    return ok;
  }
  if (operation == 19 && v.size() == 4 && handle(v) && v[2] > 0) {
    const auto node = handle(v);
    const auto *previous = registry.lookup(node);
    if (!previous || previous->mount.value != static_cast<std::uint64_t>(v[2]))
      return stale;
    if (s.collections.find(*registry.key(node))) return ok;
    Mutation mutation;
    mutation.kind = MutationKind::erase;
    mutation.key = *registry.key(node);
    mutation.expected = node;
    const auto result = s.transactions.apply(
        {state.surface(), state.snapshot().revision, std::span{&mutation, 1}});
    return result.status == BatchStatus::valid
               ? ok
               : -100 - static_cast<std::int64_t>(result.status);
  }
  if (operation == 4 && v.size() == 5 && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 &&
      v[1] <= 3) {
    FocusState focus{static_cast<FocusKind>(v[1]), {}, {}};
    if (focus.kind == FocusKind::managed) {
      focus.node = handle(v.subspan(2));
      if (!focus.node || v[4] <= 0)
        return conversion;
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

} // namespace itar::android
