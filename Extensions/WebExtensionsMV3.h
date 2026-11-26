/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * AwesomeOS MV3 WebExtensions & uBlock Origin DeclarativeNetRequest Bridge (Upstream Issue #976)
 */
#pragma once

#include "../Bridges/AwesomeOS/b8g_ladybird_bridges.h"
#include <string_view>

namespace Ladybird::Extensions {

class WebExtensionsMV3Host {
public:
    WebExtensionsMV3Host() noexcept { b8g_content_blocker_init(&m_blocker); }

    bool register_filter_rule(char const* rule) noexcept
    {
        return b8g_content_blocker_add_rule(&m_blocker, rule) == B8G_OK;
    }

    bool should_block_request(char const* host) noexcept
    {
        return b8g_content_blocker_should_block(&m_blocker, host) == 1;
    }

    uint64_t blocked_count() const noexcept { return m_blocker.blocked_hits; }

private:
    B8gContentBlocker m_blocker {};
};

}
