#include <itar/state.hpp>

#include <array>

#include "check.hpp"

using namespace itar;

int main() {
  State state{SurfaceId{1}};
  Mutation item;
  item.key = OccurrenceKey{"logical item"};
  item.record.mounted = true;
  item.record.mount = MountGeneration{1};
  item.record.geometry = {state.surface(),
                          item.record.mount,
                          LayoutRevision{1},
                          {0, 0, 10, 10},
                          GeometryState::measured};
  CHECK(state.apply({state.surface(), {}, std::span{&item, 1}}).status ==
        BatchStatus::valid);
  item.expected = state.snapshot().registry.find(item.key);
  item.kind = MutationKind::update;
  // Fake host owns a mapping. It removes it before reporting the fact.
  std::optional<NodeHandle> hostMapping{item.expected};
  hostMapping.reset();
  AvailabilityObservation lost{state.surface(),
                               item.expected,
                               MountGeneration{1},
                               AvailabilityKind::mount_lost,
                               {}};
  CHECK(state.observeAvailability(lost) == ObservationStatus::changed);
  CHECK(state.observeAvailability(lost) == ObservationStatus::unchanged);
  Mutation duplicate;
  duplicate.key = OccurrenceKey{"unrelated duplicate"};
  auto invalid = std::array{duplicate, duplicate};
  CHECK(state.apply({state.surface(), Revision{1}, invalid}).status ==
        BatchStatus::duplicate);
  CHECK(!state.snapshot().registry.lookup(item.expected)->mounted &&
        !hostMapping);
  CHECK(state.snapshot().registry.lookup(item.expected)->geometry.state ==
        GeometryState::unavailable);
  CHECK(state.snapshot().registry.size() == 1 &&
        state.snapshot().revision == Revision{1});
  CHECK(
      state.apply({state.surface(), Revision{1}, std::span{&item, 1}}).status ==
      BatchStatus::stale_mount);  // Even a valid config cannot revive the lost
                                  // mount.
  item.record.mount = MountGeneration{2};
  item.record.geometry.mount = item.record.mount;
  CHECK(
      state.apply({state.surface(), Revision{1}, std::span{&item, 1}}).status ==
      BatchStatus::valid);
  CHECK(state.observeAvailability(lost) == ObservationStatus::stale_mount);
  CHECK(state.snapshot().registry.lookup(item.expected)->mounted);
  AvailabilityObservation dirty{
      state.surface(), item.expected, MountGeneration{2},
      AvailabilityKind::geometry_dirty, LayoutRevision{1}};
  CHECK(state.observeAvailability(dirty) == ObservationStatus::changed);
  CHECK(state.observeAvailability(dirty) == ObservationStatus::unchanged);
  CHECK(state.snapshot().registry.lookup(item.expected)->geometry.state ==
        GeometryState::dirty);
  dirty.surface = SurfaceId{2};
  CHECK(state.observeAvailability(dirty) == ObservationStatus::stale_surface);
}
