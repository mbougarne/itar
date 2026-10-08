Pod::Spec.new do |s|
  s.name = 'ItarProbeHost'
  s.version = '0.0.0'
  s.summary = 'Disposable Swift/C++ host probe; not the production adapter'
  s.homepage = 'https://github.com/mbougarne/itar'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Itar contributors'
  s.source = { :git => 'https://github.com/mbougarne/itar.git', :tag => s.version }
  s.platforms = { :tvos => '15.1', :ios => '15.1' }
  s.swift_version = '5.0'
  s.source_files = 'probes/apple/*.{h,cpp,mm,swift}', 'core/src/probe_surface.cpp', 'core/include/itar/probe/*.hpp'
  s.public_header_files = 'probes/apple/ItarProbe.h'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/core/include"'
  }
  s.dependency 'React-Core'
end
