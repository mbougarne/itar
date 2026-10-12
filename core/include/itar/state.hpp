#pragma once

#include <itar/batch.hpp>
#include <itar/host.hpp>
#include <itar/focus.hpp>

namespace itar {

struct Snapshot {
  Registry registry;
  Revision revision;
  FocusState inputFocus;
  FocusState accessibilityFocus;
  std::vector<ScopeHistory> history;
};

struct ChangedRecord {
  NodeHandle before;
  NodeHandle after;  // Empty for deletion; different from before on replacement.
};

struct ApplyResult {
  BatchStatus status;
  Revision revision;
  std::optional<std::size_t> operation;
  std::vector<ChangedRecord> changed;
};

// One serialized owner; readers borrow the snapshot until the next mutation.
// Publication is a no-throw swap after all resource preparation. No callbacks.
class State {
 public:
  explicit State(SurfaceId surface, RegistryLimits limits = {},
                 std::uint64_t revisionCeiling =
                     std::numeric_limits<std::uint64_t>::max())
      : surface_(surface), committed_{Registry{limits}, {}},
        revisionCeiling_(revisionCeiling) {}
  const Snapshot& snapshot() const noexcept { return committed_; }
  SurfaceId surface() const noexcept { return surface_; }
  Validation validate(Batch batch) const {
    return validateBatch(committed_.registry, surface_, committed_.revision, batch);
  }
  ApplyResult apply(Batch batch);
  ObservationStatus observeAvailability(AvailabilityObservation observation) noexcept;
  ObservationStatus observeFocus(FocusObservation observation);
  const OccurrenceKey* history(NodeHandle scope) const noexcept;

 private:
  SurfaceId surface_;
  Snapshot committed_;
  std::uint64_t revisionCeiling_;
};

}  // namespace itar
