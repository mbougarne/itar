#import <React/RCTViewManager.h>
// Legacy view registration exercised through RN TV's Fabric interop layer.
// All focus, lifetime, style and accessibility behavior stays in Swift.
@interface RCT_EXTERN_MODULE(ItarAppleProbeManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(onNativeActivation, RCTDirectEventBlock)
@end
