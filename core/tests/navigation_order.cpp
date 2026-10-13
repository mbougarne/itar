#include "navigation_fixture.hpp"

using namespace itar;

int main() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  scope.navigation.layout = Layout::row;
  const auto row = f.add("row", scope);
  NodeRecord unmounted;
  unmounted.order = 20;
  const auto twenty = f.add("20", unmounted, "row");
  const auto nineteen = f.add("19", f.item(19), "row");
  const auto eighteen = f.add("18", f.item(18), "row");
  auto input = f.focus(nineteen, row);
  const auto focus = f.state.snapshot().inputFocus;
  const auto p = resolve(f.state, Direction::right, input);
  CHECK(p.target == twenty && p.kind == ProposalKind::reveal && !p.mount);
  CHECK(p.reason == ProposalReason::ordered);
  CHECK(resolve(f.state, Direction::left, input).target == eighteen);
  CHECK(f.state.snapshot().inputFocus == focus);
  scope.navigation.rtl = true;
  f.update(row, scope);
  CHECK(resolve(f.state, Direction::left, input).target == twenty);
  CHECK(resolve(f.state, Direction::right, input).target == eighteen);
  auto disabled = *f.state.snapshot().registry.lookup(eighteen);
  disabled.enabled = false;
  f.update(eighteen, disabled);
  CHECK(resolve(f.state, Direction::right, input).reason == ProposalReason::stop);
  scope.navigation.boundary = Boundary::wrap;
  f.update(row, scope);
  CHECK(resolve(f.state, Direction::right, input).target == twenty);
  CHECK(resolve(f.state, Direction::right, input).reason == ProposalReason::wrapped);
  Mutation erase;
  erase.kind = MutationKind::erase;
  erase.key = OccurrenceKey{"20"};
  erase.expected = twenty;
  CHECK(f.state.apply({f.state.surface(), f.state.snapshot().revision,
                      std::span{&erase, 1}}).status == BatchStatus::valid);
  CHECK(resolve(f.state, Direction::left, input).reason == ProposalReason::stop);
  scope.navigation.layout = Layout::column;
  scope.navigation.boundary = Boundary::stop;
  f.update(row, scope);
  const auto next = f.add("next", f.item(21), "row");
  CHECK(resolve(f.state, Direction::down, input).target == next);
  CHECK(resolve(f.state, Direction::up, f.focus(next, row)).target == nineteen);
  CHECK(resolve(f.state, Direction::left, f.focus(nineteen, row)).kind == ProposalKind::boundary);
}
