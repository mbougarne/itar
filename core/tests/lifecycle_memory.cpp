#include "../benchmarks/allocation_meter.hpp"
#include "transaction_fixture.hpp"
#include "../internal/capture.hpp"
using namespace itar;
using namespace itar::diagnostics;
int main() {
  // Warm up process-owned stream state before measuring owner lifetimes.
  std::cout << "core-only lifecycle, 100 iterations, 2 logical / 1 mounted target, diagnostics enabled\n";
  const auto baseline = meter::live;
  for (int iteration = 0; iteration < 100; ++iteration) {
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
      CHECK(f.tx.usage().operations <= 32 && f.tx.usage().effects <= 32);
      CHECK(f.state.snapshot().history.size() <= f.state.snapshot().registry.limits().capacity);
      f.tx.dispose(); capture.dispose();
      CHECK(!f.tx.active() && f.tx.usage().operations == 0 && f.tx.usage().effects == 0);
      CHECK(capture.size() == 0 && capture.payloadBytes() == 0);
    }
    CHECK(meter::live == baseline);
    if (iteration % 25 == 24) { std::cout << "checkpoint=" << iteration+1 << " owned_growth_bytes=" << meter::live-baseline << '\n'; }
  }
  std::cout << "peak_process_requested_bytes=" << meter::peak << "; native views/RSS/host caches unmeasured\n";
}
