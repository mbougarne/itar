require 'xcodeproj'
root = File.expand_path('../../..', __dir__)
project = Xcodeproj::Project.open("#{root}/apps/probe/ios/ItarProbe.xcodeproj")
app = project.targets.find { |target| target.name == 'ItarProbe' }
raise 'Missing app target' unless app
raise 'Tests already wired' if project.targets.any? { |target| target.name == 'ItarAppleTests' }
tests = project.new_target(:unit_test_bundle, 'ItarAppleTests', :tvos, '15.1')
tests.add_dependency(app)
ref = project.main_group.new_file("#{__dir__}/HostTests.swift")
tests.source_build_phase.add_file_reference(ref)
tests.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_NAME' => 'ItarAppleTests',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'org.itar.apple-probe.tests',
    'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0',
    'TEST_HOST' => '$(BUILT_PRODUCTS_DIR)/ItarProbe.app/ItarProbe',
    'BUNDLE_LOADER' => '$(TEST_HOST)'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'ItarAppleTests', true)
podfile = "#{root}/apps/probe/ios/Podfile"
File.open(podfile, 'a') { |f| f.puts "\ntarget 'ItarAppleTests' do\n  pod 'ItarProbeHost', :path => '../../..'\nend" }
