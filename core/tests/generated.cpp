#include "transaction_fixture.hpp"
#include "../internal/replay.hpp"
#include <cmath>
#include <limits>
using namespace itar;
using namespace itar::diagnostics;
int main(int argc, char** argv) {
  const auto first = argc > 1 ? std::stoul(argv[1]) : 1UL;
  const auto count = argc > 2 ? std::stoul(argv[2]) : 16UL;
  CHECK(count > 0 && count <= 128 && first <= 0xffffffffUL);
  for (unsigned long seed = first; seed < first + count; ++seed) {
    std::cerr << "generator=v1 seed=" << seed << " steps=64\n";
    Fixture fixture;
    fixture.registry.capacity = 8;
    fixture.transactions = {8, 8, 8};
    fixture.initial = {{MutationKind::insert, OccurrenceKey{"a"}, {}, {}, NavigationFixture::item(0)},
                       {MutationKind::insert, OccurrenceKey{"b"}, {}, {}, NavigationFixture::item(1)}};
    std::uint32_t random = static_cast<std::uint32_t>(seed);
    TimePoint now = 0;
    for (int index = 0; index < 64; ++index) {
      random = random * 1664525U + 1013904223U;
      const auto before = replay(fixture);
      CHECK(before);
      const auto target = random & 1 ? NodeHandle{NodeId{1}, Generation{1}}
                                     : NodeHandle{NodeId{2}, Generation{1}};
      Step step{Release{}, {}};
      switch ((random >> 16) % 12) {
        case 0: step.event = FocusKey{OccurrenceKey{random & 1 ? "a" : "b"}}; break;
        case 1: step.event = Input{static_cast<Direction>((random >> 8) % 4)}; break;
        case 2: step.event = Cancel{RequestId{1 + random % 20}}; break;
        case 3: now += random % 5; step.event = Time{now}; break;
        case 4: step.event = Observe{{fixture.surface, FocusChannel::input,
                        {FocusKind::managed, target, MountGeneration{1}}}, {}}; break;
        case 5: step.expected = RequestStatus::stale; step.event = Observe{{fixture.surface, FocusChannel::input,
                        {FocusKind::managed, {target.slot, Generation{99}}, MountGeneration{1}}}, {}}; break;
        case 6: if (!before->effects.empty()) { step.event = Issue{random % before->effects.size()}; } break;
        case 7: if (!before->effects.empty()) { step.event = Outcome{random % before->effects.size(),
                         random & 1 ? OutcomeKind::accepted : OutcomeKind::rejected}; } break;
        case 8: {
          auto record = NavigationFixture::item(0);
          record.geometry.bounds.width = std::numeric_limits<double>::quiet_NaN();
          step.event = Commit{{{MutationKind::update, OccurrenceKey{"a"},
                             {NodeId{1}, Generation{1}}, {}, record}}, BatchStatus::geometry};
          break;
        }
        case 9: step.event = Commit{{fixture.initial[0], fixture.initial[0]}, BatchStatus::duplicate}; break;
        case 10: step.event = Availability{{fixture.surface, target, MountGeneration{1},
                                          AvailabilityKind::geometry_dirty, LayoutRevision{1}}}; break;
        case 11: {
          auto record = NavigationFixture::item(1);
          record.geometry.layout = LayoutRevision{2};
          step.event = Commit{{{MutationKind::update, OccurrenceKey{"b"},
                       {NodeId{2}, Generation{1}}, {}, record}}, BatchStatus::valid}; break;
        }
      }
      std::cerr << " " << index << ':' << step.event.index();
      fixture.steps.push_back(step);
    }
    const auto beforeDispose = replay(fixture);
    fixture.steps.push_back({Dispose{}, {}});
    if (!beforeDispose->effects.empty()) {
      fixture.steps.push_back({Outcome{0, OutcomeKind::accepted}, RequestStatus::stale});
    }
    const auto firstRun = replay(fixture);
    CHECK(firstRun && firstRun == replay(fixture) && !firstRun->active);
    std::cerr << " PASS\n";
  }
}
