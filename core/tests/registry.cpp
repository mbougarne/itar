#include <itar/registry.hpp>

#include "check.hpp"

using namespace itar;

int main() {
  Registry registry{{2, 8, 3}};
  const OccurrenceKey a{"a"}, b{"b"}, c{"c"};
  CHECK(registry.insert({}).status == StorageStatus::invalid);
  CHECK(registry.insert(OccurrenceKey{"123456789"}).status ==
        StorageStatus::invalid);
  const auto first = registry.insert(a);
  CHECK(first.status == StorageStatus::inserted);
  CHECK(registry.insert(a).status == StorageStatus::duplicate);
  const auto second = registry.insert(b);
  CHECK(registry.insert(c).status == StorageStatus::capacity);
  CHECK(registry.key(first.handle) && *registry.key(first.handle) == a);
  CHECK(registry.remove(first.handle));
  CHECK(!registry.remove(first.handle) && !registry.lookup(first.handle));
  const auto reused = registry.insert(c);
  CHECK(reused.handle.slot == first.handle.slot);
  CHECK(reused.handle.generation != first.handle.generation);
  CHECK(!registry.lookup(first.handle) && registry.lookup(reused.handle));
  CHECK(registry.lookup(second.handle));
  CHECK(registry.remove(reused.handle));
  const auto last = registry.insert(a);
  CHECK(last.handle.generation == Generation{3});
  CHECK(registry.remove(last.handle));
  CHECK(registry.insert(c).status == StorageStatus::exhausted);
  CHECK(registry.remove(second.handle));
  CHECK(registry.size() == 0 && registry.handles().empty());
  CHECK(registry.insert(c).handle.slot == second.handle.slot);
  Registry cycling{{1, 8, 100}};
  for (int i = 0; i < 50; ++i) {
    auto handle = cycling.insert(a).handle;
    CHECK(cycling.size() == 1 && cycling.remove(handle));
    CHECK(cycling.size() == 0 && !cycling.find(a) && !cycling.key(handle));
  }
}
