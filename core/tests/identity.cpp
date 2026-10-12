#include <itar/identity.hpp>

#include <type_traits>

#include "check.hpp"

using namespace itar;

static_assert(!std::is_convertible_v<SurfaceId, Revision>);
static_assert(!std::is_convertible_v<Generation, MountGeneration>);
static_assert(!std::is_convertible_v<NodeId, SurfaceId>);
static_assert(!std::is_convertible_v<LayoutRevision, Revision>);
static_assert(!std::is_convertible_v<std::uint64_t, SurfaceId>);

int main() {
  const auto first = OccurrenceKey::compose("screen", "railA", "entryA");
  const auto repeated = OccurrenceKey::compose("screen", "railA", "entryB");
  const auto otherRail = OccurrenceKey::compose("screen", "railB", "entryA");
  CHECK(first != repeated && first != otherRail && repeated != otherRail);
  CHECK(first == OccurrenceKey::compose("screen", "railA", "entryA"));
  CHECK(OccurrenceKey::compose("a:b", "c", "d") !=
        OccurrenceKey::compose("a", "b:c", "d"));
  CHECK(OccurrenceKey::compose("", "ab", "c") !=
        OccurrenceKey::compose("a", "b", "c"));
  CHECK(!OccurrenceKey{});
  CHECK(!SurfaceId{} && !NodeId{} && !Generation{} && !Revision{});
  CHECK(!MountGeneration{} && !LayoutRevision{} && !NodeHandle{});
  CHECK(SurfaceId{1} == SurfaceId{1});
  CHECK(Generation{1} != Generation{2});
  CHECK(!(NodeHandle{NodeId{1}, Generation{0}}));
}
