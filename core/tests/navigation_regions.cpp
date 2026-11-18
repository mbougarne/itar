#include "navigation_fixture.hpp"

using namespace itar;

static NodeRecord region(Layout layout) {
  NodeRecord value;
  value.scope = true;
  value.navigation.layout = layout;
  value.navigation.boundary = Boundary::parent;
  return value;
}

int main() {
  { // Left at a rail edge must not enter a narrower row directly above it.
    NavigationFixture f;
    f.add("sidebar", region(Layout::column));
    const auto nav = f.add("home", f.item(0, {0, 0, 60, 40}), "sidebar");
    f.add("catalogue", region(Layout::column));
    f.add("row-a", region(Layout::row), "catalogue");
    f.add("older", f.item(0, {100, 100, 100, 40}), "row-a");
    f.add("row-b", region(Layout::row), "catalogue");
    const auto source = f.add("first", f.item(0, {100, 200, 100, 40}), "row-b");
    f.add("second", f.item(1, {240, 200, 100, 40}), "row-b");
    const auto proposal = resolve(f.state, Direction::left, f.focus(source));
    CHECK(proposal.target == nav);
  }
  { // A wider editing row below is not a Right destination for a keyboard row.
    NavigationFixture f;
    f.add("keyboard", region(Layout::spatial));
    f.add("letters", region(Layout::row), "keyboard");
    f.add("h", f.item(0, {100, 100, 20, 40}), "letters");
    const auto source = f.add("n", f.item(1, {340, 100, 20, 40}), "letters");
    f.add("editing", region(Layout::row), "keyboard");
    f.add("space", f.item(0, {100, 200, 268, 40}), "editing");
    f.add("results", region(Layout::column));
    const auto result = f.add("match", f.item(0, {450, 100, 100, 40}), "results");
    CHECK(resolve(f.state, Direction::right, f.focus(source)).target == result);
  }
  { // Mounted overscan can put a neighboring rail's bounds outside the sidebar.
    NavigationFixture f;
    f.add("sidebar", region(Layout::column));
    const auto nav = f.add("home", f.item(0, {0, 0, 50, 40}), "sidebar");
    f.add("catalogue", region(Layout::column));
    f.add("previous", region(Layout::row), "catalogue");
    f.add("offscreen", f.item(0, {-120, 100, 90, 40}), "previous");
    const auto previous = f.add("visible", f.item(1, {80, 100, 90, 40}), "previous");
    const auto row = f.add("current", region(Layout::row), "catalogue");
    const auto first = f.add("first", f.item(0, {90, 200, 90, 40}), "current");
    const auto last = f.add("last", f.item(1, {190, 200, 90, 40}), "current");
    CHECK(resolve(f.state, Direction::left, f.focus(last)).target == first);
    CHECK(resolve(f.state, Direction::left, f.focus(first)).target == nav);

    // Scrolling the previous rail the other way must not turn Right into Up.
    f.add("overscan-right", f.item(2, {400, 100, 90, 40}), "previous");
    CHECK(resolve(f.state, Direction::right, f.focus(last)).kind == ProposalKind::boundary);
    const auto more = f.add("right-control", f.item(0, {330, 200, 60, 40}));
    CHECK(resolve(f.state, Direction::right, f.focus(last)).target == more);

    auto wrapped = region(Layout::row);
    wrapped.navigation.boundary = Boundary::wrap;
    f.update(row, wrapped);
    CHECK(resolve(f.state, Direction::left, f.focus(first)).target == last);
    auto override = *f.state.snapshot().registry.lookup(first);
    override.navigation.overrides[0] = previous;
    f.update(first, override);
    CHECK(resolve(f.state, Direction::left, f.focus(first)).target == previous);
  }
}
