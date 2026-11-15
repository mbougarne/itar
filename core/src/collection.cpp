#include <itar/collection.hpp>

#include <algorithm>
#include <cmath>

namespace itar {

const CollectionNode* Collections::find(const OccurrenceKey& key) const noexcept {
  const auto found = std::find_if(nodes_.begin(), nodes_.end(), [&](const auto& value) { return value.key == key; });
  if (found == nodes_.end()) { return nullptr; }
  const auto index = static_cast<std::size_t>(found - nodes_.begin());
  return state_.snapshot().registry.find(key) == handles_[index] ? &*found : nullptr;
}

CollectionResult Collections::apply(DatasetRevision dataset, std::span<const CollectionNode> nodes) {
  const auto result = [&](CollectionStatus status, BatchStatus batch = BatchStatus::valid) {
    return CollectionResult{status, batch, dataset_};
  };
  if (!dataset) { return result(CollectionStatus::invalid); }
  if (dataset == dataset_ && nodes.size() == nodes_.size() && std::equal(nodes.begin(), nodes.end(), nodes_.begin())) {
    const auto& registry = state_.snapshot().registry;
    for (std::size_t i = 0; i < nodes_.size(); ++i) {
      if (registry.find(nodes_[i].key) != handles_[i]) { return result(CollectionStatus::stale); }
    }
    return result(CollectionStatus::unchanged);
  }
  if (dataset.value <= dataset_.value) { return result(CollectionStatus::stale); }
  const auto& registry = state_.snapshot().registry;
  if (nodes.size() > registry.limits().capacity) { return result(CollectionStatus::capacity); }
  const auto lookup = [&](const OccurrenceKey& key) -> const CollectionNode* {
    const auto found = std::find_if(nodes.begin(), nodes.end(), [&](const auto& value) { return value.key == key; });
    return found == nodes.end() ? nullptr : &*found;
  };
  for (std::size_t i = 0; i < nodes.size(); ++i) {
    const auto& value = nodes[i];
    if ((value.rowEntry != CollectionRowEntry::nearest && value.rowEntry != CollectionRowEntry::first) ||
        (value.rowEntry == CollectionRowEntry::first &&
         (!value.scope || value.layout != Layout::column || lookup(value.parent)))) {
      return result(CollectionStatus::invalid);
    }
    if (!value.key || value.key.value().size() > registry.limits().keyBytes ||
        value.parent.value().size() > registry.limits().keyBytes || value.order < 0 ||
        !std::isfinite(value.extent) ||
        (value.scope ? (value.extent <= 0 || value.extent > 1'000'000 ||
                       (value.layout != Layout::row && value.layout != Layout::column))
                     : (value.extent != 0 || value.layout != Layout::spatial))) { return result(CollectionStatus::invalid); }
    if (std::any_of(nodes.begin(), nodes.begin() + i, [&](const auto& old) { return old.key == value.key; })) {
      return result(CollectionStatus::invalid);
    }
    const auto* parent = lookup(value.parent);
    if ((!value.scope && !parent) || (parent && !parent->scope)) { return result(CollectionStatus::invalid); }
    auto ancestor = parent;
    std::size_t depth = value.scope ? 1 : 0;
    while (ancestor) {
      if (++depth > 2) { return result(CollectionStatus::invalid); }
      ancestor = lookup(ancestor->parent);
    }
    if (const auto existing = registry.find(value.key); existing && !find(value.key)) {
      return result(CollectionStatus::conflict);
    }
    if (const auto* previous = find(value.key); previous && previous->scope != value.scope) {
      return result(CollectionStatus::invalid);
    }
  }
  for (const auto& list : nodes) {
    if (!list.scope) { continue; }
    const auto count = std::count_if(nodes.begin(), nodes.end(), [&](const auto& value) { return value.parent == list.key; });
    for (const auto& value : nodes) {
      if (value.parent != list.key) { continue; }
      if (value.order >= count || std::count_if(nodes.begin(), nodes.end(), [&](const auto& other) {
            return other.parent == list.key && other.order == value.order;
          }) != 1) { return result(CollectionStatus::invalid); }
    }
  }
  // Prepare every allocation before publishing the new graph or revision.
  std::vector<CollectionNode> prepared(nodes.begin(), nodes.end());
  std::vector<NodeHandle> preparedHandles(nodes.size());
  std::vector<Mutation> mutations;
  mutations.reserve(nodes_.size() + nodes.size());
  for (std::size_t i = 0; i < nodes_.size(); ++i) {
    const auto& old = nodes_[i];
    if (lookup(old.key)) { continue; }
    const auto existing = registry.find(old.key);
    if (existing && existing == handles_[i]) {
      Mutation erase;
      erase.kind = MutationKind::erase; erase.key = old.key; erase.expected = existing;
      mutations.push_back(std::move(erase));
    }
  }
  for (const auto& value : nodes) {
    Mutation mutation;
    mutation.key = value.key; mutation.parent = value.parent;
    mutation.expected = registry.find(value.key);
    mutation.kind = mutation.expected ? MutationKind::update : MutationKind::insert;
    if (const auto* old = registry.lookup(mutation.expected)) { mutation.record = *old; }
    mutation.record.scope = value.scope;
    mutation.record.enabled = value.enabled;
    mutation.record.order = value.order;
    if (value.scope) {
      mutation.record.navigation.layout = value.layout;
      mutation.record.navigation.boundary = Boundary::parent;
    }
    mutations.push_back(std::move(mutation));
  }
  const auto applied = transactions_.apply({state_.surface(), state_.snapshot().revision, mutations});
  if (applied.status != BatchStatus::valid) { return result(CollectionStatus::batch_rejected, applied.status); }
  if (const auto& active = transactions_.active(); active &&
      (std::find(handles_.begin(), handles_.end(), active->target) != handles_.end() || lookup(active->targetKey))) {
    transactions_.cancel(active->id);
  }
  for (std::size_t i = 0; i < nodes.size(); ++i) {
    preparedHandles[i] = state_.snapshot().registry.find(nodes[i].key);
  }
  nodes_.swap(prepared);
  handles_.swap(preparedHandles);
  dataset_ = dataset;
  return result(CollectionStatus::applied);
}

RequestOptions Collections::options(const OccurrenceKey& target, TimePoint deadline) const noexcept {
  return find(target) ? RequestOptions{deadline, dataset_, ResourceId{1}, {}}
                      : RequestOptions{deadline, DatasetRevision{1}, {}, {}};
}

Proposal Collections::propose(Direction direction, const InputContext& input) const noexcept {
  auto proposal = resolve(state_, direction, input);
  if ((direction != Direction::up && direction != Direction::down) ||
      (proposal.kind != ProposalKind::ready && proposal.kind != ProposalKind::reveal) ||
      proposal.reason == ProposalReason::override_target) { return proposal; }
  const auto& registry = state_.snapshot().registry;
  const auto* sourceKey = registry.key(input.source.node);
  const auto* targetKey = registry.key(proposal.target);
  const auto* source = sourceKey ? find(*sourceKey) : nullptr;
  const auto* target = targetKey ? find(*targetKey) : nullptr;
  const auto* sourceRow = source ? find(source->parent) : nullptr;
  const auto* targetRow = target ? find(target->parent) : nullptr;
  // Cross-row entry is logical, independent of which target cells are mounted.
  if (!sourceRow || !targetRow || sourceRow == targetRow ||
      sourceRow->layout != Layout::row || targetRow->layout != Layout::row ||
      !sourceRow->parent || sourceRow->parent != targetRow->parent) { return proposal; }
  const auto* collection = find(targetRow->parent);
  const auto entryOrder = collection && collection->rowEntry == CollectionRowEntry::first ? 0 : source->order;
  const CollectionNode* best = nullptr;
  for (const auto& item : nodes_) {
    if (item.parent != targetRow->key || item.scope || !find(item.key) ||
        !logicalTarget(state_, registry.find(item.key))) { continue; }
    const auto distance = std::abs(std::int64_t{item.order} - entryOrder);
    if (!best || distance < std::abs(std::int64_t{best->order} - entryOrder) ||
        (distance == std::abs(std::int64_t{best->order} - entryOrder) && item.order < best->order)) { best = &item; }
  }
  return best ? proposeTarget(state_, registry.find(best->key), input) : proposal;
}

RequestResult Collections::input(Direction direction, const InputContext& input, TimePoint deadline) {
  const auto proposal = propose(direction, input);
  const auto* key = state_.snapshot().registry.key(proposal.target);
  auto requestOptions = options(key ? *key : OccurrenceKey{}, deadline);
  return transactions_.directionalInput(direction, input, requestOptions, proposal);
}

std::vector<CollectionStep> Collections::path(NodeHandle target) const {
  std::vector<CollectionStep> steps;
  const auto* key = state_.snapshot().registry.key(target);
  auto item = key ? find(*key) : nullptr;
  for (std::size_t depth = 0; item && depth < 2; ++depth) {
    const auto* list = find(item->parent);
    if (!list || !list->scope) { break; }
    steps.push_back({list->key, item->key, item->order, list->extent, list->layout == Layout::row});
    item = list;
  }
  std::reverse(steps.begin(), steps.end());
  return steps;
}

} // namespace itar
