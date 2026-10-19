#include "ItarEngine.h"

int main(void) {
  ItarCallStatus status = ITAR_INVALID;
  ItarEngine *engine = itar_engine_create(1, 2, 8, &status);
  if (!engine || status != ITAR_OK) return 1;
  if (itar_engine_snapshot(engine, 2).revision != 0) return 2;
  return itar_engine_destroy(engine) == ITAR_OK ? 0 : 3;
}
