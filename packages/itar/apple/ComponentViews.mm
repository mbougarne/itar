#import <React/RCTViewComponentView.h>
#import <React/RCTConversions.h>
#import <react/renderer/components/ItarSpec/ComponentDescriptors.h>
#import <react/renderer/components/ItarSpec/EventEmitters.h>
#import <react/renderer/components/ItarSpec/Props.h>
#import <react/renderer/components/ItarSpec/RCTComponentViewHelpers.h>
#import "ItarEngineNative-Swift.h"

// Fabric registration, value conversion and forwarding only. UIKit ownership,
// lifetime, focus, semantics and presentation behavior live in Swift.
using namespace facebook::react;
static std::string value(NSDictionary *record, NSString *key) {
  NSString *text = record[key];
  NSData *data = [text dataUsingEncoding:NSUTF8StringEncoding];
  return data.length ? std::string(static_cast<const char *>(data.bytes), data.length) : std::string{};
}

@interface ItarSurfaceComponentView : RCTViewComponentView <RCTItarSurfaceViewProtocol>
@end
@implementation ItarSurfaceComponentView {
  ItarSurfaceHost *_host;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<ItarSurfaceComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const ItarSurfaceProps>();
    [self installHost];
  }
  return self;
}
- (void)installHost {
  _host = [[ItarSurfaceHost alloc] initWithFrame:self.bounds];
  self.contentView = _host;
  __weak ItarSurfaceComponentView *weakSelf = self;
  _host.onFocusRecord = ^(NSDictionary *record) {
    ItarSurfaceComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onFocusRecord({
      value(record, @"lifetime"), value(record, @"request"), value(record, @"occurrenceKey"),
      value(record, @"mount"), value(record, @"kind"), value(record, @"channel")});
  };
  _host.onRequestRecord = ^(NSDictionary *record) {
    ItarSurfaceComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onRequestRecord({
      value(record, @"lifetime"), value(record, @"request"), value(record, @"status")});
  };
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = static_cast<const ItarSurfaceProps &>(*props);
  _host.active = next.active;
  [super updateProps:props oldProps:oldProps];
}
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [_host insertSubview:child atIndex:index];
}
- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [child removeFromSuperview];
}
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  // Codegen's argument checks are debug-only; keep the release boundary typed.
  NSUInteger count = [commandName isEqualToString:@"cancel"] ? 2 :
      [commandName isEqualToString:@"focus"] ? 1 : 0;
  BOOL known = [commandName isEqualToString:@"focus"] || [commandName isEqualToString:@"cancel"] ||
      [commandName isEqualToString:@"showDialog"] || [commandName isEqualToString:@"dismissDialog"];
  if (!known || args.count != count) { [_host rejectCommand:5]; return; }
  for (id argument in args) {
    if (![argument isKindOfClass:NSString.class]) { [_host rejectCommand:5]; return; }
  }
  RCTItarSurfaceHandleCommand(self, commandName, args);
}
- (void)focus:(NSString *)occurrenceKey { [_host focus:occurrenceKey]; }
- (void)cancel:(NSString *)lifetime request:(NSString *)request { [_host cancel:lifetime request:request]; }
- (void)showDialog { [_host showDialog]; }
- (void)dismissDialog { [_host dismissDialog]; }
- (BOOL)isAccessibilityElement { return NO; }
- (void)prepareForRecycle {
  [_host shutdown];
  [super prepareForRecycle];
  [self installHost];
}
- (void)invalidate {
  [_host shutdown];
  [super invalidate];
}
@end

@interface ItarTargetComponentView : RCTViewComponentView
@end
@implementation ItarTargetComponentView {
  ItarTargetHost *_host;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<ItarTargetComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const ItarTargetProps>();
    [self installHost];
  }
  return self;
}
- (void)installHost {
  _host = [[ItarTargetHost alloc] initWithFrame:self.bounds];
  self.contentView = _host;
  __weak ItarTargetComponentView *weakSelf = self;
  _host.onActivate = ^(NSDictionary *record) {
    ItarTargetComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarTargetEventEmitter &>(*owner->_eventEmitter).onActivate({
      value(record, @"lifetime"), value(record, @"occurrenceKey"), value(record, @"mount"),
      value(record, @"sequence"), value(record, @"source")});
  };
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = static_cast<const ItarTargetProps &>(*props);
  [super updateProps:props oldProps:oldProps];
  _host.occurrenceKey = [[NSString alloc] initWithBytes:next.occurrenceKey.data() length:next.occurrenceKey.size() encoding:NSUTF8StringEncoding];
  _host.label = [[NSString alloc] initWithBytes:next.label.data() length:next.label.size() encoding:NSUTF8StringEncoding];
  _host.order = next.order;
  _host.targetEnabled = next.enabled;
  _host.baseColor = RCTUIColorFromSharedColor(next.baseColor);
  _host.focusColor = RCTUIColorFromSharedColor(next.focusColor);
}
- (BOOL)isAccessibilityElement { return NO; }
- (NSObject *)accessibilityElement { return _host; }
- (void)prepareForRecycle {
  [_host recycle];
  [super prepareForRecycle];
  [self installHost];
}
- (void)invalidate {
  [_host recycle];
  [super invalidate];
}
@end

Class<RCTComponentViewProtocol> ItarSurfaceCls(void) { return ItarSurfaceComponentView.class; }
Class<RCTComponentViewProtocol> ItarTargetCls(void) { return ItarTargetComponentView.class; }
