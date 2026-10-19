#include <itar/state.hpp>
#include <itar/topology.hpp>

#include <algorithm>
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
    auto returning = returning_;
    for (const auto& saved : committed_.history) {
      const auto before = saved.scope;
      const auto* old = committed_.registry.lookup(before);
      const auto* next = validation.prepared->lookup(before);
      if (!old || !old->scope || !next || !next->scope ||
          !effectivelyActive(committed_.registry, before) || effectivelyActive(*validation.prepared, before)) { continue; }
      const auto found = std::find_if(returning.begin(), returning.end(),
          [&](const ScopeHistory& entry) { return entry.scope == before; });
      if (found == returning.end()) { returning.push_back(saved); }
      else { found->occurrence = saved.occurrence; }
    }
    pruneHistory(*validation.prepared, returning);
    const auto input =
        reconcileFocus(*validation.prepared, committed_.inputFocus);
    const auto accessibility =
        reconcileFocus(*validation.prepared, committed_.accessibilityFocus);
    Snapshot next{std::move(*validation.prepared),
                  Revision{committed_.revision.value + 1}, input, accessibility,
                  std::move(history)};
    static_assert(std::is_nothrow_swappable_v<Snapshot>);
    std::swap(committed_, next);
    returning_.swap(returning);
    return {BatchStatus::valid, committed_.revision, {}, std::move(changed)};
  } catch (const std::bad_alloc&) {
    return rejected(BatchStatus::resource);
  }
}

}  // namespace itar
