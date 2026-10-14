#include "transaction_fixture.hpp"
#include <deque>
#include <variant>

// The host enqueues copied callbacks under a guard, then its return outcome.
struct FakeHost {
  using Event = std::variant<itar::HostFocus, itar::EffectOutcome>;
  std::deque<Event> inbox;
  bool invoking{};
  void focus(const itar::Effect& effect, itar::FocusObservation observation, bool callbackFirst) {
    invoking = true;
    const itar::HostFocus callback{effect.token.lifetime, observation, effect.token};
    const itar::EffectOutcome returned{effect.token, itar::OutcomeKind::accepted, observation};
    if (callbackFirst) { inbox.push_back(callback); }
    inbox.push_back(returned);
    if (!callbackFirst) { inbox.push_back(callback); }
    invoking = false;
  }
  void drain(itar::Transactions& tx) {
    CHECK(!invoking);
    while (!inbox.empty()) {
      auto event = inbox.front();
      inbox.pop_front();
      std::visit([&](auto value) {
        if constexpr (std::is_same_v<decltype(value), itar::HostFocus>) { tx.observeHost(value); }
        else { tx.complete(value); }
      }, event);
    }
  }
};

int main() {
  using namespace itar;
  for (bool callbackFirst : {false, true}) {
    TransactionFixture f;
    CHECK(f.tx.begin(resolve(f.state, Direction::right, f.input), f.options).status
          == RequestStatus::started);
    const auto effect = f.tx.drainEffects()[0];
    CHECK(f.tx.complete({effect.token, OutcomeKind::accepted, {}}).status == RequestStatus::stale);
    CHECK(f.tx.issue(effect.token).status == RequestStatus::issued);
    CHECK(f.tx.complete({effect.token, OutcomeKind::cancelled, {}}).status == RequestStatus::stale);
    auto wrong = effect.token;
    wrong.kind = EffectKind::reveal;
    CHECK(f.tx.complete({wrong, OutcomeKind::accepted, {}}).status == RequestStatus::stale);
    FakeHost host;
    host.focus(effect, {f.state.surface(), FocusChannel::input,
                         {FocusKind::managed, f.b, *effect.mount}}, callbackFirst);
    CHECK(f.tx.active() && f.state.snapshot().inputFocus == f.input.source);
    host.drain(f.tx);
    CHECK(!f.tx.active());
    const auto notifications = f.tx.drainNotifications();
    CHECK(notifications.size() == 1);
    CHECK(notifications[0].confirmedRequest == effect.token.request);
    CHECK(f.state.snapshot().inputFocus.node == f.b);
    CHECK(*f.state.history(f.row) == OccurrenceKey{"20"});
    CHECK(f.tx.complete({effect.token, OutcomeKind::accepted, {}}).status == RequestStatus::stale);
  }
  TransactionFixture f;
  f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options);
  const auto effect = f.tx.drainEffects()[0];
  f.tx.issue(effect.token);
  CHECK(f.tx.complete({effect.token, OutcomeKind::accepted, {}}).status == RequestStatus::waiting);
  CHECK(f.tx.active() && f.tx.drainNotifications().empty());
  CHECK(f.state.snapshot().inputFocus == f.input.source);
  CHECK(f.tx.complete({effect.token, OutcomeKind::completed,
                       FocusObservation{f.state.surface(), FocusChannel::input,
                                        {FocusKind::managed, f.b, *effect.mount}}}).status
        == RequestStatus::confirmed);
  CHECK(f.tx.drainNotifications().size() == 1);
  TransactionFixture rejected;
  rejected.tx.requestFocus(OccurrenceKey{"20"}, rejected.input, rejected.options);
  const auto rejectedEffect = rejected.tx.drainEffects()[0];
  rejected.tx.issue(rejectedEffect.token);
  CHECK(rejected.tx.complete({rejectedEffect.token, OutcomeKind::rejected,
                              FocusObservation{rejected.state.surface(), FocusChannel::input,
                                               {FocusKind::managed, rejected.b,
                                                *rejectedEffect.mount}}}).status
        != RequestStatus::confirmed);
  CHECK(!rejected.tx.drainNotifications()[0].confirmedRequest);
  TransactionFixture disposed;
  disposed.tx.requestFocus(OccurrenceKey{"20"}, disposed.input, disposed.options);
  const auto disposable = disposed.tx.drainEffects()[0];
  disposed.tx.issue(disposable.token);
  FakeHost host;
  host.focus(disposable, {disposed.state.surface(), FocusChannel::input,
                          {FocusKind::managed, disposed.b, *disposable.mount}}, true);
  disposed.tx.dispose();  // Lifetime revoked before draining synchronous callbacks.
  host.drain(disposed.tx);
  CHECK(disposed.state.snapshot().inputFocus == disposed.input.source);
  CHECK(disposed.tx.drainNotifications().empty() && disposed.tx.drainEffects().empty());
  TransactionFixture accessibility;
  accessibility.tx.requestFocus(OccurrenceKey{"20"}, accessibility.input, accessibility.options);
  const auto accessible = accessibility.tx.drainEffects()[0];
  accessibility.tx.issue(accessible.token);
  accessibility.tx.observeHost({accessible.token.lifetime,
    {accessibility.state.surface(), FocusChannel::accessibility,
     {FocusKind::managed, accessibility.b, *accessible.mount}}, accessible.token});
  CHECK(accessibility.tx.active() && accessibility.state.snapshot().inputFocus == accessibility.input.source);
  CHECK(*accessibility.state.history(accessibility.row) == OccurrenceKey{"19"});
  CHECK(!accessibility.tx.drainNotifications()[0].confirmedRequest);
  accessibility.state.observeAvailability({accessibility.state.surface(), accessibility.b,
                                           *accessible.mount, AvailabilityKind::geometry_dirty,
                                           LayoutRevision{1}});
  CHECK(accessibility.tx.observeHost({accessible.token.lifetime,
    {accessibility.state.surface(), FocusChannel::input,
     {FocusKind::managed, accessibility.b, *accessible.mount}}, accessible.token}).status
    == RequestStatus::reconciled);
  CHECK(!accessibility.tx.drainNotifications()[0].confirmedRequest);
}
