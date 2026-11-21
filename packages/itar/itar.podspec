package_root = File.realpath(__dir__)
checkout_root = File.expand_path('../..', package_root)
checkout = package_root == File.join(checkout_root, 'packages', 'itar') &&
           File.file?(File.join(checkout_root, 'ItarEngineCore.podspec'))

Pod::Spec.new do |s|
  s.name = 'ItarEngineNative'
  s.version = '0.0.0'
  s.summary = 'Itar production C++20 engine with a confined Swift owner'
  s.homepage = 'https://github.com/mbougarne/itar'
  s.license = { :type => 'MIT', :file => checkout ? '../../LICENSE' : 'LICENSE' }
  s.author = 'Itar contributors'
  s.source = { :git => 'https://github.com/mbougarne/itar.git', :tag => s.version }
  s.platform = :tvos, '15.1'
  s.swift_version = '5.0'
  s.source_files = 'apple/*.{mm,swift}'
  s.dependency 'ItarEngineCore', s.version.to_s
  # The adapter consumes ItarEngineCore's public C module. Its private C++ headers
  # are resolved by the selected core pod in both the checkout and the tarball.
  s.pod_target_xcconfig = { 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20' }
  install_modules_dependencies(s)
end
