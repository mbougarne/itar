cmake_minimum_required(VERSION 3.20)
project(itar_web LANGUAGES CXX)
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure through Emscripten emcmake; native builds are not browser artifacts")
endif()
get_filename_component(ITAR_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../.." ABSOLUTE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(ITAR_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
add_subdirectory("${ITAR_ROOT}/core" core EXCLUDE_FROM_ALL)
add_executable(itar_web binding.cpp)
target_link_libraries(itar_web PRIVATE itar::core)
target_compile_options(itar_core PRIVATE -fexceptions)
target_compile_options(itar_web PRIVATE -fexceptions -Wall -Wextra -Wpedantic -Werror)
target_link_options(itar_web PRIVATE --bind -fexceptions
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createItarEngine
  "-sINCOMING_MODULE_JS_API=['wasmBinary','locateFile','onAbort']"
  -sENVIRONMENT=web -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=268435456 -sSTACK_SIZE=1048576
  -sMIN_CHROME_VERSION=85 -sMIN_SAFARI_VERSION=150000)
set_target_properties(itar_web PROPERTIES OUTPUT_NAME itar-web SUFFIX .js)
