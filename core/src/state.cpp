#include <itar/state.hpp>

#include <new>
#include <type_traits>
#include <utility>

namespace itar {
namespace {

// A fresh measurement of the same mounted leaf cannot change topology, focus
// ownership, or scope history. Every other edit takes the full batch path.
bool freshMeasurement(const Registry& registry, SurfaceId surface,
                      const Mutation& op) noexcept {
  if (op.kind != MutationKind::update || op.preferred) return false;
  const auto* previous = registry.lookup(op.expected);
  if (!previous || previous->scope || !previous->mounted ||
      *registry.key(op.expected) != op.key) return false;
  const auto* parent = registry.key(previous->parent);
  if (parent ? *parent != op.parent : bool(op.parent)) return false;

  const auto& geometry = op.record.geometry;
  if (!measuredGeometry(geometry.state) ||
      geometry.layout.value <= previous->geometry.layout.value ||
      geometry.layout.value <= previous->invalidatedThrough.value ||
      !validGeometry(geometry, surface, previous->mount, true, false)) return false;
  auto metadata = op.record;
  metadata.parent = previous->parent;  // Batch parents are resolved by key.
  metadata.invalidatedThrough = previous->invalidatedThrough;
  metadata.geometry = previous->geometry;
  return metadata == *previous;
}

}  // namespace

ApplyResult State::apply(Batch batch) {
  const auto rejected = [&](BatchStatus status,
                            std::optional<std::size_t> operation = {}) {
    return ApplyResult{status, committed_.revision, operation, {}};
  };
  if (batch.operations.size() == 1 && surface_ && batch.surface == surface_ &&
      batch.expected == committed_.revision && committed_.revision.value < revisionCeiling_) {
    const auto& op = batch.operations.front();
    if (freshMeasurement(committed_.registry, surface_, op)) {
      try {
        // Allocate the caller's change record before publishing anything.
        ApplyResult result{BatchStatus::valid, Revision{committed_.revision.value + 1},
                           {}, {{op.expected, op.expected}}};
        auto updated = *committed_.registry.lookup(op.expected);
        updated.geometry = op.record.geometry;
        committed_.registry.replace(op.expected, updated);
        committed_.revision = result.revision;
        return result;
      } catch (const std::bad_alloc&) {
        return rejected(BatchStatus::resource);
      }
    }
  }
  auto validation = validate(batch);
  if (validation.status != BatchStatus::valid) {
    return rejected(validation.status, validation.operation);
  }
  if (batch.operations.empty()) {
    return {BatchStatus::valid, committed_.revision, {}, {}};
  }
  if (committed_.revision.value == revisionCeiling_) {
    return rejected(BatchStatus::revision_exhausted);
  }
  try {
    std::vector<ChangedRecord> changed;
    // Include untouched records whose parent handle changes during replacement.
    changed.reserve(committed_.registry.size() + validation.prepared->size());
    for (auto before : committed_.registry.handles()) {
      auto after = validation.prepared->find(*committed_.registry.key(before));
      const auto* oldPreferred = committed_.registry.preferred(before);
      const auto* newPreferred = validation.prepared->preferred(after);
      if (before != after || *committed_.registry.lookup(before) !=
                                 *validation.prepared->lookup(after) ||
          bool(oldPreferred) != bool(newPreferred) ||
          (oldPreferred && newPreferred && *oldPreferred != *newPreferred)) {
        changed.push_back({before, after});
      }
    }
    for (auto after : validation.prepared->handles()) {
      if (!committed_.registry.find(*validation.prepared->key(after))) {
        changed.push_back({{}, after});
      }
    }
    auto history = committed_.history;
    pruneHistory(*validation.prepared, history);
    const auto input =
        reconcileFocus(*validation.prepared, committed_.inputFocus);
    const auto accessibility =
        reconcileFocus(*validation.prepared, committed_.accessibilityFocus);
    rememberInputFocus(*validation.prepared, input, history);
    Snapshot next{std::move(*validation.prepared),
                  Revision{committed_.revision.value + 1}, input, accessibility,
                  std::move(history)};
    static_assert(std::is_nothrow_swappable_v<Snapshot>);
    std::swap(committed_, next);
    return {BatchStatus::valid, committed_.revision, {}, std::move(changed)};
  } catch (const std::bad_alloc&) {
    return rejected(BatchStatus::resource);
  }
}

}  // namespace itar
