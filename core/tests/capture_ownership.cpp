#include "transaction_fixture.hpp"
#include "../internal/capture.hpp"

using namespace itar;
using namespace itar::diagnostics;

int main() {
  Fixture initial;
  initial.initial = {
    {MutationKind::insert, OccurrenceKey{"source"}, {}, {}, NavigationFixture::item(0)},
    {MutationKind::insert, OccurrenceKey{"next"}, {}, {}, NavigationFixture::item(1, {20, 0, 10, 10})}
  };
  const FocusState source{FocusKind::managed, {NodeId{1}, Generation{1}}, MountGeneration{1}};
  const FocusState next{FocusKind::managed, {NodeId{2}, Generation{1}}, MountGeneration{1}};
  for (const auto owner : {InputOwner::accessibility, InputOwner::system,
                           InputOwner::text, InputOwner::native_control}) {
    Capture capture;
    CHECK(capture.enable(initial) == CaptureStatus::complete);
    auto session = initial;
    const InputContext input{initial.surface, {}, owner, source};
    session.steps = {
      {Observe{{initial.surface, FocusChannel::input, source}, {}}, {}},
      {Observe{{initial.surface, FocusChannel::accessibility, next}, {}}, {}},
      {Input{Direction::right, input}, RequestStatus::unavailable},
      {FocusKey{OccurrenceKey{"next"}, input}, RequestStatus::unavailable}
    };
    const auto result = replay(session, [&](const Step& step, std::optional<RequestStatus> decision) {
      CHECK(capture.record(step, decision) == CaptureStatus::complete);
    });
    CHECK(result && result == replay(*capture.complete()));
    CHECK(result->effects.empty() && !result->active);
    CHECK(result->focus == source && result->accessibilityFocus == next);
    CHECK(result->notifications.size() == 2);
    CHECK(!result->notifications.back().request);
    CHECK(std::get<Input>(capture.complete()->steps[2].event).context->owner == owner);
    // The identical move is possible when the engine really owns the input.
    session.steps.resize(2);
    session.steps.push_back({Input{Direction::right,
      InputContext{initial.surface, {}, InputOwner::engine, source}}, RequestStatus::started});
    const auto owned = replay(session);
    CHECK(owned && owned->effects.size() == 1 && owned->effects[0].target == next.node);
    // A stale source or invalid scope must not be reconstructed as valid input.
    session.steps.back() = {Input{Direction::right,
      InputContext{initial.surface, {}, InputOwner::engine, next}}, RequestStatus::unavailable};
    CHECK(replay(session)->effects.empty());
    session.steps.back() = {Input{Direction::right,
      InputContext{initial.surface, {NodeId{99}, Generation{1}}, InputOwner::engine, source}},
      RequestStatus::unavailable};
    CHECK(replay(session)->effects.empty());
    capture.dispose();
    CHECK(!capture.complete());
  }
  // Restoration has its own event: replay must not turn it into a generic focus
  // command or manufacture engine ownership. Observations rebuild its reader guard.
  for (const bool competing : {false, true}) {
    Capture capture;
    CHECK(capture.enable(initial) == CaptureStatus::complete);
    const auto initialBytes = capture.payloadBytes();
    auto session = initial;
    const InputContext reader{initial.surface, {}, InputOwner::accessibility, source};
    session.steps = {
      {Observe{{initial.surface, FocusChannel::input, source}, {}}, {}},
      {Observe{{initial.surface, FocusChannel::accessibility, source}, {}}, {}},
      {RestoreKey{OccurrenceKey{"next"}, reader}, RequestStatus::started},
      {Issue{0}, RequestStatus::issued},
      {Observe{{initial.surface, FocusChannel::accessibility, next}, {}}, RequestStatus::unchanged}
    };
    if (competing) session.steps.push_back({Observe{{initial.surface, FocusChannel::accessibility, source}, {}},
                                           RequestStatus::reconciled});
    session.steps.push_back({Observe{{initial.surface, FocusChannel::input, next}, 0},
                            competing ? RequestStatus::unchanged : RequestStatus::confirmed});
    const auto result = replay(session, [&](const Step& step, std::optional<RequestStatus> decision) {
      CHECK(capture.record(step, decision) == CaptureStatus::complete);
    });
    CHECK(result && result == replay(*capture.complete()));
    CHECK(capture.payloadBytes() == initialBytes + 4); // The restoration key is bounded payload.
    CHECK(std::get<RestoreKey>(capture.complete()->steps[2].event).context.owner == InputOwner::accessibility);
    CHECK(result->focus == next && result->accessibilityFocus == (competing ? source : next));
    CHECK(!result->active && result->effects.size() == (competing ? 2U : 1U));
    CHECK(result->notifications[2].channel == FocusChannel::accessibility && !result->notifications[2].request);
    CHECK(bool(result->notifications.back().request) == !competing);
  }
  Capture bounded{8, 3};
  Fixture empty;
  CHECK(bounded.enable(empty) == CaptureStatus::complete);
  CHECK(bounded.record({RestoreKey{OccurrenceKey{"next"},
      InputContext{empty.surface, {}, InputOwner::accessibility, source}}, {}}) == CaptureStatus::overflow);
  CHECK(!bounded.complete());
}
