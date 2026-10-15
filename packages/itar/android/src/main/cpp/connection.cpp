#include "boundary.hpp"
#include <jni.h>

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
  std::array<jlong, 32> values{};
  jlong result = conversion;
  // Never pin a Java array across an engine operation. Exceptions remain pending.
  if (input && env->GetArrayLength(input) <= static_cast<jsize>(values.size())) {
    const auto size = env->GetArrayLength(input);
    env->GetLongArrayRegion(input, 0, size, values.data());
    if (env->ExceptionCheck()) return nullptr;
    result = boundary.access(token, [&](Session&) -> std::int64_t {
      return operation == 0 && size == 0 && !key ? ok : conversion;
    });
  }
  auto output = env->NewLongArray(1);
  if (output) env->SetLongArrayRegion(output, 0, 1, &result);
  return output;
}
