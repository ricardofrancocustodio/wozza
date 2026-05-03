const { neon } = require('@neondatabase/serverless');

let _client;

function getClient() {
    if (!_client) _client = neon(process.env.DATABASE_URL);
    return _client;
}

const sql = (strings, ...values) => getClient()(strings, ...values);

// ─── Schema ──────────────────────────────────────────────────────────────────

async function ensureSchema() {
    await sql`
        CREATE TABLE IF NOT EXISTS social_channel_configs (
            id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            school_id                 TEXT NOT NULL,
            platform                  TEXT NOT NULL,
            enabled                   BOOLEAN NOT NULL DEFAULT FALSE,
            connection_status         TEXT NOT NULL DEFAULT 'PENDING',
            account_label             TEXT NOT NULL DEFAULT '',
            webhook_verify_token      TEXT NOT NULL DEFAULT '',
            auto_reply_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
            notify_director_on_sensitive BOOLEAN NOT NULL DEFAULT TRUE,
            allowed_channels          TEXT[] NOT NULL DEFAULT ARRAY['DIRECT','POST_COMMENT'],
            metadata                  JSONB NOT NULL DEFAULT '{}',
            credentials_present       JSONB NOT NULL DEFAULT '{"access_token":false,"refresh_token":false,"app_secret":false}',
            credentials_encrypted     TEXT,
            updated_at                TIMESTAMPTZ,
            UNIQUE(school_id, platform)
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS social_inbox_messages (
            id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            school_id                   TEXT NOT NULL,
            platform                    TEXT NOT NULL,
            channel                     TEXT NOT NULL,
            sender_handle               TEXT,
            sender_name                 TEXT,
            message_text                TEXT NOT NULL,
            post_permalink              TEXT,
            message_permalink           TEXT,
            metadata                    JSONB NOT NULL DEFAULT '{}',
            classification_category     TEXT,
            classification_decision     TEXT,
            classification_confidence   FLOAT,
            classification_justification TEXT,
            ai_response_text            TEXT,
            manual_reply_text           TEXT,
            status                      TEXT NOT NULL DEFAULT 'NEW',
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_sim_school ON social_inbox_messages(school_id, created_at DESC)
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS social_sensitive_alerts (
            id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            message_id  TEXT NOT NULL REFERENCES social_inbox_messages(id) ON DELETE CASCADE,
            category    TEXT,
            severity    TEXT NOT NULL DEFAULT 'MEDIUM',
            status      TEXT NOT NULL DEFAULT 'OPEN',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_ssa_msg ON social_sensitive_alerts(message_id)
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS social_reply_configs (
            school_id       TEXT PRIMARY KEY,
            bot_name        TEXT NOT NULL DEFAULT 'Alva',
            identity_phrase TEXT,
            school_short_name TEXT,
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS social_posts (
            id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            school_id   TEXT NOT NULL,
            post_text   TEXT NOT NULL,
            media       JSONB,
            results     JSONB NOT NULL DEFAULT '[]',
            published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_sp_school ON social_posts(school_id, published_at DESC)
    `;
}

// ─── Channel configs ──────────────────────────────────────────────────────────

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN'];

async function ensureAllSocialPlatforms(schoolId) {
    for (const platform of PLATFORMS) {
        await sql`
            INSERT INTO social_channel_configs (id, school_id, platform)
            VALUES (gen_random_uuid()::text, ${schoolId}, ${platform})
            ON CONFLICT (school_id, platform) DO NOTHING
        `;
    }
    const rows = await sql`
        SELECT * FROM social_channel_configs WHERE school_id = ${schoolId} ORDER BY platform
    `;
    return rows;
}

async function getConfig(schoolId, platform) {
    const rows = await sql`
        SELECT * FROM social_channel_configs WHERE school_id = ${schoolId} AND platform = ${platform}
    `;
    return rows[0] || null;
}

async function upsertConfig(schoolId, platform, fields) {
    await sql`
        INSERT INTO social_channel_configs (id, school_id, platform)
        VALUES (gen_random_uuid()::text, ${schoolId}, ${platform})
        ON CONFLICT (school_id, platform) DO NOTHING
    `;
    const sets = Object.entries(fields);
    // build dynamically: each field is a named update
    const row = await sql`
        UPDATE social_channel_configs SET
            enabled                      = ${fields.enabled ?? null}::boolean,
            connection_status            = COALESCE(${fields.connection_status ?? null}, connection_status),
            account_label                = COALESCE(${fields.account_label ?? null}, account_label),
            webhook_verify_token         = COALESCE(${fields.webhook_verify_token ?? null}, webhook_verify_token),
            auto_reply_enabled           = ${fields.auto_reply_enabled ?? null}::boolean,
            notify_director_on_sensitive = ${fields.notify_director_on_sensitive ?? null}::boolean,
            allowed_channels             = COALESCE(${fields.allowed_channels ?? null}, allowed_channels),
            metadata                     = COALESCE(${fields.metadata ?? null}, metadata),
            credentials_present          = COALESCE(${fields.credentials_present ?? null}, credentials_present),
            credentials_encrypted        = COALESCE(${fields.credentials_encrypted ?? null}, credentials_encrypted),
            updated_at                   = now()
        WHERE school_id = ${schoolId} AND platform = ${platform}
        RETURNING *
    `;
    return row[0];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

async function insertMessage(msg) {
    const rows = await sql`
        INSERT INTO social_inbox_messages (
            id, school_id, platform, channel,
            sender_handle, sender_name, message_text,
            post_permalink, message_permalink, metadata,
            classification_category, classification_decision,
            classification_confidence, classification_justification,
            ai_response_text, status
        ) VALUES (
            gen_random_uuid()::text,
            ${msg.school_id}, ${msg.platform}, ${msg.channel},
            ${msg.sender_handle || null}, ${msg.sender_name || null}, ${msg.message_text},
            ${msg.post_permalink || null}, ${msg.message_permalink || null},
            ${JSON.stringify(msg.metadata || {})},
            ${msg.classification_category || null}, ${msg.classification_decision || null},
            ${msg.classification_confidence || null}, ${msg.classification_justification || null},
            ${msg.ai_response_text || null}, ${msg.status || 'NEW'}
        ) RETURNING *
    `;
    return rows[0];
}

async function updateMessage(id, fields) {
    const rows = await sql`
        UPDATE social_inbox_messages SET
            status            = COALESCE(${fields.status ?? null}, status),
            manual_reply_text = COALESCE(${fields.manual_reply_text ?? null}, manual_reply_text),
            updated_at        = now()
        WHERE id = ${id}
        RETURNING *
    `;
    return rows[0] || null;
}

async function getRecentMessages(schoolId, limit = 20) {
    return sql`
        SELECT * FROM social_inbox_messages
        WHERE school_id = ${schoolId}
        ORDER BY created_at DESC
        LIMIT ${limit}
    `;
}

async function countMessages(schoolId) {
    const rows = await sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE classification_decision IN ('AUTO_REPLY','MIXED'))::int AS auto_reply,
            COUNT(*) FILTER (WHERE classification_decision IN ('SENSITIVE','MIXED'))::int AS sensitive
        FROM social_inbox_messages WHERE school_id = ${schoolId}
    `;
    return rows[0] || { total: 0, auto_reply: 0, sensitive: 0 };
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

async function insertAlert(alert) {
    const rows = await sql`
        INSERT INTO social_sensitive_alerts (id, message_id, category, severity, status)
        VALUES (gen_random_uuid()::text, ${alert.message_id}, ${alert.category || null}, ${alert.severity || 'MEDIUM'}, 'OPEN')
        RETURNING *
    `;
    return rows[0];
}

async function getOpenAlerts(schoolId) {
    return sql`
        SELECT a.*, m.sender_handle, m.sender_name, m.message_text, m.platform, m.channel, m.post_permalink
        FROM social_sensitive_alerts a
        JOIN social_inbox_messages m ON m.id = a.message_id
        WHERE m.school_id = ${schoolId} AND a.status = 'OPEN'
        ORDER BY a.created_at DESC
    `;
}

async function closeAlertsForMessage(messageId) {
    await sql`
        UPDATE social_sensitive_alerts SET status = 'CLOSED' WHERE message_id = ${messageId}
    `;
}

async function setAlertsInProgress(messageId) {
    await sql`
        UPDATE social_sensitive_alerts SET status = 'IN_PROGRESS' WHERE message_id = ${messageId}
    `;
}

// ─── Reply config ─────────────────────────────────────────────────────────────

async function getReplyConfig(schoolId) {
    const rows = await sql`
        SELECT * FROM social_reply_configs WHERE school_id = ${schoolId}
    `;
    return rows[0] || null;
}

async function upsertReplyConfig(schoolId, fields) {
    const rows = await sql`
        INSERT INTO social_reply_configs (school_id, bot_name, identity_phrase, school_short_name)
        VALUES (${schoolId}, ${fields.bot_name || 'Alva'}, ${fields.identity_phrase || null}, ${fields.school_short_name || null})
        ON CONFLICT (school_id) DO UPDATE SET
            bot_name          = EXCLUDED.bot_name,
            identity_phrase   = EXCLUDED.identity_phrase,
            school_short_name = EXCLUDED.school_short_name,
            updated_at        = now()
        RETURNING *
    `;
    return rows[0];
}

// ─── Posts ────────────────────────────────────────────────────────────────────

async function insertPost(post) {
    const rows = await sql`
        INSERT INTO social_posts (id, school_id, post_text, media, results)
        VALUES (gen_random_uuid()::text, ${post.school_id}, ${post.text}, ${JSON.stringify(post.media || null)}, ${JSON.stringify(post.results || [])})
        RETURNING *
    `;
    return rows[0];
}

async function getPostsByDateRange(schoolId, from, to) {
    return sql`
        SELECT * FROM social_posts
        WHERE school_id = ${schoolId}
          AND published_at >= ${from}::timestamptz
          AND published_at <= ${to}::timestamptz
        ORDER BY published_at DESC
    `;
}

module.exports = {
    sql, ensureSchema,
    ensureAllSocialPlatforms, getConfig, upsertConfig,
    insertMessage, updateMessage, getRecentMessages, countMessages,
    insertAlert, getOpenAlerts, closeAlertsForMessage, setAlertsInProgress,
    getReplyConfig, upsertReplyConfig,
    insertPost, getPostsByDateRange,
    PLATFORMS
};
