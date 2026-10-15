#include "presentation.hpp"
#include <jni.h>
#include <algorithm>

namespace {
thread_local itar::android::Boundary boundary;
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_itar_adapter_Connection_createNative(JNIEnv*, jobject) noexcept {
  return boundary.create();
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_itar_adapter_Connection_closeNative(JNIEnv*, jobject, jlong token) noexcept {
  return boundary.close(token);
}

extern "C" JNIEXPORT jlongArray JNICALL
Java_com_itar_adapter_Connection_exchangeNative(JNIEnv* env, jobject, jlong token,
                                               jint operation, jlongArray input,
                                               jstring key) noexcept {
  using namespace itar::android;
  // Allocate before changing core state or draining an output channel.
  auto output = env->NewLongArray(64);
  if (!output) return nullptr;
  std::array<jlong, 32> values{};
  std::array<std::int64_t, 64> response{};
  jlong result = conversion;
  // Never pin a Java array across an engine operation. Exceptions remain pending.
  if (input && env->GetArrayLength(input) <= static_cast<jsize>(values.size())) {
    const auto size = env->GetArrayLength(input);
    env->GetLongArrayRegion(input, 0, size, values.data());
    if (env->ExceptionCheck()) return nullptr;
    result = boundary.access(token, [&](Session& session) -> std::int64_t {
      std::array<std::int64_t, 32> copied{};
      std::copy_n(values.begin(), size, copied.begin());
      if (operation == 0) return size == 0 && !key ? ok : conversion;
      if (key && env->GetStringUTFLength(key) > 512) return conversion;
      struct Text {
        JNIEnv* env;
        jstring key;
        const char* chars;
        ~Text() { if (chars) env->ReleaseStringUTFChars(key, chars); }
      } text{env, key, key ? env->GetStringUTFChars(key, nullptr) : nullptr};
      if (key && !text.chars) return resource;
      if (operation >= 6 && operation <= 8) return itar::android::input(session, operation, std::span{copied}.first(size), response);
      if (operation >= 17) return presentation(session, operation, std::span{copied}.first(size));
      if (operation >= 9) return effects(session, operation, std::span{copied}.first(size), text.chars ? text.chars : "", response);
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
