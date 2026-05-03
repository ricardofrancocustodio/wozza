require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const port = process.env.PORT || 4000;
let dbInitPromise = null;

function env(name) {
    return String(process.env[name] || '').trim();
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos
app.use('/adminlte/plugins/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/adminlte/plugins/bootstrap/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/adminlte/plugins/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/adminlte', express.static(path.join(__dirname, 'node_modules/admin-lte/dist')));
app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/dist', express.static(path.join(__dirname, 'public/dist')));

app.use(async (_req, res, next) => {
    if (!process.env.DATABASE_URL) return next();
    try {
        await ensureDbReady();
        return next();
    } catch (err) {
        return res.status(503).json({ error: 'Banco de dados indisponível', message: err.message });
    }
});

// ─── Business logic ───────────────────────────────────────────────────────────

const ALL_CHANNELS = ['DIRECT', 'POST_COMMENT', 'REEL_COMMENT', 'STORY_MENTION', 'PAGE_MESSAGE'];
const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function classifyMessage(text) {
    const t = String(text || '').toLowerCase();
    const elogio       = /\b(parab[eé]ns|obrigad[oa]|excelente|maravilhos[oa]|ador(?:o|ei|amos)|gostei muito|amei|top demais)\b/.test(t);
    const reclamacao   = /\b(p[eé]ssim[oa]|horr[ií]vel|odiei|terr[ií]vel|reclam|insatisfeit|absurdo|inaceit[aá]vel)\b/.test(t);
    const critica      = /\b(cr[ií]tica|melhor[ae]|deveria|devia|precisa(?:m|va)|n[aã]o (?:gostei|gosto)|defici[eê]ncia)\b/.test(t);
    const sugestao     = /\b(sugiro|sugest[aã]o|que tal|seria legal|poderia(?:m)?|proponho)\b/.test(t);
    const risco        = /\b(bullying|agress[aã]o|amea[cç]a|viol[eê]ncia|preconceito|ass[ée]dio)\b/.test(t);
    const duvidaTecnica = /\b(hor[aá]rio|valor|mensalidade|matr[ií]cula|inscri[cç][aã]o|pre[cç]o|quanto custa|qual o pre[cç]o|quando|onde)\b/.test(t);

    if (risco)                  return { category: 'RISCO',         decision: 'SENSITIVE', confidence: 0.95, severity: 'HIGH',   justification: 'Conteúdo sensível: possível risco/bullying.' };
    if (reclamacao)             return { category: 'RECLAMACAO',    decision: 'SENSITIVE', confidence: 0.85, severity: 'HIGH',   justification: 'Termos de reclamação detectados.' };
    if (critica)                return { category: 'CRITICA',       decision: 'SENSITIVE', confidence: 0.75, severity: 'MEDIUM', justification: 'Termos de crítica detectados.' };
    if (elogio && duvidaTecnica) return { category: 'ELOGIO',       decision: 'MIXED',     confidence: 0.8,  severity: 'LOW',    justification: 'Mistura elogio com dúvida técnica.' };
    if (elogio)                 return { category: 'ELOGIO',        decision: 'SENSITIVE', confidence: 0.8,  severity: 'LOW',    justification: 'Elogio identificado: requer agradecimento humano.' };
    if (sugestao)               return { category: 'SUGESTAO',      decision: 'SENSITIVE', confidence: 0.7,  severity: 'MEDIUM', justification: 'Sugestão identificada.' };
    if (duvidaTecnica)          return { category: 'DUVIDA_TECNICA',decision: 'AUTO_REPLY',confidence: 0.7,                      justification: 'Dúvida sobre informações operacionais.' };
    return                             { category: 'NEUTRO',        decision: 'AUTO_REPLY',confidence: 0.5,                      justification: 'Mensagem genérica — resposta padrão.' };
}

function buildAutoReply(replyCfg, decision) {
    const botName = replyCfg?.bot_name || 'Alva';
    if (decision === 'MIXED') return `Olá! Aqui é a ${botName}. Obrigada pelo carinho! Sobre sua dúvida, vou encaminhar para nossa equipe responder com todos os detalhes.`;
    return `Olá! Aqui é a ${botName}. Recebemos sua mensagem e nossa equipe vai responder em breve com mais informações.`;
}

function publicConfigView(cfg) {
    if (!cfg) return null;
    return {
        id:                          cfg.id,
        school_id:                   cfg.school_id,
        platform:                    cfg.platform,
        enabled:                     cfg.enabled,
        connection_status:           cfg.connection_status,
        account_label:               cfg.account_label,
        webhook_verify_token:        cfg.webhook_verify_token,
        auto_reply_enabled:          cfg.auto_reply_enabled,
        notify_director_on_sensitive:cfg.notify_director_on_sensitive,
        allowed_channels:            cfg.allowed_channels,
        metadata:                    cfg.metadata || {},
        credentials_present:         cfg.credentials_present || { access_token: false, refresh_token: false, app_secret: false },
        updated_at:                  cfg.updated_at
    };
}

function publicMessageView(m) {
    return {
        id:                        m.id,
        school_id:                 m.school_id,
        platform:                  m.platform,
        channel:                   m.channel,
        sender_handle:             m.sender_handle,
        sender_name:               m.sender_name,
        message_text:              m.message_text,
        post_permalink:            m.post_permalink || null,
        message_permalink:         m.message_permalink || null,
        classification_category:   m.classification_category,
        classification_decision:   m.classification_decision,
        classification_confidence: m.classification_confidence,
        ai_response_text:          m.ai_response_text || null,
        manual_reply_text:         m.manual_reply_text || null,
        status:                    m.status,
        created_at:                m.created_at,
        updated_at:                m.updated_at
    };
}

function publicAlertView(a) {
    return {
        id:            a.id,
        message_id:    a.message_id,
        severity:      a.severity,
        status:        a.status,
        category:      a.category,
        sender_handle: a.sender_handle,
        sender_name:   a.sender_name,
        message_text:  a.message_text,
        platform:      a.platform,
        channel:       a.channel,
        post_permalink:a.post_permalink,
        created_at:    a.created_at
    };
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function baseUrlFromRequest(req) {
    const configured = env('APP_URL').replace(/\/$/, '');
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const requestUrl = `${proto}://${host}`.replace(/\/$/, '');
    const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
    if (configured && !(process.env.NODE_ENV === 'production' && configuredIsLocal)) return configured;
    return requestUrl;
}

function oauthRedirectUri(req, provider) {
    return `${baseUrlFromRequest(req)}/auth/${provider}/callback`;
}

function oauthState(platform, schoolId) {
    return Buffer.from(JSON.stringify({ platform, schoolId })).toString('base64url');
}

function parseOAuthState(state) {
    try { return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')); }
    catch { return {}; }
}

async function fetchJson(url, opts = {}) {
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: false, status: res.status, data: { error: text } }; }
}

function socialEncryptionKey() {
    const value = env('ENCRYPTION_KEY');
    if (!value) throw new Error('ENCRYPTION_KEY não configurado para salvar credenciais sociais');
    return crypto.createHash('sha256').update(value).digest();
}

function encryptSocialCredentials(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', socialEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSocialCredentials(value) {
    const [version, ivValue, tagValue, encryptedValue] = String(value || '').split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('Credenciais sociais inválidas');
    const decipher = crypto.createDecipheriv('aes-256-gcm', socialEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}

async function fetchMeta(pathname, accessToken, params = {}) {
    const query = new URLSearchParams({ ...params, access_token: accessToken });
    return fetchJson(`${META_GRAPH_BASE}/${pathname.replace(/^\//, '')}?${query}`);
}

function graphPageInfo(page) {
    return {
        page_id: page?.id || null,
        page_name: page?.name || null,
        instagram_business_id: page?.instagram_business_account?.id || null
    };
}

function normalizeInstagramPost(raw, schoolId, metadata) {
    return {
        school_id: schoolId,
        platform: 'INSTAGRAM',
        external_id: raw.id,
        content: raw.caption || '',
        media_url: raw.media_url || null,
        thumbnail_url: raw.thumbnail_url || raw.media_url || null,
        permalink: raw.permalink || null,
        media_type: raw.media_type || null,
        like_count: Number(raw.like_count || 0),
        comments_count: Number(raw.comments_count || 0),
        account_username: raw.username || metadata?.page_name || 'Instagram',
        account_avatar: null,
        published_at: raw.timestamp || new Date().toISOString(),
        media: raw.media_url ? { url: raw.media_url, thumbnail_url: raw.thumbnail_url || raw.media_url, type: raw.media_type || null } : null,
        results: [{ platform: 'INSTAGRAM', externalId: raw.id, success: true, source: 'sync' }]
    };
}

function normalizeFacebookPost(raw, schoolId, metadata) {
    const mediaUrl = raw.full_picture || raw.attachments?.data?.[0]?.media?.image?.src || null;
    return {
        school_id: schoolId,
        platform: 'FACEBOOK',
        external_id: raw.id,
        content: raw.message || raw.story || '',
        media_url: mediaUrl,
        thumbnail_url: mediaUrl,
        permalink: raw.permalink_url || null,
        media_type: raw.attachments?.data?.[0]?.type || null,
        like_count: Number(raw.reactions?.summary?.total_count || 0),
        comments_count: Number(raw.comments?.summary?.total_count || 0),
        account_username: metadata?.page_name || 'Facebook',
        account_avatar: null,
        published_at: raw.created_time || new Date().toISOString(),
        media: mediaUrl ? { url: mediaUrl, thumbnail_url: mediaUrl, type: raw.attachments?.data?.[0]?.type || null } : null,
        results: [{ platform: 'FACEBOOK', externalId: raw.id, success: true, source: 'sync' }]
    };
}

async function syncMetaPostsForConfig(config) {
    if (!config?.credentials_encrypted) throw new Error('Credenciais Meta não encontradas para este canal');
    const credentials = decryptSocialCredentials(config.credentials_encrypted);
    const metadata = config.metadata || {};
    const accessToken = credentials.page_access_token || credentials.access_token;
    const summary = { platform: config.platform, synced: 0, warnings: [] };

    if (config.platform === 'INSTAGRAM') {
        if (!metadata.instagram_business_id) {
            summary.warnings.push('Conta Instagram Business não encontrada na página Meta conectada.');
            return summary;
        }
        const mediaRes = await fetchMeta(`${metadata.instagram_business_id}/media`, accessToken, {
            fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,username',
            limit: '50'
        });
        if (!mediaRes.ok) throw new Error(mediaRes.data?.error?.message || 'Falha ao buscar posts do Instagram');
        for (const item of mediaRes.data?.data || []) {
            await db.upsertSyncedPost(normalizeInstagramPost(item, config.school_id, metadata));
            summary.synced += 1;
        }
        return summary;
    }

    if (config.platform === 'FACEBOOK') {
        if (!metadata.page_id) {
            summary.warnings.push('Página Facebook não encontrada na conexão Meta.');
            return summary;
        }
        const postsRes = await fetchMeta(`${metadata.page_id}/posts`, accessToken, {
            fields: 'id,message,story,created_time,permalink_url,full_picture,attachments{media,type,url},comments.summary(true),reactions.summary(true)',
            limit: '50'
        });
        if (!postsRes.ok) throw new Error(postsRes.data?.error?.message || 'Falha ao buscar posts do Facebook');
        for (const item of postsRes.data?.data || []) {
            await db.upsertSyncedPost(normalizeFacebookPost(item, config.school_id, metadata));
            summary.synced += 1;
        }
        return summary;
    }

    summary.warnings.push(`Plataforma ${config.platform} ainda não possui sincronização Meta.`);
    return summary;
}

async function syncMetaPosts(schoolId, platform) {
    const platforms = platform ? [platform] : ['INSTAGRAM', 'FACEBOOK'];
    const results = [];
    const warnings = [];
    for (const currentPlatform of platforms) {
        const config = await db.getConfig(schoolId, currentPlatform);
        if (!config || config.connection_status !== 'CONNECTED') {
            warnings.push(`${currentPlatform}: canal não conectado.`);
            continue;
        }
        try {
            const result = await syncMetaPostsForConfig(config);
            results.push(result);
            warnings.push(...(result.warnings || []).map((warning) => `${currentPlatform}: ${warning}`));
            await db.upsertConfig(schoolId, currentPlatform, {
                enabled: true,
                metadata: JSON.stringify({ ...(config.metadata || {}), last_sync_at: new Date().toISOString(), last_sync_result: result })
            });
        } catch (err) {
            warnings.push(`${currentPlatform}: ${err.message}`);
        }
    }
    return { results, warnings, synced: results.reduce((total, item) => total + (item.synced || 0), 0) };
}

// ─── App auth helpers ────────────────────────────────────────────────────────

const AUTH_COOKIE = 'wozza_session';
const SESSION_DAYS = 7;
const PASSWORD_TOKEN_MINUTES = 60;

function sha256(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, user) {
    if (!user?.password_hash || !user?.password_salt) return false;
    const { hash } = createPasswordHash(password, user.password_salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'));
}

function validatePassword(password) {
    const value = String(password || '');
    return value.length >= 8
        && /[A-Z]/.test(value)
        && /[a-z]/.test(value)
        && /[0-9]/.test(value)
        && /[^A-Za-z0-9]/.test(value);
}

function readCookie(req, name) {
    const cookie = String(req.headers.cookie || '');
    const parts = cookie.split(';').map((part) => part.trim());
    const found = parts.find((part) => part.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}

function setSessionCookie(req, res, token, remember) {
    const maxAge = remember ? SESSION_DAYS * 24 * 60 * 60 : 24 * 60 * 60;
    const requestProto = req.get('x-forwarded-proto') || req.protocol || '';
    const secure = requestProto === 'https' || process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${secure ? 'Secure; ' : ''}`.trim());
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function authBaseUrl(req) {
    return baseUrlFromRequest(req);
}

async function requireCurrentUser(req) {
    const token = readCookie(req, AUTH_COOKIE);
    if (!token) return null;
    return db.getUserBySessionToken(sha256(token));
}

async function createLoginSession(req, res, user, remember = true) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS : 1) * 24 * 60 * 60 * 1000).toISOString();
    await db.createAuthSession(user.id, sha256(token), expiresAt);
    setSessionCookie(req, res, token, remember);
}

async function sendAuthEmail({ to, subject, html, text }) {
    if (process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to, subject, html, text })
        });
        if (!response.ok) throw new Error(`Falha ao enviar email (${response.status})`);
        return true;
    }
    console.log(`[auth-email-dev] ${subject} -> ${to}\n${text}`);
    return false;
}

function passwordTokenUrl(req, page, token) {
    return `${authBaseUrl(req)}/${page}?token=${encodeURIComponent(token)}`;
}

function authOauthState(provider, returnTo = '/') {
    return Buffer.from(JSON.stringify({ provider, returnTo, nonce: crypto.randomBytes(8).toString('hex') })).toString('base64url');
}

function parseAuthOauthState(state) {
    try { return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')); }
    catch { return {}; }
}

async function issuePasswordToken(req, user, purpose, page) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PASSWORD_TOKEN_MINUTES * 60 * 1000).toISOString();
    await db.createPasswordToken(user.id, sha256(token), purpose, expiresAt);
    const url = passwordTokenUrl(req, page, token);
    await sendAuthEmail({
        to: user.email,
        subject: purpose === 'FIRST_PASSWORD' ? 'Crie sua primeira senha no Wozza' : 'Redefina sua senha no Wozza',
        html: `<p>Olá${user.name ? `, ${user.name}` : ''}.</p><p>Acesse o link abaixo para continuar:</p><p><a href="${url}">${url}</a></p><p>O link expira em ${PASSWORD_TOKEN_MINUTES} minutos.</p>`,
        text: `Acesse o link para continuar: ${url}\nO link expira em ${PASSWORD_TOKEN_MINUTES} minutos.`
    });
    return url;
}

// ─── App auth routes ─────────────────────────────────────────────────────────

app.get('/api/auth/me', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ authenticated: false });
        const billing = await db.getUserBillingStatus(user.id);
        return res.json({ authenticated: true, user: db.publicUser(user), billing });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const email = db.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const remember = req.body?.remember !== false;

    if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

    try {
        const user = await db.findUserByEmail(email);
        if (!user || user.status !== 'active' || !verifyPassword(password, user)) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }
        await createLoginSession(req, res, user, remember);
        return res.json({ user: db.publicUser(user), redirectTo: '/dashboard' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const token = readCookie(req, AUTH_COOKIE);
    try {
        if (token) await db.deleteAuthSession(sha256(token));
        clearSessionCookie(res);
        return res.json({ ok: true });
    } catch (err) {
        clearSessionCookie(res);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const email = db.normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Informe seu e-mail.' });

    try {
        const user = await db.findUserByEmail(email);
        let resetUrl = null;
        if (user?.status === 'active') {
            resetUrl = await issuePasswordToken(req, user, 'PASSWORD_RESET', 'reset-password');
        }
        return res.json({
            ok: true,
            message: 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.',
            reset_url: process.env.NODE_ENV === 'production' ? undefined : resetUrl
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/first-password', async (req, res) => {
    const email = db.normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    if (!email) return res.status(400).json({ error: 'Informe seu e-mail.' });

    try {
        let user = await db.findUserByEmail(email);
        const usersCount = await db.countAppUsers();

        if (!user && usersCount === 0) {
            user = await db.createInvitedUser({ email, name: name || email.split('@')[0], role: 'admin' });
        }

        let firstPasswordUrl = null;
        if (user && (!user.password_hash || user.first_login_required || user.status === 'invited')) {
            firstPasswordUrl = await issuePasswordToken(req, user, 'FIRST_PASSWORD', 'first-password');
        }

        return res.json({
            ok: true,
            message: 'Se houver convite pendente para este e-mail, enviaremos o link de primeira senha.',
            first_password_url: process.env.NODE_ENV === 'production' ? undefined : firstPasswordUrl
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    const purpose = String(req.body?.purpose || 'PASSWORD_RESET').toUpperCase();

    if (!token) return res.status(400).json({ error: 'Token inválido.' });
    if (!['PASSWORD_RESET', 'FIRST_PASSWORD'].includes(purpose)) return res.status(400).json({ error: 'Finalidade inválida.' });
    if (!validatePassword(password)) return res.status(400).json({ error: 'A senha precisa ter 8 caracteres, maiúscula, minúscula, número e caractere especial.' });

    try {
        const tokenRow = await db.consumePasswordToken(sha256(token), purpose);
        if (!tokenRow) return res.status(400).json({ error: 'Link inválido ou expirado.' });
        const { hash, salt } = createPasswordHash(password);
        const user = await db.setUserPassword(tokenRow.user_id, hash, salt);
        await createLoginSession(req, res, user, true);
        return res.json({ ok: true, user: db.publicUser(user), redirectTo: '/dashboard' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/social/status', (req, res) => {
    res.json({
        google: !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')),
        facebook: !!(env('FACEBOOK_CLIENT_ID') && env('FACEBOOK_CLIENT_SECRET'))
    });
});

app.get('/auth/google/start', (req, res) => {
    const googleClientId = env('GOOGLE_CLIENT_ID');
    if (!googleClientId) return res.redirect('/login?auth_error=Google não configurado');
    const returnTo = String(req.query.returnTo || '/dashboard');
    const params = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: `${authBaseUrl(req)}/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state: authOauthState('google', returnTo)
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const parsedState = parseAuthOauthState(state);
    if (error || !code) return res.redirect(`/login?auth_error=${encodeURIComponent(error || 'Código ausente')}`);

    try {
        const tokenRes = await fetchJson('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env('GOOGLE_CLIENT_ID'),
                client_secret: env('GOOGLE_CLIENT_SECRET'),
                code,
                grant_type: 'authorization_code',
                redirect_uri: `${authBaseUrl(req)}/auth/google/callback`
            })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error_description || 'Falha no login Google');
        const profileRes = await fetchJson('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        if (!profileRes.ok || !profileRes.data?.email) throw new Error('Não foi possível obter o perfil Google');
        const user = await db.upsertSocialUser({
            email: profileRes.data.email,
            name: profileRes.data.name,
            avatar_url: profileRes.data.picture,
            provider: 'google',
            provider_id: profileRes.data.sub
        });
        await createLoginSession(req, res, user, true);
        res.redirect(parsedState.returnTo || '/dashboard');
    } catch (err) {
        res.redirect(`/login?auth_error=${encodeURIComponent(err.message)}`);
    }
});

app.get('/auth/facebook/start', (req, res) => {
    const facebookClientId = env('FACEBOOK_CLIENT_ID');
    if (!facebookClientId) return res.redirect('/login?auth_error=Facebook não configurado');
    const returnTo = String(req.query.returnTo || '/dashboard');
    const params = new URLSearchParams({
        client_id: facebookClientId,
        redirect_uri: `${authBaseUrl(req)}/auth/facebook/callback`,
        response_type: 'code',
        scope: 'email,public_profile',
        state: authOauthState('facebook', returnTo)
    });
    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const parsedState = parseAuthOauthState(state);
    if (error || !code) return res.redirect(`/login?auth_error=${encodeURIComponent(error_description || error || 'Código ausente')}`);

    try {
        const tokenRes = await fetchJson('https://graph.facebook.com/v19.0/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env('FACEBOOK_CLIENT_ID'),
                client_secret: env('FACEBOOK_CLIENT_SECRET'),
                code,
                redirect_uri: `${authBaseUrl(req)}/auth/facebook/callback`
            })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error?.message || 'Falha no login Facebook');
        const profileRes = await fetchJson(`https://graph.facebook.com/v19.0/me?fields=id,name,email,picture&access_token=${tokenRes.data.access_token}`);
        if (!profileRes.ok || !profileRes.data?.email) throw new Error('Não foi possível obter o e-mail do Facebook');
        const user = await db.upsertSocialUser({
            email: profileRes.data.email,
            name: profileRes.data.name,
            avatar_url: profileRes.data.picture?.data?.url,
            provider: 'facebook',
            provider_id: profileRes.data.id
        });
        await createLoginSession(req, res, user, true);
        res.redirect(parsedState.returnTo || '/dashboard');
    } catch (err) {
        res.redirect(`/login?auth_error=${encodeURIComponent(err.message)}`);
    }
});

// ─── OAuth — Meta ─────────────────────────────────────────────────────────────

const DEFAULT_META_SCOPES = [
    'instagram_basic',
    'instagram_manage_comments',
    'pages_show_list',
    'business_management'
].join(',');

function metaScopes() {
    return env('META_SCOPES') || DEFAULT_META_SCOPES;
}

// Instagram Direct Login (sem Facebook Page)
const INSTAGRAM_DIRECT_SCOPES = 'instagram_business_basic,instagram_business_content_publish';

app.get('/auth/instagram/start', (req, res) => {
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    const instagramAppId = env('INSTAGRAM_APP_ID');
    if (!instagramAppId) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('INSTAGRAM_APP_ID não configurado no .env')}&platform=INSTAGRAM`);
    }
    const params = new URLSearchParams({
        client_id: instagramAppId,
        redirect_uri: oauthRedirectUri(req, 'instagram'),
        scope: INSTAGRAM_DIRECT_SCOPES,
        response_type: 'code',
        state: oauthState('INSTAGRAM', schoolId)
    });
    res.redirect(`https://api.instagram.com/oauth/authorize?${params}`);
});

app.get('/auth/instagram/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    if (error) return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(error_description || error)}`);

    const { platform, schoolId } = parseOAuthState(state);
    if (!code || !schoolId) return res.redirect('/social-monitor?oauth_error=Parâmetros inválidos');

    try {
        const tokenRes = await fetchJson('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env('INSTAGRAM_APP_ID'),
                client_secret: env('INSTAGRAM_APP_SECRET'),
                grant_type: 'authorization_code',
                redirect_uri: oauthRedirectUri(req, 'instagram'),
                code
            })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error_description || 'Falha ao obter token Instagram');

        const accessToken = tokenRes.data.access_token;
        const userId = tokenRes.data.user_id;

        const userRes = await fetchJson(`https://graph.instagram.com/${userId}?fields=username,name,id&access_token=${accessToken}`);
        if (!userRes.ok) throw new Error('Não foi possível obter dados do Instagram');

        const savedAt = new Date().toISOString();
        const credentialsEncrypted = encryptSocialCredentials({
            provider: 'instagram_direct',
            access_token: accessToken,
            user_id: userId,
            saved_at: savedAt
        });

        const config = await db.upsertConfig(schoolId, 'INSTAGRAM', {
            enabled: true,
            connection_status: 'CONNECTED',
            account_label: userRes.data.username || userRes.data.name || null,
            credentials_present: JSON.stringify({ access_token: true, refresh_token: false, app_secret: false }),
            credentials_encrypted: credentialsEncrypted,
            metadata: JSON.stringify({ instagram_user_id: userId, username: userRes.data.username, connected_at: savedAt })
        });

        await db.markFirstSocialConnectedBySchool(schoolId);
        res.redirect(`/social-monitor?oauth_ok=INSTAGRAM&school_id=${encodeURIComponent(schoolId)}`);
    } catch (err) {
        console.error('Instagram OAuth error:', err);
        res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(err.message)}&platform=INSTAGRAM`);
    }
});

app.get('/auth/meta/start', (req, res) => {
    const platform = String(req.query.platform || 'INSTAGRAM').toUpperCase();
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    const metaAppId = env('META_APP_ID');
    if (!metaAppId) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('META_APP_ID não configurado no .env')}&platform=${platform}`);
    }
    const params = new URLSearchParams({
        client_id: metaAppId,
        redirect_uri: oauthRedirectUri(req, 'meta'),
        scope: metaScopes(),
        response_type: 'code',
        state: oauthState(platform, schoolId)
    });
    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

app.get('/auth/meta/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    if (error) return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(error_description || error)}`);

    const { platform, schoolId } = parseOAuthState(state);
    if (!code || !platform || !schoolId) return res.redirect('/social-monitor?oauth_error=Parâmetros inválidos');

    try {
        const tokenRes = await fetchJson('https://graph.facebook.com/v19.0/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: oauthRedirectUri(req, 'meta'), code })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error?.message || 'Falha ao obter token');
        const shortToken = tokenRes.data.access_token;

        const longRes = await fetchJson(
            `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: shortToken })}`
        );
        const accessToken = longRes.ok ? longRes.data.access_token : shortToken;

        const pagesRes = await fetchJson(
            `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token,instagram_business_account`
        );
        const pages = pagesRes.ok ? (pagesRes.data.data || []) : [];
        const firstPage = pages[0] || {};
        const pageInfo = graphPageInfo(firstPage);
        const savedAt = new Date().toISOString();
        const credentialsEncrypted = encryptSocialCredentials({
            provider: 'meta',
            access_token: accessToken,
            page_access_token: firstPage.access_token || accessToken,
            token_type: longRes.ok ? longRes.data.token_type || null : tokenRes.data.token_type || null,
            expires_in: longRes.ok ? longRes.data.expires_in || null : tokenRes.data.expires_in || null,
            saved_at: savedAt
        });

        const config = await db.upsertConfig(schoolId, platform, {
            enabled: true,
            connection_status: 'CONNECTED',
            account_label: firstPage.name || null,
            credentials_present: JSON.stringify({ access_token: true, refresh_token: false, app_secret: false }),
            credentials_encrypted: credentialsEncrypted,
            metadata: JSON.stringify({ ...pageInfo, connected_at: savedAt })
        });

        await db.markFirstSocialConnectedBySchool(schoolId);
        const syncResult = await syncMetaPosts(schoolId, config.platform);
        if (syncResult.warnings.length) console.warn('Meta initial sync warnings:', syncResult.warnings);

        res.redirect(`/social-monitor?oauth_ok=${encodeURIComponent(platform)}&school_id=${encodeURIComponent(schoolId)}`);
    } catch (err) {
        console.error('Meta OAuth error:', err);
        res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(err.message)}&platform=${platform}`);
    }
});

// ─── OAuth — TikTok ───────────────────────────────────────────────────────────

app.get('/auth/tiktok/start', (req, res) => {
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    const tiktokAppId = env('TIKTOK_APP_ID');
    if (!tiktokAppId) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('TIKTOK_APP_ID não configurado no .env')}&platform=TIKTOK`);
    }
    const params = new URLSearchParams({
        app_id: tiktokAppId,
        state: oauthState('TIKTOK', schoolId),
        redirect_uri: oauthRedirectUri(req, 'tiktok'),
        scope: 'user.info.basic,video.list,comment.list,comment.list.manage'
    });
    res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
});

app.get('/auth/tiktok/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error || !code) return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(error || 'Sem código')}&platform=TIKTOK`);
    const { schoolId } = parseOAuthState(state);
    try {
        const tokenRes = await fetchJson('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_key: env('TIKTOK_APP_ID'), client_secret: env('TIKTOK_APP_SECRET'), code, grant_type: 'authorization_code', redirect_uri: oauthRedirectUri(req, 'tiktok') })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error?.message || 'Falha ao obter token TikTok');
        const { open_id } = tokenRes.data;
        await db.upsertConfig(schoolId, 'TIKTOK', {
            enabled: true,
            connection_status: 'CONNECTED',
            credentials_present: JSON.stringify({ access_token: true, refresh_token: false, app_secret: false }),
            metadata: JSON.stringify({ tiktok_account_id: open_id })
        });
        res.redirect(`/social-monitor?oauth_ok=TIKTOK&school_id=${encodeURIComponent(schoolId)}`);
    } catch (err) {
        console.error('TikTok OAuth error:', err);
        res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(err.message)}&platform=TIKTOK`);
    }
});

// ─── OAuth — LinkedIn ─────────────────────────────────────────────────────────

app.get('/auth/linkedin/start', (req, res) => {
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    const linkedInClientId = env('LINKEDIN_CLIENT_ID');
    if (!linkedInClientId) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('LINKEDIN_CLIENT_ID não configurado no .env')}&platform=LINKEDIN`);
    }
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: linkedInClientId,
        redirect_uri: oauthRedirectUri(req, 'linkedin'),
        state: oauthState('LINKEDIN', schoolId),
        scope: 'r_organization_admin w_organization_social r_organization_social'
    });
    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

app.get('/auth/linkedin/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    if (error || !code) return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(error_description || error || 'Sem código')}&platform=LINKEDIN`);
    const { schoolId } = parseOAuthState(state);
    try {
        const tokenRes = await fetchJson('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: oauthRedirectUri(req, 'linkedin'), client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET') })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error_description || 'Falha ao obter token LinkedIn');
        const { access_token } = tokenRes.data;
        const orgsRes = await fetchJson('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', { headers: { Authorization: `Bearer ${access_token}` } });
        const orgId = orgsRes.ok ? orgsRes.data?.elements?.[0]?.organization?.split(':').pop() : null;
        await db.upsertConfig(schoolId, 'LINKEDIN', {
            enabled: true,
            connection_status: 'CONNECTED',
            credentials_present: JSON.stringify({ access_token: true, refresh_token: false, app_secret: false }),
            metadata: JSON.stringify({ linkedin_org_id: orgId })
        });
        res.redirect(`/social-monitor?oauth_ok=LINKEDIN&school_id=${encodeURIComponent(schoolId)}`);
    } catch (err) {
        console.error('LinkedIn OAuth error:', err);
        res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(err.message)}&platform=LINKEDIN`);
    }
});

app.get('/api/oauth/status', (req, res) => {
    res.json({
        meta:     !!(env('META_APP_ID') && env('META_APP_SECRET')),
        tiktok:   !!(env('TIKTOK_APP_ID') && env('TIKTOK_APP_SECRET')),
        linkedin: !!(env('LINKEDIN_CLIENT_ID') && env('LINKEDIN_CLIENT_SECRET'))
    });
});

// ─── API: Billing ─────────────────────────────────────────────────────────────

app.get('/api/billing/plans', async (_req, res) => {
    try {
        const plans = await db.getBillingPlans();
        return res.json({ plans });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/select-plan', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });
        const planCode = String(req.body?.plan_code || '').trim().toLowerCase();
        const accountName = String(req.body?.account_name || '').trim();
        if (!planCode) return res.status(400).json({ error: 'plan_code é obrigatório' });
        const result = await db.selectPlanForUser(user.id, planCode, accountName);
        return res.json({ ok: true, account_id: result.account_id, plan_code: planCode });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

app.get('/api/billing/status', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });
        const billing = await db.getUserBillingStatus(user.id);
        return res.json(billing);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── API: Onboarding ──────────────────────────────────────────────────────────

app.get('/api/onboarding/status', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });
        const steps = await db.getOnboardingStatus(user.id);
        return res.json({ steps: steps || {} });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/onboarding/dismiss-connect-social', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });
        await db.dismissConnectSocial(user.id);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── Páginas ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'reset-password.html')));
app.get('/first-password', (req, res) => res.sendFile(path.join(__dirname, 'first-password.html')));
app.get('/social-monitor', (req, res) => res.sendFile(path.join(__dirname, 'social-monitor.html')));
app.get('/plans',    (req, res) => res.sendFile(path.join(__dirname, 'plans.html')));
app.get('/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'onboarding.html')));
app.get('/billing',  (req, res) => res.sendFile(path.join(__dirname, 'billing.html')));
app.get('/privacy-policy',    (req, res) => res.sendFile(path.join(__dirname, 'privacy-policy.html')));
app.get('/terms-of-service',  (req, res) => res.sendFile(path.join(__dirname, 'terms-of-service.html')));
app.get('/portal-privacidade',(req, res) => res.sendFile(path.join(__dirname, 'privacy-portal.html')));

// ─── API: Monitor Social ──────────────────────────────────────────────────────

app.get('/api/social-monitor/overview', async (req, res) => {
    const schoolId = String(req.query.school_id || '').trim();
    if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
    try {
        const [configs, counts, recentMessages, openAlerts] = await Promise.all([
            db.ensureAllSocialPlatforms(schoolId),
            db.countMessages(schoolId),
            db.getRecentMessages(schoolId, 20),
            db.getOpenAlerts(schoolId)
        ]);
        return res.json({
            metrics: {
                received:   counts.total,
                autoReply:  counts.auto_reply,
                sensitive:  counts.sensitive,
                openAlerts: openAlerts.length
            },
            configs:        configs.map(publicConfigView),
            recentMessages: recentMessages.map(publicMessageView),
            alerts:         openAlerts.map(publicAlertView)
        });
    } catch (err) {
        console.error('overview error:', err);
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/social-monitor/config', async (req, res) => {
    const schoolId = String(req.query.school_id || '').trim();
    if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
    try {
        const configs = await db.ensureAllSocialPlatforms(schoolId);
        return res.json({ configs: configs.map(publicConfigView) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/social-monitor/config', async (req, res) => {
    const body = req.body || {};
    const schoolId = String(body.school_id || '').trim();
    const platform = String(body.platform || '').trim().toUpperCase();
    if (!schoolId || !platform) return res.status(400).json({ error: 'school_id e platform são obrigatórios' });
    if (!db.PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Plataforma inválida' });

    const creds = body.credentials || {};
    const currentCfg = await db.getConfig(schoolId, platform);
    const currentCredsPresent = currentCfg?.credentials_present || {};

    try {
        const cfg = await db.upsertConfig(schoolId, platform, {
            enabled:                      body.enabled != null ? !!body.enabled : null,
            connection_status:            body.connection_status || null,
            account_label:                body.account_label ?? null,
            webhook_verify_token:         body.webhook_verify_token ?? null,
            auto_reply_enabled:           body.auto_reply_enabled != null ? !!body.auto_reply_enabled : null,
            notify_director_on_sensitive: body.notify_director_on_sensitive != null ? !!body.notify_director_on_sensitive : null,
            allowed_channels:             Array.isArray(body.allowed_channels) ? body.allowed_channels.filter((c) => ALL_CHANNELS.includes(c)) : null,
            metadata:                     body.metadata ? JSON.stringify(body.metadata) : null,
            credentials_present:          JSON.stringify({
                access_token:  !!(creds.access_token  || currentCredsPresent?.access_token),
                refresh_token: !!(creds.refresh_token || currentCredsPresent?.refresh_token),
                app_secret:    !!(creds.app_secret    || currentCredsPresent?.app_secret)
            })
        });
        return res.json({ config: publicConfigView(cfg) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/social-monitor/reply-config', async (req, res) => {
    const schoolId = String(req.query.school_id || '').trim();
    if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
    try {
        return res.json({ config: await db.getReplyConfig(schoolId) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/social-monitor/reply-config', async (req, res) => {
    const body = req.body || {};
    const schoolId = String(body.school_id || '').trim();
    if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
    try {
        const cfg = await db.upsertReplyConfig(schoolId, {
            bot_name:         String(body.bot_name || 'Alva').trim(),
            identity_phrase:  body.identity_phrase || null,
            school_short_name:body.school_short_name || null
        });
        return res.json({ config: cfg });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/social-monitor/ingest', async (req, res) => {
    const body = req.body || {};
    const schoolId   = String(body.school_id   || '').trim();
    const platform   = String(body.platform    || '').trim().toUpperCase();
    const channel    = String(body.channel     || '').trim().toUpperCase();
    const messageText= String(body.message_text|| '').trim();
    if (!schoolId || !platform || !channel || !messageText) {
        return res.status(400).json({ error: 'Campos obrigatórios: school_id, platform, channel, message_text' });
    }

    try {
        const classification = classifyMessage(messageText);
        const replyCfg = await db.getReplyConfig(schoolId);

        let aiResponseText = null;
        if (classification.decision === 'AUTO_REPLY' || classification.decision === 'MIXED') {
            aiResponseText = buildAutoReply(replyCfg, classification.decision);
        }

        let status = classification.decision === 'SENSITIVE' ? 'PENDING_REVIEW'
                   : aiResponseText ? 'AUTO_READY' : 'NEW';

        const message = await db.insertMessage({
            school_id: schoolId, platform, channel,
            sender_handle: body.sender_handle || null,
            sender_name:   body.sender_name   || null,
            message_text:  messageText,
            post_permalink:    body.post_permalink    || null,
            message_permalink: body.message_permalink || null,
            metadata: body.metadata || {},
            classification_category:    classification.category,
            classification_decision:    classification.decision,
            classification_confidence:  classification.confidence,
            classification_justification: classification.justification,
            ai_response_text: aiResponseText,
            status
        });

        let alert = null;
        if (classification.decision === 'SENSITIVE' || classification.decision === 'MIXED') {
            const inserted = await db.insertAlert({
                message_id: message.id,
                category:   classification.category,
                severity:   classification.severity || 'MEDIUM'
            });
            alert = { ...inserted, message_text: messageText, platform, channel };
        }

        return res.json({ message: publicMessageView(message), alert: alert ? publicAlertView(alert) : null, classification });
    } catch (err) {
        console.error('ingest error:', err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/social-monitor/messages/:id/manual-action', async (req, res) => {
    const id     = String(req.params.id || '').trim();
    const body   = req.body || {};
    const action = String(body.action || '').toUpperCase();

    const statusMap = { REPLY: 'RESOLVED', DISMISS: 'DISMISSED', IN_PROGRESS: 'MANUAL_IN_PROGRESS', RESOLVE: 'RESOLVED' };
    if (!statusMap[action]) return res.status(400).json({ error: 'Ação inválida (use REPLY | DISMISS | IN_PROGRESS | RESOLVE)' });
    if (action === 'REPLY' && !String(body.reply_text || '').trim()) return res.status(400).json({ error: 'reply_text é obrigatório' });

    try {
        const message = await db.updateMessage(id, {
            status:            statusMap[action],
            manual_reply_text: action === 'REPLY' ? String(body.reply_text).trim() : null
        });
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada' });

        if (message.status === 'RESOLVED' || message.status === 'DISMISSED') {
            await db.closeAlertsForMessage(id);
        } else if (message.status === 'MANUAL_IN_PROGRESS') {
            await db.setAlertsInProgress(id);
        }

        return res.json({ message: publicMessageView(message) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── API: Postagens ───────────────────────────────────────────────────────────

app.post('/api/social/post-multi', async (req, res) => {
    const body     = req.body || {};
    const schoolId = String(body.school_id  || '').trim();
    const conteudo = body.conteudo || {};
    const destinos = Array.isArray(body.destinos) ? body.destinos : [];
    if (!schoolId || !conteudo.text || !destinos.length) {
        return res.status(400).json({ error: 'school_id, conteudo.text e destinos são obrigatórios' });
    }

    const resultado = {};
    const results = destinos.map((rede) => {
        const externalId = `mock-${rede.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`;
        resultado[rede] = { success: true, externalId };
        return { network: rede, externalId, success: true };
    });

    try {
        const post = await db.insertPost({ school_id: schoolId, text: conteudo.text, media: conteudo.media || null, results });
        return res.json({ resultado, post });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/social/sync-posts', async (req, res) => {
    try {
        const user = await requireCurrentUser(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        const body = req.body || {};
        const schoolId = String(body.school_id || user.school_id || '').trim();
        const platform = body.platform ? String(body.platform).trim().toUpperCase() : null;
        if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
        if (schoolId !== user.school_id) return res.status(403).json({ error: 'school_id não pertence ao usuário autenticado' });
        if (platform && !['INSTAGRAM', 'FACEBOOK'].includes(platform)) {
            return res.status(400).json({ error: 'platform deve ser INSTAGRAM ou FACEBOOK' });
        }

        const syncResult = await syncMetaPosts(schoolId, platform);
        return res.json({ ok: true, ...syncResult });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/social/posts', async (req, res) => {
    const schoolId = String(req.query.school_id || '').trim();
    if (!schoolId) return res.status(400).json({ error: 'school_id é obrigatório' });
    const from = req.query.from ? `${req.query.from}T00:00:00Z` : new Date(Date.now() - 30*86400e3).toISOString();
    const to   = req.query.to   ? `${req.query.to}T23:59:59Z`   : new Date().toISOString();
    try {
        const posts = await db.getPostsByDateRange(schoolId, from, to);
        return res.json({ posts });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/social/posts/:postId/interactions', (req, res) => res.json({ interactions: [] }));
app.post('/api/social/comments/:commentId/reply', (req, res) => {
    const text = String((req.body || {}).text || '').trim();
    if (!text) return res.status(400).json({ error: 'text é obrigatório' });
    return res.json({ success: true, replyId: `mock-reply-${crypto.randomBytes(4).toString('hex')}` });
});
app.post('/api/social/posts/:externalId/caption', (req, res) => res.json({ success: true }));
app.delete('/api/social/posts/:externalId', (req, res) => res.json({ success: true }));

// ─── Webhooks ─────────────────────────────────────────────────────────────────
app.post('/webhook/social/meta',     (req, res) => res.json({ received: true }));
app.post('/webhook/social/tiktok',   (req, res) => res.json({ received: true }));
app.post('/webhook/social/linkedin', (req, res) => res.json({ received: true }));

// ─── Start ────────────────────────────────────────────────────────────────────
async function initDb() {
    if (process.env.DATABASE_URL) {
        try {
            await db.ensureSchema();
            console.log('Schema Neon OK');
        } catch (err) {
            console.warn('Aviso schema Neon:', err.message);
            throw err;
        }
    } else {
        console.warn('DATABASE_URL não configurado — sem persistência NeonDB');
    }
}

function ensureDbReady() {
    if (!dbInitPromise) {
        dbInitPromise = initDb().catch((err) => {
            dbInitPromise = null;
            throw err;
        });
    }
    return dbInitPromise;
}

if (require.main === module) {
    // Execução local: node server.js
    ensureDbReady().catch(() => null).then(() => {
        app.listen(port, () => console.log(`Wozza rodando em http://localhost:${port}`));
    });
} else {
    // Vercel serverless: exporta o app e inicializa o schema uma vez
    ensureDbReady().catch(() => null);
    module.exports = app;
}
