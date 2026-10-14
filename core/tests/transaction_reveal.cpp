#include "transaction_fixture.hpp"

int main() {
  using namespace itar;
  TransactionFixture f{false};
  CHECK(f.tx.begin(resolve(f.state, Direction::right, f.input), f.options).status
        == RequestStatus::started);
  const auto reveal = f.tx.drainEffects()[0];
  CHECK(reveal.token.kind == EffectKind::reveal && !reveal.mount);
  CHECK(f.tx.issue(reveal.token).status == RequestStatus::issued);
  auto mounted = NavigationFixture::item(20);
  mounted.mount = MountGeneration{2};
  mounted.geometry = {};  // A mount without measurements is not ready.
  f.update(f.b, mounted);
  Realization realization{reveal.token, f.state.surface(), f.b, mounted.mount,
                           f.options.dataset, true};
  auto wrong = realization;
  wrong.target = f.a;
  CHECK(f.tx.realize(wrong).status == RequestStatus::stale);
  wrong = realization;
  wrong.dataset = DatasetRevision{2};
  CHECK(f.tx.realize(wrong).status == RequestStatus::stale);
  wrong = realization;
  wrong.mount = MountGeneration{1};
  CHECK(f.tx.realize(wrong).status == RequestStatus::stale);
  CHECK(f.tx.realize(realization).status == RequestStatus::waiting);
  CHECK(f.tx.drainEffects().empty() && f.tx.drainNotifications().empty());
  mounted.geometry = {f.state.surface(), mounted.mount, LayoutRevision{2},
                       {20, 0, 10, 10}, GeometryState::measured};
  f.update(f.b, mounted);
  CHECK(f.tx.refresh().status == RequestStatus::started);
  const auto focus = f.tx.drainEffects();
  CHECK(focus.size() == 1 && focus[0].token.kind == EffectKind::focus);
  CHECK(focus[0].mount == mounted.mount && focus[0].token.effect != reveal.token.effect);
  CHECK(f.tx.refresh().status == RequestStatus::waiting);
  CHECK(f.tx.drainEffects().empty());
  CHECK(f.state.snapshot().inputFocus == f.input.source);
  TransactionFixture clipped;
  auto record = *clipped.state.snapshot().registry.lookup(clipped.b);
  record.geometry.state = GeometryState::clipped;
  clipped.update(clipped.b, record);
  CHECK(clipped.tx.requestFocus(OccurrenceKey{"20"}, clipped.input, clipped.options).status
        == RequestStatus::started);
  const auto effect = clipped.tx.drainEffects()[0];
  CHECK(effect.token.kind == EffectKind::reveal);
  CHECK(clipped.tx.issue(effect.token).status == RequestStatus::issued);
  CHECK(clipped.tx.realize({effect.token, clipped.state.surface(), clipped.b,
                            record.mount, clipped.options.dataset, false}).status
        == RequestStatus::waiting);
  CHECK(clipped.tx.drainEffects().empty());
}
