#include <itar/geometry_view.hpp>

#include <array>

#include "check.hpp"

using namespace itar;

int main() {
  State state{SurfaceId{1}};
  Mutation a;
  a.key = OccurrenceKey{"a"};
  a.record.mounted = true;
  a.record.mount = MountGeneration{1};
  a.record.geometry = {state.surface(), a.record.mount, LayoutRevision{1},
                       {0, 0, 10, 10}, GeometryState::measured};
  Mutation b = a;
  b.key = OccurrenceKey{"b"};
  auto operations = std::array{a, b};
  CHECK(state.apply({state.surface(), {}, operations}).status == BatchStatus::valid);
  for (auto& op : operations) {
    op.expected = state.snapshot().registry.find(op.key);
    op.kind = MutationKind::update;
    CHECK(usableGeometry(state.snapshot(), state.surface(), op.expected)->committed == Revision{1});
  }
  a = operations[0];
  CHECK(state.observeAvailability({state.surface(), a.expected, a.record.mount,
      AvailabilityKind::geometry_dirty, LayoutRevision{2}}) == ObservationStatus::changed);
  CHECK(!usableGeometry(state.snapshot(), state.surface(), a.expected));
  CHECK(state.apply({state.surface(), Revision{1}, operations}).status == BatchStatus::geometry);
  for (auto& op : operations) {
    op.record.geometry.layout = LayoutRevision{3};
    op.record.geometry.bounds.y = 20;
  }
  CHECK(state.apply({state.surface(), Revision{1}, operations}).status == BatchStatus::valid);
  const auto old = state.snapshot();
  for (auto& op : operations) {
    auto bounds = usableGeometry(old, state.surface(), op.expected);
    CHECK(bounds && bounds->committed == Revision{2} && bounds->bounds.y == 20);
  }
  CHECK(state.observeAvailability({state.surface(), a.expected, a.record.mount,
      AvailabilityKind::geometry_dirty, LayoutRevision{2}}) == ObservationStatus::unchanged);
  operations[0].record.geometry.surface = SurfaceId{2};
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status == BatchStatus::geometry);
  operations[0].record.geometry.surface = state.surface();
  operations[0].record.geometry.mount = MountGeneration{2};
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status == BatchStatus::geometry);
  operations[0].record.geometry.mount = a.record.mount;
  operations[0].record.geometry.state = GeometryState::hidden;
  operations[1].record.geometry.state = GeometryState::clipped;
  CHECK(state.apply({state.surface(), Revision{2}, operations}).status == BatchStatus::valid);
  CHECK(!usableGeometry(state.snapshot(), state.surface(), operations[0].expected));
  CHECK(!usableGeometry(state.snapshot(), state.surface(), operations[1].expected));
  CHECK(!usableGeometry(old, SurfaceId{2}, a.expected));
  operations[0].record.geometry.state = GeometryState::unavailable;
  CHECK(state.apply({state.surface(), Revision{3}, operations}).status == BatchStatus::valid);
  operations[0].record.geometry.state = GeometryState::measured;
  CHECK(state.apply({state.surface(), Revision{4}, operations}).status == BatchStatus::geometry);
  CHECK(usableGeometry(old, state.surface(), a.expected));
}
