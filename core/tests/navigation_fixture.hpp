#pragma once

#include <itar/navigation.hpp>
#include <itar/geometry_view.hpp>
#include <itar/topology.hpp>

#include "check.hpp"

struct NavigationFixture {
  itar::State state{itar::SurfaceId{1}};
  itar::NodeHandle add(std::string key, itar::NodeRecord record = {},
                       std::string parent = "") {
    itar::Mutation op;
    op.key = itar::OccurrenceKey{std::move(key)};
    op.parent = itar::OccurrenceKey{std::move(parent)};
    op.record = record;
    CHECK(state.apply({state.surface(), state.snapshot().revision,
                       std::span{&op, 1}}).status == itar::BatchStatus::valid);
    return state.snapshot().registry.find(op.key);
  }
  void update(itar::NodeHandle node, itar::NodeRecord record,
              std::optional<itar::OccurrenceKey> preferred = {}) {
    const auto& registry = state.snapshot().registry;
    itar::Mutation op;
    op.kind = itar::MutationKind::update;
    op.key = *registry.key(node);
    op.expected = node;
    if (registry.lookup(node)->parent) {
      op.parent = *registry.key(registry.lookup(node)->parent);
    }
    op.record = record;
    op.preferred = std::move(preferred);
    CHECK(state.apply({state.surface(), state.snapshot().revision,
                       std::span{&op, 1}}).status == itar::BatchStatus::valid);
  }
  itar::InputContext focus(itar::NodeHandle node, itar::NodeHandle authority = {}) {
    const itar::FocusState focus{itar::FocusKind::managed, node,
                                state.snapshot().registry.lookup(node)->mount};
    CHECK(state.observeFocus({state.surface(), itar::FocusChannel::input, focus})
          != itar::ObservationStatus::stale_handle);
    return {state.surface(), authority, itar::InputOwner::engine, focus};
  }
  static itar::NodeRecord item(int order, itar::Rect bounds = {0, 0, 10, 10}) {
    itar::NodeRecord record;
    record.order = order;
    record.mounted = true;
    record.mount = itar::MountGeneration{1};
    record.geometry = {itar::SurfaceId{1}, record.mount, itar::LayoutRevision{1},
                       bounds, itar::GeometryState::measured};
    return record;
  }
};
