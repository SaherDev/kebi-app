Pod::Spec.new do |s|
  s.name           = 'KebiAppGroup'
  s.version        = '1.0.0'
  s.summary        = 'Shared App Group storage between the Kebi app and its share extension'
  s.description    = 'Reads and writes the App Group UserDefaults suite the share extension also uses.'
  s.author         = 'Kebi'
  s.homepage       = 'https://kebi.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
