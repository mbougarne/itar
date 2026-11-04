#include "../benchmarks/allocation_meter.hpp"
#include "transaction_fixture.hpp"
#include "../internal/capture.hpp"
using namespace itar;
using namespace itar::diagnostics;
int main() {
  // Warm up process-owned stream state before measuring owner lifetimes.
  std::cout << "core-only lifecycle, 2 runs of 100 cycles + 10 warmup, 2 logical / 1 mounted target, diagnostics enabled\n";
  const auto baseline = meter::live;
  for (int run = 0; run < 2; ++run) {
    for (int iteration = -10; iteration < 100; ++iteration) {
      {
        TransactionFixture f{false};
        Capture capture{16, 4096};
        Fixture initial;
        CHECK(capture.enable(initial) == CaptureStatus::complete);
        CHECK(capture.record({Time{0}, {}}) == CaptureStatus::complete);
        CHECK(f.tx.requestFocus(OccurrenceKey{"20"}, f.input, f.options).status == RequestStatus::started);
        const auto effects = f.tx.drainEffects();
        CHECK(effects.size() == 1 && f.tx.issue(effects[0].token).status == RequestStatus::issued);
        CHECK(f.tx.cancel(f.tx.active()->id).status == RequestStatus::cancelled);
        auto cancellation = f.tx.drainEffects();
        CHECK(cancellation.size() == 1 && cancellation[0].token.kind == EffectKind::cancel);
        CHECK(f.tx.issue(cancellation[0].token).status == RequestStatus::issued);
        CHECK(f.tx.complete({cancellation[0].token, OutcomeKind::cancelled, {}}).status
              == RequestStatus::reconciled);
        CHECK(f.tx.usage().operations == 0);
        // Route deactivation/reactivation cancels pending focus under that scope.
        CHECK(f.tx.requestFocus(OccurrenceKey{"19"}, f.input, f.options).status == RequestStatus::started);
        auto scope = *f.state.snapshot().registry.lookup(f.row);
        scope.active = false;
        Mutation route{MutationKind::update, OccurrenceKey{"row"}, f.row, {}, scope};
        CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&route, 1}}).status == BatchStatus::valid);
        CHECK(!f.tx.active());
        route.record.active = true;
        CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&route, 1}}).status == BatchStatus::valid);
        // Recycle the source identity; delayed observations must not revive it.
        Mutation recycled{MutationKind::replace, OccurrenceKey{"19"}, f.a,
                           OccurrenceKey{"row"}, NavigationFixture::item(19)};
        CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&recycled, 1}}).status == BatchStatus::valid);
        CHECK(f.state.snapshot().registry.find(OccurrenceKey{"19"}) != f.a);
        CHECK(f.tx.observeHost({SurfaceLifetime{10},
          {f.state.surface(), FocusChannel::accessibility, f.input.source}, {}}).status == RequestStatus::stale);
        CHECK(f.tx.usage().operations <= 32 && f.tx.usage().effects <= 32);
        CHECK(f.state.snapshot().history.size() <= f.state.snapshot().registry.limits().capacity);
        f.tx.dispose(); capture.dispose();
        CHECK(!f.tx.active() && f.tx.usage().operations == 0 && f.tx.usage().effects == 0);
        CHECK(capture.size() == 0 && capture.payloadBytes() == 0);
      }
      CHECK(meter::live == baseline);
      if (iteration == 9 || iteration % 25 == 24) {
        std::cout << "run=" << run+1 << " checkpoint=" << iteration+1
                  << " owned_growth_bytes=" << meter::live-baseline << '\n';
      }
    }
  }
  std::cout << "peak_process_requested_bytes=" << meter::peak << "; native views/RSS/host caches unmeasured\n";
}
