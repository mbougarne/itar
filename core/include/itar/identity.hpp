#pragma once

#include <cstdint>
#include <initializer_list>
#include <string>
#include <string_view>
#include <utility>

namespace itar {

// Zero is reserved. Tokens have no host pointers or implicit conversions.
template <class Tag, class Value = std::uint64_t>
struct Identifier {
  Value value{};
  explicit constexpr operator bool() const noexcept { return value != 0; }
  bool operator==(const Identifier&) const = default;
};

using SurfaceId = Identifier<struct SurfaceTag>;
using NodeId = Identifier<struct NodeTag, std::uint32_t>;
using Generation = Identifier<struct GenerationTag, std::uint32_t>;
using MountGeneration = Identifier<struct MountTag>;
using Revision = Identifier<struct RevisionTag>;
using LayoutRevision = Identifier<struct LayoutTag>;

struct NodeHandle {
  NodeId slot;
  Generation generation;
  explicit constexpr operator bool() const noexcept {
    return bool(slot) && bool(generation);
  }
  bool operator==(const NodeHandle&) const = default;
};

// Application-owned opaque identity, unique within a surface. No array index.
class OccurrenceKey {
 public:
  OccurrenceKey() = default;
  explicit OccurrenceKey(std::string value) : value_(std::move(value)) {}
  explicit operator bool() const noexcept { return !value_.empty(); }
  std::string_view value() const noexcept { return value_; }
  bool operator==(const OccurrenceKey&) const = default;

  // Length prefixes preserve component boundaries even with ':' or NUL bytes.
  static OccurrenceKey compose(std::string_view screen, std::string_view rail,
                               std::string_view entry) {
    std::string encoded;
    for (auto part : {screen, rail, entry}) {
      encoded += std::to_string(part.size());
      encoded += ':';
      encoded.append(part);
    }
    return OccurrenceKey{std::move(encoded)};
  }

 private:
  std::string value_;
};

}  // namespace itar
