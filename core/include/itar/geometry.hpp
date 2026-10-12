#pragma once

#include <itar/identity.hpp>

namespace itar {

struct Rect {
  double x{}, y{}, width{}, height{};
  bool operator==(const Rect&) const = default;
};

enum class GeometryState { unavailable, dirty, measured, hidden, clipped };

struct Geometry {
  SurfaceId surface;
  MountGeneration mount;
  LayoutRevision layout;
  Rect bounds;
  GeometryState state{GeometryState::unavailable};
  bool operator==(const Geometry&) const = default;
};

}  // namespace itar
