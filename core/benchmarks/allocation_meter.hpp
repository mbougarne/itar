#pragma once
// Executable-only allocator instrumentation; never linked into the library.
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <new>
namespace meter {
inline std::size_t live{}, peak{}, allocations{}, requested{};
inline bool measuring{};
struct Header { void* raw; std::size_t size; };
inline void* allocate(std::size_t size, std::size_t alignment) {
  alignment = std::max(alignment, alignof(Header));
  if (size > SIZE_MAX - alignment - sizeof(Header)) { throw std::bad_alloc{}; }
  void* raw = std::malloc(size + alignment + sizeof(Header));
  if (!raw) { throw std::bad_alloc{}; }
  const auto start = reinterpret_cast<std::uintptr_t>(raw) + sizeof(Header);
  const auto aligned = (start + alignment - 1) & ~(alignment - 1);
  auto* header = reinterpret_cast<Header*>(aligned) - 1;
  *header = {raw, size};
  live += size; peak = std::max(peak, live);
  if (measuring) { ++allocations; requested += size; }
  return reinterpret_cast<void*>(aligned);
}
inline void release(void* pointer) noexcept {
  if (!pointer) { return; }
  const auto header = *(static_cast<Header*>(pointer) - 1);
  live -= header.size; std::free(header.raw);
}
inline void reset() { allocations = requested = 0; }
}
void* operator new(std::size_t n) { return meter::allocate(n, alignof(std::max_align_t)); }
void* operator new[](std::size_t n) { return ::operator new(n); }
void* operator new(std::size_t n, std::align_val_t a) { return meter::allocate(n, static_cast<std::size_t>(a)); }
void* operator new[](std::size_t n, std::align_val_t a) { return ::operator new(n, a); }
void operator delete(void* p) noexcept { meter::release(p); }
void operator delete[](void* p) noexcept { meter::release(p); }
void operator delete(void* p, std::size_t) noexcept { meter::release(p); }
void operator delete[](void* p, std::size_t) noexcept { meter::release(p); }
void operator delete(void* p, std::align_val_t) noexcept { meter::release(p); }
void operator delete[](void* p, std::align_val_t) noexcept { meter::release(p); }
void operator delete(void* p, std::size_t, std::align_val_t) noexcept { meter::release(p); }
void operator delete[](void* p, std::size_t, std::align_val_t) noexcept { meter::release(p); }
