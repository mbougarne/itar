#pragma once

#include <itar/state.hpp>

#include <string_view>

namespace itar {

enum class InputOwner { engine, text, native_control, accessibility, system };
enum class ProposalKind { ready, reveal, boundary, unavailable, host_owned };
enum class ProposalReason {
  selected, host_input, stale_surface, no_authority, unknown_source,
  absent_source, stale_source, ineligible, outside_boundary, override_target,
  invalid_override, stop, wrapped, parent_continuation, invalid_direction, ordered,
  geometric, stale_geometry, first_entry, restoration, anchor_entry,
  entry_not_ready, existing_focus, no_entry, invalid_anchor, origin_present,
  host_reassigned, deletion_neighbor, recovery_fallback, no_recovery
};
inline constexpr std::string_view navigationPolicy = "itar-linear-v1";

struct InputContext {
  SurfaceId surface;
  NodeHandle authority;  // Empty means this surface's root.
  InputOwner owner{InputOwner::engine};
  FocusState source;  // Adapter's current observation must match committed focus.
};

struct Proposal {
  ProposalKind kind{ProposalKind::unavailable};
  ProposalReason reason{ProposalReason::ineligible};
  SurfaceId surface;
  Revision revision;
  NodeHandle authority;
  FocusState source;
  NodeHandle target;
  MountGeneration mount;  // Only supplied for an immediately ready target.
  std::string_view policy{navigationPolicy};
  bool operator==(const Proposal&) const = default;
};

// Serialized read-only owner. No host callbacks, measurements or effects.
Proposal gateNavigation(const State& state, const InputContext& input) noexcept;
bool logicalTarget(const State& state, NodeHandle node) noexcept;
bool withinBoundary(const State& state, NodeHandle target,
                    const InputContext& input) noexcept;
Proposal proposeTarget(const State& state, NodeHandle target,
                       const InputContext& input) noexcept;
bool stableBefore(const Registry& registry, NodeHandle a, NodeHandle b) noexcept;
Proposal resolveOverride(const State& state, Direction direction,
                         const InputContext& input) noexcept;
Proposal boundaryProposal(const State& state, NodeHandle scope,
                          Direction direction, const InputContext& input,
                          NodeHandle region = {}) noexcept;
bool orderedAxis(const NodeRecord& scope, Direction direction) noexcept;
NodeHandle orderedDestination(const State& state, NodeHandle source,
                              Direction direction, const InputContext& input) noexcept;
Proposal resolve(const State& state, Direction direction,
                 const InputContext& input) noexcept;
std::optional<Rect> regionBounds(const State& state, NodeHandle node,
                                 const InputContext& input) noexcept;
NodeHandle geometricDestination(const State& state, NodeHandle source,
                                Direction direction, const InputContext& input,
                                bool wrap = false) noexcept;
enum class EntryReason { first, returning, adjacent };
struct EntryContext {
  EntryReason reason{EntryReason::first};
  Direction direction{Direction::down};
  std::optional<double> anchor;  // Surface x for up/down, y for left/right.
};
Proposal resolveEntry(const State& state, NodeHandle scope,
                      const InputContext& input, EntryContext entry = {}) noexcept;
Proposal enterDestination(const State& state, NodeHandle target, Direction direction,
                          const InputContext& input) noexcept;
struct RecoveryScope {
  OccurrenceKey key;
  NodeHandle handle;
};
struct RecoveryOrigin {
  SurfaceId surface;
  Revision revision;
  OccurrenceKey occurrence;
  std::int32_t order{};
  std::vector<RecoveryScope> ancestors;  // Nearest first, bounded by registry capacity.
};
// Capture before a related batch. Owned values; allocation failure may throw.
std::optional<RecoveryOrigin> captureRecovery(const State& state);
Proposal resolveRecovery(const State& state, const RecoveryOrigin& origin,
                         const InputContext& input) noexcept;

}  // namespace itar
