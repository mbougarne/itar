#include "transaction_fixture.hpp"

#include <array>

namespace {
void targetGeometryDuringIssuedMove(bool generalBatch) {
  using namespace itar;
  TransactionFixture f;
  const auto request = f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options);
  CHECK(request.status == RequestStatus::started);
  const auto movement = f.tx.drainEffects().at(0);
  CHECK(f.tx.issue(movement.token).status == RequestStatus::issued);

  const auto& registry = f.state.snapshot().registry;
  std::array updates{
      Mutation{MutationKind::update, *registry.key(f.b), f.b, *registry.key(f.row), *registry.lookup(f.b)},
      Mutation{MutationKind::update, *registry.key(f.row), f.row, {}, *registry.lookup(f.row)}};
  const auto batch = std::span{updates}.first(generalBatch ? 2 : 1);
  updates[0].record.geometry.layout = LayoutRevision{2};
  updates[0].record.geometry.bounds.x = 32;
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, batch}).status == BatchStatus::valid);
  CHECK(f.tx.active() && f.tx.active()->id == request.request);
  CHECK(f.tx.active()->revision == f.state.snapshot().revision && f.tx.drainEffects().empty());

  updates[0].record.geometry.layout = LayoutRevision{3};
  updates[0].record.geometry.state = GeometryState::clipped;
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, batch}).status == BatchStatus::valid);
  CHECK(!f.tx.active());
  const auto cleanup = f.tx.drainEffects();
  CHECK(cleanup.size() == 1 && cleanup[0].cancels == movement.token);
  CHECK(f.state.snapshot().inputFocus == f.input.source);
}
}  // namespace

int main() {
  using namespace itar;
  targetGeometryDuringIssuedMove(false);
  targetGeometryDuringIssuedMove(true);
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
