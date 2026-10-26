#include "transaction_fixture.hpp"
#include "../internal/replay.hpp"

namespace {
using namespace itar;
using namespace itar::diagnostics;

const NodeHandle a{NodeId{2}, Generation{1}};
const NodeHandle b{NodeId{3}, Generation{1}};

Fixture initial(bool mounted) {
  Fixture fixture;
  NodeRecord scope;
  scope.scope = true;
  scope.navigation.layout = Layout::row;
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"row"}, {}, {}, scope});
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"19"}, {}, OccurrenceKey{"row"},
                             NavigationFixture::item(19)});
  auto target = NavigationFixture::item(20, {20, 0, 10, 10});
  if (!mounted) { target.mounted = false; target.mount = {}; target.geometry = {}; }
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"20"}, {}, OccurrenceKey{"row"}, target});
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"Play"}, {}, {},
                             NavigationFixture::item(0, {0, 20, 10, 10})});
  fixture.steps.push_back({Observe{{fixture.surface, FocusChannel::input,
                                   {FocusKind::managed, a, MountGeneration{1}}}, {}}, {}});
  return fixture;
}
}  // namespace

int main() {
  using namespace itar;
  auto loading = initial(false);
  auto target = NavigationFixture::item(20, {20, 0, 10, 10});
  target.mount = MountGeneration{2};
  target.geometry.mount = target.mount;
  target.geometry.layout = LayoutRevision{2};
  loading.steps.insert(loading.steps.end(), {
    {Input{Direction::right}, RequestStatus::started},
    {Input{Direction::right}, RequestStatus::joined},
    {Release{}, {}},
    {Issue{0}, RequestStatus::issued},
    {Commit{{{MutationKind::update, OccurrenceKey{"20"}, b, OccurrenceKey{"row"}, target}}}, {}},
    {Realize{0, b, target.mount}, RequestStatus::started},
    {Issue{1}, RequestStatus::issued},
    {Cancel{RequestId{1}}, RequestStatus::cancelled},
    {FocusKey{OccurrenceKey{"19"}}, RequestStatus::started},
    {Issue{2}, RequestStatus::issued},
    {Outcome{2, OutcomeKind::not_cancellable}, RequestStatus::reconciled},
    {Issue{3}, RequestStatus::waiting},
    {Observe{{loading.surface, FocusChannel::input, {FocusKind::managed, b, target.mount}}, 1},
             RequestStatus::reconciled},
    {Outcome{1, OutcomeKind::accepted}, RequestStatus::waiting},
    {Time{100}, RequestStatus::unchanged}
  });
  const auto first = replay(loading);
  CHECK(first && first == replay(loading));
  CHECK(first->effects.size() == 4 && first->effects[0].token.kind == EffectKind::reveal);
  CHECK(first->effects[1].token.kind == EffectKind::focus && first->effects[1].mount == target.mount);
  CHECK(first->focus.node == b && !first->active && first->notifications.size() == 2);
  CHECK(!first->notifications.back().request);  // Cancelled intent never succeeds.
  auto rejected = initial(true);
  rejected.steps.insert(rejected.steps.end(), {
    {FocusKey{OccurrenceKey{"20"}}, RequestStatus::started},
    {Availability{{rejected.surface, b, MountGeneration{1}, AvailabilityKind::geometry_dirty,
                    LayoutRevision{1}}}, {}},
    {Availability{{rejected.surface, a, MountGeneration{1}, AvailabilityKind::mount_lost, {}}}, {}},
    {Commit{{{MutationKind::update, OccurrenceKey{"19"}, a, OccurrenceKey{"missing"},
               NavigationFixture::item(19)}}, BatchStatus::stale_mount}, {}},
    {Observe{{rejected.surface, FocusChannel::input, {FocusKind::unmanaged, {}, {}}}, {}}, {}},
    {Time{100}, RequestStatus::unchanged}
  });
  const auto second = replay(rejected);
  CHECK(second && second == replay(rejected));
  CHECK(!second->records[1].mounted && second->records[2].geometry.state == GeometryState::dirty);
  CHECK(second->focus.kind == FocusKind::unmanaged && !second->active);
  rejected.version = 2;
  CHECK(!replay(rejected));
}
