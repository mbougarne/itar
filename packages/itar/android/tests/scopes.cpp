#include "../src/main/cpp/scopes.hpp"
#include "../../../../core/tests/check.hpp"

using namespace itar;
using namespace itar::android;

void exactTargetRestoration() {
  Session session{1};
  std::array<std::int64_t, 64> out{};
  const std::array<std::int64_t, 9> config{0, 0, 0, 0, 1, 1, 0, 0, 1};
  CHECK(scope(session, 20, config, "rail", "b", out) == ok);
  const auto group = session.state.snapshot().registry.find(OccurrenceKey{"rail"});
  const auto add = [&](std::string_view key, int order, bool inScope) {
    std::array<std::int64_t, 14> values{0, 0, order + 1, order, 1, 1, 2,
        order * 20, 0, 10, 10, 0, inScope ? group.slot.value : 0, inScope ? group.generation.value : 0};
    CHECK(registration(session, 1, values, key, out) == ok);
    return session.state.snapshot().registry.find(OccurrenceKey{std::string(key)});
  };
  const auto a = add("a", 0, true), b = add("b", 1, true), outside = add("outside", 2, false);
  session.state.observeFocus({SurfaceId{1}, FocusChannel::input,
      {FocusKind::managed, outside, MountGeneration{3}}});
  const auto request = [&](std::string_view key, InputOwner owner) {
    const std::array<std::int64_t, 3> values{static_cast<std::int64_t>(owner), 0, 100};
    CHECK(scope(session, 23, values, key, "", out) == ok);
    return static_cast<RequestStatus>(out[1]);
  };
  for (const auto owner : {InputOwner::accessibility, InputOwner::engine}) {
    CHECK(request("a", owner) == RequestStatus::started);
    CHECK(session.transactions.active()->owner == owner);
    const auto exact = session.transactions.drainEffects()[0];
    CHECK(exact.target == a && exact.token.kind == EffectKind::focus);
    session.transactions.cancel(exact.token.request);
    CHECK(request("rail", owner) == RequestStatus::started);
    const auto entry = session.transactions.drainEffects()[0];
    CHECK(entry.target == b); // Scope preference remains distinct from the exact target.
    session.transactions.cancel(entry.token.request);
  }
  for (const auto owner : {InputOwner::text, InputOwner::native_control, InputOwner::system}) {
    CHECK(request("a", owner) == RequestStatus::unavailable);
    CHECK(session.transactions.drainEffects().empty());
  }
  const auto original = *session.state.snapshot().registry.lookup(a);
  Mutation update{MutationKind::update, OccurrenceKey{"a"}, a, OccurrenceKey{"rail"}, original};
  const auto apply = [&] {
    CHECK(session.transactions.apply({SurfaceId{1}, session.state.snapshot().revision,
        std::span{&update, 1}}).status == BatchStatus::valid);
  };
  for (int unavailable = 0; unavailable < 4; ++unavailable) {
    update.record = original;
    if (unavailable == 0) update.record.enabled = false;
    if (unavailable == 1) update.record.active = false;
    if (unavailable == 2) update.record.geometry.state = GeometryState::clipped;
    if (unavailable == 3) update.record.geometry.state = GeometryState::dirty;
    apply();
    CHECK(request("a", InputOwner::accessibility) == RequestStatus::unavailable);
    CHECK(session.transactions.drainEffects().empty()); // No reveal or fallback to B.
  }
  update.record = original;
  update.record.geometry.layout = LayoutRevision{2}; // Dirty geometry requires a newer host measurement.
  apply();
  CHECK(request("a", InputOwner::accessibility) == RequestStatus::started);
  const auto staleEffect = session.transactions.drainEffects()[0];
  session.transactions.observeAvailability({SurfaceId{1}, a, MountGeneration{1}, AvailabilityKind::mount_lost, {}});
  CHECK(session.transactions.issue(staleEffect.token).status == RequestStatus::stale);
  CHECK(request("a", InputOwner::accessibility) == RequestStatus::unavailable);
  CHECK(request("missing", InputOwner::accessibility) == RequestStatus::unavailable);
}

int main() {
  Session session{1};
  std::array<std::int64_t, 64> out{};
  std::array<std::int64_t, 9> config{0, 0, 0, 0, 1, 1, 0, 1, 1};
  CHECK(scope(session, 20, config, "rail", "b", out) == ok);
  const auto group = session.state.snapshot().registry.find(OccurrenceKey{"rail"});
  CHECK(group && session.state.snapshot().registry.lookup(group)->scope);
  const auto add = [&](std::string_view key, int order, bool inScope) {
    std::array<std::int64_t, 14> values{0, 0, order + 1, order, 1, 1, 2,
        order * 20, 0, 10, 10, 0, inScope ? group.slot.value : 0, inScope ? group.generation.value : 0};
    CHECK(registration(session, 1, values, key, out) == ok);
    return session.state.snapshot().registry.find(OccurrenceKey{std::string(key)});
  };
  const auto a = add("a", 0, true), b = add("b", 1, true), c = add("outside", 2, false);
  std::array<std::int64_t, 3> returning{0, 0, 100};
  // A first explicit restore enters from another scope using the preference.
  CHECK(!session.state.history(group));
  CHECK(session.state.observeFocus({SurfaceId{1}, FocusChannel::input,
      {FocusKind::managed, c, MountGeneration{3}}}) == ObservationStatus::changed);
  CHECK(scope(session, 23, returning, "rail", "", out) == ok);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::started));
  CHECK(session.transactions.drainEffects()[0].target == b);
  session.transactions.cancel(RequestId{static_cast<std::uint64_t>(out[2])});
  CHECK(session.state.observeFocus({SurfaceId{1}, FocusChannel::input,
      {FocusKind::managed, a, MountGeneration{1}}}) == ObservationStatus::changed);
  InputContext input{SurfaceId{1}, {}, InputOwner::engine, session.state.snapshot().inputFocus};
  CHECK(resolve(session.state, Direction::right, input).target == b);
  CHECK(session.state.observeFocus({SurfaceId{1}, FocusChannel::input, {FocusKind::unmanaged, {}, {}}}) == ObservationStatus::changed);
  CHECK(scope(session, 23, returning, "rail", "", out) == ok);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::started));
  CHECK(session.transactions.drainEffects()[0].target == a);
  session.transactions.cancel(RequestId{static_cast<std::uint64_t>(out[2])});
  CHECK(session.state.observeFocus({SurfaceId{1}, FocusChannel::input, {FocusKind::managed, a, MountGeneration{1}}}) == ObservationStatus::changed);
  CHECK(session.transactions.requestFocus(OccurrenceKey{"outside"}, input, {100, DatasetRevision{1}, {}, {}}).status == RequestStatus::unavailable);
  const auto revision = session.state.snapshot().revision;
  config[0] = group.slot.value; config[1] = group.generation.value;
  config[5] = 99;
  CHECK(scope(session, 20, config, "rail", "", out) == conversion);
  CHECK(session.state.snapshot().revision == revision);
  config[5] = 1; config[4] = 0;
  CHECK(scope(session, 20, config, "rail", "", out) == ok);
  CHECK(!logicalTarget(session.state, a) && !logicalTarget(session.state, b));
  CHECK(logicalTarget(session.state, c));
  CHECK(*session.state.history(group) == OccurrenceKey{"a"});
  CHECK(session.state.observeFocus({SurfaceId{1}, FocusChannel::input,
      {FocusKind::unmanaged, {}, {}}}) == ObservationStatus::changed);
  CHECK(scope(session, 23, returning, "rail", "", out) == ok);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::unavailable));
  CHECK(!session.state.snapshot().registry.lookup(group)->active);
  config[4] = 1;
  CHECK(scope(session, 20, config, "rail", "", out) == ok);
  CHECK(scope(session, 23, returning, "rail", "", out) == ok);
  CHECK(out[1] == static_cast<std::int64_t>(RequestStatus::started));
  CHECK(session.transactions.drainEffects()[0].target == a);
  session.transactions.cancel(RequestId{static_cast<std::uint64_t>(out[2])});
  std::array<std::int64_t, 2> remove{group.slot.value, group.generation.value};
  CHECK(scope(session, 21, remove, "", "", out) == ok);
  CHECK(!session.state.snapshot().registry.lookup(a));
  CHECK(session.state.snapshot().registry.lookup(c));
  CHECK(scope(session, 21, remove, "", "", out) == stale);
  exactTargetRestoration();
}
