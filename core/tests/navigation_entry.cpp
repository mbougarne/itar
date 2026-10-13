#include "navigation_fixture.hpp"

#include <limits>

using namespace itar;

int main() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  const auto root = f.add("root", scope);
  scope.navigation.layout = Layout::row;
  scope.navigation.boundary = Boundary::parent;
  const auto upper = f.add("upper", scope, "root");
  const auto lower = f.add("lower", scope, "root");
  const auto a = f.add("a", f.item(1, {0, 0, 10, 10}), "upper");
  const auto b = f.add("b", f.item(2, {100, 0, 10, 10}), "upper");
  const auto c = f.add("c", f.item(3, {100, 30, 10, 10}), "lower");
  f.focus(a, root);  // Upper remembers the left card.
  auto input = f.focus(c, root);
  CHECK(resolveEntry(f.state, upper, input, {EntryReason::returning}).target == a);
  CHECK(resolveEntry(f.state, upper, input, {EntryReason::adjacent, Direction::up, 105}).target == b);
  CHECK(resolve(f.state, Direction::up, input).target == b);
  CHECK(resolveEntry(f.state, upper, input).reason == ProposalReason::existing_focus);
  scope.navigation.preferred = b;
  scope.navigation.entryReady = false;
  f.update(upper, scope);
  CHECK(resolveEntry(f.state, upper, input, {EntryReason::returning}).reason == ProposalReason::entry_not_ready);
  scope.navigation.entryReady = true;
  f.update(upper, scope);
  auto disabled = *f.state.snapshot().registry.lookup(a);
  disabled.enabled = false;
  f.update(a, disabled);
  CHECK(resolveEntry(f.state, upper, input, {EntryReason::returning}).target == b);
  CHECK(resolveEntry(f.state, upper, input, {EntryReason::adjacent, Direction::up,
                      std::numeric_limits<double>::quiet_NaN()}).reason == ProposalReason::invalid_anchor);
  CHECK(f.state.observeFocus({f.state.surface(), FocusChannel::input,
                             {FocusKind::absent, {}, {}}}) == ObservationStatus::changed);
  input.source = f.state.snapshot().inputFocus;
  CHECK(resolveEntry(f.state, upper, input).target == b);
  auto unavailable = *f.state.snapshot().registry.lookup(b);
  unavailable.enabled = false;
  f.update(b, unavailable);
  CHECK(resolveEntry(f.state, upper, input).reason == ProposalReason::no_entry);
  CHECK(f.state.snapshot().inputFocus.kind == FocusKind::absent);
  CHECK(resolveEntry(f.state, lower, input).target == c);
}
