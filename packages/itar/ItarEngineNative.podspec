# Retain the explicit pod name/path used by existing development consumers.
eval(File.read(File.join(__dir__, 'itar.podspec')), binding, File.join(__dir__, 'itar.podspec'))
