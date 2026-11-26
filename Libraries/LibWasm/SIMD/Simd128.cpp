/* SPDX-License-Identifier: BSD-2-Clause */
#include "Simd128.h"

namespace Wasm::SIMD {

V128 i32x4_splat(int32_t v) noexcept
{
    V128 out {};
    out.i32x4 = { v, v, v, v };
    return out;
}

V128 i32x4_add(V128 a, V128 b) noexcept
{
    V128 out {};
    for (size_t lane = 0; lane < 4; ++lane)
        out.i32x4[lane] = static_cast<int32_t>(static_cast<uint32_t>(a.i32x4[lane]) + static_cast<uint32_t>(b.i32x4[lane]));
    return out;
}

V128 f32x4_mul_add(V128 a, V128 b, V128 c) noexcept
{
    V128 out {};
    for (size_t lane = 0; lane < 4; ++lane)
        out.f32x4[lane] = a.f32x4[lane] * b.f32x4[lane] + c.f32x4[lane];
    return out;
}

}
