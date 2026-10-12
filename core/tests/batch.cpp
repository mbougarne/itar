#include <itar/batch.hpp>

#include <array>
#include <limits>

#include "check.hpp"

using namespace itar;

int main() {
  Registry registry{{3}};
  const SurfaceId surface{1};
  Mutation parent;
  parent.key = OccurrenceKey{"parent"};
  parent.record.scope = true;
  Mutation child;
  child.key = OccurrenceKey{"child"};
  child.parent = parent.key;
  auto operations = std::array{child, parent};
  const auto validate = [&](Revision expected = {}) {
    return validateBatch(registry, surface, {},
                         {surface, expected, operations});
  };
  auto valid = validate();
  CHECK(valid.status == BatchStatus::valid && valid.prepared->size() == 2);
  CHECK(registry.size() == 0);  // Validation never publishes.
  std::swap(operations[0], operations[1]);
  CHECK(validate().status == BatchStatus::valid);
  operations[1].key = parent.key;
  const auto duplicate = validate();
  CHECK(duplicate.status == BatchStatus::duplicate && duplicate.operation == 1);
  operations = {child, parent};
  operations[1].parent = child.key;
  operations[0].record.scope = true;
  CHECK(validate().status == BatchStatus::cycle);
  operations = {child, parent};
  operations[0].parent = OccurrenceKey{"missing"};
  CHECK(validate().status == BatchStatus::missing_parent);
  operations = {child, parent};
  operations[0].record.mounted = true;
  operations[0].record.mount = MountGeneration{1};
  operations[0].record.geometry = {
      surface,
      MountGeneration{1},
      LayoutRevision{1},
      {0, 0, 1, std::numeric_limits<double>::infinity()},
      GeometryState::measured};
  CHECK(validate().status == BatchStatus::geometry);
  operations[0].record.geometry.bounds = {0, 0, -1, 2};
  CHECK(validate().status == BatchStatus::geometry);
  CHECK(validate(Revision{1}).status == BatchStatus::revision_mismatch);
  operations = {child, parent};
  operations[0].record.geometry.bounds.x =
      std::numeric_limits<double>::quiet_NaN();
  CHECK(validate().status == BatchStatus::geometry);
  operations = {child, parent};
  Registry small{{1}};
  CHECK(validateBatch(small, surface, {}, {surface, {}, operations}).status ==
        BatchStatus::capacity);
  CHECK(validateBatch(registry, surface, {}, {SurfaceId{2}, {}, operations})
            .status == BatchStatus::stale_surface);
  CHECK(registry.size() == 0);
  registry = std::move(*valid.prepared);
  operations = {child, parent};
  operations[0].kind = MutationKind::update;
  operations[0].expected = registry.find(child.key);
  operations[1].kind = MutationKind::update;
  operations[1].expected = registry.find(parent.key);
  operations[1].record.scope = false;
  CHECK(validate().status == BatchStatus::missing_parent);
  operations[1].record.scope = true;
  operations[0].expected.generation.value += 1;
  CHECK(validate().status == BatchStatus::stale_handle);
  CHECK(registry.size() == 2);
}
