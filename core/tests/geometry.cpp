#include <itar/geometry_view.hpp>

#include <array>

#include "check.hpp"

using namespace itar;

namespace {
void singleUpdateMatchesGeneralBatch() {
  State single{SurfaceId{1}, {}, 5};
  State general{SurfaceId{1}, {}, 5};
  Mutation row;
  row.key = OccurrenceKey{"row"};
  row.record.scope = true;
  Mutation card;
  card.key = OccurrenceKey{"card"};
  card.parent = row.key;
  card.record.mounted = true;
  card.record.mount = MountGeneration{2};
  card.record.geometry = {single.surface(), card.record.mount, LayoutRevision{1},
                          {0, 0, 10, 20}, GeometryState::measured};
  Mutation peer = card;
  peer.key = OccurrenceKey{"peer"};
  const std::array initial{row, card, peer};
  for (auto* state : {&single, &general}) {
    CHECK(state->apply({state->surface(), {}, initial}).status == BatchStatus::valid);
  }
  const auto& registry = single.snapshot().registry;
  row.kind = card.kind = MutationKind::update;
  row.expected = registry.find(row.key);
  card.expected = registry.find(card.key);
  // A real native update may copy neither the resolved parent handle nor the
  // host-owned dirty epoch. The parent key and committed epoch are authoritative.
  const FocusState input{FocusKind::managed, card.expected, card.record.mount};
  const FocusState reader{FocusKind::managed, registry.find(peer.key), peer.record.mount};
  for (auto* state : {&single, &general}) {
    CHECK(state->observeFocus({state->surface(), FocusChannel::input, input}) == ObservationStatus::changed);
    CHECK(state->observeFocus({state->surface(), FocusChannel::accessibility, reader}) == ObservationStatus::changed);
  }
  const auto compare = [&](Mutation update, BatchStatus expected, bool changed,
                           std::optional<SurfaceId> surface = {}, std::optional<Revision> revision = {}) {
    const auto before = single.snapshot().revision;
    const auto oldCard = *single.snapshot().registry.lookup(input.node);
    // The second operation restates an unchanged root scope. It forces the
    // general batch path without changing a record, scope history or layout.
    const std::array batch{update, row};
    const auto owner = surface.value_or(single.surface());
    const auto base = revision.value_or(before);
    const auto a = single.apply({owner, base, std::span{&update, 1}});
    const auto b = general.apply({owner, base, batch});
    CHECK(a.status == expected && a.status == b.status && a.operation == b.operation);
    CHECK(a.revision == b.revision && a.revision.value == before.value + (expected == BatchStatus::valid));
    CHECK(a.changed.size() == b.changed.size() && a.changed.size() == (changed ? 1u : 0u));
    if (changed) {
      CHECK(a.changed[0].before == input.node && a.changed[0].after == input.node);
      CHECK(b.changed[0].before == input.node && b.changed[0].after == input.node);
    }
    const auto& committedCard = *single.snapshot().registry.lookup(input.node);
    CHECK(committedCard == *general.snapshot().registry.lookup(input.node));
    if (!changed) CHECK(committedCard == oldCard);
    for (const auto* state : {&single, &general}) {
      CHECK(state->snapshot().inputFocus == input && state->snapshot().accessibilityFocus == reader);
      CHECK(state->history(row.expected) && *state->history(row.expected) == card.key);
    }
  };

  compare(card, BatchStatus::valid, false);  // Even a no-op batch advances the revision.
  for (auto* state : {&single, &general}) {
    CHECK(state->observeAvailability({state->surface(), input.node, input.mount,
                                      AvailabilityKind::geometry_dirty, LayoutRevision{3}}) == ObservationStatus::changed);
  }
  card.record.geometry.layout = LayoutRevision{3};
  compare(card, BatchStatus::geometry, false);
  card.record.geometry.layout = LayoutRevision{4};
  auto bad = card;
  bad.record.geometry.mount = MountGeneration{1};
  compare(bad, BatchStatus::geometry, false);
  bad.record.mount = MountGeneration{1};
  compare(bad, BatchStatus::stale_mount, false);
  bad = card;
  bad.record.geometry.surface = SurfaceId{2};
  compare(bad, BatchStatus::geometry, false);
  bad = card;
  bad.record.geometry.bounds.width = -1;
  compare(bad, BatchStatus::geometry, false);
  bad = card;
  bad.expected = row.expected;
  compare(bad, BatchStatus::stale_handle, false);
  compare(card, BatchStatus::stale_surface, false, SurfaceId{2});
  compare(card, BatchStatus::revision_mismatch, false, {}, Revision{1});
  compare(card, BatchStatus::valid, true);
  CHECK(single.snapshot().registry.lookup(input.node)->invalidatedThrough == LayoutRevision{3});

  card.record.geometry.state = GeometryState::unavailable;
  compare(card, BatchStatus::valid, true);
  card.record.geometry.state = GeometryState::measured;
  compare(card, BatchStatus::geometry, false);  // The unavailable update fenced epoch 4.
  card.record.geometry.layout = LayoutRevision{5};
  compare(card, BatchStatus::valid, true);
  compare(card, BatchStatus::revision_exhausted, false);
  card.record.geometry.layout = LayoutRevision{3};
  compare(card, BatchStatus::geometry, false);  // Validation still precedes exhaustion.
}
}  // namespace

int main() {
  singleUpdateMatchesGeneralBatch();
  State state{SurfaceId{1}};
  Mutation a;
  a.key = OccurrenceKey{"a"};
  a.record.mounted = true;
  a.record.mount = MountGeneration{1};
  a.record.geometry = {state.surface(),
                       a.record.mount,
                       LayoutRevision{1},
                       {0, 0, 10, 10},
                       GeometryState::measured};
  Mutation b = a;
  b.key = OccurrenceKey{"b"};
  auto operations = std::array{a, b};
  CHECK(state.apply({state.surface(), {}, operations}).status ==
        BatchStatus::valid);
  for (auto& op : operations) {
    op.expected = state.snapshot().registry.find(op.key);
    op.kind = MutationKind::update;
    CHECK(usableGeometry(state.snapshot(), state.surface(), op.expected)
              ->committed == Revision{1});
  }
  a = operations[0];
  CHECK(state.observeAvailability({state.surface(), a.expected, a.record.mount,
                                   AvailabilityKind::geometry_dirty,
                                   LayoutRevision{2}}) ==
        ObservationStatus::changed);
  CHECK(!usableGeometry(state.snapshot(), state.surface(), a.expected));
  CHECK(state.apply({state.surface(), Revision{1}, operations}).status ==
        BatchStatus::geometry);
  for (auto& op : operations) {
    op.record.geometry.layout = LayoutRevision{3};
    op.record.geometry.bounds.y = 20;
  }
  CHECK(state.apply({state.surface(), Revision{1}, operations}).status ==
        BatchStatus::valid);
  const auto old = state.snapshot();
  for (auto& op : operations) {
    auto bounds = usableGeometry(old, state.surface(), op.expected);
    CHECK(bounds && bounds->committed == Revision{2} && bounds->bounds.y == 20);
  }
  CHECK(state.observeAvailability({state.surface(), a.expected, a.record.mount,
                                   AvailabilityKind::geometry_dirty,
                                   LayoutRevision{2}}) ==
        ObservationStatus::unchanged);
  operations[0].record.geometry.surface = SurfaceId{2};
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status ==
        BatchStatus::geometry);
  operations[0].record.geometry.surface = state.surface();
  operations[0].record.geometry.mount = MountGeneration{2};
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status ==
        BatchStatus::geometry);
  operations[0].record.geometry.mount = a.record.mount;
  operations[0].record.geometry.state = GeometryState::hidden;
  operations[1].record.geometry.state = GeometryState::clipped;
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status ==
        BatchStatus::valid);
  CHECK(!usableGeometry(state.snapshot(), state.surface(),
                        operations[0].expected));
  CHECK(!usableGeometry(state.snapshot(), state.surface(),
                        operations[1].expected));
  CHECK(!usableGeometry(old, SurfaceId{2}, a.expected));
  operations[0].record.geometry.state = GeometryState::unavailable;
  CHECK(state.apply({state.surface(), Revision{3}, operations}).status ==
        BatchStatus::valid);
  operations[0].record.geometry.state = GeometryState::measured;
  CHECK(state.apply({state.surface(), Revision{4}, operations}).status ==
        BatchStatus::geometry);
  CHECK(usableGeometry(old, state.surface(), a.expected));
}
