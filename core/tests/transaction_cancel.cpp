#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  TransactionFixture f;
  auto old = f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).request;
  auto movement = f.tx.drainEffects()[0];
  CHECK(f.tx.issue(movement.token).status == RequestStatus::issued);
  CHECK(f.tx.cancel(old).status == RequestStatus::cancelled);
  const auto cleanup = f.tx.drainEffects()[0];
  CHECK(cleanup.cancels == movement.token && cleanup.token.effect != movement.token.effect);
  const auto replacement = f.tx.requestFocus(OccurrenceKey{"19"}, f.input, f.options).request;
  CHECK(replacement != old);
  CHECK(f.tx.cancel(old).status == RequestStatus::unchanged);
  CHECK(f.tx.active()->id == replacement);
  CHECK(f.tx.issue(cleanup.token).status == RequestStatus::issued);
  CHECK(f.tx.complete({cleanup.token, OutcomeKind::not_cancellable, {}}).status
        == RequestStatus::reconciled);
  // The host actually focused the old target; adopt it without old-request success.
  CHECK(f.tx.observeHost({movement.token.lifetime,
                          {f.state.surface(), FocusChannel::input,
                           {FocusKind::managed, f.b, *movement.mount}}, movement.token}).status
        == RequestStatus::reconciled);
  CHECK(!f.tx.active());
  const auto notifications = f.tx.drainNotifications();
  CHECK(notifications.size() == 1 && !notifications[0].confirmedRequest);
  CHECK(f.state.snapshot().inputFocus.node == f.b);
  TransactionFixture removed;
  removed.tx.requestFocus(OccurrenceKey{"20"}, removed.input, removed.options);
  const auto retained = *removed.tx.active();  // Value context, never a live view.
  CHECK(retained.originKey == OccurrenceKey{"19"});
  movement = removed.tx.drainEffects()[0];
  removed.tx.issue(movement.token);
  CHECK(removed.tx.observeAvailability({removed.state.surface(), removed.b,
                                        *movement.mount, AvailabilityKind::mount_lost, {}})
        == ObservationStatus::changed);
  CHECK(!removed.tx.active());
  Mutation erase{MutationKind::erase, OccurrenceKey{"19"}, removed.a, {}, {}};
  CHECK(removed.tx.apply({removed.state.surface(), removed.state.snapshot().revision,
                          std::span{&erase, 1}}).status == BatchStatus::valid);
  CHECK(!removed.state.snapshot().registry.lookup(removed.a));
  CHECK(retained.originKey == OccurrenceKey{"19"});
  const auto afterRemoval = removed.tx.drainEffects()[0];
  CHECK(removed.tx.issue(afterRemoval.token).status == RequestStatus::issued);
  CHECK(removed.tx.complete({afterRemoval.token, OutcomeKind::cancelled, {}}).status
        == RequestStatus::reconciled);
  CHECK(removed.tx.complete({movement.token, OutcomeKind::accepted, {}}).status == RequestStatus::stale);
  TransactionFixture queued;
  old = queued.tx.requestFocus(OccurrenceKey{"20"}, queued.input, queued.options).request;
  queued.tx.cancel(old);
  CHECK(queued.tx.drainEffects().empty());
  queued.tx.requestFocus(OccurrenceKey{"20"}, queued.input, queued.options);
  auto changed = *queued.state.snapshot().registry.lookup(queued.b);
  changed.order = 21;
  queued.update(queued.b, changed);
  CHECK(queued.tx.synchronize().status == RequestStatus::cancelled);
  CHECK(queued.tx.drainEffects().empty());
  queued.tx.dispose();
  CHECK(queued.tx.requestFocus(OccurrenceKey{"19"}, queued.input, queued.options).status
        == RequestStatus::disposed);
}
