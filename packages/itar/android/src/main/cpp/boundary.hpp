#pragma once

#include <itar/transaction.hpp>

#include <array>
#include <atomic>
#include <memory>
#include <thread>

namespace itar::android {

enum Error : std::int64_t { ok = 0, stale = -1, conversion = -2, resource = -3,
                          failure = -4, wrong_thread = -5 };

struct Session {
  explicit Session(std::uint64_t token)
      : state(SurfaceId{token}), transactions(state, SurfaceLifetime{token}) {}
  State state;
  Transactions transactions;  // Destroyed before its borrowed state.
};

// One UI-thread owner, bounded surfaces, no host/JNI objects or pointer tokens.
class Boundary {
 public:
  std::int64_t create() noexcept {
    if (!owner()) return wrong_thread;
    try {
      for (auto& entry : entries_) {
        if (entry.session) continue;
        auto token = serial_.load();
        do {
          if (token == INT64_MAX) return resource;
        } while (!serial_.compare_exchange_weak(token, token + 1));
        auto session = std::make_unique<Session>(token + 1);
        entry = {token + 1, std::move(session)};
        return entry.token;
      }
      return resource;
    } catch (const std::bad_alloc&) { return resource; }
    catch (...) { return failure; }
  }

  template <class Function>
  std::int64_t access(std::int64_t token, Function function) noexcept {
    if (!owner()) return wrong_thread;
    try {
      for (auto& entry : entries_) {
        if (token > 0 && entry.token == token && entry.session) {
          return function(*entry.session);
        }
      }
      return stale;
    } catch (const std::bad_alloc&) { return resource; }
    catch (...) { return failure; }
  }

  std::int64_t close(std::int64_t token) noexcept {
    if (!owner()) return wrong_thread;
    for (auto& entry : entries_) {
      if (token > 0 && entry.token == token && entry.session) {
        entry.session->transactions.dispose();
        entry.session.reset();
        return ok;
      }
    }
    return stale;
  }

 private:
  struct Entry {
    std::int64_t token{};
    std::unique_ptr<Session> session;
  };

  bool owner() const noexcept { return std::this_thread::get_id() == owner_; }
  const std::thread::id owner_{std::this_thread::get_id()};
  inline static std::atomic<std::int64_t> serial_{};
  std::array<Entry, 8> entries_;
};

}  // namespace itar::android
