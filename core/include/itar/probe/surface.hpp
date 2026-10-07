#pragma once

#include <array>
#include <cstdint>
#include <optional>

namespace itar::probe {

// Probe-only value tokens. Native code owns every host view and token mapping.
struct SurfaceLifetime {
  std::uint64_t value{};
  bool operator==(const SurfaceLifetime&) const = default;
};

struct OccurrenceId {
  std::uint64_t value{};
  bool operator==(const OccurrenceId&) const = default;
};

struct MountHandle {
  std::uint32_t slot{};
  std::uint32_t generation{};
  bool operator==(const MountHandle&) const = default;
};

struct Target {
  OccurrenceId occurrence;
  MountHandle mount;
  bool operator==(const Target&) const = default;
};

enum class Direction { up, down, left, right };

enum class FocusState { managed, unmanaged, absent, unknown };

struct Observation {
  FocusState state{FocusState::unknown};
  Target target{};  // Meaningful only for managed input focus.
};

enum class Status {
  proposed, boundary, unmanaged, absent, unknown, unavailable,
  stale_surface, disposed, invalid
};

struct Result {
  Status status;
  SurfaceLifetime surface;
  std::optional<Target> target;  // A proposal, never host confirmation.
  bool operator==(const Result&) const = default;
};

// Deterministic fixture: A is below B. No production policy or registry.
// One serialized owner thread; no callbacks, allocation, clocks or host effects.
class Surface final {
 public:
  Surface(SurfaceLifetime lifetime, Target a, Target b) noexcept;
  Surface(const Surface&) = delete;
  Surface& operator=(const Surface&) = delete;
  Result resolve(SurfaceLifetime expected, Observation focus,
                 Direction direction) const noexcept;
  bool invalidate(SurfaceLifetime expected, MountHandle mount) noexcept;
  void dispose() noexcept { disposed_ = true; }

 private:
  SurfaceLifetime lifetime_;
  std::array<Target, 2> targets_;
  std::array<bool, 2> available_{true, true};
  bool valid_;
  bool disposed_{};
};

}  // namespace itar::probe
