#include "ItarEngine.h"
#include <itar/collection.hpp>
#include <itar/geometry_view.hpp>

#include <new>
#include <stdexcept>
#include <thread>

struct ItarEngine {
  std::thread::id owner{std::this_thread::get_id()};
  uint64_t lifetime;
  bool disposed{};
  itar::State state;
  itar::Transactions transactions;
  itar::Collections collections;
  std::optional<itar::RecoveryOrigin> restoration;
  itar::NodeHandle opener;
  uint64_t restorationToken{};
  ItarEngine(uint64_t surface, uint64_t life, uint32_t capacity)
      : lifetime(life), state(itar::SurfaceId{surface}, {capacity}),
        transactions(state, itar::SurfaceLifetime{life}), collections(state, transactions) {}
  void revoke() noexcept { disposed = true; transactions.dispose(); restoration.reset(); }
};

namespace {
using namespace itar;
static_assert(static_cast<int>(RequestStatus::confirmed) == ITAR_REQUEST_CONFIRMED);
static_assert(static_cast<int>(RequestStatus::resync) == ITAR_REQUEST_RESYNC);
static_assert(static_cast<int>(RequestStatus::issued) == ITAR_REQUEST_ISSUED);
static_assert(static_cast<int>(RequestStatus::waiting) == ITAR_REQUEST_WAITING);

ItarCallStatus check(ItarEngine *engine, uint64_t lifetime, bool allowDisposed = false) noexcept {
  if (!engine) return ITAR_INVALID;
  if (engine->owner != std::this_thread::get_id()) return ITAR_WRONG_THREAD;
  if (lifetime != engine->lifetime) return ITAR_STALE_LIFETIME;
  return engine->disposed && !allowDisposed ? ITAR_DISPOSED : ITAR_OK;
}
template <class Function>
ItarCallStatus protect(ItarEngine *engine, Function function) noexcept {
  try { function(); return ITAR_OK; }
  catch (const std::invalid_argument&) { return ITAR_INVALID; }
  // An unexpected allocation/error may follow mutation. Revoke rather than
  // pretending that a potentially partial operation can safely be retried.
  catch (const std::bad_alloc&) { engine->revoke(); return ITAR_RESOURCE; }
  catch (...) { engine->revoke(); return ITAR_INTERNAL; }
}
void require(bool condition) {
  if (!condition) throw std::invalid_argument("invalid native record");
}
bool valid(ItarBytes value) noexcept { return value.count <= 512 && (!value.count || value.bytes); }
OccurrenceKey key(ItarBytes value) {
  require(valid(value));
  return value.count ? OccurrenceKey{std::string(reinterpret_cast<const char *>(value.bytes), value.count)}
                     : OccurrenceKey{};
}
NodeHandle node(ItarNode value) {
  require(bool(value.slot) == bool(value.generation));
  return {{value.slot}, {value.generation}};
}
ItarNode native(NodeHandle value) noexcept { return {value.slot.value, value.generation.value}; }
bool flag(uint8_t value) { require(value <= 1); return value != 0; }
FocusState focus(ItarFocus value) {
  require(value.kind >= 0 && value.kind <= 3);
  auto handle = node(value.node);
  require(value.kind == 0 ? bool(handle) && value.mount : !handle && !value.mount);
  return {static_cast<FocusKind>(value.kind), handle, {value.mount}};
}
ItarFocus native(FocusState value) noexcept {
  return {static_cast<int32_t>(value.kind), native(value.node), value.mount.value};
}
EffectToken token(ItarToken value) {
  require(value.lifetime && value.request && value.effect && value.kind >= 0 && value.kind <= 2);
  return {{value.lifetime}, {value.request}, {value.effect}, static_cast<EffectKind>(value.kind)};
}
ItarToken native(EffectToken value) noexcept {
  return {value.lifetime.value, value.request.value, value.effect.value, static_cast<int32_t>(value.kind)};
}
NodeRecord record(const ItarRecord& value) {
  require(value.geometry.state >= 0 && value.geometry.state <= 4 &&
          value.layout >= 0 && value.layout <= 2 && value.boundary >= 0 && value.boundary <= 2);
  NodeRecord output;
  output.order = value.order;
  output.scope = flag(value.scope); output.active = flag(value.active);
  output.enabled = flag(value.enabled); output.mounted = flag(value.mounted);
  output.mount = {value.mount};
  const auto& g = value.geometry;
  output.geometry = {{g.surface}, {g.mount}, {g.layout},
                    {g.bounds.x, g.bounds.y, g.bounds.width, g.bounds.height},
                    static_cast<GeometryState>(g.state)};
  for (size_t i = 0; i < 4; ++i) output.navigation.overrides[i] = node(value.overrides[i]);
  output.navigation.layout = static_cast<Layout>(value.layout);
  output.navigation.boundary = static_cast<Boundary>(value.boundary);
  output.navigation.rtl = flag(value.rtl); output.navigation.trap = flag(value.trap);
  output.navigation.entryReady = flag(value.entry_ready);
  return output;
}
template <class Function>
ItarRequestResult request(ItarEngine *engine, uint64_t life, Function function) noexcept {
  ItarRequestResult output{check(engine, life), -1, 0};
  if (output.call != ITAR_OK) return output;
  output.call = protect(engine, [&] {
    const auto result = function();
    output.code = static_cast<int32_t>(result.status);
    output.request = result.request.value;
  });
  return output;
}
} // namespace

extern "C" ItarEngine *itar_engine_create(uint64_t surface, uint64_t lifetime,
    uint32_t capacity, ItarCallStatus *status) noexcept {
  if (!status) return nullptr;
  *status = ITAR_INVALID;
  if (!surface || !lifetime || !capacity || capacity > 4096) return nullptr;
  try {
    auto *engine = new ItarEngine(surface, lifetime, capacity);
    *status = ITAR_OK;
    return engine;
  } catch (const std::bad_alloc&) { *status = ITAR_RESOURCE; }
    catch (...) { *status = ITAR_INTERNAL; }
  return nullptr;
}
extern "C" ItarCallStatus itar_engine_dispose(ItarEngine *engine, uint64_t life) noexcept {
  const auto status = check(engine, life, true);
  if (status == ITAR_OK) engine->revoke();
  return status;
}
extern "C" ItarCallStatus itar_engine_destroy(ItarEngine *engine) noexcept {
  if (!engine) return ITAR_OK;
  if (engine->owner != std::this_thread::get_id()) return ITAR_WRONG_THREAD;
  delete engine;
  return ITAR_OK;
}
extern "C" ItarSnapshot itar_engine_snapshot(ItarEngine *engine, uint64_t life) noexcept {
  ItarSnapshot output{};
  output.call = check(engine, life);
  if (output.call != ITAR_OK) return output;
  const auto& snapshot = engine->state.snapshot();
  output.revision = snapshot.revision.value;
  output.input = native(snapshot.inputFocus); output.accessibility = native(snapshot.accessibilityFocus);
  output.deadline = engine->transactions.nextDeadline().value_or(0);
  output.active_request = engine->transactions.active() ? engine->transactions.active()->id.value : 0;
  output.collection_dataset = engine->collections.dataset().value;
  output.resync_required = engine->transactions.resyncRequired();
  return output;
}
extern "C" ItarBatchResult itar_engine_apply(ItarEngine *engine, uint64_t life, uint64_t revision,
    const ItarMutation *operations, size_t count) noexcept {
  ItarBatchResult output{check(engine, life), -1, 0, SIZE_MAX};
  if (output.call != ITAR_OK) return output;
  output.call = protect(engine, [&] {
    require(count <= size_t{engine->state.snapshot().registry.limits().capacity} * 2 && (!count || operations));
    std::vector<Mutation> mutations;
    mutations.reserve(count);
    // Convert every record before entering the atomic engine batch.
    for (size_t i = 0; i < count; ++i) {
      const auto& op = operations[i];
      require(op.kind >= 0 && op.kind <= 3);
      Mutation mutation;
      mutation.kind = static_cast<MutationKind>(op.kind);
      mutation.key = key(op.key); mutation.parent = key(op.parent);
      mutation.expected = node(op.expected);
      if (op.kind != 3) mutation.record = record(op.record);
      if (flag(op.has_preferred)) mutation.preferred = key(op.preferred);
      mutations.push_back(std::move(mutation));
    }
    const auto result = engine->transactions.apply({engine->state.surface(), {revision}, mutations});
    output.code = static_cast<int32_t>(result.status);
    output.revision = result.revision.value;
    output.operation = result.operation.value_or(SIZE_MAX);
  });
  return output;
}
extern "C" ItarCallStatus itar_engine_find(ItarEngine *engine, uint64_t life, ItarBytes bytes,
    ItarNode *output) noexcept {
  if (!output) return ITAR_INVALID;
  *output = {};
  const auto status = check(engine, life);
  if (status != ITAR_OK) return status;
  return protect(engine, [&] { *output = native(engine->state.snapshot().registry.find(key(bytes))); });
}
extern "C" ItarRequestResult itar_engine_observe_focus(ItarEngine *engine, uint64_t life,
    int32_t channel, ItarFocus value, uint8_t hasCorrelation, ItarToken correlation) noexcept {
  return request(engine, life, [&] {
    require(channel >= 0 && channel <= 1);
    const auto current = focus(value);
    std::optional<EffectToken> issued;
    if (flag(hasCorrelation)) issued = token(correlation);
    return engine->transactions.observeHost({{life}, {engine->state.surface(),
        static_cast<FocusChannel>(channel), current}, issued});
  });
}
extern "C" ItarCallStatus itar_engine_invalidate(ItarEngine *engine, uint64_t life, ItarNode target,
    uint64_t mount, int32_t kind, uint64_t through, int32_t *code) noexcept {
  if (!code) return ITAR_INVALID;
  *code = -1;
  const auto status = check(engine, life);
  if (status != ITAR_OK) return status;
  return protect(engine, [&] {
    require(kind >= 0 && kind <= 2);
    *code = static_cast<int32_t>(engine->transactions.observeAvailability({engine->state.surface(),
        node(target), {mount}, static_cast<AvailabilityKind>(kind), {through}}));
  });
}
extern "C" ItarRequestResult itar_engine_request_focus(ItarEngine *engine, uint64_t life,
    ItarBytes bytes, ItarNode authority, int32_t owner, uint64_t deadline, uint64_t dataset) noexcept {
  return request(engine, life, [&] {
    require(owner >= 0 && owner <= 4);
    const InputContext input{engine->state.surface(), node(authority), static_cast<InputOwner>(owner),
                             engine->state.snapshot().inputFocus};
    const auto target = key(bytes);
    auto options = engine->collections.options(target, deadline);
    if (!engine->collections.find(target)) options.dataset = {dataset};
    return engine->transactions.requestFocus(target, input, options);
  });
}
extern "C" ItarRequestResult itar_engine_issue(ItarEngine *engine, uint64_t life, ItarToken value) noexcept {
  return request(engine, life, [&] { return engine->transactions.issue(token(value)); });
}
extern "C" ItarRequestResult itar_engine_restore_scope(ItarEngine *engine, uint64_t life,
    ItarBytes bytes, uint64_t deadline, uint64_t dataset) noexcept {
  return request(engine, life, [&]() -> RequestResult {
    const auto scope = engine->state.snapshot().registry.find(key(bytes));
    const auto *record = engine->state.snapshot().registry.lookup(scope);
    if (!record || !record->scope || !record->active || !record->navigation.entryReady) return {RequestStatus::unavailable, {}};
    // The destination can differ from the source scope; authority is the surface.
    const InputContext input{engine->state.surface(), {}, InputOwner::engine, engine->state.snapshot().inputFocus};
    if (const auto *remembered = engine->state.history(scope);
        remembered && logicalTarget(engine->state, engine->state.snapshot().registry.find(*remembered))) {
      auto options = engine->collections.options(*remembered, deadline);
      if (!engine->collections.find(*remembered)) options.dataset = {dataset};
      return engine->transactions.requestFocus(*remembered, input, options);
    }
    const auto proposal = resolveEntry(engine->state, scope, input, {EntryReason::returning});
    const auto* target = engine->state.snapshot().registry.key(proposal.target);
    return engine->transactions.begin(proposal, engine->collections.options(target ? *target : OccurrenceKey{}, deadline));
  });
}
extern "C" ItarRequestResult itar_engine_complete(ItarEngine *engine, uint64_t life,
    ItarToken value, int32_t outcome) noexcept {
  return request(engine, life, [&] {
    require(outcome >= 0 && outcome <= 5);
    return engine->transactions.complete({token(value), static_cast<OutcomeKind>(outcome), {}});
  });
}
extern "C" ItarRequestResult itar_engine_cancel(ItarEngine *engine, uint64_t life, uint64_t id) noexcept {
  return request(engine, life, [&] { return engine->transactions.cancel({id}); });
}
extern "C" ItarRequestResult itar_engine_advance(ItarEngine *engine, uint64_t life, uint64_t now) noexcept {
  return request(engine, life, [&] { return engine->transactions.advanceTo(now); });
}
extern "C" ItarCallStatus itar_engine_capture_restoration(ItarEngine *engine, uint64_t life,
    uint64_t *output) noexcept {
  if (!output) return ITAR_INVALID;
  *output = 0;
  const auto status = check(engine, life);
  if (status != ITAR_OK) return status;
  return protect(engine, [&] {
    require(engine->restorationToken != UINT64_MAX);
    engine->restoration = captureRecovery(engine->state);
    engine->opener = engine->state.snapshot().inputFocus.node;
    ++engine->restorationToken;
    if (engine->restoration) *output = engine->restorationToken;
  });
}
extern "C" ItarRequestResult itar_engine_restore(ItarEngine *engine, uint64_t life, uint64_t value,
    int32_t owner, uint64_t deadline, uint64_t dataset) noexcept {
  return request(engine, life, [&]() -> RequestResult {
    require(owner >= 0 && owner <= 4);
    if (!value || value != engine->restorationToken || !engine->restoration) return {RequestStatus::stale, {}};
    auto origin = std::move(*engine->restoration);
    engine->restoration.reset();
    const auto& snapshot = engine->state.snapshot();
    if (owner != 0 || snapshot.inputFocus.kind != FocusKind::absent) return {RequestStatus::unavailable, {}};
    const InputContext input{engine->state.surface(), {}, static_cast<InputOwner>(owner), snapshot.inputFocus};
    const RequestOptions options{deadline, {dataset}, {}, {}};
    const auto target = snapshot.registry.find(origin.occurrence);
    if (target) {
      if (target != engine->opener || !usableGeometry(snapshot, engine->state.surface(), target)) {
        return {RequestStatus::unavailable, {}};
      }
      return engine->transactions.requestFocus(origin.occurrence, input, options);
    }
    return engine->transactions.begin(resolveRecovery(engine->state, origin, input), options);
  });
}
extern "C" ItarCallStatus itar_engine_effects(ItarEngine *engine, uint64_t life,
    ItarEffect *output, size_t capacity, size_t *count) noexcept {
  if (!count) return ITAR_INVALID;
  *count = 0;
  const auto status = check(engine, life);
  if (status != ITAR_OK) return status;
  if (capacity < 32) return ITAR_BUFFER_TOO_SMALL;
  if (!output) return ITAR_INVALID;
  return protect(engine, [&] {
    const auto effects = engine->transactions.drainEffects();
    for (const auto& effect : effects) {
      output[(*count)++] = {native(effect.token), effect.surface.value, native(effect.target),
          effect.mount.value_or(MountGeneration{}).value, effect.dataset.value, effect.resource.value,
          static_cast<uint8_t>(effect.cancels.has_value()), native(effect.cancels.value_or(EffectToken{}))};
    }
  });
}
extern "C" ItarCallStatus itar_engine_notifications(ItarEngine *engine, uint64_t life,
    ItarNotification *output, size_t capacity, size_t *count) noexcept {
  if (!count) return ITAR_INVALID;
  *count = 0;
  const auto status = check(engine, life);
  if (status != ITAR_OK) return status;
  if (capacity < 32) return ITAR_BUFFER_TOO_SMALL;
  if (!output) return ITAR_INVALID;
  return protect(engine, [&] {
    const auto events = engine->transactions.drainNotifications();
    for (const auto& event : events) {
      output[(*count)++] = {static_cast<int32_t>(event.observation.channel), native(event.observation.focus),
                           event.confirmedRequest.value_or(RequestId{}).value};
    }
  });
}

extern "C" ItarBatchResult itar_engine_collections(ItarEngine *engine, uint64_t life,
    uint64_t dataset, const ItarCollectionNode *values, size_t count) noexcept {
  ItarBatchResult output{check(engine, life), -1, 0, SIZE_MAX};
  if (output.call != ITAR_OK) return output;
  output.call = protect(engine, [&] {
    require(count <= engine->state.snapshot().registry.limits().capacity && (!count || values));
    std::vector<CollectionNode> nodes;
    nodes.reserve(count);
    for (size_t i = 0; i < count; ++i) {
      const auto& value = values[i];
      require(value.layout >= 0 && value.layout <= 2);
      nodes.push_back({key(value.key), key(value.parent), value.order, flag(value.scope),
          flag(value.enabled), static_cast<Layout>(value.layout), value.extent});
    }
    const auto result = engine->collections.apply({dataset}, nodes);
    output.code = static_cast<int32_t>(result.status);
    output.revision = result.dataset.value;
  });
  return output;
}
extern "C" ItarProposal itar_engine_direction_query(ItarEngine *engine, uint64_t life,
    int32_t direction, int32_t owner) noexcept {
  ItarProposal output{check(engine, life), -1, {}};
  if (output.call != ITAR_OK) return output;
  output.call = protect(engine, [&] {
    require(direction >= 0 && direction <= 3 && owner >= 0 && owner <= 4);
    const InputContext input{engine->state.surface(), {}, static_cast<InputOwner>(owner), engine->state.snapshot().inputFocus};
    const auto proposal = engine->collections.propose(static_cast<Direction>(direction), input);
    output.kind = static_cast<int32_t>(proposal.kind);
    output.target = native(proposal.target);
  });
  return output;
}
extern "C" ItarRequestResult itar_engine_direction(ItarEngine *engine, uint64_t life,
    int32_t direction, int32_t owner, uint64_t deadline) noexcept {
  return request(engine, life, [&] {
    require(direction >= 0 && direction <= 3 && owner >= 0 && owner <= 4);
    const InputContext input{engine->state.surface(), {}, static_cast<InputOwner>(owner), engine->state.snapshot().inputFocus};
    return engine->collections.input(static_cast<Direction>(direction), input, deadline);
  });
}
extern "C" ItarRequestResult itar_engine_realize(ItarEngine *engine, uint64_t life,
    ItarToken reveal, ItarNode target, uint64_t mount, uint64_t dataset) noexcept {
  return request(engine, life, [&] {
    return engine->transactions.realize({token(reveal), engine->state.surface(), node(target), {mount}, {dataset}, true});
  });
}
extern "C" ItarCallStatus itar_engine_release_input(ItarEngine *engine, uint64_t life) noexcept {
  const auto status = check(engine, life);
  if (status == ITAR_OK) engine->transactions.releaseInput();
  return status;
}
