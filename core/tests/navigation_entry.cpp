#include "navigation_fixture.hpp"

#include <array>
#include <limits>

using namespace itar;

void enterGridFromFilters() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  const auto root = f.add("root", scope);
  scope.navigation.boundary = Boundary::parent;
  scope.navigation.layout = Layout::row;
  f.add("filters", scope, "root");
  const auto all = f.add("all", f.item(0, {0, 0, 60, 30}), "filters");
  const auto genre = f.add("genre", f.item(1, {100, 0, 60, 30}), "filters");
  scope.navigation.layout = Layout::column;
  const auto grid = f.add("grid", scope, "root");
  scope.navigation.layout = Layout::row;
  const auto cards = f.add("cards", scope, "grid");
  scope.order = 1;
  f.add("pagination", scope, "grid");
  const auto first = f.add("first", f.item(0, {0, 50, 80, 60}), "cards");
  const auto second = f.add("second", f.item(1, {100, 50, 80, 60}), "cards");
  const auto more = f.add("more", f.item(0, {0, 400, 60, 30}), "pagination");
  const auto footer = f.add("footer", f.item(0, {100, 500, 60, 30}), "root");

  CHECK(resolve(f.state, Direction::down, f.focus(all, root)).target == first);
  CHECK(resolve(f.state, Direction::down, f.focus(genre, root)).target == second);
  CHECK(resolve(f.state, Direction::up, f.focus(footer, root)).target == more);

  auto unavailable = *f.state.snapshot().registry.lookup(cards);
  unavailable.navigation.entryReady = false;
  f.update(cards, unavailable);
  CHECK(resolve(f.state, Direction::down, f.focus(all, root)).target == more);
  unavailable.navigation.entryReady = true;
  f.update(cards, unavailable);

  auto returning = *f.state.snapshot().registry.lookup(grid);
  returning.navigation.restoreOnEntry = true;
  f.update(grid, returning);
  f.focus(more, root);
  CHECK(resolve(f.state, Direction::down, f.focus(all, root)).target == more);
}

int main() {
  enterGridFromFilters();
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
  scope.navigation.restoreOnEntry = true;
  f.update(upper, scope, OccurrenceKey{"b"});
  CHECK(resolve(f.state, Direction::up, input).target == a);
  auto retired = *f.state.snapshot().registry.lookup(a);
  retired.enabled = false;
  f.update(a, retired);
  CHECK(resolve(f.state, Direction::up, input).target == b);
  retired.enabled = true;
  f.update(a, retired);
  scope.navigation.restoreOnEntry = false;
  scope.navigation.entryReady = false;
  f.update(upper, scope, OccurrenceKey{"b"});
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
  NavigationFixture atomic;
  Mutation rail;
  rail.key = OccurrenceKey{"rail"};
  rail.record.scope = true;
  rail.preferred = OccurrenceKey{"preferred"};
  Mutation first;
  first.key = OccurrenceKey{"first"};
  first.parent = rail.key;
  first.record = atomic.item(1);
  Mutation preferred = first;
  preferred.key = *rail.preferred;
  preferred.record.order = 2;
  const auto batch = std::array{preferred, first, rail};
  CHECK(atomic.state.apply({atomic.state.surface(), {}, batch}).status == BatchStatus::valid);
  atomic.state.observeFocus({atomic.state.surface(), FocusChannel::input, {FocusKind::absent, {}, {}}});
  const InputContext absent{atomic.state.surface(), {}, InputOwner::engine, atomic.state.snapshot().inputFocus};
  const auto handle = atomic.state.snapshot().registry.find(preferred.key);
  const auto scopeHandle = atomic.state.snapshot().registry.find(rail.key);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent).target == handle);
  preferred.kind = MutationKind::replace;
  preferred.expected = handle;
  CHECK(atomic.state.apply({atomic.state.surface(), Revision{1}, std::span{&preferred, 1}}).status == BatchStatus::valid);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent).target != handle);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent).target == atomic.state.snapshot().registry.find(preferred.key));
  rail.kind = MutationKind::update;
  rail.expected = scopeHandle;
  rail.preferred = OccurrenceKey{};
  const auto cleared = atomic.state.apply({atomic.state.surface(), Revision{2}, std::span{&rail, 1}});
  CHECK(cleared.status == BatchStatus::valid && cleared.changed.size() == 1);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent).target == atomic.state.snapshot().registry.find(first.key));
  rail.preferred = OccurrenceKey{std::string(513, 'x')};
  CHECK(atomic.state.apply({atomic.state.surface(), Revision{3}, std::span{&rail, 1}}).status == BatchStatus::invalid);
  CHECK(atomic.state.snapshot().revision == Revision{3});
  rail.preferred = OccurrenceKey{"not-yet-known"};
  CHECK(atomic.state.apply({atomic.state.surface(), Revision{3}, std::span{&rail, 1}}).status == BatchStatus::valid);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent).reason == ProposalReason::no_entry);
  CHECK(resolveEntry(atomic.state, scopeHandle, absent, {EntryReason::returning}).target
        == atomic.state.snapshot().registry.find(first.key));
}
