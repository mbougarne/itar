#pragma once

#include <itar/identity.hpp>
#include <array>

namespace itar {

enum class Direction { left, right, up, down };
enum class Layout { spatial, row, column };
enum class Boundary { stop, wrap, parent };

struct NavigationConfig {
  std::array<NodeHandle, 4> overrides{};  // Generational; never chase a chain.
  Layout layout{Layout::spatial};
  Boundary boundary{Boundary::stop};
  bool rtl{};  // Row order runs from right to left when explicitly enabled.
  bool trap{};
  bool entryReady{true};
  bool restoreOnEntry{}; // Opt-in history/preference instead of adjacent-rail anchoring.
  bool operator==(const NavigationConfig&) const = default;
};

inline bool validNavigationConfig(const NavigationConfig& config) noexcept {
  if ((config.layout != Layout::spatial && config.layout != Layout::row &&
       config.layout != Layout::column) ||
      (config.boundary != Boundary::stop && config.boundary != Boundary::wrap &&
       config.boundary != Boundary::parent)) { return false; }
  for (const auto handle : config.overrides) {
    if (bool(handle.slot) != bool(handle.generation)) { return false; }
  }
  return true;
}

}  // namespace itar
