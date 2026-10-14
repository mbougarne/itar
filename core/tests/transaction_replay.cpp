#include "transaction_fixture.hpp"

#include <variant>

namespace {
using namespace itar;

// Internal fixture v1: owned protocol values, ordered events, no parser/capture API.
struct Commit { std::vector<Mutation> mutations; BatchStatus expected{BatchStatus::valid}; };
struct Input { Direction direction; };
struct FocusKey { OccurrenceKey key; };
struct Cancel { RequestId request; };
struct Issue { std::size_t effect; };
struct Outcome { std::size_t effect; OutcomeKind kind; };
struct Observe { FocusObservation focus; std::optional<std::size_t> effect; };
struct Realize { std::size_t effect; NodeHandle target; MountGeneration mount; };
struct Availability { AvailabilityObservation fact; };
struct Time { TimePoint now; };
struct Release {};
using Event = std::variant<Commit, Input, FocusKey, Cancel, Issue, Outcome, Observe,
                           Realize, Availability, Time, Release>;
struct Step { Event event; std::optional<RequestStatus> expected; };
struct Fixture {
  unsigned version{1};
  SurfaceId surface{1};
  SurfaceLifetime lifetime{10};
  RegistryLimits registry;
  TransactionLimits transactions;
  RequestOptions options{100, DatasetRevision{1}, ResourceId{1}, {}};
  std::vector<Mutation> initial;
  std::vector<Step> steps;
};
struct Notification {
  FocusChannel channel;
  FocusState focus;
  std::optional<RequestId> request;
  bool operator==(const Notification&) const = default;
};
struct Decision {
  std::size_t kind;
  int status;
  RequestId request;
  bool operator==(const Decision&) const = default;
};
struct Replay {
  std::vector<Decision> decisions;
  std::vector<Effect> effects;
  std::vector<Notification> notifications;
  std::vector<NodeRecord> records;
  FocusState focus;
  bool active{};
  bool operator==(const Replay&) const = default;
};

std::optional<Replay> replay(const Fixture& fixture) {
  if (fixture.version != 1) { return {}; }
  State state{fixture.surface, fixture.registry};
  Transactions tx{state, fixture.lifetime, fixture.transactions};
  CHECK(tx.apply({fixture.surface, {}, fixture.initial}).status == BatchStatus::valid);
  Replay result;
  for (const auto& step : fixture.steps) {
    RequestResult decision{RequestStatus::unchanged, {}};
    int status{};
    std::visit([&](const auto& event) {
      using T = std::decay_t<decltype(event)>;
      InputContext input{fixture.surface, {}, InputOwner::engine, state.snapshot().inputFocus};
      if constexpr (std::is_same_v<T, Commit>) {
        const auto committed = tx.apply({fixture.surface, state.snapshot().revision, event.mutations});
        if (committed.status != event.expected) {
          std::cerr << "replay commit status " << static_cast<int>(committed.status)
                    << " expected " << static_cast<int>(event.expected) << '\n';
        }
        CHECK(committed.status == event.expected);
        status = static_cast<int>(committed.status);
      } else if constexpr (std::is_same_v<T, Input>) {
        decision = tx.directionalInput(event.direction, input, fixture.options);
      } else if constexpr (std::is_same_v<T, FocusKey>) {
        decision = tx.requestFocus(event.key, input, fixture.options);
      } else if constexpr (std::is_same_v<T, Cancel>) {
        decision = tx.cancel(event.request);
      } else if constexpr (std::is_same_v<T, Issue>) {
        decision = tx.issue(result.effects.at(event.effect).token);
      } else if constexpr (std::is_same_v<T, Outcome>) {
        decision = tx.complete({result.effects.at(event.effect).token, event.kind, {}});
      } else if constexpr (std::is_same_v<T, Observe>) {
        decision = tx.observeHost({fixture.lifetime, event.focus,
                                  event.effect ? std::optional{result.effects.at(*event.effect).token}
                                               : std::nullopt});
      } else if constexpr (std::is_same_v<T, Realize>) {
        decision = tx.realize({result.effects.at(event.effect).token, fixture.surface,
                               event.target, event.mount, fixture.options.dataset, true});
      } else if constexpr (std::is_same_v<T, Availability>) {
        status = static_cast<int>(tx.observeAvailability(event.fact));
      } else if constexpr (std::is_same_v<T, Time>) {
        decision = tx.advanceTo(event.now);
      } else if constexpr (std::is_same_v<T, Release>) { tx.releaseInput(); }
      if constexpr (!std::is_same_v<T, Commit> && !std::is_same_v<T, Availability>) {
        status = static_cast<int>(decision.status);
      }
    }, step.event);
    if (step.expected) { CHECK(decision.status == *step.expected); }
    result.decisions.push_back({step.event.index(), status, decision.request});
    auto effects = tx.drainEffects();
    result.effects.insert(result.effects.end(), effects.begin(), effects.end());
    for (const auto& notification : tx.drainNotifications()) {
      result.notifications.push_back({notification.observation.channel, notification.observation.focus,
                                      notification.confirmedRequest});
    }
  }
  for (auto node : state.snapshot().registry.handles()) {
    result.records.push_back(*state.snapshot().registry.lookup(node));
  }
  result.focus = state.snapshot().inputFocus;
  result.active = bool(tx.active());
  return result;
}

const NodeHandle row{NodeId{1}, Generation{1}};
const NodeHandle a{NodeId{2}, Generation{1}};
const NodeHandle b{NodeId{3}, Generation{1}};

Fixture initial(bool mounted) {
  Fixture fixture;
  NodeRecord scope;
  scope.scope = true;
  scope.navigation.layout = Layout::row;
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"row"}, {}, {}, scope});
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"19"}, {}, OccurrenceKey{"row"},
                             NavigationFixture::item(19)});
  auto target = NavigationFixture::item(20, {20, 0, 10, 10});
  if (!mounted) { target.mounted = false; target.mount = {}; target.geometry = {}; }
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"20"}, {}, OccurrenceKey{"row"}, target});
  fixture.initial.push_back({MutationKind::insert, OccurrenceKey{"Play"}, {}, {},
                             NavigationFixture::item(0, {0, 20, 10, 10})});
  fixture.steps.push_back({Observe{{fixture.surface, FocusChannel::input,
                                   {FocusKind::managed, a, MountGeneration{1}}}, {}}, {}});
  return fixture;
}
}  // namespace

int main() {
  using namespace itar;
  auto loading = initial(false);
  auto target = NavigationFixture::item(20, {20, 0, 10, 10});
  target.mount = MountGeneration{2};
  target.geometry.mount = target.mount;
  target.geometry.layout = LayoutRevision{2};
  loading.steps.insert(loading.steps.end(), {
    {Input{Direction::right}, RequestStatus::started},
    {Input{Direction::right}, RequestStatus::joined},
    {Release{}, {}},
    {Issue{0}, RequestStatus::issued},
    {Commit{{{MutationKind::update, OccurrenceKey{"20"}, b, OccurrenceKey{"row"}, target}}}, {}},
    {Realize{0, b, target.mount}, RequestStatus::started},
    {Issue{1}, RequestStatus::issued},
    {Cancel{RequestId{1}}, RequestStatus::cancelled},
    {FocusKey{OccurrenceKey{"19"}}, RequestStatus::started},
    {Issue{2}, RequestStatus::issued},
    {Outcome{2, OutcomeKind::not_cancellable}, RequestStatus::reconciled},
    {Issue{3}, RequestStatus::waiting},
    {Observe{{loading.surface, FocusChannel::input, {FocusKind::managed, b, target.mount}}, 1},
             RequestStatus::reconciled},
    {Outcome{1, OutcomeKind::accepted}, RequestStatus::waiting},
    {Time{100}, RequestStatus::unchanged}
  });
  const auto first = replay(loading);
  CHECK(first && first == replay(loading));
  CHECK(first->effects.size() == 4 && first->effects[0].token.kind == EffectKind::reveal);
  CHECK(first->effects[1].token.kind == EffectKind::focus && first->effects[1].mount == target.mount);
  CHECK(first->focus.node == b && !first->active && first->notifications.size() == 2);
  CHECK(!first->notifications.back().request);  // Cancelled intent never succeeds.
  auto rejected = initial(true);
  rejected.steps.insert(rejected.steps.end(), {
    {FocusKey{OccurrenceKey{"20"}}, RequestStatus::started},
    {Availability{{rejected.surface, b, MountGeneration{1}, AvailabilityKind::geometry_dirty,
                    LayoutRevision{1}}}, {}},
    {Availability{{rejected.surface, a, MountGeneration{1}, AvailabilityKind::mount_lost, {}}}, {}},
    {Commit{{{MutationKind::update, OccurrenceKey{"19"}, a, OccurrenceKey{"missing"},
               NavigationFixture::item(19)}}, BatchStatus::stale_mount}, {}},
    {Observe{{rejected.surface, FocusChannel::input, {FocusKind::unmanaged, {}, {}}}, {}}, {}},
    {Time{100}, RequestStatus::unchanged}
  });
  const auto second = replay(rejected);
  CHECK(second && second == replay(rejected));
  CHECK(!second->records[1].mounted && second->records[2].geometry.state == GeometryState::dirty);
  CHECK(second->focus.kind == FocusKind::unmanaged && !second->active);
  rejected.version = 2;
  CHECK(!replay(rejected));
}
