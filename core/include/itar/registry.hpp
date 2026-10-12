#pragma once

#include <itar/identity.hpp>

#include <limits>
#include <optional>
#include <vector>

namespace itar {

struct NodeRecord {
  NodeHandle parent;
  std::int32_t order{};
  bool scope{};
  bool active{true};
  bool enabled{true};
  MountGeneration mount;
  bool mounted{};
  bool operator==(const NodeRecord&) const = default;
};

enum class StorageStatus { inserted, duplicate, invalid, capacity, exhausted };

struct InsertResult {
  StorageStatus status;
  NodeHandle handle;
};

struct RegistryLimits {
  std::uint32_t capacity{256};
  std::size_t keyBytes{512};
  // Smaller limits permit deterministic exhaustion fixtures.
  std::uint32_t generationCeiling{std::numeric_limits<std::uint32_t>::max()};
};

// Owned hot slots and separately stored cold keys. No host object ownership.
// Serialized owner only. Borrowed records expire at mutation or destruction.
class Registry {
 public:
  explicit Registry(RegistryLimits limits = {});
  InsertResult insert(const OccurrenceKey& key, NodeRecord record = {});
  bool remove(NodeHandle handle) noexcept;
  const NodeRecord* lookup(NodeHandle handle) const noexcept;
  bool replace(NodeHandle handle, NodeRecord record) noexcept;
  NodeHandle find(const OccurrenceKey& key) const noexcept;
  const OccurrenceKey* key(NodeHandle handle) const noexcept;
  std::vector<NodeHandle> handles() const;
  std::size_t size() const noexcept { return size_; }
  RegistryLimits limits() const noexcept { return limits_; }

 private:
  struct Slot {
    Generation generation{1};
    std::optional<NodeRecord> record;
    bool retired{};
  };

  RegistryLimits limits_;
  std::vector<Slot> slots_;
  std::vector<OccurrenceKey> keys_;
  std::size_t size_{};
};

}  // namespace itar
