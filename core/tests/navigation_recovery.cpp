#include "navigation_fixture.hpp"

#include <array>

using namespace itar;

int main() {
  NavigationFixture f;
  NodeRecord scope;
  scope.scope = true;
  const auto root = f.add("root", scope);
  const auto a = f.add("a", f.item(1), "root");
  const auto source = f.add("source", f.item(2), "root");
  auto input = f.focus(source, root);
  const auto origin = *captureRecovery(f.state);
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::host_reassigned);
  CHECK(f.state.observeAvailability({f.state.surface(), source, MountGeneration{1},
                                    AvailabilityKind::mount_lost, {}}) == ObservationStatus::changed);
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::unknown_source);
  f.add("temporary-new-child", {}, "root");
  CHECK(f.state.observeFocus({f.state.surface(), FocusChannel::input,
                             {FocusKind::absent, {}, {}}}) == ObservationStatus::changed);
  input.source = f.state.snapshot().inputFocus;
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::origin_present);
  Mutation erase;
  erase.kind = MutationKind::erase;
  erase.key = origin.occurrence;
  erase.expected = source;
  Mutation replacement;
  replacement.key = OccurrenceKey{"replacement"};
  replacement.parent = OccurrenceKey{"root"};
  replacement.record = f.item(3);
  const auto batch = std::array{erase, replacement};
  const auto revision = f.state.snapshot().revision;
  CHECK(f.state.apply({f.state.surface(), revision, batch}).status == BatchStatus::valid);
  const auto target = f.state.snapshot().registry.find(replacement.key);
  CHECK(resolveRecovery(f.state, origin, input).target == target);
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::deletion_neighbor);
  CHECK(f.state.snapshot().revision.value == revision.value + 1);
  auto disabled = *f.state.snapshot().registry.lookup(target);
  disabled.enabled = false;
  f.update(target, disabled);
  CHECK(resolveRecovery(f.state, origin, input).target == a);
  input = f.focus(a, root);
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::host_reassigned);
  for (auto kind : {FocusKind::unmanaged, FocusKind::unknown}) {
    f.state.observeFocus({f.state.surface(), FocusChannel::input, {kind, {}, {}}});
    input.source = f.state.snapshot().inputFocus;
    CHECK(!resolveRecovery(f.state, origin, input).target);
  }
  f.state.observeFocus({f.state.surface(), FocusChannel::input, {FocusKind::absent, {}, {}}});
  input.source = f.state.snapshot().inputFocus;
  scope.active = false;
  f.update(root, scope);
  CHECK(resolveRecovery(f.state, origin, input).reason == ProposalReason::no_authority);
  CHECK(f.state.snapshot().inputFocus.kind == FocusKind::absent);
  NavigationFixture nested;
  NodeRecord container;
  container.scope = true;
  const auto outer = nested.add("outer", container);
  const auto inner = nested.add("inner", container, "outer");
  const auto removed = nested.add("removed", nested.item(1), "inner");
  const auto fallback = nested.add("fallback", nested.item(2), "outer");
  auto entry = nested.focus(removed, outer);
  const auto token = *captureRecovery(nested.state);
  erase.key = OccurrenceKey{"removed"};
  erase.expected = removed;
  CHECK(nested.state.apply({nested.state.surface(), nested.state.snapshot().revision,
                           std::span{&erase, 1}}).status == BatchStatus::valid);
  CHECK(!resolveRecovery(nested.state, token, entry).target);
  nested.state.observeFocus({nested.state.surface(), FocusChannel::input,
                            {FocusKind::absent, {}, {}}});
  entry.source = nested.state.snapshot().inputFocus;
  CHECK(resolveRecovery(nested.state, token, entry).target == fallback);
  CHECK(resolveRecovery(nested.state, token, entry).reason == ProposalReason::recovery_fallback);
  container.navigation.trap = true;
  nested.update(inner, container);
  CHECK(resolveRecovery(nested.state, token, entry).reason == ProposalReason::no_recovery);
  container.navigation.trap = false;
  nested.update(inner, container);
  disabled = *nested.state.snapshot().registry.lookup(fallback);
  disabled.enabled = false;
  nested.update(fallback, disabled);
  CHECK(resolveRecovery(nested.state, token, entry).reason == ProposalReason::no_recovery);
}
