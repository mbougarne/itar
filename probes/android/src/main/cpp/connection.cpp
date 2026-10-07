#include <itar/probe/surface.hpp>
#include <jni.h>

#include <array>
#include <limits>
#include <optional>

namespace {
using namespace itar::probe;

struct Entry {
  jlong token{};
  std::optional<Surface> surface;
};

// Kotlin confines every call to the UI thread. No host/JNI references are stored.
// Eight simultaneous probe surfaces; monotonically increasing tokens never reuse.
thread_local std::array<Entry, 8> entries;
thread_local jlong serial{};

Entry* find(jlong token) noexcept {
  for (auto& entry : entries) {
    if (token > 0 && entry.token == token && entry.surface) return &entry;
  }
  return nullptr;
}

Target target(std::uint32_t slot) noexcept {
  return {{slot}, {slot, 1}};
}
}  // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_com_itar_probe_Connection_createNative(JNIEnv*, jobject) noexcept {
  if (serial == std::numeric_limits<jlong>::max()) return 0;
  for (auto& entry : entries) {
    if (!entry.surface) {
      entry.token = ++serial;
      entry.surface.emplace(SurfaceLifetime{static_cast<std::uint64_t>(serial)},
                            target(1), target(2));
      return entry.token;
    }
  }
  return 0;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_itar_probe_Connection_queryNative(JNIEnv*, jobject, jlong token,
                                          jint source, jint direction) noexcept {
  auto* entry = find(token);
  if (!entry || source < -2 || source > 2 || direction < 0 || direction > 3) return -1;
  Observation observation;
  if (source > 0) observation = {FocusState::managed, target(static_cast<std::uint32_t>(source))};
  else if (source == 0) observation.state = FocusState::absent;
  else if (source == -1) observation.state = FocusState::unmanaged;
  const std::array directions{Direction::up, Direction::down, Direction::left, Direction::right};
  const auto result = entry->surface->resolve(
      {static_cast<std::uint64_t>(token)}, observation, directions[direction]);
  return result.target ? static_cast<jint>(result.target->mount.slot)
                       : -2 - static_cast<jint>(result.status);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_itar_probe_Connection_invalidateNative(JNIEnv*, jobject, jlong token, jint slot) noexcept {
  auto* entry = find(token);
  return entry && slot > 0 && slot <= 2 && entry->surface->invalidate(
      {static_cast<std::uint64_t>(token)}, {static_cast<std::uint32_t>(slot), 1});
}

extern "C" JNIEXPORT void JNICALL
Java_com_itar_probe_Connection_closeNative(JNIEnv*, jobject, jlong token) noexcept {
  if (auto* entry = find(token)) entry->surface.reset();
}
