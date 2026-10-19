#pragma once
#include "registration.hpp"
#include <itar/topology.hpp>

namespace itar::android {
inline std::int64_t scope(Session &s, int operation, std::span<const std::int64_t> v,
                          std::string_view key, std::string_view preferred,
                          std::span<std::int64_t> out) {
  const auto &registry = s.state.snapshot().registry;
  if (operation == 23 && v.size() == 3 && v[0] >= 0 && v[0] <= 4 && v[1] >= 0 && v[2] > 0) {
    const auto node = registry.find(OccurrenceKey{std::string(key)});
    const auto *record = registry.lookup(node);
    RequestResult result{RequestStatus::unavailable, {}};
    if (record && record->scope && record->active && record->navigation.entryReady && v[0] == 0) {
      const InputContext input{s.state.surface(), node, InputOwner::engine, s.state.snapshot().inputFocus};
      const RequestOptions options{static_cast<TimePoint>(v[2]), DatasetRevision{1}, {}, {}};
      const auto *remembered = s.state.returningHistory(node);
      if (!remembered) remembered = s.state.history(node);
      if (remembered && logicalTarget(s.state, registry.find(*remembered)))
        result = s.transactions.requestFocus(*remembered, input, options);
      else result = s.transactions.begin(resolveEntry(s.state, node, input, {EntryReason::returning}), options);
      if (result.status == RequestStatus::started) s.state.consumeReturningHistory(node);
    }
    out[1] = static_cast<std::int64_t>(result.status); out[2] = result.request.value;
    return ok;
  }
  if (operation == 20 && v.size() == 9 && !key.empty() && key.size() <= 512 && preferred.size() <= 512) {
    if ((v[0] == 0) != (v[1] == 0) || (v[2] == 0) != (v[3] == 0) ||
        v[4] < 0 || v[4] > 1 || v[5] < 0 || v[5] > 2 || v[6] < 0 || v[6] > 2 ||
        v[7] < 0 || v[7] > 1 || v[8] < 0 || v[8] > 1) return conversion;
    const auto expected = handle(v), parent = handle(v.subspan(2));
    if ((v[0] && !expected) || (v[2] && (!parent || !registry.lookup(parent)))) return stale;
    Mutation mutation;
    mutation.key = OccurrenceKey{std::string(key)};
    mutation.expected = expected;
    mutation.kind = expected ? MutationKind::update : MutationKind::insert;
    if (parent) mutation.parent = *registry.key(parent);
    mutation.record.scope = true;
    mutation.record.active = v[4] != 0;
    mutation.record.navigation.layout = static_cast<Layout>(v[5]);
    mutation.record.navigation.boundary = static_cast<itar::Boundary>(v[6]);
    mutation.record.navigation.trap = v[7] != 0;
    mutation.record.navigation.entryReady = v[8] != 0;
    mutation.preferred = OccurrenceKey{std::string(preferred)};
    const auto result = s.transactions.apply({s.state.surface(), s.state.snapshot().revision, std::span{&mutation, 1}});
    if (result.status != BatchStatus::valid) return -100 - static_cast<std::int64_t>(result.status);
    const auto node = registry.find(mutation.key);
    out[1] = node.slot.value; out[2] = node.generation.value;
    return ok;
  }
  if (operation == 21 && v.size() == 2 && handle(v)) {
    const auto root = handle(v);
    if (!registry.lookup(root) || !registry.lookup(root)->scope) return stale;
    std::vector<Mutation> mutations;
    for (const auto node : registry.handles()) {
      if (node != root && !descendantOf(registry, node, root)) continue;
      Mutation mutation;
      mutation.kind = MutationKind::erase;
      mutation.key = *registry.key(node);
      mutation.expected = node;
      mutations.push_back(std::move(mutation));
    }
    const auto result = s.transactions.apply({s.state.surface(), s.state.snapshot().revision, mutations});
    return result.status == BatchStatus::valid ? ok : -100 - static_cast<std::int64_t>(result.status);
  }
  return conversion;
}
} // namespace itar::android
