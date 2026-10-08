#include "ItarProbe.h"
#include <itar/probe/surface.hpp>
#include <new>

using namespace itar::probe;

struct ItarProbe {
  Surface surface;
  ItarProbe(uint64_t lifetime, uint32_t generation) noexcept
      : surface({lifetime}, {{1}, {1, generation}}, {{2}, {2, generation}}) {}
};

extern "C" ItarProbe *itar_probe_create(uint64_t lifetime, uint32_t generation) {
  if (lifetime == 0 || generation == 0) return nullptr;
  return new (std::nothrow) ItarProbe(lifetime, generation);
}

extern "C" ItarProbeResult itar_probe_query(ItarProbe *handle, uint64_t lifetime,
    uint32_t generation, int32_t state, uint32_t slot, int32_t direction) {
  if (!handle || state < 0 || state > 3 || direction < 0 || direction > 3) {
    return {8, 0, 0};
  }
  const auto result = handle->surface.resolve({lifetime},
      {static_cast<FocusState>(state), {{slot}, {slot, generation}}},
      static_cast<Direction>(direction));
  return {static_cast<int32_t>(result.status), result.target ? result.target->mount.slot : 0,
          result.target ? result.target->mount.generation : 0};
}

extern "C" int32_t itar_probe_invalidate(ItarProbe *handle, uint64_t lifetime,
                                        uint32_t slot, uint32_t generation) {
  return handle && handle->surface.invalidate({lifetime}, {slot, generation});
}

extern "C" void itar_probe_dispose(ItarProbe *handle) {
  if (handle) handle->surface.dispose();
}

extern "C" void itar_probe_destroy(ItarProbe *handle) { delete handle; }
