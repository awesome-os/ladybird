/* SPDX-License-Identifier: BSD-2-Clause */
#pragma once

#include <array>
#include <cstdint>

namespace Wasm::SIMD {

struct alignas(16) V128 {
    union {
        std::array<int32_t, 4> i32x4;
        std::array<float, 4> f32x4;
        std::array<uint8_t, 16> bytes;
    };
};

V128 i32x4_splat(int32_t v) noexcept;
V128 i32x4_add(V128 a, V128 b) noexcept;
V128 f32x4_mul_add(V128 a, V128 b, V128 c) noexcept;

}
