#include <itar/batch.hpp>

#include <algorithm>
#include <new>

namespace itar {
namespace {

Validation prepare(const Registry& committed, SurfaceId surface,
                   Revision revision, Batch batch) {
  const auto fail = [](BatchStatus status, std::optional<std::size_t> i = {}) {
    return Validation{status, i, {}};
  };
  if (!surface || batch.surface != surface) {
    return fail(BatchStatus::stale_surface);
  }
  if (batch.expected != revision) {
    return fail(BatchStatus::revision_mismatch);
  }
  if (batch.operations.size() > std::size_t{committed.limits().capacity} * 2) {
    return fail(BatchStatus::capacity);
  }
  for (std::size_t i = 0; i < batch.operations.size(); ++i) {
    const auto& op = batch.operations[i];
    if (!op.key || op.key.value().size() > committed.limits().keyBytes ||
        op.parent.value().size() > committed.limits().keyBytes) {
      return fail(BatchStatus::invalid, i);
    }
    for (std::size_t j = 0; j < i; ++j) {
      if (op.key == batch.operations[j].key) {
        return fail(BatchStatus::duplicate, i);
      }
    }
    const auto existing = committed.find(op.key);
    if (op.kind != MutationKind::erase && !validNavigationConfig(op.record.navigation)) {
      return fail(BatchStatus::invalid, i);
    }
    if (op.kind == MutationKind::insert) {
      if (existing) {
        return fail(BatchStatus::duplicate, i);
      }
    } else if (op.kind == MutationKind::update ||
               op.kind == MutationKind::replace ||
               op.kind == MutationKind::erase) {
      if (!existing) {
        return fail(BatchStatus::missing, i);
      }
      if (existing != op.expected) {
        return fail(BatchStatus::stale_handle, i);
      }
    } else {
      return fail(BatchStatus::invalid, i);
    }
    if (op.kind == MutationKind::update) {
      const auto& previous = *committed.lookup(existing);
      if (op.record.mount.value < previous.mount.value ||
          (op.record.mounted && !previous.mounted &&
           op.record.mount == previous.mount && bool(previous.mount))) {
        return fail(BatchStatus::stale_mount, i);
      }
      if (op.record.mount == previous.mount &&
          measuredGeometry(op.record.geometry.state) &&
          (op.record.geometry.layout.value < previous.geometry.layout.value ||
           op.record.geometry.layout.value <=
               previous.invalidatedThrough.value)) {
        return fail(BatchStatus::geometry, i);
      }
    }
    if (op.kind != MutationKind::erase &&
        ((op.record.mounted && (!op.record.mount || op.record.scope)) ||
         !validGeometry(op.record.geometry, surface, op.record.mount,
                        op.record.mounted, op.record.scope))) {
      return fail(BatchStatus::geometry, i);
    }
  }
  Registry staged = committed;
  for (const auto& op : batch.operations) {
    if (op.kind == MutationKind::erase || op.kind == MutationKind::replace) {
      staged.remove(op.expected);
    }
  }
  for (std::size_t i = 0; i < batch.operations.size(); ++i) {
    const auto& op = batch.operations[i];
    if (op.kind == MutationKind::insert || op.kind == MutationKind::replace) {
      const auto result = staged.insert(op.key, op.record);
      if (result.status != StorageStatus::inserted) {
        return fail(result.status == StorageStatus::exhausted
                        ? BatchStatus::exhausted
                        : BatchStatus::capacity,
                    i);
      }
    } else if (op.kind == MutationKind::update) {
      auto record = op.record;
      const auto& previous = *committed.lookup(op.expected);
      record.invalidatedThrough = record.mount == previous.mount
                                      ? previous.invalidatedThrough
                                      : LayoutRevision{};
      if (record.mount == previous.mount &&
          !measuredGeometry(record.geometry.state)) {
        record.invalidatedThrough.value = std::max(
            record.invalidatedThrough.value, previous.geometry.layout.value);
      }
      staged.replace(op.expected, record);
    }
  }
  for (auto handle : staged.handles()) {
    auto record = *staged.lookup(handle);
    OccurrenceKey parent;
    std::optional<std::size_t> operation;
    const auto old = committed.find(*staged.key(handle));
    if (const auto* previous = committed.lookup(old);
        previous && previous->parent) {
      const auto* key = committed.key(previous->parent);
      if (!key) {
        return fail(BatchStatus::missing_parent);
      }
      parent = *key;
    }
    for (std::size_t i = 0; i < batch.operations.size(); ++i) {
      if (batch.operations[i].key == *staged.key(handle)) {
        parent = batch.operations[i].parent;
        operation = i;
      }
    }
    record.parent = staged.find(parent);
    if (parent && (!record.parent || !staged.lookup(record.parent)->scope)) {
      return fail(BatchStatus::missing_parent, operation);
    }
    staged.replace(handle, record);
  }
  for (auto handle : staged.handles()) {
    auto ancestor = handle;
    for (std::size_t depth = 0;; ++depth) {
      ancestor = staged.lookup(ancestor)->parent;
      if (!ancestor) {
        break;
      }
      if (depth >= staged.size()) {
        return fail(BatchStatus::cycle);
      }
    }
  }
  return {BatchStatus::valid, {}, std::move(staged)};
}

}  // namespace

Validation validateBatch(const Registry& committed, SurfaceId surface,
                         Revision revision, Batch batch) {
  try {
    return prepare(committed, surface, revision, batch);
  } catch (const std::bad_alloc&) {
    return {BatchStatus::resource, {}, {}};
  }
}

}  // namespace itar
