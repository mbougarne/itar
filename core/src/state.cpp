#include <itar/state.hpp>

#include <new>
#include <type_traits>
#include <utility>

namespace itar {

ApplyResult State::apply(Batch batch) {
  const auto rejected = [&](BatchStatus status,
                            std::optional<std::size_t> operation = {}) {
    return ApplyResult{status, committed_.revision, operation, {}};
  };
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
