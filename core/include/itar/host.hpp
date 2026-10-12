#pragma once

#include <itar/identity.hpp>

namespace itar {

enum class AvailabilityKind { mount_lost, geometry_dirty, geometry_unavailable };

struct AvailabilityObservation {
  SurfaceId surface;
  NodeHandle node;
  MountGeneration mount;
  AvailabilityKind kind;
  LayoutRevision through;  // Invalidate all measurements up to this host epoch.
};

enum class ObservationStatus {
  changed, unchanged, stale_surface, stale_handle, stale_mount, invalid, resource
};

}  // namespace itar
