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
  bool operator==(const NavigationConfig&) const = default;
};

}  // namespace itar
