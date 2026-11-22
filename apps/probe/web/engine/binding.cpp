#include <emscripten/bind.h>
#include <itar/collection.hpp>

#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>

namespace {
using namespace itar;
using emscripten::val;
constexpr unsigned ceiling = 1000000000;

template<class T> T field(const val& value, const char* name, T fallback) {
  const auto property = value[name];
  return property.isUndefined() ? fallback : property.as<T>();
}
unsigned integer(double value, unsigned maximum = ceiling) {
  if (!std::isfinite(value) || value < 0 || value > maximum || std::floor(value) != value) {
    throw std::invalid_argument("Expected a bounded nonnegative integer");
  }
  return static_cast<unsigned>(value);
}
unsigned capacity(unsigned value) {
  if (!value || value > 4096) { throw std::invalid_argument("Capacity must be 1..4096"); }
  return value;
}
int order(double value) {
  if (!std::isfinite(value) || std::floor(value) != value || value < -2147483648.0 || value > 2147483647.0) {
    throw std::invalid_argument("Order must be an Int32");
  }
  return static_cast<int>(value);
}
val result(RequestResult value) {
  auto out = val::object();
  out.set("status", static_cast<int>(value.status));
  out.set("request", static_cast<unsigned>(value.request.value));
  return out;
}

// App-only, serialized browser owner. No JS callbacks execute inside the engine.
// A complete bounded logical snapshot includes unmounted virtualized targets.
class WebEngine {
 public:
  explicit WebEngine(unsigned size)
      : state_(SurfaceId{1}, RegistryLimits{capacity(size)}),
        tx_(state_, SurfaceLifetime{1}, TransactionLimits{32, 32, 32, ceiling}) {}
  ~WebEngine() { dispose(); }

  int sync(const val& values) {
    if (disposed_) { return static_cast<int>(BatchStatus::invalid); }
    try {
      const auto count = integer(values["length"].as<double>(), 4096);
      if (count > state_.snapshot().registry.limits().capacity) {
        return static_cast<int>(BatchStatus::capacity);
      }
      if (epoch_ == ceiling) { return static_cast<int>(BatchStatus::revision_exhausted); }
      const auto next = epoch_ + 1;
      const auto& registry = state_.snapshot().registry;
      std::vector<Mutation> mutations;
      std::vector<CollectionNode> catalog;
      std::vector<std::pair<std::string, int>> alignments;
      std::set<std::string, std::less<>> keys;
      mutations.reserve(count + registry.size());
      for (unsigned i = 0; i < count; ++i) {
        const auto value = values[i];
        const auto key = value["key"].as<std::string>();
        if (!keys.insert(key).second) { return static_cast<int>(BatchStatus::duplicate); }
        const auto node = registry.find(OccurrenceKey{key});
        NodeRecord record;
        record.scope = field(value, "scope", false);
        record.active = field(value, "active", true);
        record.enabled = field(value, "enabled", true);
        record.order = order(field(value, "order", 0.0));
        record.mounted = !record.scope && field(value, "mounted", false);
        record.mount = MountGeneration{integer(field(value, "mount", 0.0))};
        if (const auto* previous = registry.lookup(node); previous && !record.mounted) {
          record.mount.value = std::max(record.mount.value, previous->mount.value);
        }
        record.navigation.layout = static_cast<Layout>(integer(field(value, "layout", 0.0), 2));
        record.navigation.boundary = static_cast<Boundary>(integer(field(value, "boundary", 2.0), 2));
        record.navigation.trap = field(value, "trap", false);
        record.navigation.entryReady = field(value, "entryReady", true);
        record.navigation.restoreOnEntry = field(value, "restoreOnEntry", false);
        const auto policy = value["rowEntry"];
        if (!policy.isUndefined() && policy.typeOf().as<std::string>() != "number") {
          return static_cast<int>(BatchStatus::invalid);
        }
        const auto entry = integer(field(value, "rowEntry", 0.0), 2);
        if (field(value, "collection", false)) {
          const auto visual = value["horizontalAlignment"];
          if (!visual.isUndefined() && (visual.typeOf().as<std::string>() != "number" ||
              !record.scope || record.navigation.layout != Layout::row)) { return static_cast<int>(BatchStatus::invalid); }
          const auto alignment = integer(field(value, "horizontalAlignment", 0.0), 2);
          if (alignment && (!record.scope || record.navigation.layout != Layout::row)) { return static_cast<int>(BatchStatus::invalid); }
          alignments.emplace_back(key, alignment);
          catalog.push_back({OccurrenceKey{key}, OccurrenceKey{field(value, "parent", std::string{})},
            record.order, record.scope, record.enabled, record.navigation.layout,
            field(value, "extent", 0.0), static_cast<CollectionRowEntry>(entry)});
        } else if (!policy.isUndefined()) { return static_cast<int>(BatchStatus::invalid); }
        if (record.mounted) {
          record.geometry = {state_.surface(), record.mount, LayoutRevision{next},
            {field(value, "x", 0.0), field(value, "y", 0.0),
             field(value, "width", 0.0), field(value, "height", 0.0)}, GeometryState::measured};
        }
        std::optional<OccurrenceKey> preferred;
        if (record.scope) {
          const auto wanted = field(value, "preferredKey", std::string{});
          const auto* previous = registry.preferred(node);
          if ((!previous && !wanted.empty()) || (previous && previous->value() != wanted)) {
            preferred = OccurrenceKey{wanted};
          }
        }
        mutations.push_back({node ? MutationKind::update : MutationKind::insert,
          OccurrenceKey{key}, node, OccurrenceKey{field(value, "parent", std::string{})}, record,
          std::move(preferred)});
      }
      if (!validCollectionNodes(catalog, registry.limits())) { return static_cast<int>(BatchStatus::invalid); }
      // DOM registration/transport order is not a logical dataset change.
      std::sort(catalog.begin(), catalog.end(), [](const auto& a, const auto& b) { return a.key.value() < b.key.value(); });
      std::sort(alignments.begin(), alignments.end());
      const auto changed = catalog != catalog_ || alignments != alignments_;
      if (changed && dataset_ == ceiling) { return static_cast<int>(BatchStatus::revision_exhausted); }
      std::vector<NodeHandle> handles(catalog.size());
      for (const auto node : registry.handles()) {
        const auto key = *registry.key(node);
        if (!keys.contains(key.value())) { mutations.push_back({MutationKind::erase, key, node, {}, {}}); }
      }
      const auto validation = state_.validate({state_.surface(), state_.snapshot().revision, mutations});
      if (validation.status != BatchStatus::valid) { return static_cast<int>(validation.status); }
      // Actual detach facts cannot be undone by a later rejected app batch.
      for (const auto& mutation : mutations) {
        const auto* previous = registry.lookup(mutation.expected);
        if (previous && previous->mounted && (mutation.kind == MutationKind::erase ||
            !mutation.record.mounted || mutation.record.mount != previous->mount)) {
          tx_.observeAvailability({state_.surface(), mutation.expected, previous->mount,
                                   AvailabilityKind::mount_lost, LayoutRevision{epoch_}});
        }
      }
      const auto applied = tx_.apply({state_.surface(), state_.snapshot().revision, mutations});
      if (applied.status == BatchStatus::valid) {
        epoch_ = next;
        if (changed) {
          if (const auto& active = tx_.active(); active &&
              (std::any_of(catalog_.begin(), catalog_.end(), [&](const auto& node) { return node.key == active->targetKey; }) ||
               std::any_of(catalog.begin(), catalog.end(), [&](const auto& node) { return node.key == active->targetKey; }))) { tx_.cancel(active->id); }
          ++dataset_;
        }
        for (std::size_t i = 0; i < catalog.size(); ++i) { handles[i] = registry.find(catalog[i].key); }
        catalog_.swap(catalog); handles_.swap(handles); alignments_.swap(alignments);
      }
      tx_.drainNotifications();
      return static_cast<int>(applied.status);
    } catch (const std::bad_alloc&) { return static_cast<int>(BatchStatus::resource); }
    catch (const std::invalid_argument&) { return static_cast<int>(BatchStatus::invalid); }
  }

  int detach(const std::string& key, unsigned mount) {
    return static_cast<int>(tx_.observeAvailability({state_.surface(), find(key), MountGeneration{mount},
      AvailabilityKind::mount_lost, LayoutRevision{epoch_}}));
  }
  val observe(const std::string& key, unsigned mount, int channel, unsigned effect) {
    if (channel < 0 || channel > 1) { return result({RequestStatus::invalid, {}}); }
    FocusState focus{FocusKind::absent, {}, {}};
    if (!key.empty()) {
      const auto node = find(key);
      if (!node) { return result({RequestStatus::stale, {}}); }
      focus = {FocusKind::managed, node, MountGeneration{mount}};
    }
    const auto found = effects_.find(effect);
    auto observed = tx_.observeHost({SurfaceLifetime{1},
      {state_.surface(), static_cast<FocusChannel>(channel), focus},
      found == effects_.end() ? std::nullopt : std::optional{found->second.token}});
    tx_.drainNotifications();
    return result(observed);
  }
  val unmanaged(int channel) {
    if (channel < 0 || channel > 1) { return result({RequestStatus::invalid, {}}); }
    const auto observed = tx_.observeHost({SurfaceLifetime{1},
      {state_.surface(), static_cast<FocusChannel>(channel), {FocusKind::unmanaged, {}, {}}}, {}});
    tx_.drainNotifications();
    return result(observed);
  }
  val direction(int direction, int owner) {
    if (direction < 0 || direction > 3 || owner < 0 || owner > 4) { return result({RequestStatus::invalid, {}}); }
    const auto heading = static_cast<Direction>(direction);
    const auto context = input(owner);
    return result(tx_.directionalInput(heading, context, options(),
        proposeCollectionEntry(state_, catalog_, handles_, heading, context)));
  }
  val focus(const std::string& key, int owner) {
    if (owner < 0 || owner > 4) { return result({RequestStatus::invalid, {}}); }
    return result(tx_.requestFocus(OccurrenceKey{key}, input(owner), options()));
  }
  val restore(const std::string& scope) {
    const auto node = find(scope);
    const auto* record = state_.snapshot().registry.lookup(node);
    if (!record || !record->scope || !record->active || !record->navigation.entryReady) {
      return result({RequestStatus::unavailable, {}});
    }
    if (const auto* remembered = state_.history(node);
        remembered && logicalTarget(state_, state_.snapshot().registry.find(*remembered))) {
      return result(tx_.requestFocus(*remembered, input(), options()));
    }
    const auto proposal = resolveEntry(state_, node, input(), {EntryReason::returning});
    return result(tx_.begin(proposal, options()));
  }
  val drain() {
    const auto active = tx_.active() ? tx_.active()->id : RequestId{};
    std::erase_if(effects_, [&](const auto& item) {
      return !issued_.contains(item.first) && item.second.token.request != active;
    });
    auto out = val::array();
    for (const auto& effect : tx_.drainEffects()) {
      const auto id = static_cast<unsigned>(effect.token.effect.value);
      if (effects_.size() >= 32) { throw std::runtime_error("Host failed to retire bounded effect records"); }
      effects_.insert_or_assign(id, effect);
      auto item = val::object();
      item.set("id", id);
      item.set("request", static_cast<unsigned>(effect.token.request.value));
      item.set("kind", static_cast<int>(effect.token.kind));
      item.set("key", key(effect.target));
      item.set("mount", static_cast<unsigned>(effect.mount.value_or(MountGeneration{}).value));
      item.set("cancels", effect.cancels ? static_cast<unsigned>(effect.cancels->effect.value) : 0);
      out.call<void>("push", item);
    }
    return out;
  }
  val issue(unsigned effect) {
    const auto found = effects_.find(effect);
    if (found == effects_.end()) { return result({RequestStatus::stale, {}}); }
    const auto issued = tx_.issue(found->second.token);
    if (issued.status == RequestStatus::issued) { issued_.insert(effect); }
    if (issued.status != RequestStatus::issued && issued.status != RequestStatus::waiting) { effects_.erase(found); }
    return result(issued);
  }
  val complete(unsigned effect, int outcome) {
    const auto found = effects_.find(effect);
    if (found == effects_.end() || outcome < 0 || outcome > 5) { return result({RequestStatus::stale, {}}); }
    const auto old = found->second.cancels;
    const auto completed = tx_.complete({found->second.token, static_cast<OutcomeKind>(outcome), {}});
    if (outcome != static_cast<int>(OutcomeKind::accepted)) {
      effects_.erase(found);
      issued_.erase(effect);
      if (old && outcome != static_cast<int>(OutcomeKind::not_cancellable)) {
        const auto cancelled = static_cast<unsigned>(old->effect.value);
        effects_.erase(cancelled); issued_.erase(cancelled);
      }
    }
    return result(completed);
  }
  val realize(unsigned effect, const std::string& target, unsigned mount) {
    const auto found = effects_.find(effect);
    if (found == effects_.end()) { return result({RequestStatus::stale, {}}); }
    const auto realized = tx_.realize({found->second.token, state_.surface(), find(target),
                                      MountGeneration{mount}, found->second.dataset, true});
    if (realized.status == RequestStatus::started) { effects_.erase(found); issued_.erase(effect); }
    return result(realized);
  }
  val cancel(unsigned request) { return result(tx_.cancel(RequestId{request})); }
  void release() { tx_.releaseInput(); }
  val advance(double now) {
    if (!std::isfinite(now) || now < 0 || now > 9007199254740000.0) { return result({RequestStatus::invalid, {}}); }
    const auto value = static_cast<TimePoint>(now);
    const auto advanced = tx_.advanceTo(value);
    if (advanced.status != RequestStatus::backward_time) { now_ = value; }
    return result(advanced);
  }
  val snapshot() const {
    const auto& current = state_.snapshot();
    auto out = val::object();
    out.set("inputKey", key(current.inputFocus.node));
    out.set("inputKind", static_cast<int>(current.inputFocus.kind));
    out.set("a11yKey", key(current.accessibilityFocus.node));
    out.set("a11yKind", static_cast<int>(current.accessibilityFocus.kind));
    out.set("activeRequest", tx_.active() ? static_cast<unsigned>(tx_.active()->id.value) : 0);
    out.set("resync", tx_.resyncRequired());
    return out;
  }
  void dispose() { if (!disposed_) { tx_.dispose(); effects_.clear(); issued_.clear(); disposed_ = true; } }
 private:
  NodeHandle find(const std::string& value) const { return state_.snapshot().registry.find(OccurrenceKey{value}); }
  std::string key(NodeHandle node) const {
    const auto* value = state_.snapshot().registry.key(node);
    return value ? std::string{value->value()} : std::string{};
  }
  InputContext input(int owner = 0) const {
    return {state_.surface(), {}, static_cast<InputOwner>(owner), state_.snapshot().inputFocus};
  }
  RequestOptions options() const { return {now_ + 1000, DatasetRevision{dataset_}, ResourceId{1}, {}}; }
  State state_;
  Transactions tx_;
  std::vector<CollectionNode> catalog_;
  std::vector<NodeHandle> handles_;
  std::vector<std::pair<std::string, int>> alignments_;
  std::map<unsigned, Effect> effects_;
  std::set<unsigned> issued_;
  unsigned epoch_{};
  unsigned dataset_{1};
  TimePoint now_{};
  bool disposed_{};
};
} // namespace

EMSCRIPTEN_BINDINGS(itar_web) {
  emscripten::class_<WebEngine>("WebEngine")
    .constructor<unsigned>()
    .function("sync", &WebEngine::sync).function("detach", &WebEngine::detach)
    .function("observe", &WebEngine::observe).function("unmanaged", &WebEngine::unmanaged)
    .function("direction", &WebEngine::direction).function("focus", &WebEngine::focus)
    .function("restore", &WebEngine::restore).function("drain", &WebEngine::drain)
    .function("issue", &WebEngine::issue).function("complete", &WebEngine::complete)
    .function("realize", &WebEngine::realize).function("cancel", &WebEngine::cancel)
    .function("release", &WebEngine::release).function("advance", &WebEngine::advance)
    .function("snapshot", &WebEngine::snapshot).function("dispose", &WebEngine::dispose);
}
