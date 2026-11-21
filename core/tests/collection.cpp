#include <itar/collection.hpp>

#include <array>
#include <limits>

#include "check.hpp"

using namespace itar;

struct Fixture {
  State state{SurfaceId{1}, {12}};
  Transactions tx{state, SurfaceLifetime{7}};
  Collections collections{state, tx};
  std::vector<CollectionNode> nodes{
      {OccurrenceKey{"list"}, {}, 0, true, true, Layout::row, 100},
      {OccurrenceKey{"a"}, OccurrenceKey{"list"}, 0},
      {OccurrenceKey{"b"}, OccurrenceKey{"list"}, 1}};
  Fixture() { CHECK(collections.apply(DatasetRevision{1}, nodes).status == CollectionStatus::applied); }
  NodeHandle node(const char* key) { return state.snapshot().registry.find(OccurrenceKey{key}); }
  void mount(const char* key, std::uint64_t generation) {
    Mutation mutation;
    mutation.key = OccurrenceKey{key}; mutation.kind = MutationKind::update; mutation.expected = node(key);
    mutation.parent = *state.snapshot().registry.key(state.snapshot().registry.lookup(mutation.expected)->parent);
    mutation.record = *state.snapshot().registry.lookup(mutation.expected);
    mutation.record.mounted = true; mutation.record.mount = MountGeneration{generation};
    mutation.record.geometry = {state.surface(), mutation.record.mount, LayoutRevision{generation},
        {0, 0, 80, 60}, GeometryState::measured};
    CHECK(tx.apply({state.surface(), state.snapshot().revision, std::span{&mutation, 1}}).status == BatchStatus::valid);
  }
  InputContext input() { return {state.surface(), {}, InputOwner::engine, state.snapshot().inputFocus}; }
};

void membershipAndAtomicity() {
  Fixture f;
  const auto original = f.state.snapshot().revision;
  CHECK(f.collections.apply(DatasetRevision{1}, f.nodes).status == CollectionStatus::unchanged);
  CHECK(f.state.snapshot().revision == original);
  CHECK(f.state.snapshot().registry.lookup(f.node("b"))->mounted == false);
  CHECK(f.collections.options(OccurrenceKey{"b"}, 500).resource == ResourceId{1});
  auto invalid = f.nodes;
  invalid.push_back(invalid.back());
  CHECK(f.collections.apply(DatasetRevision{2}, invalid).status == CollectionStatus::invalid);
  CHECK(f.collections.dataset() == DatasetRevision{1} && f.state.snapshot().revision == original);
  invalid = f.nodes; invalid[2].order = 0;
  CHECK(f.collections.apply(DatasetRevision{2}, invalid).status == CollectionStatus::invalid);
  invalid = f.nodes; invalid[0].extent = std::numeric_limits<double>::infinity();
  CHECK(f.collections.apply(DatasetRevision{2}, invalid).status == CollectionStatus::invalid);
  invalid = f.nodes; invalid[0].parent = OccurrenceKey{"missing"};
  CHECK(f.collections.apply(DatasetRevision{2}, invalid).status == CollectionStatus::batch_rejected);
  CHECK(f.collections.dataset() == DatasetRevision{1} && f.state.snapshot().revision == original);
}

void realizationAndRevision() {
  Fixture f;
  f.mount("a", 1);
  CHECK(f.tx.observeHost({SurfaceLifetime{7}, {f.state.surface(), FocusChannel::input,
      {FocusKind::managed, f.node("a"), MountGeneration{1}}}, {}}).status == RequestStatus::unchanged);
  const auto request = f.tx.requestFocus(OccurrenceKey{"b"}, f.input(), f.collections.options(OccurrenceKey{"b"}, 500));
  CHECK(request.status == RequestStatus::started);
  const auto reveal = f.tx.drainEffects()[0];
  CHECK(reveal.token.kind == EffectKind::reveal && reveal.dataset == DatasetRevision{1});
  CHECK(f.tx.issue(reveal.token).status == RequestStatus::issued);
  f.mount("b", 2);
  CHECK(f.tx.active() && f.tx.active()->id == request.request);
  CHECK(f.tx.realize({reveal.token, f.state.surface(), f.node("b"), MountGeneration{2}, DatasetRevision{2}, true}).status == RequestStatus::stale);
  CHECK(f.tx.realize({reveal.token, f.state.surface(), f.node("b"), MountGeneration{2}, DatasetRevision{1}, true}).status == RequestStatus::started);
  CHECK(f.tx.drainEffects()[0].token.kind == EffectKind::focus);
  std::swap(f.nodes[1].order, f.nodes[2].order);
  CHECK(f.collections.apply(DatasetRevision{2}, f.nodes).status == CollectionStatus::applied);
  CHECK(!f.tx.active());
  CHECK(f.state.snapshot().inputFocus.node == f.node("a"));
  CHECK(f.state.snapshot().registry.lookup(f.node("b"))->mount == MountGeneration{2});
  CHECK(f.tx.realize({reveal.token, f.state.surface(), f.node("b"), MountGeneration{2}, DatasetRevision{1}, true}).status == RequestStatus::stale);
  CHECK(f.collections.apply(DatasetRevision{1}, f.nodes).status == CollectionStatus::stale);
}

void nestedPathsAndDeletion() {
  Fixture f;
  std::vector<CollectionNode> nested{
      {OccurrenceKey{"outer"}, {}, 0, true, true, Layout::column, 120},
      {OccurrenceKey{"row"}, OccurrenceKey{"outer"}, 0, true, true, Layout::row, 100},
      {OccurrenceKey{"item"}, OccurrenceKey{"row"}, 0}};
  CHECK(f.collections.apply(DatasetRevision{2}, nested).status == CollectionStatus::applied);
  CHECK(!f.node("a") && !f.node("list"));
  const auto item = f.node("item");
  const auto path = f.collections.path(item);
  CHECK(path.size() == 2 && path[0].collection == OccurrenceKey{"outer"} && path[1].collection == OccurrenceKey{"row"});
  CHECK(!path[0].horizontal && path[1].horizontal && path[1].index == 0);
  CHECK(f.collections.apply(DatasetRevision{3}, {}).status == CollectionStatus::applied);
  CHECK(!f.state.snapshot().registry.lookup(item) && f.collections.path(item).empty());
  CHECK(f.collections.apply(DatasetRevision{4}, nested).status == CollectionStatus::applied);
  CHECK(f.node("item") != item);
  CHECK(f.collections.path(item).empty());
}

void hostFactsAndConflicts() {
  Fixture f;
  f.mount("a", 1);
  CHECK(f.tx.observeAvailability({f.state.surface(), f.node("a"), MountGeneration{1},
      AvailabilityKind::mount_lost, {}}) == ObservationStatus::changed);
  auto invalid = f.nodes; invalid.push_back(invalid.back());
  CHECK(f.collections.apply(DatasetRevision{2}, invalid).status == CollectionStatus::invalid);
  CHECK(!f.state.snapshot().registry.lookup(f.node("a"))->mounted);
  CHECK(f.collections.apply(DatasetRevision{2}, f.nodes).status == CollectionStatus::applied);
  CHECK(!f.state.snapshot().registry.lookup(f.node("a"))->mounted);
  Mutation foreign; foreign.key = OccurrenceKey{"foreign"};
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&foreign, 1}}).status == BatchStatus::valid);
  auto conflicting = f.nodes; conflicting[2].key = foreign.key;
  const auto revision = f.state.snapshot().revision;
  CHECK(f.collections.apply(DatasetRevision{3}, conflicting).status == CollectionStatus::conflict);
  CHECK(f.state.snapshot().revision == revision && f.collections.dataset() == DatasetRevision{2});
}

void nestedColumnAndSupersession() {
  Fixture f;
  std::vector<CollectionNode> nodes{{OccurrenceKey{"outer"}, {}, 0, true, true, Layout::column, 120}};
  for (int row = 0; row < 3; ++row) {
    const auto rowKey = OccurrenceKey{"row-" + std::to_string(row)};
    nodes.push_back({rowKey, OccurrenceKey{"outer"}, row, true, true, Layout::row, 100});
    for (int item = 0; item < 2; ++item) {
      nodes.push_back({OccurrenceKey{"item-" + std::to_string(row) + "-" + std::to_string(item)}, rowKey, item});
    }
  }
  CHECK(f.collections.apply(DatasetRevision{2}, nodes).status == CollectionStatus::applied);
  f.mount("item-0-1", 1);
  const FocusState source{FocusKind::managed, f.node("item-0-1"), MountGeneration{1}};
  CHECK(f.tx.observeHost({SurfaceLifetime{7}, {f.state.surface(), FocusChannel::input, source}, {}}).status == RequestStatus::unchanged);
  const auto down = f.collections.input(Direction::down, f.input(), 500);
  CHECK(down.status == RequestStatus::started && f.tx.active()->targetKey == OccurrenceKey{"item-1-1"});
  const auto reveal = f.tx.drainEffects()[0];
  CHECK(f.tx.issue(reveal.token).status == RequestStatus::issued);
  for (int repeat = 0; repeat < 1000; ++repeat) {
    CHECK(f.collections.input(Direction::down, f.input(), 900).status == RequestStatus::joined);
  }
  CHECK(f.tx.active()->deadline == 500 && f.tx.active()->id == down.request && f.tx.drainEffects().empty());
  const auto left = f.collections.input(Direction::left, f.input(), 800);
  CHECK(left.status == RequestStatus::started && f.tx.active()->targetKey == OccurrenceKey{"item-0-0"});
  const auto replacement = f.tx.drainEffects();
  CHECK(replacement.size() == 2 && replacement[0].token.kind == EffectKind::cancel);
  CHECK(f.tx.issue(replacement[0].token).status == RequestStatus::issued);
  CHECK(f.tx.issue(replacement[1].token).status == RequestStatus::waiting);
  CHECK(f.tx.complete({replacement[0].token, OutcomeKind::cancelled, {}}).status == RequestStatus::reconciled);
  CHECK(f.tx.issue(replacement[1].token).status == RequestStatus::issued);
  CHECK(f.tx.realize({reveal.token, f.state.surface(), reveal.target, MountGeneration{2}, DatasetRevision{2}, true}).status == RequestStatus::stale);
  CHECK(f.state.snapshot().inputFocus == source);
  CHECK(f.tx.advanceTo(800).status == RequestStatus::expired && !f.tx.active());
  CHECK(f.state.snapshot().inputFocus == source);
  auto reader = f.input(); reader.owner = InputOwner::accessibility;
  CHECK(f.collections.input(Direction::right, reader, 1000).status == RequestStatus::unavailable);
}
void foreignReplacementSurvivesRetirement() {
  Fixture f;
  const auto old = f.node("b");
  Mutation erase; erase.kind = MutationKind::erase; erase.key = OccurrenceKey{"b"}; erase.expected = old;
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&erase, 1}}).status == BatchStatus::valid);
  Mutation insert; insert.key = OccurrenceKey{"b"};
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&insert, 1}}).status == BatchStatus::valid);
  const auto replacement = f.node("b");
  CHECK(replacement != old && !f.collections.find(OccurrenceKey{"b"}));
  CHECK(f.collections.path(replacement).empty());
  CHECK(f.collections.apply(DatasetRevision{1}, f.nodes).status == CollectionStatus::stale);
  CHECK(f.collections.apply(DatasetRevision{2}, f.nodes).status == CollectionStatus::conflict);
  CHECK(f.collections.apply(DatasetRevision{2}, {}).status == CollectionStatus::applied);
  CHECK(f.node("b") == replacement);
}

void configurableRowEntry() {
  Fixture f;
  std::vector<CollectionNode> nodes{{OccurrenceKey{"outer"}, {}, 0, true, true, Layout::column, 120}};
  nodes[0].rowEntry = CollectionRowEntry::first;
  for (int row = 0; row < 3; ++row) {
    const auto key = OccurrenceKey{"row-" + std::to_string(row)};
    nodes.push_back({key, OccurrenceKey{"outer"}, row, true, true, Layout::row, 100});
    for (int item = 0; item < 2; ++item) {
      nodes.push_back({OccurrenceKey{"item-" + std::to_string(row) + "-" + std::to_string(item)}, key, item});
    }
  }
  CHECK(f.collections.apply(DatasetRevision{2}, nodes).status == CollectionStatus::applied);
  f.mount("item-1-1", 1);
  f.mount("item-2-1", 2); // Mounting the later card must not change logical first entry.
  CHECK(f.tx.observeHost({SurfaceLifetime{7}, {f.state.surface(), FocusChannel::input,
      {FocusKind::managed, f.node("item-1-1"), MountGeneration{1}}}, {}}).status == RequestStatus::unchanged);
  CHECK(f.collections.propose(Direction::down, f.input()).target == f.node("item-2-0"));
  CHECK(f.collections.propose(Direction::down, f.input()).kind == ProposalKind::reveal);
  CHECK(f.collections.propose(Direction::up, f.input()).target == f.node("item-0-0"));
  CHECK(f.collections.propose(Direction::left, f.input()).target == f.node("item-1-0"));
  auto reader = f.input(); reader.owner = InputOwner::accessibility;
  CHECK(f.collections.propose(Direction::down, reader).kind == ProposalKind::host_owned);

  nodes[8].enabled = false;
  CHECK(f.collections.apply(DatasetRevision{3}, nodes).status == CollectionStatus::applied);
  CHECK(f.collections.propose(Direction::down, f.input()).target == f.node("item-2-1"));
  nodes[9].enabled = false;
  CHECK(f.collections.apply(DatasetRevision{4}, nodes).status == CollectionStatus::applied);
  const auto empty = f.collections.propose(Direction::down, f.input());
  CHECK(empty.kind != ProposalKind::ready && empty.kind != ProposalKind::reveal);

  nodes[8].enabled = nodes[9].enabled = true;
  CHECK(f.collections.apply(DatasetRevision{5}, nodes).status == CollectionStatus::applied);
  Mutation override;
  override.kind = MutationKind::update; override.key = OccurrenceKey{"item-1-1"};
  override.expected = f.node("item-1-1"); override.parent = OccurrenceKey{"row-1"};
  override.record = *f.state.snapshot().registry.lookup(override.expected);
  override.record.navigation.overrides[3] = f.node("item-0-1");
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&override, 1}}).status == BatchStatus::valid);
  CHECK(f.collections.propose(Direction::down, f.input()).target == f.node("item-0-1"));
  override.record.navigation.overrides = {};
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&override, 1}}).status == BatchStatus::valid);

  const auto restored = f.tx.restoreFocus(OccurrenceKey{"item-2-1"}, f.input(),
      f.collections.options(OccurrenceKey{"item-2-1"}, 400));
  CHECK(restored.status == RequestStatus::started && f.tx.active()->targetKey == OccurrenceKey{"item-2-1"});
  CHECK(f.tx.cancel(restored.request).status == RequestStatus::cancelled);

  const auto request = f.collections.input(Direction::down, f.input(), 500);
  CHECK(request.status == RequestStatus::started && f.tx.active()->targetKey == OccurrenceKey{"item-2-0"});
  nodes[0].rowEntry = CollectionRowEntry::nearest;
  CHECK(f.collections.apply(DatasetRevision{5}, nodes).status == CollectionStatus::stale);
  CHECK(f.tx.active() && f.tx.active()->id == request.request);
  CHECK(f.collections.apply(DatasetRevision{6}, nodes).status == CollectionStatus::applied);
  CHECK(!f.tx.active() && f.state.snapshot().inputFocus.node == f.node("item-1-1"));
  CHECK(f.collections.propose(Direction::down, f.input()).target == f.node("item-2-1"));

  const auto revision = f.state.snapshot().revision;
  for (const auto index : {0, 1, 2}) {
    auto invalid = nodes;
    invalid[index].rowEntry = index == 0 ? static_cast<CollectionRowEntry>(99) : CollectionRowEntry::first;
    CHECK(f.collections.apply(DatasetRevision{7}, invalid).status == CollectionStatus::invalid);
    CHECK(f.collections.dataset() == DatasetRevision{6} && f.state.snapshot().revision == revision);
    CHECK(f.tx.drainEffects().empty());
  }
}

void rememberedRowEntry() {
  Fixture f;
  std::vector<CollectionNode> nodes{
      {OccurrenceKey{"outer"}, {}, 0, true, true, Layout::column, 120, CollectionRowEntry::remembered},
      {OccurrenceKey{"upper"}, OccurrenceKey{"outer"}, 0, true, true, Layout::row, 80},
      {OccurrenceKey{"lower"}, OccurrenceKey{"outer"}, 1, true, true, Layout::row, 80},
      {OccurrenceKey{"u0"}, OccurrenceKey{"upper"}, 0}, {OccurrenceKey{"u1"}, OccurrenceKey{"upper"}, 1},
      {OccurrenceKey{"l0"}, OccurrenceKey{"lower"}, 0}, {OccurrenceKey{"l1"}, OccurrenceKey{"lower"}, 1}};
  CHECK(f.collections.apply(DatasetRevision{2}, nodes).status == CollectionStatus::applied);
  f.mount("u1", 1); f.mount("l0", 2); f.mount("l1", 3);
  const auto focus = [&](const char* key, std::uint64_t mount, FocusChannel channel = FocusChannel::input) {
    CHECK(f.state.observeFocus({f.state.surface(), channel,
        {FocusKind::managed, f.node(key), MountGeneration{mount}}}) == ObservationStatus::changed);
  };
  focus("u1", 1);
  focus("l1", 3, FocusChannel::accessibility);
  CHECK(f.collections.propose(Direction::down, f.input()).target == f.node("l0")); // First input visit.
  focus("l1", 3);
  CHECK(f.collections.propose(Direction::up, f.input()).target == f.node("u1"));
  focus("u1", 1);
  const auto below = [&] { return f.collections.propose(Direction::down, f.input()); };
  CHECK(below().target == f.node("l1"));
  std::swap(nodes[5].order, nodes[6].order);
  CHECK(f.collections.apply(DatasetRevision{3}, nodes).status == CollectionStatus::applied);
  Mutation detach;
  detach.kind = MutationKind::update; detach.expected = f.node("l1");
  detach.key = OccurrenceKey{"l1"}; detach.parent = OccurrenceKey{"lower"};
  detach.record = *f.state.snapshot().registry.lookup(detach.expected);
  detach.record.mounted = false; detach.record.geometry = {};
  CHECK(f.tx.apply({f.state.surface(), f.state.snapshot().revision, std::span{&detach, 1}}).status == BatchStatus::valid);
  CHECK(below().target == f.node("l1") && below().kind == ProposalKind::reveal);
  f.mount("l1", 4); // Recycled native view. Remember the occurrence, not its previous mount.
  CHECK(below().target == f.node("l1"));
  nodes[6].enabled = false;
  CHECK(f.collections.apply(DatasetRevision{4}, nodes).status == CollectionStatus::applied);
  CHECK(below().target == f.node("l0"));
  nodes.pop_back(); nodes[5].order = 0;
  CHECK(f.collections.apply(DatasetRevision{5}, nodes).status == CollectionStatus::applied);
  CHECK(below().target == f.node("l0"));
}

int main() {
  membershipAndAtomicity();
  realizationAndRevision();
  nestedPathsAndDeletion();
  hostFactsAndConflicts();
  nestedColumnAndSupersession();
  foreignReplacementSurvivesRetirement();
  configurableRowEntry();
  rememberedRowEntry();
}
