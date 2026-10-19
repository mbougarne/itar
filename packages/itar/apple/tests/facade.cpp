#include "ItarEngine.h"
#include "../../../../core/tests/check.hpp"
#include <itar/transaction.hpp>

#include <array>
#include <atomic>
#include <cstring>
#include <new>
#include <thread>

namespace {
std::atomic<bool> failAllocation{false};
ItarBytes bytes(const char *value) {
  return {reinterpret_cast<const uint8_t *>(value), std::strlen(value)};
}
ItarMutation item(const char *key, int32_t order = 0) {
  ItarMutation value{};
  value.key = bytes(key);
  value.record.order = order;
  value.record.active = value.record.enabled = value.record.mounted = value.record.entry_ready = 1;
  value.record.mount = 1;
  value.record.geometry = {1, 1, 1, {double(order) * 20, 0, 10, 10}, 2};
  return value;
}
struct Fixture {
  ItarEngine *engine;
  ItarNode a{}, b{};
  Fixture() {
    ItarCallStatus status;
    engine = itar_engine_create(1, 10, 8, &status);
    CHECK(engine && status == ITAR_OK);
    std::array values{item("a"), item("b", 1)};
    const auto batch = itar_engine_apply(engine, 10, 0, values.data(), values.size());
    CHECK(batch.call == ITAR_OK && batch.code == 0 && batch.revision == 1);
    CHECK(itar_engine_find(engine, 10, bytes("a"), &a) == ITAR_OK);
    CHECK(itar_engine_find(engine, 10, bytes("b"), &b) == ITAR_OK);
    CHECK(itar_engine_observe_focus(engine, 10, 0, {0, a, 1}, 0, {}).call == ITAR_OK);
    notifications();
  }
  ~Fixture() { CHECK(itar_engine_destroy(engine) == ITAR_OK); }
  ItarRequestResult start() {
    return itar_engine_request_focus(engine, 10, bytes("b"), {}, 0, 100, 1);
  }
  std::vector<ItarEffect> effects() {
    std::array<ItarEffect, 32> values{};
    size_t count = 0;
    CHECK(itar_engine_effects(engine, 10, values.data(), values.size(), &count) == ITAR_OK);
    return {values.begin(), values.begin() + count};
  }
  std::vector<ItarNotification> notifications() {
    std::array<ItarNotification, 32> values{};
    size_t count = 0;
    CHECK(itar_engine_notifications(engine, 10, values.data(), values.size(), &count) == ITAR_OK);
    return {values.begin(), values.begin() + count};
  }
};

void ownership() {
  static_assert(noexcept(itar_engine_create(1, 1, 8, nullptr)));
  static_assert(noexcept(itar_engine_apply(nullptr, 0, 0, nullptr, 0)));
  ItarCallStatus status;
  CHECK(!itar_engine_create(0, 1, 8, &status) && status == ITAR_INVALID);
  CHECK(!itar_engine_create(1, 1, 4097, &status) && status == ITAR_INVALID);
  CHECK(!itar_engine_create(1, 1, 8, nullptr));
  failAllocation = true;
  CHECK(!itar_engine_create(1, 1, 8, &status) && status == ITAR_RESOURCE);
  failAllocation = false;
  Fixture f;
  CHECK(itar_engine_snapshot(nullptr, 10).call == ITAR_INVALID);
  CHECK(itar_engine_snapshot(f.engine, 11).call == ITAR_STALE_LIFETIME);
  std::thread wrong([&] {
    CHECK(itar_engine_snapshot(f.engine, 10).call == ITAR_WRONG_THREAD);
    CHECK(itar_engine_dispose(f.engine, 10) == ITAR_WRONG_THREAD);
    CHECK(itar_engine_destroy(f.engine) == ITAR_WRONG_THREAD);
  });
  wrong.join();
  CHECK(itar_engine_dispose(f.engine, 10) == ITAR_OK);
  CHECK(itar_engine_dispose(f.engine, 10) == ITAR_OK);
  CHECK(f.start().call == ITAR_DISPOSED);
  CHECK(itar_engine_destroy(nullptr) == ITAR_OK);
}

void conversionAndAtomicity() {
  Fixture f;
  auto value = item("c", 2);
  value.record.active = 2;
  CHECK(itar_engine_apply(f.engine, 10, 1, &value, 1).call == ITAR_INVALID);
  CHECK(itar_engine_snapshot(f.engine, 10).revision == 1);
  value = item("c", 2);
  std::array duplicate{value, value};
  auto result = itar_engine_apply(f.engine, 10, 1, duplicate.data(), duplicate.size());
  CHECK(result.call == ITAR_OK && result.code != 0 && result.revision == 1);
  ItarNode missing{99, 99};
  CHECK(itar_engine_find(f.engine, 10, bytes("c"), &missing) == ITAR_OK && !missing.slot);
  CHECK(itar_engine_find(f.engine, 10, {nullptr, 2}, &missing) == ITAR_INVALID);
  CHECK(itar_engine_find(f.engine, 10, {nullptr, 513}, &missing) == ITAR_INVALID);
  CHECK(itar_engine_apply(f.engine, 10, 1, nullptr, SIZE_MAX).call == ITAR_INVALID);
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {3, f.a, 1}, 0, {}).call == ITAR_INVALID);
  CHECK(itar_engine_observe_focus(f.engine, 10, 2, {3, {}, 0}, 0, {}).call == ITAR_INVALID);
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {0, {1, 0}, 1}, 0, {}).call == ITAR_INVALID);
  CHECK(itar_engine_request_focus(f.engine, 10, bytes("b"), {}, 99, 100, 1).call == ITAR_INVALID);
  CHECK(itar_engine_snapshot(f.engine, 10).input.node.slot == f.a.slot);
  // Borrowed key storage may change as soon as apply returns.
  char owned[] = "temporary";
  value = item(owned);
  CHECK(itar_engine_apply(f.engine, 10, 1, &value, 1).code == 0);
  owned[0] = 'x';
  CHECK(itar_engine_find(f.engine, 10, bytes("temporary"), &missing) == ITAR_OK && missing.slot);
}

void confirmationAndCancellation() {
  Fixture f;
  const auto started = f.start();
  CHECK(started.code == ITAR_REQUEST_STARTED && started.request);
  CHECK(itar_engine_snapshot(f.engine, 10).deadline == 100);
  size_t count = 99;
  CHECK(itar_engine_effects(f.engine, 10, nullptr, 0, &count) == ITAR_BUFFER_TOO_SMALL && count == 0);
  auto effects = f.effects();
  CHECK(effects.size() == 1 && effects[0].token.kind == 1);
  const auto effect = effects[0];
  CHECK(itar_engine_issue(f.engine, 10, effect.token).code == ITAR_REQUEST_ISSUED);
  CHECK(itar_engine_complete(f.engine, 10, effect.token, 0).code == ITAR_REQUEST_WAITING);
  CHECK(itar_engine_snapshot(f.engine, 10).input.node.slot == f.a.slot);
  CHECK(f.notifications().empty());
  auto observed = itar_engine_observe_focus(f.engine, 10, 0, {0, f.b, 1}, 1, effect.token);
  CHECK(observed.code == ITAR_REQUEST_CONFIRMED && observed.request == started.request);
  auto events = f.notifications();
  CHECK(events.size() == 1 && events[0].confirmed_request == started.request);
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {0, f.b, 1}, 1, effect.token).call == ITAR_OK);
  CHECK(f.notifications().empty() && itar_engine_snapshot(f.engine, 10).deadline == 0);

  Fixture late;
  const auto cancelled = late.start();
  const auto movement = late.effects()[0];
  CHECK(itar_engine_issue(late.engine, 10, movement.token).code == ITAR_REQUEST_ISSUED);
  CHECK(itar_engine_cancel(late.engine, 10, cancelled.request).call == ITAR_OK);
  const auto cleanup = late.effects()[0];
  CHECK(cleanup.has_cancels && cleanup.cancels.effect == movement.token.effect);
  CHECK(itar_engine_issue(late.engine, 10, cleanup.token).code == ITAR_REQUEST_ISSUED);
  CHECK(itar_engine_complete(late.engine, 10, cleanup.token, 5).call == ITAR_OK);
  observed = itar_engine_observe_focus(late.engine, 10, 0, {0, late.b, 1}, 1, movement.token);
  CHECK(observed.code != ITAR_REQUEST_CONFIRMED);
  events = late.notifications();
  CHECK(events.size() == 1 && events[0].confirmed_request == 0);
  CHECK(itar_engine_snapshot(late.engine, 10).input.node.slot == late.b.slot);
}

void invalidationAndReuse() {
  Fixture f;
  const auto started = f.start();
  auto movement = f.effects()[0];
  int32_t code = -1;
  CHECK(itar_engine_invalidate(f.engine, 10, f.b, 1, 0, 0, &code) == ITAR_OK && code == 0);
  auto bad = item("b", 1);
  bad.kind = 1; bad.expected = f.b;
  CHECK(itar_engine_apply(f.engine, 10, 0, &bad, 1).code != 0);
  CHECK(itar_engine_issue(f.engine, 10, movement.token).code != ITAR_REQUEST_ISSUED);
  CHECK(itar_engine_snapshot(f.engine, 10).deadline == 0 && started.request);
  auto replacement = item("b", 1);
  replacement.kind = 2; replacement.expected = f.b;
  replacement.record.mount = replacement.record.geometry.mount = 2;
  CHECK(itar_engine_apply(f.engine, 10, 1, &replacement, 1).code == 0);
  ItarNode current{};
  CHECK(itar_engine_find(f.engine, 10, bytes("b"), &current) == ITAR_OK);
  CHECK(current.slot == f.b.slot && current.generation != f.b.generation);
  CHECK(itar_engine_invalidate(f.engine, 10, f.b, 1, 0, 0, &code) == ITAR_OK && code != 0);
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {0, f.b, 1}, 0, {}).code != ITAR_REQUEST_CONFIRMED);
  CHECK(f.start().code == ITAR_REQUEST_STARTED);
  movement = f.effects()[0];
  CHECK(movement.target.generation == current.generation && movement.mount == 2);
  // Loss of all managed registrations is not proof of host focus absence.
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {1, {}, 0}, 0, {}).call == ITAR_OK);
  CHECK(itar_engine_snapshot(f.engine, 10).input.kind == 1);
  CHECK(itar_engine_observe_focus(f.engine, 10, 1, {2, {}, 0}, 0, {}).call == ITAR_OK);
  CHECK(itar_engine_snapshot(f.engine, 10).accessibility.kind == 2);
}

void deadlinesAndResources() {
  Fixture f;
  f.start();
  CHECK(itar_engine_advance(f.engine, 10, 100).call == ITAR_OK);
  CHECK(itar_engine_snapshot(f.engine, 10).deadline == 0);
  CHECK(itar_engine_advance(f.engine, 10, 99).code == static_cast<int>(itar::RequestStatus::backward_time));
  auto value = item("c");
  failAllocation = true;
  CHECK(itar_engine_apply(f.engine, 10, 1, &value, 1).call == ITAR_RESOURCE);
  failAllocation = false;
  CHECK(itar_engine_snapshot(f.engine, 10).call == ITAR_DISPOSED);
}
void restoration() {
  Fixture f;
  uint64_t token = 0;
  CHECK(itar_engine_capture_restoration(f.engine, 10, &token) == ITAR_OK && token);
  CHECK(itar_engine_observe_focus(f.engine, 10, 0, {2, {}, 0}, 0, {}).call == ITAR_OK);
  CHECK(itar_engine_restore(f.engine, 10, token + 1, 0, 100, 1).code == static_cast<int>(itar::RequestStatus::stale));
  CHECK(itar_engine_restore(f.engine, 10, token, 0, 100, 1).code == ITAR_REQUEST_STARTED);
  CHECK(f.effects()[0].target.slot == f.a.slot);
  CHECK(itar_engine_restore(f.engine, 10, token, 0, 100, 1).code == static_cast<int>(itar::RequestStatus::stale));

  Fixture removed;
  CHECK(itar_engine_capture_restoration(removed.engine, 10, &token) == ITAR_OK && token);
  ItarMutation erase{};
  erase.kind = 3; erase.key = bytes("a"); erase.expected = removed.a;
  CHECK(itar_engine_apply(removed.engine, 10, 1, &erase, 1).code == 0);
  CHECK(itar_engine_observe_focus(removed.engine, 10, 0, {2, {}, 0}, 0, {}).call == ITAR_OK);
  CHECK(itar_engine_restore(removed.engine, 10, token, 0, 100, 1).code == ITAR_REQUEST_STARTED);
  CHECK(removed.effects()[0].target.slot == removed.b.slot);

  Fixture host;
  CHECK(itar_engine_capture_restoration(host.engine, 10, &token) == ITAR_OK && token);
  CHECK(itar_engine_observe_focus(host.engine, 10, 0, {1, {}, 0}, 0, {}).call == ITAR_OK);
  CHECK(itar_engine_restore(host.engine, 10, token, 0, 100, 1).code != ITAR_REQUEST_STARTED);
  CHECK(host.effects().empty());
}
} // namespace

// Test-only allocation failure at the C++ exception boundary.
void *operator new(std::size_t size) {
  if (failAllocation) throw std::bad_alloc{};
  if (void *value = std::malloc(size ? size : 1)) return value;
  throw std::bad_alloc{};
}
void operator delete(void *value) noexcept { std::free(value); }
void operator delete(void *value, std::size_t) noexcept { std::free(value); }

int main() {
  ownership();
  conversionAndAtomicity();
  confirmationAndCancellation();
  invalidationAndReuse();
  deadlinesAndResources();
  restoration();
}
