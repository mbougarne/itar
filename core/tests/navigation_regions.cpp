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
}
