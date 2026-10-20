#include <jni.h>

#include <algorithm>
#include <bit>

#include "presentation.hpp"
#include "scopes.hpp"

namespace {
thread_local itar::android::Boundary boundary;
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_itar_adapter_Connection_createNative(JNIEnv*, jobject) noexcept {
  return boundary.create();
}

extern "C" JNIEXPORT jlong JNICALL Java_com_itar_adapter_Connection_closeNative(
    JNIEnv*, jobject, jlong token) noexcept {
  return boundary.close(token);
}

extern "C" JNIEXPORT jlongArray JNICALL
Java_com_itar_adapter_Connection_exchangeNative(JNIEnv* env, jobject,
                                                jlong token, jint operation,
                                                jlongArray input,
                                                jstring key, jstring extra) noexcept {
  using namespace itar::android;
  // Allocate before changing core state or draining an output channel.
  auto output = env->NewLongArray(64);
  if (!output) return nullptr;
  std::array<jlong, 32> values{};
  std::array<std::int64_t, 64> response{};
  jlong result = conversion;
  // Never pin a Java array across an engine operation. Exceptions remain
  // pending.
  if (input &&
      env->GetArrayLength(input) <= static_cast<jsize>(values.size())) {
    const auto size = env->GetArrayLength(input);
    env->GetLongArrayRegion(input, 0, size, values.data());
    if (env->ExceptionCheck()) return nullptr;
    result = boundary.access(token, [&](Session& session) -> std::int64_t {
      std::array<std::int64_t, 32> copied{};
      std::copy_n(values.begin(), size, copied.begin());
      if (operation == 0) return size == 0 && !key && !extra ? ok : conversion;
      if (key && env->GetStringUTFLength(key) > 512) return conversion;
      if (extra && (operation != 20 || env->GetStringUTFLength(extra) > 512)) return conversion;
      struct Text {
        JNIEnv* env;
        jstring key;
        const char* chars;
        ~Text() {
          if (chars) env->ReleaseStringUTFChars(key, chars);
        }
      } text{env, key, key ? env->GetStringUTFChars(key, nullptr) : nullptr};
      if (key && !text.chars) return resource;
      Text additional{env, extra, extra ? env->GetStringUTFChars(extra, nullptr) : nullptr};
      if (extra && !additional.chars) return resource;
if (operation == 24 && size == 8) {
  const auto result = session.transactions.realize({itar::android::token(std::span{copied}.first(4)),
      session.state.surface(), handle(std::span{copied}.subspan(4, 2)),
      {static_cast<std::uint64_t>(copied[6])}, {static_cast<std::uint64_t>(copied[7])}, true});
  response[1] = static_cast<std::int64_t>(result.status); response[2] = result.request.value;
  return ok;
}
if (operation == 25 && size == 0 && text.chars) {
  const auto node = session.state.snapshot().registry.find(itar::OccurrenceKey{std::string(text.chars)});
  response[1] = node.slot.value; response[2] = node.generation.value;
  return ok;
}
if (operation >= 20) return scope(session, operation, std::span{copied}.first(size),
          text.chars ? text.chars : "", additional.chars ? additional.chars : "", response);
      if (operation >= 6 && operation <= 8)
        return itar::android::input(session, operation,
                                    std::span{copied}.first(size), response);
      if (operation == 19)
        return registration(session, operation, std::span{copied}.first(size),
                            "", response);
      if (operation >= 17)
        return presentation(session, operation, std::span{copied}.first(size));
      if (operation >= 9)
        return effects(session, operation, std::span{copied}.first(size),
                       text.chars ? text.chars : "", response);
      return registration(session, operation, std::span{copied}.first(size),
                          text.chars ? text.chars : "", response);
    });
  }
  if (env->ExceptionCheck()) return nullptr;
  std::array<jlong, 64> converted{};
  std::copy(response.begin(), response.end(), converted.begin());
  converted[0] = result;
  env->SetLongArrayRegion(output, 0, converted.size(), converted.data());
  return output;
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_itar_adapter_Connection_collectionsNative(JNIEnv* env, jobject, jlong token,
    jlong dataset, jobjectArray keys, jobjectArray parents, jlongArray input) noexcept {
  using namespace itar::android;
  if (dataset <= 0 || !keys || !parents || !input) return conversion;
  const auto count = env->GetArrayLength(keys);
  if (count > 256 || env->GetArrayLength(parents) != count || env->GetArrayLength(input) != count * 5) return conversion;
  return boundary.access(token, [&](Session& session) -> std::int64_t {
    std::vector<jlong> values(count * 5);
    if (!values.empty()) env->GetLongArrayRegion(input, 0, static_cast<jsize>(values.size()), values.data());
    if (env->ExceptionCheck()) return resource;
    std::vector<itar::CollectionNode> nodes;
    nodes.reserve(count);
    for (jsize i = 0; i < count; ++i) {
      std::array<std::string, 2> copied;
      for (std::size_t j = 0; j < 2; ++j) {
        struct Text {
          JNIEnv* env;
          jstring value;
          const char* bytes{};
          ~Text() {
            if (bytes) env->ReleaseStringUTFChars(value, bytes);
            if (value) env->DeleteLocalRef(value);
          }
        } text{env, static_cast<jstring>(env->GetObjectArrayElement(j ? parents : keys, i))};
        if (!text.value || env->GetStringUTFLength(text.value) > 512) return conversion;
        text.bytes = env->GetStringUTFChars(text.value, nullptr);
        if (!text.bytes) return resource;
        copied[j] = text.bytes;
      }
      const auto* v = values.data() + i * 5;
      if (v[0] < 0 || v[0] > INT32_MAX || v[1] < 0 || v[1] > 1 || v[2] < 0 || v[2] > 1 || v[3] < 0 || v[3] > 2) return conversion;
      nodes.push_back({itar::OccurrenceKey{std::move(copied[0])}, itar::OccurrenceKey{std::move(copied[1])},
          static_cast<std::int32_t>(v[0]), v[1] != 0, v[2] != 0, static_cast<itar::Layout>(v[3]),
          std::bit_cast<double>(v[4])});
    }
    return static_cast<std::int64_t>(session.collections.apply({static_cast<std::uint64_t>(dataset)}, nodes).status);
  });
}
