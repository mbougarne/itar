#include "allocation_meter.hpp"
#include "../tests/navigation_fixture.hpp"
#include <chrono>
#include <cmath>
#include <iostream>
using namespace itar;
using Clock = std::chrono::steady_clock;
static volatile std::uint64_t sink{};
template<class Work> void measure(const char* name, Work work) {
  for (int i = 0; i < 50; ++i) { work(); }
  std::vector<double> samples(250);
  meter::reset();
  for (auto& sample : samples) {
    meter::measuring = true;
    const auto start = Clock::now(); work();
    const auto end = Clock::now();
    meter::measuring = false;
    sample = std::chrono::duration<double, std::nano>(end - start).count();
  }
  const auto count = meter::allocations, bytes = meter::requested;
  std::sort(samples.begin(), samples.end());
  auto percentile = [&](double p) { return samples[static_cast<std::size_t>(std::ceil(p * samples.size())) - 1]; };
  std::cout << "{\"operation\":\"" << name << "\",\"iterations\":250,\"warmup\":50,\"p50_ns\":"
    << percentile(.50) << ",\"p95_ns\":" << percentile(.95) << ",\"p99_ns\":" << percentile(.99)
    << ",\"allocations_total\":" << count << ",\"requested_bytes_total\":" << bytes << "}\n";
}
int main() {
  std::cout << "{\"compiler\":\"" << __VERSION__ << "\",\"cplusplus\":" << __cplusplus
            << ",\"note\":\"Release; instrumented process heap; not RSS or TV latency\"}\n";
  for (const auto logical : {64U, 256U, 1024U}) {
    const unsigned mounted = std::min(logical, 64U);
    const auto baseline = meter::live;
    const auto coldStart = Clock::now();
    State state{SurfaceId{1}, RegistryLimits{logical}};
    std::vector<Mutation> batch;
    for (unsigned i = 0; i < logical; ++i) {
      auto record = NavigationFixture::item(static_cast<int>(i), {double(i % 8) * 20, double(i / 8) * 20, 10, 10});
      if (i >= mounted) { record.mounted = false; record.mount = {}; record.geometry = {}; }
      batch.push_back({MutationKind::insert, OccurrenceKey{std::to_string(i)}, {}, {}, record});
    }
    CHECK(state.apply({state.surface(), {}, batch}).status == BatchStatus::valid);
    std::vector<Mutation>().swap(batch);
    const auto coldEnd = Clock::now();
    const auto source = state.snapshot().registry.find(OccurrenceKey{"0"});
    const FocusState focus{FocusKind::managed, source, MountGeneration{1}};
    CHECK(state.observeFocus({state.surface(), FocusChannel::input, focus}) == ObservationStatus::changed);
    const InputContext input{state.surface(), {}, InputOwner::engine, focus};
    std::cout << "{\"logical\":" << logical << ",\"mounted\":" << mounted
              << ",\"cold_setup_ns\":" << std::chrono::duration<double, std::nano>(coldEnd-coldStart).count()
              << ",\"retained_core_requested_bytes\":" << meter::live-baseline << "}\n";
    measure("spatial_query", [&] { const auto result = resolve(state, Direction::right, input); sink = result.target.slot.value; });
    const auto node = state.snapshot().registry.find(OccurrenceKey{"1"});
    Mutation update{MutationKind::update, OccurrenceKey{"1"}, node, {}, *state.snapshot().registry.lookup(node)};
    measure("batch_update_1", [&] {
      update.record.order = update.record.order == 1 ? 2 : 1;
      CHECK(state.apply({state.surface(), state.snapshot().revision, std::span{&update, 1}}).status == BatchStatus::valid);
    });
  }
}
