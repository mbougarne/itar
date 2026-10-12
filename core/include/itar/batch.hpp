#pragma once

#include <itar/registry.hpp>

#include <span>

namespace itar {

enum class MutationKind { insert, update, replace, erase };

struct Mutation {
  MutationKind kind{MutationKind::insert};
  OccurrenceKey key;
  NodeHandle expected;  // Required for update, replacement and deletion.
  OccurrenceKey
      parent;         // Empty means surface root; resolved in final topology.
  NodeRecord record;  // parent handle is resolved from the key, never trusted.
};

struct Batch {
  SurfaceId surface;
  Revision expected;
  std::span<const Mutation> operations;
};

enum class BatchStatus {
  valid,
  stale_surface,
  revision_mismatch,
  invalid,
  duplicate,
  missing,
  stale_handle,
  missing_parent,
  cycle,
  geometry,
  capacity,
  exhausted,
  resource,
  revision_exhausted,
  stale_mount
};

struct Validation {
  BatchStatus status{BatchStatus::valid};
  // Bounded context: index into caller-owned operations, no copied diagnostics.
  std::optional<std::size_t> operation;
  std::optional<Registry> prepared;
};

// No mutation, focus state, notifications or effects. Allocation failure is
// data.
Validation validateBatch(const Registry& committed, SurfaceId surface,
                         Revision revision, Batch batch);

}  // namespace itar
