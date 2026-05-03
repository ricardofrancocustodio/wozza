require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const port = process.env.PORT || 4000;
const APP_URL = (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');

app.use(express.json({ limit: '2mb' }));

// Servir arquivos estáticos
app.use('/adminlte/plugins/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/adminlte/plugins/bootstrap/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/adminlte/plugins/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/adminlte', express.static(path.join(__dirname, 'node_modules/admin-lte/dist')));
app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/dist', express.static(path.join(__dirname, 'public/dist')));

// ─── Business logic ───────────────────────────────────────────────────────────

const ALL_CHANNELS = ['DIRECT', 'POST_COMMENT', 'REEL_COMMENT', 'STORY_MENTION', 'PAGE_MESSAGE'];

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

function oauthRedirectUri(provider) {
    return `${APP_URL}/auth/${provider}/callback`;
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

// ─── OAuth — Meta ─────────────────────────────────────────────────────────────

const META_SCOPES = [
    'instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments',
    'pages_manage_metadata', 'pages_read_engagement', 'pages_messaging', 'business_management'
].join(',');

app.get('/auth/meta/start', (req, res) => {
    const platform = String(req.query.platform || 'INSTAGRAM').toUpperCase();
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    if (!process.env.META_APP_ID) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('META_APP_ID não configurado no .env')}&platform=${platform}`);
    }
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID,
        redirect_uri: oauthRedirectUri('meta'),
        scope: META_SCOPES,
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
            body: new URLSearchParams({ client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: oauthRedirectUri('meta'), code })
        });
        if (!tokenRes.ok) throw new Error(tokenRes.data?.error?.message || 'Falha ao obter token');
        const shortToken = tokenRes.data.access_token;

        const longRes = await fetchJson(
            `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${shortToken}`
        );
        const accessToken = longRes.ok ? longRes.data.access_token : shortToken;

        const pagesRes = await fetchJson(
            `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
        );
        const pages = pagesRes.ok ? (pagesRes.data.data || []) : [];
        const firstPage = pages[0] || {};
        const igAccountId = firstPage.instagram_business_account?.id || null;

        await db.upsertConfig(schoolId, platform, {
            enabled: true,
            connection_status: 'CONNECTED',
            account_label: firstPage.name || null,
            credentials_present: JSON.stringify({ access_token: true, refresh_token: false, app_secret: false }),
            metadata: JSON.stringify({ page_id: firstPage.id || null, page_name: firstPage.name || null, instagram_business_id: igAccountId })
        });

        res.redirect(`/social-monitor?oauth_ok=${encodeURIComponent(platform)}&school_id=${encodeURIComponent(schoolId)}`);
    } catch (err) {
        console.error('Meta OAuth error:', err);
        res.redirect(`/social-monitor?oauth_error=${encodeURIComponent(err.message)}&platform=${platform}`);
    }
});

// ─── OAuth — TikTok ───────────────────────────────────────────────────────────

app.get('/auth/tiktok/start', (req, res) => {
    const schoolId = String(req.query.school_id || 'wozza-default-school');
    if (!process.env.TIKTOK_APP_ID) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('TIKTOK_APP_ID não configurado no .env')}&platform=TIKTOK`);
    }
    const params = new URLSearchParams({
        app_id: process.env.TIKTOK_APP_ID,
        state: oauthState('TIKTOK', schoolId),
        redirect_uri: oauthRedirectUri('tiktok'),
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
            body: new URLSearchParams({ client_key: process.env.TIKTOK_APP_ID, client_secret: process.env.TIKTOK_APP_SECRET, code, grant_type: 'authorization_code', redirect_uri: oauthRedirectUri('tiktok') })
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
    if (!process.env.LINKEDIN_CLIENT_ID) {
        return res.redirect(`/social-monitor?oauth_error=${encodeURIComponent('LINKEDIN_CLIENT_ID não configurado no .env')}&platform=LINKEDIN`);
    }
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.LINKEDIN_CLIENT_ID,
        redirect_uri: oauthRedirectUri('linkedin'),
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
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: oauthRedirectUri('linkedin'), client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET })
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
        meta:     !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        tiktok:   !!(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET),
        linkedin: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    });
});

// ─── Páginas ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/social-monitor', (req, res) => res.sendFile(path.join(__dirname, 'social-monitor.html')));

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
        }
    } else {
        console.warn('DATABASE_URL não configurado — sem persistência NeonDB');
    }
}

if (require.main === module) {
    // Execução local: node server.js
    initDb().then(() => {
        app.listen(port, () => console.log(`Wozza rodando em http://localhost:${port}`));
    });
} else {
    // Vercel serverless: exporta o app e inicializa o schema uma vez
    initDb();
    module.exports = app;
}
