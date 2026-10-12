#include <itar/registry.hpp>

namespace itar {

Registry::Registry(RegistryLimits limits)
    : limits_(limits), slots_(limits.capacity), keys_(limits.capacity) {}

InsertResult Registry::insert(const OccurrenceKey& key, NodeRecord record) {
  if (!key || key.value().size() > limits_.keyBytes ||
      !limits_.generationCeiling) {
    return {StorageStatus::invalid, {}};
  }
  if (find(key)) {
    return {StorageStatus::duplicate, {}};
  }
  for (std::size_t i = 0; i < slots_.size(); ++i) {
    auto& slot = slots_[i];
    if (!slot.record && !slot.retired) {
      keys_[i] = key;  // Prepare the only allocating field before publication.
      slot.record = record;
      ++size_;
      return {StorageStatus::inserted,
              {NodeId{static_cast<std::uint32_t>(i + 1)}, slot.generation}};
    }
  }
  return {size_ == slots_.size() ? StorageStatus::capacity
                                 : StorageStatus::exhausted,
          {}};
}

const NodeRecord* Registry::lookup(NodeHandle handle) const noexcept {
  if (!handle || handle.slot.value > slots_.size()) {
    return nullptr;
  }
  const auto& slot = slots_[handle.slot.value - 1];
  return slot.generation == handle.generation && slot.record ? &*slot.record
                                                             : nullptr;
}

bool Registry::remove(NodeHandle handle) noexcept {
  if (!lookup(handle)) {
    return false;
  }
  auto& slot = slots_[handle.slot.value - 1];
  slot.record.reset();
  keys_[handle.slot.value - 1] = {};
  --size_;
  if (slot.generation.value == limits_.generationCeiling) {
    slot.retired = true;
  } else {
    ++slot.generation.value;
  }
  return true;
}

bool Registry::replace(NodeHandle handle, NodeRecord record) noexcept {
  if (!lookup(handle)) {
    return false;
  }
  slots_[handle.slot.value - 1].record = record;
  return true;
}

NodeHandle Registry::find(const OccurrenceKey& key) const noexcept {
  if (!key) {
    return {};
  }
  for (std::size_t i = 0; i < slots_.size(); ++i) {
    if (slots_[i].record && keys_[i] == key) {
      return {NodeId{static_cast<std::uint32_t>(i + 1)}, slots_[i].generation};
    }
  }
  return {};
}

const OccurrenceKey* Registry::key(NodeHandle handle) const noexcept {
  return lookup(handle) ? &keys_[handle.slot.value - 1] : nullptr;
}

std::vector<NodeHandle> Registry::handles() const {
  std::vector<NodeHandle> result;
  result.reserve(size_);
  for (std::size_t i = 0; i < slots_.size(); ++i) {
    if (slots_[i].record) {
      result.push_back(
          {NodeId{static_cast<std::uint32_t>(i + 1)}, slots_[i].generation});
    }
  }
  return result;
}

}  // namespace itar
