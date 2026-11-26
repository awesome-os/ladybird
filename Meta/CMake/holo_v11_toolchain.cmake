# SPDX-License-Identifier: BSD-2-Clause
# AwesomeOS Holo v11 CAS CMake Toolchain Pre-Resolver for Ladybird
# Resolves shared C/C++ libraries (icu, skia, harfbuzz, freetype, libpng, libwebp,
# zlib-ng, openssl, simde) from $B8G_CAS_DIR/v11/links via 0-byte hardlinks
# before falling back to upstream vcpkg source builds.

if (DEFINED ENV{B8G_CAS_DIR} AND NOT "$ENV{B8G_CAS_DIR}" STREQUAL "")
    set(AWESOMEOS_CAS_ROOT "$ENV{B8G_CAS_DIR}")
else()
    if (WIN32)
        set(AWESOMEOS_CAS_ROOT "$ENV{USERPROFILE}/.b8g/cas")
    else()
        set(AWESOMEOS_CAS_ROOT "$ENV{HOME}/.b8g/cas")
    endif()
endif()

set(AWESOMEOS_V11_LINKS "${AWESOMEOS_CAS_ROOT}/v11/links")
if (EXISTS "${AWESOMEOS_V11_LINKS}")
    message(STATUS "[AwesomeOS Holo v11] Prepending shared CAS link root: ${AWESOMEOS_V11_LINKS}")
    list(PREPEND CMAKE_PREFIX_PATH "${AWESOMEOS_V11_LINKS}")
    list(PREPEND CMAKE_LIBRARY_PATH "${AWESOMEOS_V11_LINKS}")
endif()

set(ENABLE_AWESOME_OS_BRIDGES ON CACHE BOOL "Enable AwesomeOS B8G_ABI_MAGIC_V3 C11 bridges" FORCE)
