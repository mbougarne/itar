#pragma once

#include <itar/state.hpp>

namespace itar {

struct MeasuredBounds {
  Rect bounds;
  LayoutRevision layout;
  Revision committed;
};

// Read a single borrowed committed snapshot for the whole candidate traversal.
// The owner must not mutate during traversal. No general occlusion inference.
std::optional<MeasuredBounds> usableGeometry(const Snapshot& snapshot,
                                            SurfaceId surface,
                                            NodeHandle node) noexcept;

}  // namespace itar
