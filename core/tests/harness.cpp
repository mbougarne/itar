#include <array>
#include <cstdlib>
#include <iostream>
#include <span>
#include <string_view>

int main(int argc, char* argv[]) {
  // Compile a C++20 facility through the linked target's usage requirements.
  constexpr std::array values{1, 2, 3};
  const std::span<const int> view{values};
  if (view.size() != 3 || view.front() != 1 || view.back() != 3) {
    std::cerr << "C++20 harness check failed\n";
    return EXIT_FAILURE;
  }
  if (argc == 2 && std::string_view{argv[1]} == "--fail") {
    std::cerr << "Intentional harness failure\n";
    return EXIT_FAILURE;
  }
  if (argc != 1) {
    std::cerr << "Usage: itar_core_harness [--fail]\n";
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
