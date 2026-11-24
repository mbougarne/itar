require 'xcodeproj'
root = File.expand_path('../../../..', __dir__)
project = Xcodeproj::Project.open("#{root}/build/native-consumer/ios/ItarProbe.xcodeproj")
app = project.targets.find { |target| target.name == 'ItarProbe' }
raise 'Missing consumer target' unless app
raise 'Apple adapter tests already wired' if project.targets.any? { |target| target.name == 'ItarAdapterTests' }
tests = project.new_target(:unit_test_bundle, 'ItarAdapterTests', :tvos, '15.1')
tests.add_dependency(app)
tests.source_build_phase.add_file_reference(project.main_group.new_file("#{__dir__}/HostTests.swift"))
tests.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_NAME' => 'ItarAdapterTests',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'org.itar.adapter.tests', 'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0', 'TEST_HOST' => '$(BUILT_PRODUCTS_DIR)/ItarProbe.app/ItarProbe',
    'BUNDLE_LOADER' => '$(TEST_HOST)'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'ItarAdapterTests', true)
podfile = "#{root}/build/native-consumer/ios/Podfile"
source = File.read(podfile)
needle = '  config = use_native_modules!'
raise 'Missing native autolinking call' unless source.include?(needle)
File.write(podfile, source.sub(needle, needle + "\n  target 'ItarAdapterTests' do\n    inherit! :search_paths\n  end"))
