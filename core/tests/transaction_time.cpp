#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  for (bool mounted : {false, true}) {
    TransactionFixture f{mounted};
    CHECK(!f.tx.nextDeadline());
    const auto id = f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).request;
    const auto effect = f.tx.drainEffects()[0];
    f.tx.issue(effect.token);
    CHECK(f.tx.nextDeadline() == f.options.deadline);
    CHECK(f.tx.advanceTo(99).status == RequestStatus::unchanged);
    CHECK(f.tx.advanceTo(98).status == RequestStatus::backward_time);
    CHECK(f.tx.active()->id == id && f.tx.nextDeadline() == 100);
    CHECK(f.tx.advanceTo(100) == (RequestResult{RequestStatus::expired, id}));
    CHECK(!f.tx.nextDeadline() && !f.tx.active());
    CHECK(f.tx.drainEffects()[0].token.kind == EffectKind::cancel);
    CHECK(f.tx.advanceTo(100).status == RequestStatus::unchanged);
    CHECK(f.state.snapshot().inputFocus == f.input.source);
    CHECK(f.tx.drainNotifications().empty());
    CHECK(f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).status == RequestStatus::expired);
  }
  TransactionFixture f;
  f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options);
  const auto effect = f.tx.drainEffects()[0];
  f.tx.issue(effect.token);
  CHECK(f.tx.advanceTo(99).status == RequestStatus::unchanged);
  CHECK(f.tx.observeHost({effect.token.lifetime,
                          {f.state.surface(), FocusChannel::input,
                           {FocusKind::managed, f.b, *effect.mount}}, effect.token}).status
        == RequestStatus::confirmed);
  CHECK(!f.tx.nextDeadline());
  CHECK(f.tx.advanceTo(100).status == RequestStatus::unchanged);
}
