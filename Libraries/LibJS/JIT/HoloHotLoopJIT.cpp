/* SPDX-License-Identifier: BSD-2-Clause */
#include "HoloHotLoopJIT.h"

namespace JS::JIT {

bool HoloHotLoopJIT::record_and_maybe_tier_up(HotLoopProfile& profile) noexcept
{
    ++profile.invocation_count;
    if (!profile.compiled && profile.invocation_count >= HOT_LOOP_THRESHOLD) {
        profile.compiled = true;
        ++m_compiled_kernels;
        return true;
    }
    return profile.compiled;
}

double HoloHotLoopJIT::execute_compiled_sum_f64(double const* data, size_t count) const noexcept
{
    // 4-way unrolled superscalar accumulation matching holo-compiler Tier-2 numeric loop emission
    double acc0 = 0.0;
    double acc1 = 0.0;
    double acc2 = 0.0;
    double acc3 = 0.0;
    size_t i = 0;
    for (; i + 4 <= count; i += 4) {
        acc0 += data[i];
        acc1 += data[i + 1];
        acc2 += data[i + 2];
        acc3 += data[i + 3];
    }
    double tail = 0.0;
    for (; i < count; ++i)
        tail += data[i];
    return (acc0 + acc1) + (acc2 + acc3) + tail;
}

}
