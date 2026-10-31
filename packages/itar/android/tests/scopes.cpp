#include "../src/main/cpp/scopes.hpp"
#include "../../../../core/tests/check.hpp"

using namespace itar;
using namespace itar::android;
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
}
