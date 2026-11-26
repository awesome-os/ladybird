/* SPDX-License-Identifier: BSD-2-Clause */
#pragma once

#include <cstddef>
#include <cstdint>

namespace JS::JIT {

enum class HoloKernelOp : uint8_t {
    AddF64 = 1,
    MulAddF64 = 2,
    SumArrayF64 = 3,
};

struct HotLoopProfile {
    uint64_t bytecode_hash { 0 };
    uint32_t invocation_count { 0 };
    bool compiled { false };
};

class HoloHotLoopJIT {
public:
    static constexpr uint32_t HOT_LOOP_THRESHOLD = 100;

    bool record_and_maybe_tier_up(HotLoopProfile& profile) noexcept;
    double execute_compiled_sum_f64(double const* data, size_t count) const noexcept;
    uint64_t compiled_kernel_count() const noexcept { return m_compiled_kernels; }

private:
    uint64_t m_compiled_kernels { 0 };
};

}
