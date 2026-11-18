# Public C++ headers

[العربية](README.ar.md)

Consumers of `itar::core` include headers as `<itar/name.hpp>`. Start with [state.hpp](state.hpp) and [identity.hpp](identity.hpp) for the surface, occurrence keys and registration handles. [navigation.hpp](navigation.hpp) exposes destination selection, [transaction.hpp](transaction.hpp) exposes the request/effect lifecycle and [collection.hpp](collection.hpp) adds fixed-extent list membership and row-entry policy. The [engine walkthrough](../../../docs/guides/architecture.md) ties them together.

The headers under [probe/](probe/) belong to the separate `itar::probe` fixture.
