#include <itar/navigation.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include <algorithm>
#include <cmath>
#include <tuple>

namespace itar {

std::optional<Rect> regionBounds(const State& state, NodeHandle node,
                                 const InputContext& input) noexcept {
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(node);
  if (!record || !record->enabled || !effectivelyActive(registry, node)) { return {}; }
  if (!record->scope) {
    const auto geometry = usableGeometry(state.snapshot(), state.surface(), node);
    return geometry ? std::optional{geometry->bounds} : std::nullopt;
  }
  std::optional<Rect> bounds;
  for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
    const auto child = registry.handleAt(i);
    if (!logicalTarget(state, child) || !descendantOf(registry, child, node) ||
        !withinBoundary(state, child, input)) { continue; }
    const auto geometry = usableGeometry(state.snapshot(), state.surface(), child);
    if (!geometry) { continue; }
    const auto r = geometry->bounds;
    if (!bounds) { bounds = r; continue; }
    const auto right = std::max(bounds->x + bounds->width, r.x + r.width);
    const auto bottom = std::max(bounds->y + bounds->height, r.y + r.height);
    bounds->x = std::min(bounds->x, r.x);
    bounds->y = std::min(bounds->y, r.y);
    bounds->width = right - bounds->x;
    bounds->height = bottom - bounds->y;
    if (!std::isfinite(bounds->width) || !std::isfinite(bounds->height)) { return {}; }
  }
  return bounds;
}

NodeHandle geometricDestination(const State& state, NodeHandle source,
                                Direction direction, const InputContext& input,
                                bool wrap) noexcept {
  if (static_cast<std::size_t>(direction) >= 4) { return {}; }
  const auto& registry = state.snapshot().registry;
  const auto* record = registry.lookup(source);
  const auto from = regionBounds(state, source, input);
  if (!record || !from) { return {}; }
  const bool horizontal = direction == Direction::left || direction == Direction::right;
  const bool positive = direction == Direction::right || direction == Direction::down;
  // Long doubles keep finite double rectangles from overflowing score arithmetic.
  const auto axes = [horizontal](Rect r) {
    return horizontal ? std::array<long double, 4>{r.x, r.width, r.y, r.height}
                      : std::array<long double, 4>{r.y, r.height, r.x, r.width};
  };
  const auto a = axes(*from);
  using Rank = std::tuple<long double, long double, long double>;
  Rank bestRank;
  NodeHandle best;
  for (std::size_t i = 0; i < registry.limits().capacity; ++i) {
    const auto node = registry.handleAt(i);
    const auto* candidate = registry.lookup(node);
    if (!candidate || candidate->parent != record->parent || node == source) { continue; }
    if (!candidate->scope && (!logicalTarget(state, node) ||
                             !withinBoundary(state, node, input))) { continue; }
    const auto bounds = regionBounds(state, node, input);
    if (!bounds) { continue; }
    const auto b = axes(*bounds);
    const auto delta = (b[0] + b[1] / 2) - (a[0] + a[1] / 2);
    if (!wrap && (positive ? delta <= 0 : delta >= 0)) { continue; }
    const auto forward = std::max(0.0L, positive ? b[0] - (a[0] + a[1])
                                               : a[0] - (b[0] + b[1]));
    const auto gap = std::max({0.0L, b[2] - (a[2] + a[3]), a[2] - (b[2] + b[3])});
    const auto perpendicular = std::abs((b[2] + b[3] / 2) - (a[2] + a[3] / 2));
    const Rank rank = wrap ? Rank{positive ? b[0] : -(b[0] + b[1]), gap, perpendicular}
                           : Rank{forward + 2 * gap + perpendicular / 4,
                                  forward, perpendicular};
    if (!best || rank < bestRank ||
        (rank == bestRank && stableBefore(registry, node, best))) {
      best = node;
      bestRank = rank;
    }
  }
  return best;
}

}  // namespace itar
