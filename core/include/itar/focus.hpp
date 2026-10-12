#pragma once

#include <itar/host.hpp>
#include <itar/registry.hpp>

namespace itar {

enum class FocusKind { managed, unmanaged, absent, unknown };
enum class FocusChannel { input, accessibility };

struct FocusState {
  FocusKind kind{FocusKind::unknown};
  NodeHandle node;
  MountGeneration mount;
  bool operator==(const FocusState&) const = default;
};

struct FocusObservation {
  SurfaceId surface;
  FocusChannel channel;
  FocusState focus;
};

struct ScopeHistory {
  NodeHandle scope;
  OccurrenceKey
      occurrence;  // Stable logical entry, never a host pointer/index.
};

bool liveFocus(const Registry& registry, FocusState focus) noexcept;
FocusState reconcileFocus(const Registry& registry, FocusState focus) noexcept;
void pruneHistory(const Registry& registry, std::vector<ScopeHistory>& history);

}  // namespace itar
