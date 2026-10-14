#pragma once
#include <itar/transaction.hpp>
#include "navigation_fixture.hpp"

struct TransactionFixture : NavigationFixture {
  itar::Transactions tx{state, itar::SurfaceLifetime{10}};
  itar::RequestOptions options{100, itar::DatasetRevision{1}, itar::ResourceId{1},
                               itar::Direction::right};
  itar::NodeHandle a, b, row;
  itar::InputContext input;
  TransactionFixture(bool mounted = true) {
    itar::NodeRecord scope;
    scope.scope = true;
    scope.navigation.layout = itar::Layout::row;
    row = add("row", scope);
    a = add("19", item(19), "row");
    auto target = item(20, {20, 0, 10, 10});
    if (!mounted) { target.mounted = false; target.mount = {}; target.geometry = {}; }
    b = add("20", target, "row");
    input = focus(a, row);
  }
};
