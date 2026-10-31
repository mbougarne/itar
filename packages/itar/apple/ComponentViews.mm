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
_host.onCollectionRecord = ^(NSDictionary *record) {
  ItarSurfaceComponentView *owner = weakSelf;
  if (!owner || !owner->_eventEmitter) return;
  static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onCollectionRecord({
    value(record, @"lifetime"), value(record, @"provider"), value(record, @"sequence"), value(record, @"payload")});
};
_host.onSurfaceRecord = ^(NSDictionary *record) {
    ItarSurfaceComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onSurfaceRecord({
      value(record, @"lifetime"), value(record, @"provider"), value(record, @"sequence"), value(record, @"state")});
  };
  _host.onFocusRecord = ^(NSDictionary *record) {
    ItarSurfaceComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onFocusRecord({
      value(record, @"lifetime"), value(record, @"request"), value(record, @"occurrenceKey"),
      value(record, @"mount"), value(record, @"kind"), value(record, @"channel"), value(record, @"provider"), value(record, @"sequence")});
  };
  _host.onRequestRecord = ^(NSDictionary *record) {
    ItarSurfaceComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarSurfaceEventEmitter &>(*owner->_eventEmitter).onRequestRecord({
      value(record, @"lifetime"), value(record, @"request"), value(record, @"status"), value(record, @"command"),
      value(record, @"provider"), value(record, @"sequence")});
  };
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = static_cast<const ItarSurfaceProps &>(*props);
  _host.providerId = [[NSString alloc] initWithBytes:next.providerId.data() length:next.providerId.size() encoding:NSUTF8StringEncoding];
  _host.active = next.active;
  _host.collectionData = [[NSString alloc] initWithBytes:next.collectionData.data() length:next.collectionData.size() encoding:NSUTF8StringEncoding];
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
  NSUInteger count = ([commandName isEqualToString:@"cancel"] || [commandName isEqualToString:@"focusRequest"] || [commandName isEqualToString:@"restoreScopeRequest"]) ? 2 :
      ([commandName isEqualToString:@"focus"] || [commandName isEqualToString:@"cancelRequest"] || [commandName isEqualToString:@"prepareCollection"]) ? 1 : 0;
  BOOL known = [commandName isEqualToString:@"focus"] || [commandName isEqualToString:@"cancel"] ||
      [commandName isEqualToString:@"showDialog"] || [commandName isEqualToString:@"dismissDialog"] ||
      [commandName isEqualToString:@"focusRequest"] || [commandName isEqualToString:@"cancelRequest"] || [commandName isEqualToString:@"restoreScopeRequest"] || [commandName isEqualToString:@"prepareCollection"];
  if (!known || args.count != count) { [_host rejectCommand:5]; return; }
  for (id argument in args) {
    if (![argument isKindOfClass:NSString.class]) { [_host rejectCommand:5]; return; }
  }
  RCTItarSurfaceHandleCommand(self, commandName, args);
}
- (void)prepareCollection:(NSString *)payload { [_host prepareCollection:payload]; }
- (void)focus:(NSString *)occurrenceKey { [_host focus:occurrenceKey]; }
- (void)cancel:(NSString *)lifetime request:(NSString *)request { [_host cancel:lifetime request:request]; }
- (void)showDialog { [_host showDialog]; }
- (void)dismissDialog { [_host dismissDialog]; }
- (void)focusRequest:(NSString *)key command:(NSString *)command { [_host focusRequest:key command:command]; }
- (void)cancelRequest:(NSString *)command { [_host cancelRequest:command]; }
- (void)restoreScopeRequest:(NSString *)key command:(NSString *)command { [_host restoreScopeRequest:key command:command]; }
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
  _host.onAdjust = ^(NSDictionary *record) {
    ItarTargetComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarTargetEventEmitter &>(*owner->_eventEmitter).onAdjust({
      value(record, @"lifetime"), value(record, @"occurrenceKey"), value(record, @"mount"),
      value(record, @"sequence"), value(record, @"source"), value(record, @"provider"), value(record, @"registration"),
      value(record, @"delta")});
  };
  _host.onActivate = ^(NSDictionary *record) {
    ItarTargetComponentView *owner = weakSelf;
    if (!owner || !owner->_eventEmitter) return;
    static_cast<const ItarTargetEventEmitter &>(*owner->_eventEmitter).onActivate({
      value(record, @"lifetime"), value(record, @"occurrenceKey"), value(record, @"mount"),
      value(record, @"sequence"), value(record, @"source"), value(record, @"provider"), value(record, @"registration")});
  };
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = static_cast<const ItarTargetProps &>(*props);
  [super updateProps:props oldProps:oldProps];
  _host.occurrenceKey = [[NSString alloc] initWithBytes:next.occurrenceKey.data() length:next.occurrenceKey.size() encoding:NSUTF8StringEncoding];
  _host.scopeKey = [[NSString alloc] initWithBytes:next.scopeKey.data() length:next.scopeKey.size() encoding:NSUTF8StringEncoding];
  _host.collectionDataset = [[NSString alloc] initWithBytes:next.collectionDataset.data() length:next.collectionDataset.size() encoding:NSUTF8StringEncoding];
  _host.registrationId = [[NSString alloc] initWithBytes:next.registrationId.data() length:next.registrationId.size() encoding:NSUTF8StringEncoding];
  _host.label = [[NSString alloc] initWithBytes:next.label.data() length:next.label.size() encoding:NSUTF8StringEncoding];
  _host.displayLabel = [[NSString alloc] initWithBytes:next.displayLabel.data() length:next.displayLabel.size() encoding:NSUTF8StringEncoding];
  _host.labelPlacement = next.labelPlacement == ItarTargetLabelPlacement::Bottom ? @"bottom" : next.labelPlacement == ItarTargetLabelPlacement::BottomCenter ? @"bottom-center" : @"center";
  _host.labelSize = next.labelSize;
  _host.outlineInsetBottom = next.outlineInsetBottom;
  _host.order = next.order;
  _host.targetEnabled = next.enabled;
  _host.adjustable = next.adjustable;
  _host.baseColor = RCTUIColorFromSharedColor(next.baseColor);
  _host.focusColor = RCTUIColorFromSharedColor(next.focusColor);
  _host.cornerRadius = next.cornerRadius;
  _host.focusBackgroundColor = RCTUIColorFromSharedColor(next.focusBackgroundColor);
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

@interface ItarScopeComponentView : RCTViewComponentView
@end
@implementation ItarScopeComponentView {
  ItarScopeHost *_host;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<ItarScopeComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const ItarScopeProps>();
    _host = [[ItarScopeHost alloc] initWithFrame:self.bounds];
    self.contentView = _host;
  }
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = static_cast<const ItarScopeProps &>(*props);
  [super updateProps:props oldProps:oldProps];
  auto text = [](const std::string &s) { return [[NSString alloc] initWithBytes:s.data() length:s.size() encoding:NSUTF8StringEncoding]; };
  _host.collectionDataset = text(next.collectionDataset);
  int32_t layout = next.layout == ItarScopeLayout::Row ? 1 : next.layout == ItarScopeLayout::Column ? 2 : 0;
  int32_t boundary = next.boundary == ItarScopeBoundary::Wrap ? 1 : next.boundary == ItarScopeBoundary::Parent ? 2 : 0;
  [_host configure:text(next.scopeKey) parent:text(next.parentScopeKey) active:next.active layout:layout
          boundary:boundary trap:next.trap entryReady:next.entryReady preferred:text(next.preferredKey)];
  _host.restoreOnEntry = next.restoreOnEntry;
}
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index { [_host insertSubview:child atIndex:index]; }
- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index { [child removeFromSuperview]; }
- (BOOL)isAccessibilityElement { return NO; }
- (void)prepareForRecycle {
  [_host recycle];
  [super prepareForRecycle];
  _host = [[ItarScopeHost alloc] initWithFrame:self.bounds];
  self.contentView = _host;
}
- (void)invalidate { [_host recycle]; [super invalidate]; }
@end

Class<RCTComponentViewProtocol> ItarSurfaceCls(void) { return ItarSurfaceComponentView.class; }
Class<RCTComponentViewProtocol> ItarTargetCls(void) { return ItarTargetComponentView.class; }
Class<RCTComponentViewProtocol> ItarScopeCls(void) { return ItarScopeComponentView.class; }
