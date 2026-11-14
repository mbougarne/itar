#pragma once
#include "replay.hpp"
#include <memory>

namespace itar::diagnostics {
enum class CaptureStatus { disabled, complete, overflow, resource };
// Internal serialized-owner hook: feed protocol values at the dispatch boundary,
// before executing them. No graph traversal, host object, formatting or public API.
class Capture {
 public:
  explicit Capture(std::size_t records = 256, std::size_t payloadBytes = 65536)
      : capacity_(records), payloadLimit_(payloadBytes) {}
  CaptureStatus enable(const Fixture& initial) {
    disable();
    if (!initial.steps.empty() || bytes(initial.initial) > payloadLimit_) {
      return status_ = CaptureStatus::overflow;
    }
    try {
      fixture_ = std::make_unique<Fixture>(initial);
      fixture_->steps.reserve(capacity_);
      used_ = bytes(initial.initial);
      status_ = CaptureStatus::complete;
    } catch (const std::bad_alloc&) { fixture_.reset(); status_ = CaptureStatus::resource; }
    return status_;
  }
  CaptureStatus record(const Step& step, std::optional<RequestStatus> decision = {}) {
    if (status_ != CaptureStatus::complete) { return status_; }
    const auto extra = std::visit([](const auto& event) -> std::size_t {
      using T = std::decay_t<decltype(event)>;
      if constexpr (std::is_same_v<T, Commit>) { return bytes(event.mutations); }
      else if constexpr (std::is_same_v<T, FocusKey> || std::is_same_v<T, RestoreKey>) {
        return event.key.value().size();
      }
      else { return 0; }
    }, step.event);
    if (fixture_->steps.size() == capacity_ || extra > payloadLimit_ - used_) {
      return status_ = CaptureStatus::overflow;
    }
    try {
      fixture_->steps.push_back(step);
      if (decision) { fixture_->steps.back().expected = decision; }
      used_ += extra;
    }
    catch (const std::bad_alloc&) { status_ = CaptureStatus::resource; }
    return status_;
  }
  // An overflowed prefix is never offered as a complete replay.
  const Fixture* complete() const noexcept {
    return status_ == CaptureStatus::complete ? fixture_.get() : nullptr;
  }
  CaptureStatus status() const noexcept { return status_; }
  std::size_t size() const noexcept { return fixture_ ? fixture_->steps.size() : 0; }
  std::size_t payloadBytes() const noexcept { return used_; }
  void disable() noexcept { fixture_.reset(); used_ = 0; status_ = CaptureStatus::disabled; }
  void dispose() noexcept { disable(); }
 private:
  static std::size_t bytes(const std::vector<Mutation>& mutations) {
    std::size_t result = mutations.size() * sizeof(Mutation);
    for (const auto& mutation : mutations) {
      result += mutation.key.value().size() + mutation.parent.value().size();
      if (mutation.preferred) { result += mutation.preferred->value().size(); }
    }
    return result;
  }
  std::size_t capacity_, payloadLimit_, used_{};
  CaptureStatus status_{CaptureStatus::disabled};
  std::unique_ptr<Fixture> fixture_;
};
}  // namespace itar::diagnostics
