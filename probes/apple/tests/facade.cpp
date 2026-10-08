#include "ItarProbe.h"
#include <cstdlib>

int main() {
  if (itar_probe_create(0, 1) || itar_probe_create(1, 0)) return EXIT_FAILURE;
  auto *handle = itar_probe_create(7, 2);
  if (!handle) return EXIT_FAILURE;
  bool ok = itar_probe_query(handle, 7, 2, 0, 1, 0).slot == 2;
  ok &= itar_probe_query(handle, 8, 2, 0, 1, 0).status == 6;
  ok &= itar_probe_query(handle, 7, 1, 0, 1, 0).status == 5;
  ok &= itar_probe_query(handle, 7, 2, 4, 1, 0).status == 8;
  ok &= itar_probe_query(nullptr, 7, 2, 0, 1, 0).status == 8;
  for (int state = 1; state <= 3; ++state) {
    ok &= itar_probe_query(handle, 7, 2, state, 0, 0).status == state + 1;
  }
  ok &= itar_probe_invalidate(handle, 7, 2, 2) == 1;
  ok &= itar_probe_query(handle, 7, 2, 0, 1, 0).status == 5;
  itar_probe_dispose(handle);
  ok &= itar_probe_query(handle, 7, 2, 0, 1, 0).status == 7;
  itar_probe_destroy(handle);
  itar_probe_destroy(nullptr);
  return ok ? EXIT_SUCCESS : EXIT_FAILURE;
}
