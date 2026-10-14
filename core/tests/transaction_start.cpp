#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  TransactionFixture f;
  const auto proposal = resolve(f.state, Direction::right, f.input);
  auto record = *f.state.snapshot().registry.lookup(f.b);
  record.enabled = false;
  f.update(f.b, record);
  CHECK(f.tx.begin(proposal, f.options).status == RequestStatus::stale);
  CHECK(f.tx.drainEffects().empty());
  CHECK(f.tx.requestFocus(OccurrenceKey{"missing"}, f.input, f.options).status
        == RequestStatus::unavailable);
  CHECK(f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).status
        == RequestStatus::unavailable);
  TransactionFixture mounted;
  const auto history = *mounted.state.history(mounted.row);
  CHECK(mounted.tx.begin(resolve(mounted.state, Direction::right, mounted.input),
                         mounted.options).status == RequestStatus::started);
  CHECK(mounted.tx.active()->phase == RequestPhase::focusing);
  CHECK(mounted.tx.drainEffects()[0].token.kind == EffectKind::focus);
  CHECK(mounted.state.snapshot().inputFocus == mounted.input.source);
  CHECK(*mounted.state.history(mounted.row) == history);
  CHECK(mounted.tx.drainNotifications().empty());
  TransactionFixture unmounted{false};
  CHECK(unmounted.tx.requestFocus(OccurrenceKey{"20"}, unmounted.input,
                                  unmounted.options).status == RequestStatus::started);
  CHECK(!unmounted.tx.active()->mount);
  CHECK(unmounted.tx.drainEffects()[0].token.kind == EffectKind::reveal);
  TransactionFixture inactive;
  record = *inactive.state.snapshot().registry.lookup(inactive.row);
  record.active = false;
  inactive.update(inactive.row, record);
  CHECK(inactive.tx.requestFocus(OccurrenceKey{"20"}, inactive.input, inactive.options).status
        == RequestStatus::unavailable);
  CHECK(inactive.tx.drainEffects().empty());
}
