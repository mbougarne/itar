#include <itar/state.hpp>

#include <algorithm>

namespace itar {

ObservationStatus State::observeAvailability(AvailabilityObservation observation) noexcept {
  if (observation.surface != surface_ || !surface_) {
    return ObservationStatus::stale_surface;
  }
  const auto* previous = committed_.registry.lookup(observation.node);
  if (!previous) {
    return ObservationStatus::stale_handle;
  }
  if (!observation.mount || observation.mount != previous->mount) {
    return ObservationStatus::stale_mount;
  }
  auto record = *previous;
  switch (observation.kind) {
    case AvailabilityKind::mount_lost:
      record.mounted = false;
      record.geometry.state = GeometryState::unavailable;
      break;
    case AvailabilityKind::geometry_dirty:
    case AvailabilityKind::geometry_unavailable:
      if (!observation.through) {
        return ObservationStatus::invalid;
      }
      if (!record.mounted || observation.through.value < record.geometry.layout.value ||
          observation.through.value <= record.invalidatedThrough.value) {
        return ObservationStatus::unchanged;
      }
      record.geometry.state = observation.kind == AvailabilityKind::geometry_dirty
                                  ? GeometryState::dirty : GeometryState::unavailable;
      record.invalidatedThrough = observation.through;
      break;
    default: return ObservationStatus::invalid;
  }
  if (record == *previous) {
    return ObservationStatus::unchanged;
  }
  committed_.registry.replace(observation.node, record);
  return ObservationStatus::changed;
}

}  // namespace itar
