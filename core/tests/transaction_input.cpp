#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  for (bool mounted : {false, true}) {
    TransactionFixture f{mounted};
    auto id = f.tx.directionalInput(Direction::right, f.input, f.options).request;
    const auto movement = f.tx.drainEffects()[0];
    f.tx.issue(movement.token);
    auto repeated = f.options;
    repeated.deadline = 200;
    for (int i = 0; i < 1000; ++i) {
      CHECK(f.tx.directionalInput(Direction::right, f.input, repeated)
            == (RequestResult{RequestStatus::joined, id}));
      CHECK(f.tx.active()->target == f.b && f.tx.active()->deadline == 100);
    }
    CHECK(f.tx.drainEffects().empty());
    CHECK(f.tx.heldDirection() == Direction::right);
    f.tx.releaseInput();
    CHECK(!f.tx.heldDirection() && f.tx.active()->id == id);
    // Reverse at item 19 is a boundary, not movement from speculative item 20.
    CHECK(f.tx.directionalInput(Direction::left, f.input, repeated).status == RequestStatus::unavailable);
    CHECK(!f.tx.active());
    CHECK(f.tx.drainEffects()[0].token.kind == EffectKind::cancel);
  }
  TransactionFixture explicitCommand{false};
  auto id = explicitCommand.tx.directionalInput(Direction::right, explicitCommand.input,
                                               explicitCommand.options).request;
  CHECK(explicitCommand.tx.requestFocus(OccurrenceKey{"19"}, explicitCommand.input,
                                        explicitCommand.options).status == RequestStatus::started);
  CHECK(explicitCommand.tx.active()->id != id && explicitCommand.tx.active()->target == explicitCommand.a);
  CHECK(!explicitCommand.tx.active()->direction);
  CHECK(explicitCommand.tx.drainEffects().size() == 1);  // Old queued reveal discarded.
  TransactionFixture confirmed;
  confirmed.tx.directionalInput(Direction::right, confirmed.input, confirmed.options);
  const auto effect = confirmed.tx.drainEffects()[0];
  confirmed.tx.issue(effect.token);
  confirmed.tx.observeHost({effect.token.lifetime, {confirmed.state.surface(), FocusChannel::input,
                           {FocusKind::managed, confirmed.b, *effect.mount}}, effect.token});
  CHECK(!confirmed.tx.active() && confirmed.tx.drainEffects().empty());
  auto current = confirmed.input;
  current.source = confirmed.state.snapshot().inputFocus;
  CHECK(confirmed.tx.directionalInput(Direction::left, current, confirmed.options).status
        == RequestStatus::started);
  CHECK(confirmed.tx.active()->target == confirmed.a);
  TransactionFixture absent;
  absent.state.observeFocus({absent.state.surface(), FocusChannel::input, {FocusKind::absent, {}, {}}});
  auto input = absent.input;
  input.source = absent.state.snapshot().inputFocus;
  CHECK(absent.tx.directionalInput(Direction::right, input, absent.options).status == RequestStatus::unavailable);
  CHECK(absent.tx.requestFocus(OccurrenceKey{"20"}, input, absent.options).status == RequestStatus::started);
}
