#include "navigation_fixture.hpp"

using namespace itar;

int main() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  scope.navigation.layout = Layout::row;
  const auto root = f.add("root", scope);
  const auto modal = f.add("modal", scope, "root");
  const auto a = f.add("a", f.item(1), "modal");
  const auto b = f.add("b", f.item(2), "modal");
  const auto outside = f.add("outside", f.item(3), "root");
  auto input = f.focus(a, root);
  auto config = *f.state.snapshot().registry.lookup(a);
  config.navigation.overrides[1] = b;
  f.update(a, config);
  CHECK(resolveOverride(f.state, Direction::right, input).target == b);
  config.navigation.overrides[1] = outside;
  f.update(a, config);
  auto modalConfig = *f.state.snapshot().registry.lookup(modal);
  modalConfig.navigation.trap = true;
  f.update(modal, modalConfig);
  CHECK(resolveOverride(f.state, Direction::right, input).reason
        == ProposalReason::outside_boundary);
  modalConfig.navigation.trap = false;
  f.update(modal, modalConfig);
  auto outsideConfig = *f.state.snapshot().registry.lookup(outside);
  outsideConfig.active = false;
  f.update(outside, outsideConfig);
  CHECK(resolveOverride(f.state, Direction::right, input).reason == ProposalReason::ineligible);
  config.navigation.overrides[1] = a;
  f.update(a, config);
  CHECK(resolveOverride(f.state, Direction::right, input).reason == ProposalReason::invalid_override);
  config.navigation.overrides[1] = {NodeId{200}, Generation{1}};
  f.update(a, config);
  CHECK(resolveOverride(f.state, Direction::right, input).reason == ProposalReason::invalid_override);
  config.navigation.overrides[1] = b;
  f.update(a, config);
  auto reverse = *f.state.snapshot().registry.lookup(b);
  reverse.navigation.overrides[1] = a;
  f.update(b, reverse);  // A->B->A never traverses a chain.
  CHECK(resolveOverride(f.state, Direction::right, input).target == b);
  CHECK(boundaryProposal(f.state, modal, Direction::right, input).reason == ProposalReason::stop);
  modalConfig.navigation.boundary = Boundary::wrap;
  f.update(modal, modalConfig);
  CHECK(boundaryProposal(f.state, modal, Direction::right, input).reason == ProposalReason::wrapped);
  modalConfig.navigation.boundary = Boundary::parent;
  f.update(modal, modalConfig);
  CHECK(boundaryProposal(f.state, modal, Direction::right, input).reason == ProposalReason::parent_continuation);
  CHECK(resolveOverride(f.state, static_cast<Direction>(9), input).reason == ProposalReason::invalid_direction);
}
