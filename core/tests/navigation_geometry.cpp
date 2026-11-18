#include "navigation_fixture.hpp"

#include <limits>

using namespace itar;

int main() {
  for (bool reverse : {false, true}) {
    NavigationFixture f;
    const auto source = f.add("source", f.item(0, {0, 0, 10, 10}));
    NodeHandle a, b;
    if (reverse) {
      b = f.add("b", f.item(1, {20, 0, 20, 20}));
      a = f.add("a", f.item(1, {20, 0, 20, 20}));
    } else {
      a = f.add("a", f.item(1, {20, 0, 20, 20}));
      b = f.add("b", f.item(1, {20, 0, 20, 20}));
    }
    const auto diagonal = f.add("diagonal", f.item(3, {12, 25, 10, 10}));
    f.add("distant-aligned", f.item(4, {100, 0, 10, 10}));
    f.add("wrong-direction", f.item(5, {-12, 0, 10, 10}));
    auto input = f.focus(source);
    CHECK(resolve(f.state, Direction::right, input).target == a);
    CHECK(resolve(f.state, Direction::right, input).reason == ProposalReason::geometric);
    CHECK(resolve(f.state, Direction::right, input).policy == "itar-linear-v4");
    CHECK(f.state.observeAvailability({f.state.surface(), a, MountGeneration{1},
                                      AvailabilityKind::geometry_dirty, LayoutRevision{1}})
          == ObservationStatus::changed);
    CHECK(resolve(f.state, Direction::right, input).target == b);
    auto disabled = *f.state.snapshot().registry.lookup(b);
    disabled.active = false;
    f.update(b, disabled);
    CHECK(resolve(f.state, Direction::right, input).target == diagonal);
    disabled = *f.state.snapshot().registry.lookup(diagonal);
    disabled.geometry.state = GeometryState::clipped;
    f.update(diagonal, disabled);
    CHECK(resolve(f.state, Direction::right, input).target
          == f.state.snapshot().registry.find(OccurrenceKey{"distant-aligned"}));
    auto invalid = f.item(6);
    invalid.geometry.bounds.x = std::numeric_limits<double>::infinity();
    Mutation op;
    op.key = OccurrenceKey{"invalid"};
    op.record = invalid;
    CHECK(f.state.apply({f.state.surface(), f.state.snapshot().revision,
                        std::span{&op, 1}}).status == BatchStatus::geometry);
    CHECK(f.state.observeAvailability({f.state.surface(), source, MountGeneration{1},
                                      AvailabilityKind::geometry_dirty, LayoutRevision{1}})
          == ObservationStatus::changed);
    CHECK(resolve(f.state, Direction::right, input).reason == ProposalReason::stale_geometry);
  }
}
