#include "navigation_fixture.hpp"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <new>

static bool countAllocations;
static std::size_t allocations;
void* operator new(std::size_t size) {
  if (countAllocations) { ++allocations; }
  if (void* result = std::malloc(size ? size : 1)) { return result; }
  throw std::bad_alloc{};
}
void operator delete(void* pointer) noexcept { std::free(pointer); }
void operator delete(void* pointer, std::size_t) noexcept { std::free(pointer); }

using namespace itar;

struct Case {
  const char* source;
  Direction direction;
  const char* target;
  ProposalKind kind;
  ProposalReason reason;
};

int main() {
  for (bool reverse : {false, true}) {
    NavigationFixture f;
    NodeRecord root;
    root.scope = true;
    NodeRecord rail = root;
    rail.navigation.layout = Layout::row;
    rail.navigation.boundary = Boundary::parent;
    NodeRecord sidebar = root;
    sidebar.navigation.layout = Layout::column;
    sidebar.navigation.boundary = Boundary::parent;
    NodeRecord inactive = root;
    inactive.active = false;
    NodeRecord modal = root;
    modal.navigation.trap = true;
    auto make = [](const char* key, const char* parent, NodeRecord record) {
      Mutation op;
      op.key = OccurrenceKey{key};
      op.parent = OccurrenceKey{parent};
      op.record = record;
      return op;
    };
    auto mutations = std::array{
      make("root", "", root), make("upper", "root", rail),
      make("lower", "root", rail), make("sidebar", "root", sidebar),
      make("inactive", "root", inactive), make("modal", "root", modal),
      make("upper-left", "upper", f.item(1, {0, 0, 10, 10})),
      make("upper-right", "upper", f.item(2, {100, 0, 10, 10})),
      make("lower-left", "lower", f.item(1, {0, 100, 10, 10})),
      make("lower-right", "lower", f.item(2, {100, 100, 10, 10})),
      make("sidebar-top", "sidebar", f.item(1, {-50, 0, 10, 10})),
      make("sidebar-bottom", "sidebar", f.item(2, {-50, 100, 10, 10})),
      make("inactive-near", "inactive", f.item(1, {112, 100, 10, 10})),
      make("modal-first", "modal", f.item(1, {0, 300, 10, 10})),
      make("modal-second", "modal", f.item(2, {20, 300, 10, 10}))};
    if (reverse) { std::reverse(mutations.begin(), mutations.end()); }
    CHECK(f.state.apply({f.state.surface(), {}, mutations}).status == BatchStatus::valid);
    const auto& registry = f.state.snapshot().registry;
    const auto find = [&](const char* key) { return registry.find(OccurrenceKey{key}); };
    f.focus(find("upper-left"), find("root"));  // History differs from adjacent anchor.
    const std::array cases{
      Case{"lower-right", Direction::left, "lower-left", ProposalKind::ready, ProposalReason::ordered},
      Case{"lower-right", Direction::up, "upper-right", ProposalKind::ready, ProposalReason::parent_continuation},
      Case{"lower-left", Direction::left, "sidebar-bottom", ProposalKind::ready, ProposalReason::parent_continuation},
      Case{"modal-first", Direction::right, "modal-second", ProposalKind::ready, ProposalReason::geometric},
      Case{"modal-first", Direction::left, "", ProposalKind::boundary, ProposalReason::stop}};
    for (const auto& fixture : cases) {
      auto input = f.focus(find(fixture.source), find("root"));
      const auto before = f.state.snapshot();
      allocations = 0;
      countAllocations = true;
      Proposal result;
      for (int repeat = 0; repeat < 30; ++repeat) {
        const auto proposal = resolve(f.state, fixture.direction, input);
        if (repeat) { CHECK(proposal == result); }
        result = proposal;
      }
      countAllocations = false;
      CHECK(allocations == 0);
      CHECK(result.kind == fixture.kind && result.reason == fixture.reason);
      CHECK(result.policy == navigationPolicy);
      CHECK(result.target == find(fixture.target));
      if (result.target) { CHECK(result.mount == registry.lookup(result.target)->mount); }
      CHECK(f.state.snapshot().revision == before.revision);
      CHECK(f.state.snapshot().inputFocus == before.inputFocus);
      CHECK(f.state.snapshot().accessibilityFocus == before.accessibilityFocus);
      CHECK(f.state.snapshot().history.size() == before.history.size());
      for (std::size_t i = 0; i < before.history.size(); ++i) {
        CHECK(f.state.snapshot().history[i].scope == before.history[i].scope);
        CHECK(f.state.snapshot().history[i].occurrence == before.history[i].occurrence);
      }
      for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
        const auto handle = registry.handleAt(i);
        CHECK(handle == before.registry.handleAt(i));
        if (handle) { CHECK(*registry.lookup(handle) == *before.registry.lookup(handle)); }
      }
    }
    auto input = f.focus(find("lower-right"), find("root"));
    auto config = *registry.lookup(find("lower-right"));
    config.navigation.overrides[2] = find("upper");
    f.update(find("lower-right"), config);
    CHECK(resolve(f.state, Direction::up, input).target == find("upper-right"));
    CHECK(resolve(f.state, Direction::up, input).reason == ProposalReason::override_target);
    auto upper = *registry.lookup(find("upper"));
    upper.navigation.entryReady = false;
    f.update(find("upper"), upper);
    CHECK(resolve(f.state, Direction::up, input).reason == ProposalReason::entry_not_ready);
    upper.navigation.entryReady = true;
    f.update(find("upper"), upper);
    const auto retired = find("upper-right");
    config.navigation.overrides[2] = retired;
    f.update(find("lower-right"), config);
    auto replacement = make("upper-right", "upper", f.item(2, {100, 0, 10, 10}));
    replacement.kind = MutationKind::replace;
    replacement.expected = retired;
    CHECK(f.state.apply({f.state.surface(), f.state.snapshot().revision,
                        std::span{&replacement, 1}}).status == BatchStatus::valid);
    CHECK(resolve(f.state, Direction::up, input).reason == ProposalReason::invalid_override);
    config.navigation.overrides[2] = {};
    f.update(find("lower-right"), config);
    CHECK(resolve(f.state, Direction::up, input).target == find("upper-right"));
    CHECK(resolve(f.state, Direction::up, input).target != retired);
    auto column = *registry.lookup(find("root"));
    column.navigation.layout = Layout::column;
    f.update(find("root"), column);
    upper.order = 1;
    f.update(find("upper"), upper);
    auto lower = *registry.lookup(find("lower"));
    lower.order = 2;
    f.update(find("lower"), lower);
    CHECK(resolve(f.state, Direction::up, input).target == find("upper-right"));
    CHECK(resolve(f.state, Direction::up, input).reason == ProposalReason::parent_continuation);
    auto modalConfig = *registry.lookup(find("modal-first"));
    modalConfig.navigation.overrides[0] = find("lower-right");
    f.update(find("modal-first"), modalConfig);
    CHECK(resolve(f.state, Direction::left, f.focus(find("modal-first"), find("root"))).reason
          == ProposalReason::outside_boundary);
    auto invalid = make("invalid", "root", root);
    invalid.record.navigation.boundary = static_cast<Boundary>(99);
    CHECK(f.state.apply({f.state.surface(), f.state.snapshot().revision,
                        std::span{&invalid, 1}}).status == BatchStatus::invalid);
  }
  NavigationFixture wrap;
  NodeRecord scope;
  scope.scope = true;
  scope.navigation.boundary = Boundary::wrap;
  const auto root = wrap.add("root", scope);
  const auto first = wrap.add("first", wrap.item(1, {0, 0, 10, 10}), "root");
  const auto last = wrap.add("last", wrap.item(2, {40, 0, 10, 10}), "root");
  const auto input = wrap.focus(first, root);
  CHECK(resolve(wrap.state, Direction::left, input).target == last);
  CHECK(resolve(wrap.state, Direction::left, input).reason == ProposalReason::wrapped);
}
