#include "../benchmarks/allocation_meter.hpp"
#include "transaction_fixture.hpp"
#include "../internal/capture.hpp"
using namespace itar;
using namespace itar::diagnostics;
int main() {
  Fixture fixture;
  fixture.initial = {{MutationKind::insert, OccurrenceKey{"target"}, {}, {},
                       NavigationFixture::item(0)}};
  Capture capture{8, 4096};
  Step focus{FocusKey{OccurrenceKey{"target"}}, RequestStatus::started};
  meter::reset(); meter::measuring = true;
  CHECK(capture.record(focus) == CaptureStatus::disabled && !capture.complete());
  meter::measuring = false;
  CHECK(meter::allocations == 0);
  CHECK(capture.enable(fixture) == CaptureStatus::complete);
  const std::vector<Step> session{
    focus, {Issue{0}, RequestStatus::issued},
    {Observe{{SurfaceId{1}, FocusChannel::input,
              {FocusKind::managed, {NodeId{1}, Generation{1}}, MountGeneration{1}}}, 0},
      RequestStatus::confirmed},
    {Outcome{0, OutcomeKind::accepted}, RequestStatus::waiting},
    {Time{100}, RequestStatus::unchanged}, {Dispose{}, {}}};
  fixture.steps = session;
  const auto observed = replay(fixture, [&](const Step& step, std::optional<RequestStatus> decision) {
    CHECK(capture.record(step, decision) == CaptureStatus::complete);
  });
  CHECK(observed);
  CHECK(replay(*capture.complete()) == replay(fixture));
  const auto result = replay(*capture.complete());
  CHECK(result && result->effects.size() == 1 && !result->active);
  CHECK(result->notifications.size() == 1 && result->notifications[0].request == RequestId{1});
  capture.dispose();
  CHECK(capture.size() == 0 && capture.payloadBytes() == 0 && !capture.complete());
  fixture.steps.clear();
  Capture tiny{1, 4096};
  CHECK(tiny.enable(fixture) == CaptureStatus::complete);
  CHECK(tiny.record(focus) == CaptureStatus::complete);
  CHECK(tiny.record(focus) == CaptureStatus::overflow && !tiny.complete());
  CHECK(tiny.record(focus) == CaptureStatus::overflow && tiny.size() == 1);
  Capture bytes{10, 0};
  CHECK(bytes.enable(fixture) == CaptureStatus::overflow);
  Fixture empty;
  CHECK(bytes.enable(empty) == CaptureStatus::complete);
  CHECK(bytes.record(focus) == CaptureStatus::overflow);
  CHECK(capture.enable(fixture) == CaptureStatus::complete);
  capture.disable();
  CHECK(capture.record(focus) == CaptureStatus::disabled && !capture.complete());
}
