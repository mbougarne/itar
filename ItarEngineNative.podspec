Pod::Spec.new do |s|
  s.name = 'ItarEngineNative'
  s.version = '0.0.0'
  s.summary = 'Itar production C++20 engine with a confined Swift owner'
  s.homepage = 'https://github.com/mbougarne/itar'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Itar contributors'
  s.source = { :git => 'https://github.com/mbougarne/itar.git', :tag => s.version }
  s.platform = :tvos, '15.1'
  s.swift_version = '5.0'
  s.source_files = 'packages/itar/apple/*.{h,cpp,mm,swift}', 'core/include/itar/*.hpp', 'core/src/*.cpp'
  s.exclude_files = 'core/src/probe_surface.cpp'
  s.public_header_files = 'packages/itar/apple/ItarEngine.h'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/core/include"'
  }
  install_modules_dependencies(s)
end
