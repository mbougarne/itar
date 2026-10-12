#pragma once

#include <cstdlib>
#include <iostream>

// Always active, including Release/NDEBUG. Report the actual failing expression.
#define CHECK(expression)                                                       \
  do {                                                                          \
    if (!(expression)) {                                                        \
      std::cerr << __FILE__ << ':' << __LINE__ << ": " << #expression << '\n';    \
      std::exit(EXIT_FAILURE);                                                  \
    }                                                                           \
  } while (false)
