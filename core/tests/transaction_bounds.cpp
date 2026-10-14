#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  TransactionFixture f{false};
  Transactions tx{f.state, SurfaceLifetime{5}, {4, 4, 1}};
  auto old = tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).request;
  const auto reveal = tx.drainEffects()[0];
  tx.issue(reveal.token);
  tx.cancel(old);
  const auto cleanup = tx.drainEffects()[0];
  tx.issue(cleanup.token);
  CHECK(tx.complete({cleanup.token, OutcomeKind::not_cancellable, {}}).status
        == RequestStatus::reconciled);
  CHECK(tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).status == RequestStatus::started);
  const auto replacement = tx.drainEffects()[0];
  CHECK(tx.issue(replacement.token).status == RequestStatus::waiting);
  CHECK(tx.advanceTo(100).status == RequestStatus::expired);
  CHECK(!tx.active() && tx.usage().operations == 1 && tx.drainEffects().empty());
  tx.complete({reveal.token, OutcomeKind::completed, {}});
  CHECK(tx.usage().operations == 0);
  auto later = f.options;
  later.deadline = 200;
  tx.requestFocus(OccurrenceKey{"20"}, f.input, later);
  const auto next = tx.drainEffects()[0];
  CHECK(tx.issue(next.token).status == RequestStatus::issued);
  tx.cancel(next.token.request);
  const auto cancelled = tx.drainEffects()[0];
  tx.issue(cancelled.token);
  tx.complete({cancelled.token, OutcomeKind::already_finished, {}});
  CHECK(tx.usage().operations == 0);
  for (int i = 0; i < 1000; ++i) {
    const auto id = tx.requestFocus(OccurrenceKey{"20"}, f.input, later).request;
    CHECK(id && tx.usage().operations == 1);
    tx.cancel(id);
    CHECK(tx.usage().operations == 0 && tx.usage().effects == 0);
  }
  Transactions noOperations{f.state, SurfaceLifetime{6}, {0, 1, 1}};
  CHECK(noOperations.requestFocus(OccurrenceKey{"20"}, f.input, later).status == RequestStatus::exhausted);
  Transactions noEffects{f.state, SurfaceLifetime{7}, {1, 0, 1}};
  CHECK(noEffects.requestFocus(OccurrenceKey{"20"}, f.input, later).status == RequestStatus::exhausted);
  Transactions small{f.state, SurfaceLifetime{8}, {1, 1, 1}};
  small.requestFocus(OccurrenceKey{"20"}, f.input, later);
  const auto issued = small.drainEffects()[0];
  small.issue(issued.token);
  CHECK(small.cancel(issued.token.request).status == RequestStatus::resync);
  CHECK(small.resyncRequired() && small.usage().operations == 1);
  small.complete({issued.token, OutcomeKind::completed, {}});
  CHECK(small.usage().operations == 0);
  small.dispose();
  CHECK(small.usage().operations == 0 && small.usage().effects == 0);
  TransactionFixture notifications;
  Transactions noNotifications{notifications.state, SurfaceLifetime{9}, {4, 4, 0}};
  noNotifications.requestFocus(OccurrenceKey{"20"}, notifications.input, later);
  const auto focus = noNotifications.drainEffects()[0];
  noNotifications.issue(focus.token);
  CHECK(noNotifications.observeHost({focus.token.lifetime,
        {notifications.state.surface(), FocusChannel::input,
         {FocusKind::managed, notifications.b, *focus.mount}}, focus.token}).status == RequestStatus::resync);
  CHECK(noNotifications.resyncRequired() && noNotifications.drainNotifications().empty());
  CHECK(notifications.state.snapshot().inputFocus.node == notifications.b);
  Transactions ids{f.state, SurfaceLifetime{11}, {4, 4, 1, 1}};
  auto id = ids.requestFocus(OccurrenceKey{"20"}, f.input, later).request;
  ids.cancel(id);
  CHECK(ids.requestFocus(OccurrenceKey{"20"}, f.input, later).status == RequestStatus::exhausted);
  Transactions queue{f.state, SurfaceLifetime{12}, {4, 1, 1}};
  queue.requestFocus(OccurrenceKey{"20"}, f.input, later);
  const auto first = queue.drainEffects()[0];
  queue.issue(first.token);
  queue.cancel(first.token.request);  // Cleanup fills the one-entry output queue.
  CHECK(queue.requestFocus(OccurrenceKey{"20"}, f.input, later).status == RequestStatus::exhausted);
  CHECK(queue.usage().operations == 2 && queue.usage().effects == 1);
  const auto cancel = queue.drainEffects()[0];
  queue.issue(cancel.token);
  queue.complete({cancel.token, OutcomeKind::cancelled, {}});
  CHECK(queue.usage().operations == 0);
}
