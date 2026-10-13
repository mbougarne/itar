#include "navigation_fixture.hpp"

using namespace itar;

int main() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  const auto root = f.add("root", scope);
  const auto a = f.add("a", f.item(19), "root");
  const auto b = f.add("b", {}, "root");
  auto input = f.focus(a, root);
  const auto before = f.state.snapshot();
  for (auto owner : {InputOwner::text, InputOwner::native_control,
                     InputOwner::accessibility, InputOwner::system}) {
    input.owner = owner;
    CHECK(proposeTarget(f.state, b, input).kind == ProposalKind::host_owned);
  }
  input.owner = InputOwner::engine;
  for (int i = 0; i < 20; ++i) {
    const auto p = proposeTarget(f.state, b, input);
    CHECK(p.kind == ProposalKind::reveal && p.target == b && !p.mount);
  }
  CHECK(f.state.snapshot().revision == before.revision);
  CHECK(f.state.snapshot().inputFocus == before.inputFocus);
  CHECK(*f.state.history(root) == before.history.front().occurrence);
  CHECK(proposeTarget(f.state, a, input).mount == MountGeneration{1});
  input.source.mount = MountGeneration{2};
  CHECK(gateNavigation(f.state, input).reason == ProposalReason::stale_source);
  input.source = before.inputFocus;
  input.surface = SurfaceId{2};
  CHECK(gateNavigation(f.state, input).reason == ProposalReason::stale_surface);
  input.surface = f.state.surface();
  for (auto kind : {FocusKind::unknown, FocusKind::absent, FocusKind::unmanaged}) {
    CHECK(f.state.observeFocus({f.state.surface(), FocusChannel::input,
                               {kind, {}, {}}}) == ObservationStatus::changed);
    CHECK(gateNavigation(f.state, input).kind != ProposalKind::ready);
  }
  input = f.focus(a, root);
  CHECK(f.state.observeAvailability({f.state.surface(), a, MountGeneration{1},
                                    AvailabilityKind::mount_lost, {}})
        == ObservationStatus::changed);
  CHECK(gateNavigation(f.state, input).reason == ProposalReason::unknown_source);
}
