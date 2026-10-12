#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include <cmath>

namespace itar {

bool measuredGeometry(GeometryState state) noexcept {
  return state == GeometryState::measured || state == GeometryState::hidden ||
         state == GeometryState::clipped;
}

bool validGeometry(const Geometry& geometry, SurfaceId surface,
                   MountGeneration mount, bool mounted, bool scope) noexcept {
  if (geometry.state == GeometryState::unavailable ||
      geometry.state == GeometryState::dirty) {
    return true;
  }
  const auto& r = geometry.bounds;
  return measuredGeometry(geometry.state) && mounted && !scope &&
         bool(geometry.layout) && bool(surface) && geometry.surface == surface &&
         geometry.mount == mount && std::isfinite(r.x) && std::isfinite(r.y) &&
         std::isfinite(r.width) && std::isfinite(r.height) && r.width > 0 &&
         r.height > 0 && std::isfinite(r.x + r.width) && std::isfinite(r.y + r.height);
}

std::optional<MeasuredBounds> usableGeometry(const Snapshot& snapshot,
                                            SurfaceId surface,
                                            NodeHandle node) noexcept {
  const auto* record = snapshot.registry.lookup(node);
  if (!record || !record->enabled || !effectivelyActive(snapshot.registry, node) ||
      record->geometry.state != GeometryState::measured ||
      record->geometry.layout.value <= record->invalidatedThrough.value ||
      !validGeometry(record->geometry, surface, record->mount,
                     record->mounted, record->scope)) {
    return {};
  }
  return MeasuredBounds{record->geometry.bounds, record->geometry.layout,
                        snapshot.revision};
}

}  // namespace itar
