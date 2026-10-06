#include <itar/probe/surface.hpp>

#include <iostream>
#include <type_traits>
#include <utility>

using namespace itar::probe;
static_assert(std::is_trivially_copyable_v<Target>);
static_assert(!std::is_copy_constructible_v<Surface>);
static_assert(!std::is_move_constructible_v<Surface>);

int main() {
  int failures = 0;
  const auto check = [&failures](bool passed, const char* scenario) {
    if (!passed) { std::cerr << scenario << '\n'; ++failures; }
  };
  const SurfaceLifetime lifetime{41};
  const Target a{{101}, {1, 3}}, b{{102}, {2, 8}};
  Surface surface(lifetime, a, b);
  const Observation source{FocusState::managed, a};
  const auto up = surface.resolve(lifetime, source, Direction::up);
  check(up == Result{Status::proposed, lifetime, b}, "A up proposes B");
  for (int i = 0; i < 100; ++i) {
    check(surface.resolve(lifetime, source, Direction::up) == up,
          "query does not move focus or mutate state");
  }
  check(surface.resolve(lifetime, {FocusState::managed, b}, Direction::down) ==
        Result{Status::proposed, lifetime, a}, "B down proposes A");
  for (auto direction : {Direction::left, Direction::right, Direction::down}) {
    check(surface.resolve(lifetime, source, direction) ==
          Result{Status::boundary, lifetime, {}}, "A boundary has no target");
  }
  check(surface.resolve(lifetime, {FocusState::managed, b}, Direction::up).status ==
        Status::boundary, "B upper boundary");
  for (auto [state, status] : {std::pair{FocusState::unmanaged, Status::unmanaged},
       {FocusState::absent, Status::absent}, {FocusState::unknown, Status::unknown}}) {
    check(surface.resolve(lifetime, {state, {}}, Direction::up) ==
          Result{status, lifetime, {}}, "distinct host observations");
  }
  check(surface.resolve({42}, source, Direction::up).status == Status::stale_surface,
        "reject stale surface lifetime");
  check(surface.resolve(lifetime, {FocusState::managed, {{101}, {1, 2}}},
                        Direction::up).status == Status::unavailable, "reject old mount");
  check(surface.resolve(lifetime, {FocusState::managed, {{999}, a.mount}},
                        Direction::up).status == Status::unavailable, "reject wrong occurrence");
  check(surface.resolve(lifetime, source, static_cast<Direction>(99)).status ==
        Status::invalid, "reject invalid direction");
  check(surface.resolve(lifetime, {static_cast<FocusState>(99), {}}, Direction::up).status ==
        Status::invalid, "reject invalid observation");
  check(!surface.invalidate({42}, b.mount), "old lifetime cannot invalidate");
  check(!surface.invalidate(lifetime, {2, 7}), "old generation cannot invalidate");
  check(surface.resolve(lifetime, source, Direction::up) == up, "stale invalidation has no effect");
  check(surface.invalidate(lifetime, b.mount), "invalidate destination");
  check(surface.invalidate(lifetime, b.mount), "duplicate invalidation is idempotent");
  check(surface.resolve(lifetime, source, Direction::up) ==
        Result{Status::unavailable, lifetime, {}}, "detached destination cannot be proposed");
  check(surface.invalidate(lifetime, a.mount), "invalidate source");
  check(surface.resolve(lifetime, source, Direction::up).status == Status::unavailable,
        "no registrations does not invent absence");
  surface.dispose();
  surface.dispose();
  check(surface.resolve(lifetime, source, Direction::up).status == Status::disposed,
        "dispose revokes query authority");
  check(!surface.invalidate(lifetime, a.mount), "disposed surface rejects mutation");
  Surface replacement({42}, {{101}, {1, 4}}, {{102}, {2, 9}});
  check(replacement.resolve(lifetime, source, Direction::up).status == Status::stale_surface,
        "replacement rejects old callback lifetime");
  for (auto bad : {Target{{0}, {1, 3}}, Target{{101}, {0, 3}}, Target{{101}, {1, 0}},
                   b, Target{{103}, b.mount}}) {
    Surface invalid(lifetime, bad, b);
    check(invalid.resolve(lifetime, source, Direction::up).status == Status::invalid,
          "invalid construction fails closed");
  }
  Surface invalid_lifetime({}, a, b);
  check(invalid_lifetime.resolve({}, source, Direction::up).status == Status::invalid,
        "zero lifetime fails closed");
  return failures == 0 ? 0 : 1;
}
