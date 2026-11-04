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
}
