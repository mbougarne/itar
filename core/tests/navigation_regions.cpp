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
  // Swapping the axes or wrapping the ordered group must preserve the result.
  for (bool transpose : {false, true}) {
    for (bool nested : {false, true}) {
      NavigationFixture f;
      const auto rect = [transpose](double x, double y, double w, double h) {
        return transpose ? Rect{y, x, h, w} : Rect{x, y, w, h};
      };
      const auto next = transpose ? Direction::right : Direction::down;
      const auto previous = transpose ? Direction::left : Direction::up;
      const auto across = transpose ? Direction::up : Direction::left;
      const auto major = transpose ? Layout::row : Layout::column;
      const auto minor = transpose ? Layout::column : Layout::row;
      if (nested) { f.add("wrapper", region(Layout::spatial)); }
      f.add("group", region(major), nested ? "wrapper" : "");
      f.add("leading", region(minor), "group");
      f.add("trailing", region(minor), "group");
      const auto first = f.add("first", f.item(0, rect(200, 100, 300, 150)), "leading");
      const auto last = f.add("last", f.item(0, rect(200, 900, 300, 150)), "trailing");
      f.add("lateral", region(major));
      const auto nearFirst = f.add("near-first", f.item(0, rect(0, 120, 100, 50)), "lateral");
      const auto nearLast = f.add("near-last", f.item(1, rect(0, 1000, 100, 65)), "lateral");
      CHECK(resolve(f.state, next, f.focus(last)).kind == ProposalKind::boundary);
      CHECK(resolve(f.state, previous, f.focus(last)).target == first);
      CHECK(resolve(f.state, across, f.focus(first)).target == nearFirst);
      CHECK(resolve(f.state, across, f.focus(last)).target == nearLast);
      f.add("forward", region(minor));
      const auto beyond = f.add("beyond", f.item(0, rect(200, 1070, 100, 50)), "forward");
      CHECK(resolve(f.state, next, f.focus(last)).target == beyond);
      // A diagonal peer still qualifies when both of its edges advance.
      f.add("diagonal", region(minor));
      const auto offset = f.add("offset", f.item(0, rect(0, 75, 100, 50)), "diagonal");
      CHECK(resolve(f.state, previous, f.focus(first)).target == offset);
    }
  }
  { // A measured sibling cannot supply a missing spatial origin.
    NavigationFixture f;
    f.add("outer", region(Layout::spatial));
    f.add("inner", region(Layout::row), "outer");
    f.add("a", f.item(0, {0, 0, 10, 10}), "inner");
    auto clipped = f.item(1, {20, 0, 10, 10});
    clipped.geometry.state = GeometryState::clipped;
    const auto b = f.add("b", clipped, "inner");
    f.add("c", f.item(0, {40, 0, 10, 10}), "outer");
    const auto result = resolve(f.state, Direction::right, f.focus(b));
    CHECK(result.kind == ProposalKind::unavailable && result.reason == ProposalReason::stale_geometry);
  }
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
