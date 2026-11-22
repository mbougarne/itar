# Loaded only by the generated Cinema Podfile.
def configure_cinema_pods(installer)
  project = installer.pods_project
  # AsyncStorage 2.2 sets a tvOS 11 minimum on its resource bundle.
  # Build it for the same minimum as Cinema when that minimum is higher.
  resources = project.targets.find { |t| t.name == 'RNCAsyncStorage-RNCAsyncStorage_resources' }
  cinema = installer.podfile.target_definitions.fetch('ItarProbe').platform.deployment_target.to_s
  resources&.build_configurations&.each do |config|
    minimum = config.build_settings['TVOS_DEPLOYMENT_TARGET']
    if minimum && Gem::Version.new(minimum) < Gem::Version.new(cinema)
      config.build_settings['TVOS_DEPLOYMENT_TARGET'] = cinema
    end
  end

  # The recorder shares the adapter's Swift module and needs no package API.
  target = project.targets.find { |t| t.name == 'ItarEngineNative' }
  raise 'The Cinema workspace needs the ItarEngineNative pod' unless target

  group = project.main_group.find_subpath('Cinema Occo', true)
  sources = Dir[File.join(__dir__, 'occo/apple', '*.{swift,m}')].sort
  raise 'Missing Cinema Occo recorder sources' if sources.empty?
  sources.each do |source|
    path = Pathname.new(source).relative_path_from(project.path.dirname)
    ref = group.files.find { |f| f.path == path.to_s } || group.new_file(path, :project)
    target.source_build_phase.add_file_reference(ref, true)
  end

  target.build_configurations.each do |config|
    if config.name == 'Debug'
      { 'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => 'ITAR_OCCO',
        'GCC_PREPROCESSOR_DEFINITIONS' => 'ITAR_OCCO=1' }.each do |key, flag|
        config.build_settings[key] = (Array(config.build_settings[key] || '$(inherited)') | [flag])
      end
    else
      files = sources.map { |source| File.basename(source) }
      key = 'EXCLUDED_SOURCE_FILE_NAMES'
      config.build_settings[key] = Array(config.build_settings[key] || '$(inherited)') | files
    end
  end
end
