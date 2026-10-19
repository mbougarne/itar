require 'fileutils'
root = File.expand_path('../../../..', __dir__)
build = File.expand_path(ARGV.fetch(0))
raise 'Build the CMake production boundary first' unless File.file?("#{build}/libitar_apple_engine.a")
output = "#{build}/swift-boundary"
FileUtils.mkdir_p(output)
sources = ["#{root}/packages/itar/apple/EngineConnection.swift", "#{__dir__}/BoundaryTests.swift"]
command = ['xcrun', 'swiftc', '-swift-version', '5', '-warnings-as-errors', '-parse-as-library',
           '-import-objc-header', "#{root}/packages/itar/apple/ItarEngine.h", *sources,
           "#{build}/libitar_apple_engine.a", "#{build}/libitar_core.a", '-lc++',
           '-o', "#{output}/boundary-tests"]
raise 'Swift boundary compilation failed' unless system(*command)
raise 'Swift boundary checks failed' unless system("#{output}/boundary-tests")
