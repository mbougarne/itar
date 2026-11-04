#pragma once
#include <itar/transaction.hpp>
#include "../tests/check.hpp"
#include <variant>

namespace itar::diagnostics {
// Internal fixture v1: owned protocol values; no stable public trace API.
struct Commit { std::vector<Mutation> mutations; BatchStatus expected{BatchStatus::valid}; };
// Captures preserve the caller's ownership/authority/source. Legacy synthetic
// fixtures may omit context to use engine ownership and current observed focus.
struct Input { Direction direction; std::optional<InputContext> context{}; };
struct FocusKey { OccurrenceKey key; std::optional<InputContext> context{}; };
struct Cancel { RequestId request; };
struct Issue { std::size_t effect; };
struct Outcome { std::size_t effect; OutcomeKind kind; };
struct Observe { FocusObservation focus; std::optional<std::size_t> effect; };
struct Realize { std::size_t effect; NodeHandle target; MountGeneration mount; };
struct Availability { AvailabilityObservation fact; };
struct Time { TimePoint now; };
struct Release {};
struct Dispose {};
using Event = std::variant<Commit, Input, FocusKey, Cancel, Issue, Outcome, Observe,
                           Realize, Availability, Time, Release, Dispose>;
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
  FocusState accessibilityFocus;
  bool active{};
  bool operator==(const Replay&) const = default;
};

struct IgnoreStep { void operator()(const Step&, std::optional<RequestStatus>) const noexcept {} };
template<class Observer = IgnoreStep>
std::optional<Replay> replay(const Fixture& fixture, Observer observe = {}) {
  if (fixture.version != 1) { return {}; }
  State state{fixture.surface, fixture.registry};
  Transactions tx{state, fixture.lifetime, fixture.transactions};
  CHECK(tx.apply({fixture.surface, {}, fixture.initial}).status == BatchStatus::valid);
  Replay result;
  for (const auto& step : fixture.steps) {
    const auto revisionBefore = state.snapshot().revision;
    const auto focusBefore = state.snapshot().inputFocus;
    RequestResult decision{RequestStatus::unchanged, {}};
    int status{};
    std::visit([&](const auto& event) {
      using T = std::decay_t<decltype(event)>;
      InputContext input{fixture.surface, {}, InputOwner::engine, state.snapshot().inputFocus};
      if constexpr (std::is_same_v<T, Commit>) {
        const auto registryBefore = state.snapshot().registry;
        const auto historyBefore = state.snapshot().history;
        const auto committed = tx.apply({fixture.surface, state.snapshot().revision, event.mutations});
        if (committed.status != event.expected) {
          std::cerr << "replay commit status " << static_cast<int>(committed.status)
                    << " expected " << static_cast<int>(event.expected) << '\n';
        }
        CHECK(committed.status == event.expected);
        status = static_cast<int>(committed.status);
        if (committed.status != BatchStatus::valid) {
          CHECK(state.snapshot().revision == revisionBefore);
          CHECK(state.snapshot().inputFocus == focusBefore);
          CHECK(state.snapshot().history.size() == historyBefore.size());
          for (std::size_t i = 0; i < historyBefore.size(); ++i) {
            CHECK(state.snapshot().history[i].scope == historyBefore[i].scope);
            CHECK(state.snapshot().history[i].occurrence == historyBefore[i].occurrence);
          }
          CHECK(state.snapshot().registry.handles() == registryBefore.handles());
          for (auto node : registryBefore.handles()) {
            CHECK(*state.snapshot().registry.lookup(node) == *registryBefore.lookup(node));
            CHECK(*state.snapshot().registry.key(node) == *registryBefore.key(node));
            const auto* before = registryBefore.preferred(node);
            const auto* after = state.snapshot().registry.preferred(node);
            CHECK(bool(before) == bool(after));
            if (before) { CHECK(*before == *after); }
          }
        }
      } else if constexpr (std::is_same_v<T, Input>) {
        decision = tx.directionalInput(event.direction, event.context.value_or(input), fixture.options);
      } else if constexpr (std::is_same_v<T, FocusKey>) {
        decision = tx.requestFocus(event.key, event.context.value_or(input), fixture.options);
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
      else if constexpr (std::is_same_v<T, Dispose>) { tx.dispose(); }
      if constexpr (!std::is_same_v<T, Commit> && !std::is_same_v<T, Availability>) {
        status = static_cast<int>(decision.status);
      }
    }, step.event);
    if (step.expected) { CHECK(decision.status == *step.expected); }
    const auto usage = tx.usage();
    CHECK(usage.operations <= fixture.transactions.operations);
    CHECK(usage.effects <= fixture.transactions.effects);
    CHECK(usage.notifications <= fixture.transactions.notifications);
    if (decision.status == RequestStatus::confirmed) {
      const auto focus = state.snapshot().inputFocus;
      const auto* live = state.snapshot().registry.lookup(focus.node);
      CHECK(live && live->mounted && live->mount == focus.mount);
    }
    const bool requestEvent = !std::holds_alternative<Commit>(step.event) &&
                              !std::holds_alternative<Availability>(step.event);
    observe(step, requestEvent ? std::optional{decision.status} : std::nullopt);
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
  result.accessibilityFocus = state.snapshot().accessibilityFocus;
  result.active = bool(tx.active());
  return result;
}

}  // namespace itar::diagnostics
