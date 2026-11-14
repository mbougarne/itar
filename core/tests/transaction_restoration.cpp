#include "transaction_fixture.hpp"
#include "../../packages/itar/android/src/main/cpp/scopes.hpp"

#include <array>

using namespace itar;

namespace {
InputContext reader(TransactionFixture& f) {
  auto input = f.input;
  input.owner = InputOwner::accessibility;
  CHECK(f.state.observeFocus({f.state.surface(), FocusChannel::accessibility, input.source})
        == ObservationStatus::changed);
  return input;
}
HostFocus observed(TransactionFixture& f, NodeHandle node, FocusChannel channel = FocusChannel::input) {
  return {SurfaceLifetime{10}, {f.state.surface(), channel,
      {FocusKind::managed, node, f.state.snapshot().registry.lookup(node)->mount}}, {}};
}
void ownershipAndValidation() {
  for (const auto owner : {InputOwner::accessibility, InputOwner::text, InputOwner::native_control, InputOwner::system}) {
    TransactionFixture f;
    auto input = reader(f); input.owner = owner;
    CHECK(f.tx.requestFocus(OccurrenceKey{"20"}, input, f.options).status == RequestStatus::unavailable);
    CHECK(f.tx.directionalInput(Direction::right, input, f.options).status == RequestStatus::unavailable);
    CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, input, f.options).status ==
          (owner == InputOwner::accessibility ? RequestStatus::started : RequestStatus::unavailable));
  }
  TransactionFixture f;
  auto input = reader(f);
  auto stale = input; stale.source.node = f.b;
  CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, stale, f.options).status == RequestStatus::stale);
  stale = input; stale.surface = SurfaceId{99};
  CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, stale, f.options).status == RequestStatus::stale);
  stale = input; stale.authority = f.b;
  CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, stale, f.options).status == RequestStatus::unavailable);
  CHECK(f.tx.restoreFocus(OccurrenceKey{"missing"}, input, f.options).status == RequestStatus::unavailable);
  auto disabled = *f.state.snapshot().registry.lookup(f.b); disabled.enabled = false;
  f.update(f.b, disabled);
  CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, input, f.options).status == RequestStatus::unavailable);
  disabled.enabled = true; f.update(f.b, disabled);
  for (const auto geometry : {GeometryState::hidden, GeometryState::clipped, GeometryState::dirty}) {
    auto target = *f.state.snapshot().registry.lookup(f.b); target.geometry.state = geometry;
    f.update(f.b, target);
    CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, input, f.options).status == RequestStatus::unavailable);
  }
  TransactionFixture unmounted{false};
  CHECK(unmounted.tx.restoreFocus(OccurrenceKey{"20"}, reader(unmounted), unmounted.options).status == RequestStatus::unavailable);
  CHECK(unmounted.tx.drainEffects().empty()); // Reader restoration never reveals.
  CHECK(unmounted.tx.restoreFocus(OccurrenceKey{"20"}, unmounted.input, unmounted.options).status == RequestStatus::started);
  CHECK(unmounted.tx.drainEffects()[0].token.kind == EffectKind::reveal); // Existing engine path.
  TransactionFixture inactive;
  const auto accessible = reader(inactive);
  auto scope = *inactive.state.snapshot().registry.lookup(inactive.row); scope.active = false;
  inactive.update(inactive.row, scope);
  CHECK(inactive.tx.restoreFocus(OccurrenceKey{"20"}, accessible, inactive.options).status == RequestStatus::unavailable);
  for (const auto kind : {FocusKind::unknown, FocusKind::unmanaged}) {
    TransactionFixture other;
    auto context = reader(other);
    other.state.observeFocus({other.state.surface(), FocusChannel::input, {kind, {}, {}}});
    context.source = other.state.snapshot().inputFocus;
    CHECK(other.tx.restoreFocus(OccurrenceKey{"20"}, context, other.options).status == RequestStatus::unavailable);
  }
}
void confirmationAndCancellation() {
  TransactionFixture f;
  const auto input = reader(f);
  CHECK(f.tx.restoreFocus(OccurrenceKey{"20"}, input, f.options).status == RequestStatus::started);
  const auto effect = f.tx.drainEffects()[0];
  CHECK(f.tx.active()->owner == InputOwner::accessibility);
  CHECK(f.tx.issue(effect.token).status == RequestStatus::issued);
  CHECK(f.tx.observeHost(observed(f, f.b, FocusChannel::accessibility)).status == RequestStatus::unchanged);
  CHECK(f.tx.active() && f.state.snapshot().inputFocus == input.source);
  CHECK(*f.state.history(f.row) == OccurrenceKey{"19"});
  CHECK(!f.tx.drainNotifications()[0].confirmedRequest);
  CHECK(f.tx.observeHost(observed(f, f.b)).status == RequestStatus::confirmed);
  CHECK(f.tx.drainNotifications()[0].confirmedRequest == effect.token.request);
  CHECK(*f.state.history(f.row) == OccurrenceKey{"20"});
  for (const bool issued : {false, true}) {
    TransactionFixture moved;
    const auto context = reader(moved);
    const auto other = moved.add("other", moved.item(21, {40, 0, 10, 10}), "row");
    CHECK(moved.tx.restoreFocus(OccurrenceKey{"20"}, context, moved.options).status == RequestStatus::started);
    const auto pending = moved.tx.drainEffects()[0];
    if (issued) CHECK(moved.tx.issue(pending.token).status == RequestStatus::issued);
    CHECK(moved.tx.observeHost(observed(moved, other, FocusChannel::accessibility)).status == RequestStatus::reconciled);
    CHECK(!moved.tx.active());
    CHECK(moved.tx.issue(pending.token).status == RequestStatus::stale);
    CHECK(moved.tx.observeHost(observed(moved, moved.b)).status != RequestStatus::confirmed);
    CHECK(moved.state.snapshot().inputFocus.node == moved.b); // Late reality remains observed.
    for (const auto& note : moved.tx.drainNotifications()) CHECK(!note.confirmedRequest);
    TransactionFixture returned;
    returned.tx.restoreFocus(OccurrenceKey{"20"}, reader(returned), returned.options);
    const auto returningEffect = returned.tx.drainEffects()[0];
    if (issued) CHECK(returned.tx.issue(returningEffect.token).status == RequestStatus::issued);
    returned.tx.observeHost(observed(returned, returned.b, FocusChannel::accessibility));
    CHECK(returned.tx.observeHost(observed(returned, returned.a, FocusChannel::accessibility)).status == RequestStatus::reconciled);
    CHECK(!returned.tx.active());
    CHECK(returned.tx.issue(returningEffect.token).status == RequestStatus::stale);
  }
  TransactionFixture same;
  const auto sameInput = reader(same);
  CHECK(same.tx.restoreFocus(OccurrenceKey{"19"}, sameInput, same.options).status == RequestStatus::started);
  CHECK(same.tx.issue(same.tx.drainEffects()[0].token).status == RequestStatus::issued);
  CHECK(same.tx.observeHost(observed(same, same.a)).status == RequestStatus::confirmed);
  CHECK(same.tx.drainNotifications().empty()); // No invented input/a11y transition.
  TransactionFixture recycled;
  const auto context = reader(recycled);
  recycled.tx.restoreFocus(OccurrenceKey{"20"}, context, recycled.options);
  const auto pending = recycled.tx.drainEffects()[0];
  auto target = *recycled.state.snapshot().registry.lookup(recycled.b);
  target.mount = MountGeneration{2}; target.geometry.mount = target.mount;
  recycled.update(recycled.b, target);
  CHECK(recycled.tx.issue(pending.token).status == RequestStatus::stale);
}
void scopeBridge() {
  using namespace itar::android;
  Session s{1}; std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 9> config{0, 0, 0, 0, 1, 1, 0, 0, 1};
  CHECK(scope(s, 20, config, "rail", "b", out) == ok);
  const auto rail = s.state.snapshot().registry.find(OccurrenceKey{"rail"});
  const auto add = [&](const char* key, int order, bool inside) {
    std::array<std::int64_t, 14> v{0, 0, order + 1, order, 1, 1, 2,
        order * 20, 0, 10, 10, 0, inside ? rail.slot.value : 0, inside ? rail.generation.value : 0};
    CHECK(registration(s, 1, v, key, out) == ok);
    return s.state.snapshot().registry.find(OccurrenceKey{key});
  };
  const auto a = add("a", 0, true), b = add("b", 1, true), outside = add("outside", 2, false);
  const auto focus = [&](NodeHandle node) {
    s.transactions.observeHost({SurfaceLifetime{1}, {s.state.surface(), FocusChannel::input,
        {FocusKind::managed, node, s.state.snapshot().registry.lookup(node)->mount}}, {}});
  };
  const std::array<std::int64_t, 3> returning{3, 0, 100};
  focus(outside);
  CHECK(scope(s, 23, returning, "rail", "", out) == ok);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::started));
  CHECK(s.transactions.drainEffects()[0].target == b); // No history: preference.
  s.transactions.cancel(s.transactions.active()->id);
  focus(a); focus(outside);
  scope(s, 23, returning, "rail", "", out);
  CHECK(s.transactions.drainEffects()[0].target == a); // Input history wins.
  s.transactions.cancel(s.transactions.active()->id);
  focus(a);
  scope(s, 23, returning, "rail", "", out);
  const auto effect = s.transactions.drainEffects()[0];
  CHECK(effect.target == a); // Already input-focused is still confirmable.
  CHECK(s.transactions.issue(effect.token).status == RequestStatus::issued);
  focus(a);
  CHECK(!s.transactions.active());
  focus(outside);
  const InputContext readerInput{s.state.surface(), {}, InputOwner::accessibility, s.state.snapshot().inputFocus};
  CHECK(resolveEntry(s.state, rail, readerInput, {EntryReason::returning}).kind == ProposalKind::host_owned);
  const auto proposal = resolveEntry(s.state, rail, readerInput,
      {EntryReason::returning, Direction::down, {}, EntryIntent::restoration});
  CHECK(proposal.owner == InputOwner::accessibility && proposal.kind == ProposalKind::ready);
  CHECK(s.transactions.begin(proposal, {100, DatasetRevision{1}, {}, {}}).status == RequestStatus::unavailable);
  config[0] = rail.slot.value; config[1] = rail.generation.value; config[8] = 0;
  scope(s, 20, config, "rail", "b", out);
  scope(s, 23, returning, "rail", "", out);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::unavailable));
  config[8] = 1; scope(s, 20, config, "rail", "b", out);
  s.transactions.observeAvailability({s.state.surface(), a, MountGeneration{1},
      AvailabilityKind::geometry_unavailable, LayoutRevision{2}});
  scope(s, 23, returning, "rail", "", out);
  CHECK(s.transactions.drainEffects()[0].target == b); // Unavailable history falls back to visible preference.
  s.transactions.cancel(s.transactions.active()->id);
  s.transactions.observeAvailability({s.state.surface(), b, MountGeneration{2},
      AvailabilityKind::geometry_unavailable, LayoutRevision{2}});
  scope(s, 23, returning, "rail", "", out);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::unavailable));
  CHECK(s.transactions.drainEffects().empty());
}
}  // namespace

int main() {
  ownershipAndValidation();
  confirmationAndCancellation();
  scopeBridge();
}
