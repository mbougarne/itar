#include <itar/probe/surface.hpp>

namespace itar::probe {
namespace {
bool valid(Target target) noexcept {
  return target.occurrence.value != 0 && target.mount.slot != 0 &&
         target.mount.generation != 0;
}
}  // namespace

Surface::Surface(SurfaceLifetime lifetime, Target a, Target b) noexcept
    : lifetime_(lifetime), targets_{a, b},
      valid_(lifetime.value != 0 && valid(a) && valid(b) &&
             a.occurrence != b.occurrence && a.mount.slot != b.mount.slot) {}

Result Surface::resolve(SurfaceLifetime expected, Observation focus,
                        Direction direction) const noexcept {
  const auto result = [this](Status status) {
    return Result{status, lifetime_, std::nullopt};
  };
  if (disposed_) return result(Status::disposed);
  if (!valid_) return result(Status::invalid);
  if (expected != lifetime_) return result(Status::stale_surface);
  switch (focus.state) {
    case FocusState::unmanaged: return result(Status::unmanaged);
    case FocusState::absent: return result(Status::absent);
    case FocusState::unknown: return result(Status::unknown);
    case FocusState::managed: break;
    default: return result(Status::invalid);
  }
  std::size_t source = targets_.size();
  for (std::size_t i = 0; i < targets_.size(); ++i) {
    if (available_[i] && targets_[i] == focus.target) source = i;
  }
  if (source == targets_.size()) return result(Status::unavailable);
  switch (direction) {
    case Direction::up:
      if (source != 0) return result(Status::boundary);
      break;
    case Direction::down:
      if (source != 1) return result(Status::boundary);
      break;
    case Direction::left:
    case Direction::right: return result(Status::boundary);
    default: return result(Status::invalid);
  }
  const auto destination = 1 - source;
  if (!available_[destination]) return result(Status::unavailable);
  return {Status::proposed, lifetime_, targets_[destination]};
}

bool Surface::invalidate(SurfaceLifetime expected, MountHandle mount) noexcept {
  if (disposed_ || !valid_ || expected != lifetime_) return false;
  for (std::size_t i = 0; i < targets_.size(); ++i) {
    if (targets_[i].mount == mount) {
      available_[i] = false;
      return true;
    }
  }
  return false;
}
}  // namespace itar::probe
