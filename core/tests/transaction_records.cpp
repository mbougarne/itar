#include <itar/transaction.hpp>

#include <type_traits>
#include "check.hpp"

int main() {
  using namespace itar;
  static_assert(!std::is_convertible_v<RequestId, EffectId>);
  static_assert(!std::is_convertible_v<SurfaceId, SurfaceLifetime>);
  static_assert(!std::is_copy_constructible_v<Transactions>);
  static_assert(!std::is_move_constructible_v<Transactions>);
  RequestRecord request{};
  request.targetKey = OccurrenceKey{"rail:20"};
  CHECK(!request.mount);
  const EffectToken reveal{SurfaceLifetime{1}, RequestId{1}, EffectId{1}, EffectKind::reveal};
  const EffectToken focus{reveal.lifetime, reveal.request, EffectId{2}, EffectKind::focus};
  const EffectToken cancel{reveal.lifetime, reveal.request, EffectId{3}, EffectKind::cancel};
  CHECK(reveal != focus && focus != cancel && cancel != reveal);
  std::vector<Effect> effects{{reveal, SurfaceId{1}, {}, {}, {}, {}, {}},
                            {cancel, SurfaceId{1}, {}, {}, {}, {}, reveal}};
  std::vector<FocusNotification> notifications;
  auto drained = drainValues(effects);
  CHECK(effects.empty() && drained.size() == 2);
  CHECK(drained[1].cancels == reveal);
  CHECK(notifications.empty());
  CHECK(drainValues(notifications).empty());
}
