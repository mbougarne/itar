#include <itar/state.hpp>

#include <array>

#include "check.hpp"

using namespace itar;

int main() {
  State state{SurfaceId{1}};
  Mutation scope;
  scope.key = OccurrenceKey{"scope"};
  scope.record.scope = true;
  Mutation nested = scope;
  nested.key = OccurrenceKey{"nested"};
  nested.parent = scope.key;
  Mutation item;
  item.key = OccurrenceKey{"item"};
  item.parent = nested.key;
  item.record.mounted = true;
  item.record.mount = MountGeneration{1};
  const auto initial = std::array{item, nested, scope};
  CHECK(state.apply({state.surface(), {}, initial}).status == BatchStatus::valid);
  const auto root = state.snapshot().registry.find(scope.key);
  const auto inner = state.snapshot().registry.find(nested.key);
  item.expected = state.snapshot().registry.find(item.key);
  FocusObservation observed{state.surface(), FocusChannel::input,
      {FocusKind::managed, item.expected, MountGeneration{1}}};
  CHECK(state.snapshot().inputFocus.kind == FocusKind::unknown);
  CHECK(state.observeFocus(observed) == ObservationStatus::changed);
  CHECK(state.observeFocus(observed) == ObservationStatus::unchanged);
  CHECK(*state.history(root) == item.key && *state.history(inner) == item.key);
  const auto before = state.snapshot().inputFocus;
  observed.channel = FocusChannel::accessibility;
  observed.focus = {FocusKind::unmanaged, {}, {}};
  CHECK(state.observeFocus(observed) == ObservationStatus::changed);
  CHECK(state.snapshot().inputFocus == before);
  CHECK(state.snapshot().accessibilityFocus.kind == FocusKind::unmanaged);
  CHECK(state.observeAvailability({state.surface(), item.expected, MountGeneration{1},
      AvailabilityKind::mount_lost, {}}) == ObservationStatus::changed);
  CHECK(state.snapshot().inputFocus.kind == FocusKind::unknown);
  CHECK(*state.history(root) == item.key);
  observed.channel = FocusChannel::input;
  observed.focus = before;
  CHECK(state.observeFocus(observed) == ObservationStatus::stale_handle);
  item.kind = MutationKind::update;
  item.record.mount = MountGeneration{2};
  CHECK(state.apply({state.surface(), Revision{1}, std::span{&item, 1}}).status == BatchStatus::valid);
  CHECK(*state.history(root) == item.key);
  observed.focus.mount = MountGeneration{2};
  CHECK(state.observeFocus(observed) == ObservationStatus::changed);
  item.kind = MutationKind::erase;
  CHECK(state.apply({state.surface(), Revision{2}, std::span{&item, 1}}).status == BatchStatus::valid);
  CHECK(!state.history(root) && !state.history(inner));
  CHECK(state.snapshot().inputFocus.kind == FocusKind::unknown);
  observed.focus = {FocusKind::absent, {}, {}};
  CHECK(state.observeFocus(observed) == ObservationStatus::changed);
  CHECK(state.snapshot().inputFocus.kind == FocusKind::absent);
  item.kind = MutationKind::insert;
  CHECK(state.apply({state.surface(), Revision{3}, std::span{&item, 1}}).status == BatchStatus::valid);
  observed.focus = {FocusKind::managed, state.snapshot().registry.find(item.key), MountGeneration{2}};
  CHECK(state.observeFocus(observed) == ObservationStatus::changed);
  nested.kind = MutationKind::replace;
  nested.expected = inner;
  CHECK(state.apply({state.surface(), Revision{4}, std::span{&nested, 1}}).status == BatchStatus::valid);
  CHECK(!state.history(inner) && *state.history(root) == item.key);
  auto duplicate = std::array{item, item};
  const auto focus = state.snapshot().inputFocus;
  CHECK(state.apply({state.surface(), Revision{5}, duplicate}).status != BatchStatus::valid);
  CHECK(state.snapshot().inputFocus == focus && *state.history(root) == item.key);
}
