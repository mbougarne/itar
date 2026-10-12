#include <itar/state.hpp>
#include <itar/topology.hpp>

#include <algorithm>
#include <new>

namespace itar {

bool liveFocus(const Registry& registry, FocusState focus) noexcept {
  const auto* record = registry.lookup(focus.node);
  return focus.kind == FocusKind::managed && record && !record->scope &&
         record->mounted && bool(focus.mount) && record->mount == focus.mount;
}

FocusState reconcileFocus(const Registry& registry, FocusState focus) noexcept {
  return focus.kind == FocusKind::managed && !liveFocus(registry, focus)
             ? FocusState{} : focus;
}

void pruneHistory(const Registry& registry, std::vector<ScopeHistory>& history) {
  std::erase_if(history, [&](const ScopeHistory& entry) {
    const auto node = registry.find(entry.occurrence);
    return !node || !descendantOf(registry, node, entry.scope);
  });
}

const OccurrenceKey* State::history(NodeHandle scope) const noexcept {
  for (const auto& entry : committed_.history) {
    if (entry.scope == scope) {
      return &entry.occurrence;
    }
  }
  return nullptr;
}

ObservationStatus State::observeFocus(FocusObservation observation) {
  if (!surface_ || observation.surface != surface_) {
    return ObservationStatus::stale_surface;
  }
  if (observation.channel != FocusChannel::input &&
      observation.channel != FocusChannel::accessibility) {
    return ObservationStatus::invalid;
  }
  auto focus = observation.focus;
  switch (focus.kind) {
    case FocusKind::managed:
      if (!liveFocus(committed_.registry, focus)) {
        return ObservationStatus::stale_handle;
      }
      break;
    case FocusKind::unmanaged:
    case FocusKind::absent:
    case FocusKind::unknown:
      focus.node = {};
      focus.mount = {};
      break;
    default: return ObservationStatus::invalid;
  }
  auto& current = observation.channel == FocusChannel::input
                      ? committed_.inputFocus : committed_.accessibilityFocus;
  if (current == focus) {
    return ObservationStatus::unchanged;
  }
  try {
    // Accessibility focus never supplies input history or activation authority.
    if (observation.channel == FocusChannel::input && focus.kind == FocusKind::managed) {
      auto history = committed_.history;
      history.reserve(committed_.registry.limits().capacity);
      auto parent = committed_.registry.lookup(focus.node)->parent;
      const auto key = *committed_.registry.key(focus.node);
      while (parent) {
        auto entry = std::find_if(history.begin(), history.end(), [&](const ScopeHistory& h) {
          return h.scope == parent;
        });
        if (entry == history.end()) {
          history.push_back({parent, key});
        } else {
          entry->occurrence = key;
        }
        parent = committed_.registry.lookup(parent)->parent;
      }
      committed_.history.swap(history);
    }
    current = focus;
    return ObservationStatus::changed;
  } catch (const std::bad_alloc&) {
    return ObservationStatus::resource;
  }
}

}  // namespace itar
