#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
// Probe-only ABI. All calls run on one owner thread. No borrowed buffers.
// Create returns one owned handle or null; destroy exactly once after calls unwind.
// Dispose revokes authority but does not free storage. Null calls fail closed.
typedef struct ItarProbe ItarProbe;
typedef struct {
  int32_t status; // Surface::Status ordinal; 0 proposed, 8 invalid.
  uint32_t slot;
  uint32_t generation;
} ItarProbeResult;
ItarProbe *itar_probe_create(uint64_t lifetime, uint32_t generation);
ItarProbeResult itar_probe_query(ItarProbe *, uint64_t lifetime, uint32_t generation,
                               int32_t state, uint32_t slot, int32_t direction);
int32_t itar_probe_invalidate(ItarProbe *, uint64_t lifetime, uint32_t slot, uint32_t generation);
void itar_probe_dispose(ItarProbe *);
void itar_probe_destroy(ItarProbe *);
#ifdef __cplusplus
}
#endif
