const { neon } = require('@neondatabase/serverless');

let _client;

function getClient() {
    if (!_client) _client = neon(process.env.DATABASE_URL);
    return _client;
}

const sql = (strings, ...values) => getClient()(strings, ...values);

// ─── Schema ──────────────────────────────────────────────────────────────────

async function ensureSchema() {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

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

    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS external_id TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS content TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS permalink TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS account_username TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS account_avatar TEXT`;
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`;

    await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sp_school_platform_external
        ON social_posts(school_id, platform, external_id)
        WHERE platform IS NOT NULL AND external_id IS NOT NULL
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS app_users (
            id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            email                TEXT NOT NULL UNIQUE,
            name                 TEXT NOT NULL DEFAULT '',
            password_hash        TEXT,
            password_salt        TEXT,
            role                 TEXT NOT NULL DEFAULT 'admin',
            school_id            TEXT NOT NULL DEFAULT 'wozza-default-school',
            status               TEXT NOT NULL DEFAULT 'invited',
            avatar_url           TEXT,
            auth_provider        TEXT,
            provider_id          TEXT,
            first_login_required BOOLEAN NOT NULL DEFAULT TRUE,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_login_at        TIMESTAMPTZ
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_app_users_provider ON app_users(auth_provider, provider_id)
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS auth_password_tokens (
            id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            purpose    TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at    TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_password_tokens_user ON auth_password_tokens(user_id, purpose)
    `;

    // ─── Billing schema ───────────────────────────────────────────────────────

    await sql`
        CREATE TABLE IF NOT EXISTS billing_plans (
            id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            code          TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            billing_cycle TEXT NOT NULL,
            price_cents   INTEGER NOT NULL,
            currency      TEXT NOT NULL DEFAULT 'BRL',
            trial_days    INTEGER NOT NULL DEFAULT 7,
            max_social_channels  INTEGER,
            max_scheduled_posts  INTEGER,
            max_ai_interactions  INTEGER,
            active        BOOLEAN NOT NULL DEFAULT TRUE,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        INSERT INTO billing_plans (code, name, billing_cycle, price_cents, trial_days)
        VALUES
            ('mensal', 'Wozza Mensal', 'monthly', 4990,  7),
            ('anual',  'Wozza Anual',  'annual',  35880, 7)
        ON CONFLICT (code) DO NOTHING
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS accounts (
            id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name       TEXT NOT NULL,
            document   TEXT,
            email      TEXT,
            phone      TEXT,
            status     TEXT NOT NULL DEFAULT 'onboarding',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS account_members (
            id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            role       TEXT NOT NULL DEFAULT 'owner',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(account_id, user_id)
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_account_members_user ON account_members(user_id)
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS account_subscriptions (
            id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            account_id               TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
            plan_code                TEXT NOT NULL REFERENCES billing_plans(code),
            status                   TEXT NOT NULL DEFAULT 'trialing',
            trial_starts_at          TIMESTAMPTZ,
            trial_ends_at            TIMESTAMPTZ,
            current_period_starts_at TIMESTAMPTZ,
            current_period_ends_at   TIMESTAMPTZ,
            cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
            provider                 TEXT,
            provider_customer_id     TEXT,
            provider_subscription_id TEXT,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS billing_events (
            id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            account_id TEXT,
            provider   TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_id   TEXT UNIQUE,
            payload    JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS onboarding_steps (
            account_id               TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
            plan_selected            BOOLEAN NOT NULL DEFAULT FALSE,
            trial_started            BOOLEAN NOT NULL DEFAULT FALSE,
            first_social_connected   BOOLEAN NOT NULL DEFAULT FALSE,
            first_post_created       BOOLEAN NOT NULL DEFAULT FALSE,
            dismissed_connect_social BOOLEAN NOT NULL DEFAULT FALSE,
            completed_at             TIMESTAMPTZ,
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;

    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS default_account_id TEXT`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`;

    // ─── Scheduler ────────────────────────────────────────────────────────────

    await sql`
        CREATE TABLE IF NOT EXISTS scheduled_posts (
            id            SERIAL PRIMARY KEY,
            school_id     TEXT NOT NULL,
            platform      TEXT NOT NULL,
            content       TEXT NOT NULL,
            media_url     TEXT,
            media_type    TEXT NOT NULL DEFAULT 'IMAGE',
            scheduled_for TIMESTAMPTZ NOT NULL,
            timezone      TEXT NOT NULL DEFAULT 'UTC',
            status        TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            post_id       TEXT,
            locale        TEXT NOT NULL DEFAULT 'pt-BR',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
            ON scheduled_posts (status, scheduled_for)
            WHERE status = 'pending'
    `;
}

// ─── Channel configs ──────────────────────────────────────────────────────────

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'YOUTUBE'];

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
    const row = await sql`
        UPDATE social_channel_configs SET
            enabled                      = COALESCE(${fields.enabled ?? null}::boolean, enabled),
            connection_status            = COALESCE(${fields.connection_status ?? null}, connection_status),
            account_label                = COALESCE(${fields.account_label ?? null}, account_label),
            webhook_verify_token         = COALESCE(${fields.webhook_verify_token ?? null}, webhook_verify_token),
            auto_reply_enabled           = COALESCE(${fields.auto_reply_enabled ?? null}::boolean, auto_reply_enabled),
            notify_director_on_sensitive = COALESCE(${fields.notify_director_on_sensitive ?? null}::boolean, notify_director_on_sensitive),
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

async function updateMessageForSchool(id, schoolId, fields) {
    const rows = await sql`
        UPDATE social_inbox_messages SET
            status            = COALESCE(${fields.status ?? null}, status),
            manual_reply_text = COALESCE(${fields.manual_reply_text ?? null}, manual_reply_text),
            updated_at        = now()
        WHERE id = ${id} AND school_id = ${schoolId}
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
        INSERT INTO social_posts (
            id, school_id, platform, external_id, post_text, content, media, results,
            published_at, media_url, thumbnail_url, permalink, media_type,
            like_count, comments_count, account_username, account_avatar, synced_at
        )
        VALUES (
            gen_random_uuid()::text,
            ${post.school_id}, ${post.platform || null}, ${post.external_id || null}, ${post.text}, ${post.content || post.text},
            ${JSON.stringify(post.media || null)}, ${JSON.stringify(post.results || [])},
            ${post.published_at || new Date().toISOString()}::timestamptz, ${post.media_url || null}, ${post.thumbnail_url || null},
            ${post.permalink || null}, ${post.media_type || null}, ${post.like_count || 0}, ${post.comments_count || 0},
            ${post.account_username || null}, ${post.account_avatar || null}, ${post.platform ? new Date().toISOString() : null}::timestamptz
        )
        RETURNING *
    `;
    return rows[0];
}

async function upsertSyncedPost(post) {
    const rows = await sql`
        INSERT INTO social_posts (
            id, school_id, platform, external_id, post_text, content, media, results,
            published_at, media_url, thumbnail_url, permalink, media_type,
            like_count, comments_count, account_username, account_avatar, synced_at
        ) VALUES (
            gen_random_uuid()::text,
            ${post.school_id}, ${post.platform}, ${post.external_id}, ${post.content || ''}, ${post.content || ''},
            ${JSON.stringify(post.media || null)}, ${JSON.stringify(post.results || [])},
            ${post.published_at}::timestamptz, ${post.media_url || null}, ${post.thumbnail_url || null},
            ${post.permalink || null}, ${post.media_type || null}, ${post.like_count || 0}, ${post.comments_count || 0},
            ${post.account_username || null}, ${post.account_avatar || null}, now()
        )
        ON CONFLICT (school_id, platform, external_id) WHERE platform IS NOT NULL AND external_id IS NOT NULL
        DO UPDATE SET
            post_text        = EXCLUDED.post_text,
            content          = EXCLUDED.content,
            media            = EXCLUDED.media,
            results          = EXCLUDED.results,
            published_at     = EXCLUDED.published_at,
            media_url        = EXCLUDED.media_url,
            thumbnail_url    = EXCLUDED.thumbnail_url,
            permalink        = EXCLUDED.permalink,
            media_type       = EXCLUDED.media_type,
            like_count       = EXCLUDED.like_count,
            comments_count   = EXCLUDED.comments_count,
            account_username = EXCLUDED.account_username,
            account_avatar   = EXCLUDED.account_avatar,
            synced_at        = now()
        RETURNING *
    `;
    return rows[0];
}

async function getPostsByDateRange(schoolId, from, to) {
    return sql`
        SELECT
            *,
            COALESCE(content, post_text, '') AS content
        FROM social_posts
        WHERE school_id = ${schoolId}
          AND published_at >= ${from}::timestamptz
          AND published_at <= ${to}::timestamptz
        ORDER BY published_at DESC
    `;
}

async function markFirstSocialConnectedBySchool(schoolId) {
    await sql`
        UPDATE onboarding_steps os SET
            first_social_connected = true,
            updated_at = now()
        FROM account_members am
        JOIN app_users u ON u.id = am.user_id
        WHERE os.account_id = am.account_id
          AND u.school_id = ${schoolId}
    `;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function publicUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        school_id: row.school_id,
        status: row.status,
        avatar_url: row.avatar_url,
        first_login_required: row.first_login_required
    };
}

async function countAppUsers() {
    const rows = await sql`SELECT COUNT(*)::int AS total FROM app_users`;
    return rows[0]?.total || 0;
}

async function findUserByEmail(email) {
    const rows = await sql`SELECT * FROM app_users WHERE email = ${normalizeEmail(email)}`;
    return rows[0] || null;
}

async function findUserById(id) {
    const rows = await sql`SELECT * FROM app_users WHERE id = ${id}`;
    return rows[0] || null;
}

async function findUserByProvider(provider, providerId) {
    const rows = await sql`
        SELECT * FROM app_users
        WHERE auth_provider = ${provider} AND provider_id = ${String(providerId || '')}
    `;
    return rows[0] || null;
}

async function createInvitedUser({ email, name, role = 'admin', school_id = 'wozza-default-school' }) {
    const rows = await sql`
        INSERT INTO app_users (id, email, name, role, school_id, status, first_login_required)
        VALUES (gen_random_uuid()::text, ${normalizeEmail(email)}, ${name || ''}, ${role}, ${school_id}, 'invited', true)
        ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(NULLIF(EXCLUDED.name, ''), app_users.name),
            updated_at = now()
        RETURNING *
    `;
    return rows[0];
}

async function upsertSocialUser({ email, name, avatar_url, provider, provider_id, school_id = 'wozza-default-school' }) {
    const normalized = normalizeEmail(email);
    const rows = await sql`
        INSERT INTO app_users (id, email, name, role, school_id, status, avatar_url, auth_provider, provider_id, first_login_required, last_login_at)
        VALUES (gen_random_uuid()::text, ${normalized}, ${name || normalized}, 'admin', ${school_id}, 'active', ${avatar_url || null}, ${provider}, ${String(provider_id || '')}, false, now())
        ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(NULLIF(EXCLUDED.name, ''), app_users.name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
            auth_provider = EXCLUDED.auth_provider,
            provider_id = EXCLUDED.provider_id,
            status = 'active',
            first_login_required = false,
            last_login_at = now(),
            updated_at = now()
        RETURNING *
    `;
    return rows[0];
}

async function setUserPassword(userId, passwordHash, passwordSalt) {
    const rows = await sql`
        UPDATE app_users SET
            password_hash = ${passwordHash},
            password_salt = ${passwordSalt},
            status = 'active',
            first_login_required = false,
            updated_at = now()
        WHERE id = ${userId}
        RETURNING *
    `;
    return rows[0] || null;
}

async function createPasswordToken(userId, tokenHash, purpose, expiresAt) {
    await sql`
        UPDATE auth_password_tokens SET used_at = now()
        WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL
    `;
    const rows = await sql`
        INSERT INTO auth_password_tokens (id, user_id, token_hash, purpose, expires_at)
        VALUES (gen_random_uuid()::text, ${userId}, ${tokenHash}, ${purpose}, ${expiresAt}::timestamptz)
        RETURNING *
    `;
    return rows[0];
}

async function consumePasswordToken(tokenHash, purpose) {
    const rows = await sql`
        UPDATE auth_password_tokens SET used_at = now()
        WHERE token_hash = ${tokenHash}
          AND purpose = ${purpose}
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING *
    `;
    return rows[0] || null;
}

async function createAuthSession(userId, tokenHash, expiresAt) {
    const rows = await sql`
        INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
        VALUES (gen_random_uuid()::text, ${userId}, ${tokenHash}, ${expiresAt}::timestamptz)
        RETURNING *
    `;
    await sql`UPDATE app_users SET last_login_at = now() WHERE id = ${userId}`;
    return rows[0];
}

async function getUserBySessionToken(tokenHash) {
    const rows = await sql`
        SELECT u.*
        FROM auth_sessions s
        JOIN app_users u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
        LIMIT 1
    `;
    return rows[0] || null;
}

async function deleteAuthSession(tokenHash) {
    await sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash}`;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

async function getBillingPlans() {
    return sql`SELECT * FROM billing_plans WHERE active = true ORDER BY price_cents ASC`;
}

async function getUserBillingStatus(userId) {
    const rows = await sql`
        SELECT
            a.id          AS account_id,
            a.name        AS account_name,
            s.id          AS subscription_id,
            s.plan_code,
            s.status,
            s.trial_ends_at,
            s.current_period_ends_at,
            p.name        AS plan_name,
            p.price_cents,
            p.billing_cycle,
            p.trial_days
        FROM account_members am
        JOIN accounts a ON a.id = am.account_id
        LEFT JOIN account_subscriptions s ON s.account_id = a.id
        LEFT JOIN billing_plans p ON p.code = s.plan_code
        WHERE am.user_id = ${userId}
        ORDER BY s.created_at DESC NULLS LAST
        LIMIT 1
    `;
    const row = rows[0];
    if (!row || !row.account_id || !row.plan_code) {
        return { status: 'plan_required', can_use: false };
    }
    const status = row.status || 'plan_required';
    const now = new Date();
    let trialDaysLeft = null;
    if (status === 'trialing' && row.trial_ends_at) {
        const diff = new Date(row.trial_ends_at) - now;
        trialDaysLeft = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
    }
    const can_use = (status === 'trialing' && row.trial_ends_at && new Date(row.trial_ends_at) > now)
                 || status === 'active';
    return {
        status,
        can_use,
        plan_code:    row.plan_code,
        plan_name:    row.plan_name,
        billing_cycle: row.billing_cycle,
        trial_days_left: trialDaysLeft,
        trial_ends_at:   row.trial_ends_at,
        account_id:   row.account_id,
        account_name: row.account_name
    };
}

async function selectPlanForUser(userId, planCode, accountName) {
    const planRows = await sql`SELECT * FROM billing_plans WHERE code = ${planCode} AND active = true`;
    if (!planRows[0]) throw new Error('Plano não encontrado');
    const plan = planRows[0];

    const existingMember = await sql`
        SELECT am.account_id FROM account_members am WHERE am.user_id = ${userId} LIMIT 1
    `;

    let accountId;
    if (existingMember[0]) {
        accountId = existingMember[0].account_id;
        if (accountName) {
            await sql`UPDATE accounts SET name = ${accountName}, updated_at = now() WHERE id = ${accountId}`;
        }
    } else {
        const newAccount = await sql`
            INSERT INTO accounts (id, name, status)
            VALUES (gen_random_uuid()::text, ${accountName || 'Minha Empresa'}, 'active')
            RETURNING *
        `;
        accountId = newAccount[0].id;
        await sql`
            INSERT INTO account_members (id, account_id, user_id, role)
            VALUES (gen_random_uuid()::text, ${accountId}, ${userId}, 'owner')
        `;
        await sql`UPDATE app_users SET default_account_id = ${accountId}, updated_at = now() WHERE id = ${userId}`;
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString();

    const subRows = await sql`
        INSERT INTO account_subscriptions (id, account_id, plan_code, status, trial_starts_at, trial_ends_at)
        VALUES (gen_random_uuid()::text, ${accountId}, ${planCode}, 'trialing', ${now.toISOString()}::timestamptz, ${trialEndsAt}::timestamptz)
        ON CONFLICT (account_id) DO UPDATE SET
            plan_code       = EXCLUDED.plan_code,
            status          = 'trialing',
            trial_starts_at = EXCLUDED.trial_starts_at,
            trial_ends_at   = EXCLUDED.trial_ends_at,
            updated_at      = now()
        RETURNING *
    `;

    await sql`
        INSERT INTO onboarding_steps (account_id, plan_selected, trial_started)
        VALUES (${accountId}, true, true)
        ON CONFLICT (account_id) DO UPDATE SET
            plan_selected = true,
            trial_started = true,
            updated_at    = now()
    `;

    return { account_id: accountId, subscription: subRows[0], plan };
}

async function getOnboardingStatus(userId) {
    const rows = await sql`
        SELECT os.* FROM onboarding_steps os
        JOIN account_members am ON am.account_id = os.account_id
        WHERE am.user_id = ${userId}
        LIMIT 1
    `;
    return rows[0] || null;
}

async function dismissConnectSocial(userId) {
    const memberRows = await sql`SELECT account_id FROM account_members WHERE user_id = ${userId} LIMIT 1`;
    if (!memberRows[0]) return null;
    const accountId = memberRows[0].account_id;
    const rows = await sql`
        INSERT INTO onboarding_steps (account_id, dismissed_connect_social)
        VALUES (${accountId}, true)
        ON CONFLICT (account_id) DO UPDATE SET dismissed_connect_social = true, updated_at = now()
        RETURNING *
    `;
    return rows[0];
}

// ─── Scheduled posts ──────────────────────────────────────────────────────────

async function createScheduledPost({ schoolId, platform, content, mediaUrl, mediaType, scheduledFor, timezone, locale }) {
    const result = await sql`
        INSERT INTO scheduled_posts (school_id, platform, content, media_url, media_type, scheduled_for, timezone, locale)
        VALUES (${schoolId}, ${platform}, ${content}, ${mediaUrl ?? null}, ${mediaType ?? 'IMAGE'}, ${scheduledFor}, ${timezone ?? 'UTC'}, ${locale ?? 'pt-BR'})
        RETURNING *
    `;
    return result[0];
}

async function getDuePosts() {
    return sql`
        SELECT * FROM scheduled_posts
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
        ORDER BY scheduled_for ASC
        LIMIT 50
    `;
}

async function markScheduledPostPublished(id, postId) {
    await sql`
        UPDATE scheduled_posts
        SET status = 'published', post_id = ${postId}, updated_at = NOW()
        WHERE id = ${id}
    `;
}

async function markScheduledPostFailed(id, errorMessage) {
    await sql`
        UPDATE scheduled_posts
        SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${id}
    `;
}

async function getScheduledPostsByAccount(schoolId, from, to) {
    return sql`
        SELECT * FROM scheduled_posts
        WHERE school_id = ${schoolId}
          AND scheduled_for BETWEEN ${from} AND ${to}
        ORDER BY scheduled_for ASC
    `;
}

async function cancelScheduledPost(id, schoolId) {
    const result = await sql`
        UPDATE scheduled_posts
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${id}
          AND school_id = ${schoolId}
          AND status = 'pending'
        RETURNING *
    `;
    return result[0] ?? null;
}

module.exports = {
    sql, ensureSchema,
    ensureAllSocialPlatforms, getConfig, upsertConfig,
    insertMessage, updateMessage, updateMessageForSchool, getRecentMessages, countMessages,
    insertAlert, getOpenAlerts, closeAlertsForMessage, setAlertsInProgress,
    getReplyConfig, upsertReplyConfig,
    insertPost, upsertSyncedPost, getPostsByDateRange,
    countAppUsers, findUserByEmail, findUserById, findUserByProvider,
    createInvitedUser, upsertSocialUser, setUserPassword,
    createPasswordToken, consumePasswordToken,
    createAuthSession, getUserBySessionToken, deleteAuthSession,
    publicUser, normalizeEmail,
    PLATFORMS,
    getBillingPlans, getUserBillingStatus, selectPlanForUser,
    getOnboardingStatus, dismissConnectSocial, markFirstSocialConnectedBySchool,
    createScheduledPost, getDuePosts, markScheduledPostPublished, markScheduledPostFailed,
    getScheduledPostsByAccount, cancelScheduledPost
};
