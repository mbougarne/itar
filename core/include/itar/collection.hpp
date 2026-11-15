#pragma once

#include <itar/transaction.hpp>

namespace itar {

enum class CollectionRowEntry { nearest, first };

// A bounded logical snapshot for the selected fixed-extent VirtualizedList
// adapter. Scope entries are lists; a nested row is also an item of its parent.
// Extents plan scrolling only. They never supply focusable geometry.
struct CollectionNode {
  OccurrenceKey key, parent;
  std::int32_t order{};
  bool scope{}, enabled{true};
  Layout layout{Layout::spatial};
  double extent{};
  // Outer column collections configure vertical entry into their child rails.
  CollectionRowEntry rowEntry{CollectionRowEntry::nearest};
  bool operator==(const CollectionNode&) const = default;
};

enum class CollectionStatus { applied, unchanged, invalid, stale, capacity, conflict, batch_rejected };
struct CollectionResult {
  CollectionStatus status;
  BatchStatus batch{BatchStatus::valid};
  DatasetRevision dataset;
};
struct CollectionStep {
  OccurrenceKey collection, item;
  std::int32_t index{};
  double extent{};
  bool horizontal{};
};

// Read-only policy for adapters that already own atomic registry publication.
// Validate declarations before publication; handles identify the matching live
// registrations in the same order. Neither function mutates state or owns nodes.
bool validCollectionNodes(std::span<const CollectionNode>, RegistryLimits) noexcept;
Proposal proposeCollectionEntry(const State&, std::span<const CollectionNode>,
    std::span<const NodeHandle>, Direction, const InputContext&) noexcept;

// State/transactions outlive this owner. No views, callbacks or renderer state.
// Publication is one validated engine batch plus no-throw metadata swaps.
class Collections {
 public:
  Collections(State& state, Transactions& transactions) : state_(state), transactions_(transactions) {}
  CollectionResult apply(DatasetRevision dataset, std::span<const CollectionNode> nodes);
  const CollectionNode* find(const OccurrenceKey& key) const noexcept;
  DatasetRevision dataset() const noexcept { return dataset_; }
  RequestOptions options(const OccurrenceKey& target, TimePoint deadline) const noexcept;
  Proposal propose(Direction direction, const InputContext& input) const noexcept;
  RequestResult input(Direction direction, const InputContext& input, TimePoint deadline);
  std::vector<CollectionStep> path(NodeHandle target) const;

 private:
  State& state_;
  Transactions& transactions_;
  DatasetRevision dataset_;
  std::vector<CollectionNode> nodes_;
  std::vector<NodeHandle> handles_; // Ownership includes generation, not just key.
};

} // namespace itar
