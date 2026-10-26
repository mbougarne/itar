# Tarball-local core; the repository-root spec remains for development consumers.
Pod::Spec.new do |s|
  s.name = 'ItarEngineCore'
  s.version = '0.0.0'
  s.summary = 'Itar C++20 engine with a C-compatible Apple boundary'
  s.homepage = 'https://github.com/mbougarne/itar'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Itar contributors'
  s.source = { :git => 'https://github.com/mbougarne/itar.git', :tag => s.version }
  s.platform = :tvos, '15.1'
  s.source_files = 'cpp/src/*.cpp', 'cpp/include/itar/*.hpp', 'apple/ItarEngine.{h,cpp}'
  s.exclude_files = 'cpp/src/probe_surface.cpp'
  s.public_header_files = 'apple/ItarEngine.h'
  s.libraries = 'c++'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/cpp/include"'
  }
end
