const socialState = {
    schoolId: null,
    alerts: [],
    messages: [],
    configs: []
};

const POST_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function platformLabel(platform) {
    const key = String(platform || '').toUpperCase();
    if (key === 'INSTAGRAM') return 'Instagram';
    if (key === 'FACEBOOK') return 'Facebook';
    if (key === 'TIKTOK') return 'TikTok';
    if (key === 'LINKEDIN') return 'LinkedIn';
    if (key === 'YOUTUBE') return 'YouTube';
    return key || '-';
}

function channelLabel(channel) {
    const key = String(channel || '').toUpperCase();
    if (key === 'DIRECT') return 'Direct';
    if (key === 'POST_COMMENT') return 'Comentário';
    if (key === 'REEL_COMMENT') return 'Comentário em vídeo';
    if (key === 'STORY_MENTION') return 'Menção';
    if (key === 'PAGE_MESSAGE') return 'Mensagem de página';
    return key || '-';
}

function decisionLabel(decision) {
    const key = String(decision || '').toUpperCase();
    if (key === 'AUTO_REPLY') return 'Resposta automática';
    if (key === 'SENSITIVE') return 'Sensível';
    if (key === 'MIXED') return 'Misto (técnico + sensível)';
    return 'Revisão';
}

function statusLabel(status, item) {
    const key = String(status || '').toUpperCase();
    // Se a IA ja produziu uma resposta (pronta ou enviada) tratamos como Resolvido.
    if ((key === 'AUTO_READY' || key === 'AUTO_SENT') && item && (item.ai_response_text || item.manual_reply_text)) {
        return 'Resolvido';
    }
    const labels = {
        NEW: 'Novo',
        AUTO_READY: 'Resolvido',
        AUTO_SENT: 'Resolvido',
        PENDING_REVIEW: 'Aguardando diretoria',
        MANUAL_IN_PROGRESS: 'Em análise',
        RESOLVED: 'Resolvido',
        DISMISSED: 'Descartado'
    };
    return labels[key] || key || '-';
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
}

function connectorStatusClass(status) {
    const key = String(status || '').toUpperCase();
    if (key === 'CONNECTED') return 'connected';
    if (key === 'ERROR') return 'error';
    if (key === 'DISABLED') return 'disabled';
    return 'pending';
}

function connectorStatusLabel(status) {
    const key = String(status || '').toUpperCase();
    if (key === 'CONNECTED') return 'Conectado';
    if (key === 'ERROR') return 'Erro';
    if (key === 'DISABLED') return 'Desativado';
    return 'Pendente';
}

function getConfigByPlatform(platform) {
    return socialState.configs.find((item) => String(item.platform || '').toUpperCase() === String(platform || '').toUpperCase()) || null;
}

function checkedChannelsFromDom() {
    return $('.sm-config-channel:checked').map(function() {
        return $(this).val();
    }).get();
}

function severityClass(value) {
    const key = String(value || '').toUpperCase();
    if (key === 'CRITICAL' || key === 'HIGH') return 'high';
    if (key === 'MEDIUM') return 'medium';
    return 'low';
}

function buildAuthorProfileUrl(item) {
    const platform = String(item?.platform || '').toUpperCase();
    const raw = String(item?.sender_handle || '').trim().replace(/^@/, '');
    if (!raw) return null;
    // IDs puramente numéricos (ex.: PSID de DM) não são linkáveis
    if (/^\d+$/.test(raw)) return null;
    const h = encodeURIComponent(raw);
    if (platform === 'INSTAGRAM') return `https://www.instagram.com/${h}/`;
    if (platform === 'FACEBOOK') return `https://www.facebook.com/${h}`;
    if (platform === 'TIKTOK') return `https://www.tiktok.com/@${h}`;
    if (platform === 'LINKEDIN') return `https://www.linkedin.com/in/${h}`;
    if (platform === 'YOUTUBE') return `https://www.youtube.com/@${h}`;
    return null;
}

function renderAuthorCell(item) {
    const handle = item?.sender_handle || item?.sender_name || 'Autor não identificado';
    const url = buildAuthorProfileUrl(item);
    const label = escapeHtml(handle);
    const link = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="Abrir perfil"><i class="fas fa-external-link-alt ml-1 small"></i></a>`
        : '';
    return `${label}${link}`;
}

function buildOriginLine(item) {
    const parts = [platformLabel(item.platform), channelLabel(item.channel)];
    if (item.post_permalink) {
        parts.push('<a href="' + escapeHtml(item.post_permalink) + '" target="_blank" rel="noopener">ver postagem</a>');
    }
    const profileUrl = buildAuthorProfileUrl(item);
    if (profileUrl) {
        parts.push('<a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">ver perfil</a>');
    }
    return parts.join(' • ');
}

async function fetchOverview() {
    const res = await fetch(`/api/social-monitor/overview?school_id=${encodeURIComponent(socialState.schoolId)}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Falha ao carregar monitor social.');
    return body;
}

function renderMetrics(metrics = {}) {
    $('#sm-metric-received').text(metrics.received || 0);
    $('#sm-metric-auto').text(metrics.autoReply || 0);
    $('#sm-metric-sensitive').text(metrics.sensitive || 0);
    $('#sm-metric-open').text(metrics.openAlerts || 0);
    $('#sm-open-alerts-label').text(`${metrics.openAlerts || 0} itens aguardando análise`);
}

function renderConnectors(configs = []) {
    const container = $('#sm-connectors-list');
    container.empty();

    if (!configs.length) {
        container.html('<div class="col-12"><div class="empty-card">Nenhum conector configurado ainda.</div></div>');
        return;
    }

    configs.forEach((cfg) => {
        const css = connectorStatusClass(cfg.connection_status);
        const allowed = Array.isArray(cfg.allowed_channels) ? cfg.allowed_channels.map(channelLabel).join(', ') : 'Direct e comentários';
        const refs = cfg.references || {};
        const refLine = [refs.page_id, refs.instagram_business_id, refs.tiktok_account_id, refs.linkedin_org_id].filter(Boolean).join(' • ');
        const tokenFlags = [];
        if (cfg.has_credentials?.access_token) tokenFlags.push('access token salvo');
        if (cfg.has_credentials?.refresh_token) tokenFlags.push('refresh token salvo');
        const html = `
            <div class="col-md-6 col-xl-4 mb-3">
                <div class="connector-card p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <div class="font-weight-bold">${escapeHtml(platformLabel(cfg.platform))}</div>
                            <small class="text-muted">${escapeHtml(cfg.account_label || 'Conta ainda não vinculada')}</small>
                        </div>
                        <span class="status-pill ${css}">${escapeHtml(connectorStatusLabel(cfg.connection_status))}</span>
                    </div>
                    <div class="small text-muted mb-2">Canais monitorados: ${escapeHtml(allowed || '-')}</div>
                    <div class="small text-muted">Auto resposta: ${cfg.auto_reply_enabled ? 'ativa' : 'desligada'}${cfg.last_sync_at ? ` • Última sincronização ${escapeHtml(formatDateTime(cfg.last_sync_at))}` : ''}</div>
                    <div class="small text-muted mt-1">${escapeHtml(refLine || 'Sem IDs de integração cadastrados')}</div>
                    <div class="small text-muted mt-1">${escapeHtml(tokenFlags.join(' • ') || 'Sem tokens cadastrados')}</div>
                    <div class="mt-3 text-right">
                        <button class="btn btn-sm btn-outline-primary" onclick="openConfigModal('${escapeHtml(cfg.platform)}')">
                            <i class="fas fa-cog mr-1"></i>Configurar
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.append(html);
    });
}

function toggleConfigFieldsByPlatform(platform) {
    const current = String(platform || '').toUpperCase();
    $('[data-platforms]').each(function() {
        const accepted = String($(this).data('platforms') || '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean);
        const visible = !accepted.length || accepted.includes(current);
        $(this).prop('hidden', !visible);
    });

    const badge = $('#sm-config-platform-badge');
    const iconMap = {
        INSTAGRAM: 'fab fa-instagram',
        FACEBOOK: 'fab fa-facebook',
        TIKTOK: 'fab fa-tiktok',
        LINKEDIN: 'fab fa-linkedin',
        YOUTUBE: 'fab fa-youtube'
    };
    badge.html(`<i class="${iconMap[current] || 'fas fa-link'}"></i><span>${escapeHtml(platformLabel(current))}</span>`);
}

function renderAlerts(alerts = []) {
    const tbody = $('#social-alerts-list');
    tbody.empty();

    // Remove alertas cuja mensagem foi escrita pela propria escola (eco de resposta).
    const ownHandles = getOwnHandles();
    const echoTexts = getEchoTextSet();
    const filtered = (alerts || []).filter((alert) => {
        const msg = alert.message || {};
        return !isSchoolAuthor(msg, ownHandles, echoTexts);
    });

    if (!filtered.length) {
        tbody.html('<tr><td colspan="5" class="text-center text-muted py-4">Nenhuma interação sensível pendente.</td></tr>');
        return;
    }

    filtered.forEach((alert) => {
        const item = alert.message || {};
        const severity = severityClass(alert.severity);
        const html = `
            <tr>
                <td>
                    <div class="font-weight-bold">${escapeHtml(platformLabel(item.platform))}</div>
                    <div class="small text-muted">${escapeHtml(channelLabel(item.channel))}</div>
                </td>
                <td>
                    <div class="font-weight-bold">${renderAuthorCell(item)}</div>
                    <div class="small text-muted">${escapeHtml(item.sender_name || '')}</div>
                </td>
                <td>
                    <div class="small text-muted mb-1">${buildOriginLine(item)}</div>
                    <div class="text-break-safe">${escapeHtml(item.message_text || '')}</div>
                </td>
                <td>
                    <span class="alert-badge ${severity}">${escapeHtml(item.classification_category || 'Sensível')}</span>
                    <div class="small text-muted mt-1">${escapeHtml(item.classification_rationale || '')}</div>
                </td>
                <td class="text-right">
                    <button class="btn btn-sm btn-outline-primary mr-1" onclick="openAlertModal('${escapeHtml(alert.id)}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="markAlertResolved('${escapeHtml(alert.id)}')">
                        <i class="fas fa-check"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(html);
    });
}

function normalizeHandle(value) {
    // Remove @, pontos, underscores e hífens para equiparar variações do mesmo handle
    // (ex: "escola.alvacirviterossi" == "escolaalvacirviterossi")
    return String(value || '').trim().replace(/^@+/, '').toLowerCase().replace(/[._\-\s]+/g, '');
}

function getOwnHandles() {
    const set = new Set();
    (socialState.configs || []).forEach((cfg) => {
        const h = normalizeHandle(cfg.account_label);
        if (h) set.add(h);
    });
    return set;
}

function getEchoTextSet() {
    const set = new Set();
    (socialState.messages || []).forEach((m) => {
        const a = normalizeEchoText(m?.ai_response_text);
        const b = normalizeEchoText(m?.manual_reply_text);
        if (a) set.add(a);
        if (b) set.add(b);
    });
    return set;
}

function normalizeEchoText(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '') // remove emojis
        .replace(/[^a-zA-Z0-9]+/g, ' ') // colapsa pontuacao/espacos
        .trim()
        .toLowerCase();
}

function isEchoMatch(messageText, echoTexts) {
    const t = normalizeEchoText(messageText);
    if (!t || !echoTexts || !echoTexts.size) return false;
    if (echoTexts.has(t)) return true;
    // fuzzy: basta um prefixo de 40 caracteres coincidir
    const prefix = t.slice(0, 40);
    if (prefix.length < 20) return false;
    for (const e of echoTexts) {
        if (e.startsWith(prefix) || t.startsWith(e.slice(0, 40))) return true;
    }
    return false;
}

function isSchoolAuthor(item, ownHandles, echoTexts) {
    const h = normalizeHandle(item?.sender_handle || item?.sender_name);
    if (h && ownHandles && ownHandles.has(h)) return true;
    if (isEchoMatch(item?.message_text, echoTexts)) return true;
    return false;
}

function conversationKey(item) {
    const platform = String(item?.platform || '').toUpperCase();
    const channel = String(item?.channel || '').toUpperCase();
    if (channel === 'POST_COMMENT' || channel === 'REEL_COMMENT' || channel === 'STORY_MENTION') {
        const post = item?.source_post_id || item?.post_permalink || 'sempost';
        const author = item?.sender_id || normalizeHandle(item?.sender_handle) || normalizeHandle(item?.sender_name) || 'anon';
        return `${platform}|POST|${post}|${author}|${item?.id || ''}`;
    }
    const sid = item?.sender_id || normalizeHandle(item?.sender_handle) || normalizeHandle(item?.sender_name) || 'anon';
    return `${platform}|DM|${sid}`;
}

function groupConversations(messages) {
    const ownHandles = getOwnHandles();
    const echoTexts = getEchoTextSet();
    const map = new Map();

    // Separa mensagens tipo comentario (agrupamento com chain) das DMs (agrupamento simples)
    const commentMsgs = [];
    const dmMsgs = [];
    messages.forEach((m) => {
        const ch = String(m?.channel || '').toUpperCase();
        if (ch === 'POST_COMMENT' || ch === 'REEL_COMMENT' || ch === 'STORY_MENTION') commentMsgs.push(m);
        else dmMsgs.push(m);
    });

    // DMs: agrupa por autor
    dmMsgs.forEach((m) => {
        const key = conversationKey(m);
        if (!map.has(key)) map.set(key, { key, items: [] });
        map.get(key).items.push(m);
    });

    // Comentarios: por post. Dentro de cada post, cada autor externo inicia uma thread;
    // respostas da escola anexam na thread externa mais recente daquele post.
    const byPost = new Map();
    commentMsgs.forEach((m) => {
        const platform = String(m.platform || '').toUpperCase();
        const postKey = `${platform}|POST|${m.source_post_id || m.post_permalink || 'sempost'}`;
        if (!byPost.has(postKey)) byPost.set(postKey, []);
        byPost.get(postKey).push(m);
    });
    byPost.forEach((items, postKey) => {
        items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const threadsOrder = []; // array de { key, items }
        items.forEach((m) => {
            if (isSchoolAuthor(m, ownHandles, echoTexts) && threadsOrder.length) {
                // Tenta casar o texto do eco com a manual_reply_text/ai_response_text
                // de alguma thread anterior (para nao grudar na thread errada).
                const mText = normalizeEchoText(m.message_text);
                let target = null;
                for (let i = threadsOrder.length - 1; i >= 0 && !target; i -= 1) {
                    const anchor = threadsOrder[i].items[0];
                    const replyText = normalizeEchoText(anchor?.manual_reply_text || anchor?.ai_response_text);
                    if (replyText && mText && (replyText === mText || replyText.startsWith(mText.slice(0, 40)) || mText.startsWith(replyText.slice(0, 40)))) {
                        target = threadsOrder[i];
                    }
                }
                if (target) {
                    target.items.push(m);
                    return;
                }
                // Sem match: nao gruda em thread errada — vira thread propria (sera filtrada por isSchoolAuthor em outros lugares).
            }
            const key = `${postKey}|${m.sender_id || normalizeHandle(m.sender_handle) || 'anon'}|${m.id}`;
            const thread = { key, items: [m] };
            threadsOrder.push(thread);
            map.set(key, thread);
        });
    });

    const groups = Array.from(map.values()).map((g) => {
        g.items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        g.last = g.items[g.items.length - 1];
        g.first = g.items[0];
        // "Respondido" = tem manual_reply_text/ai_response_text OU tem mensagem da propria escola na thread
        g.totalResponded = g.items.filter((i) => i.ai_response_text || i.manual_reply_text || isSchoolAuthor(i, ownHandles, echoTexts)).length;
        return g;
    });
    groups.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
    return groups;
}

function renderMessages(messages = []) {
    const tbody = $('#sm-messages-list');
    tbody.empty();

    if (!messages.length) {
        tbody.html('<tr><td colspan="7" class="text-center text-muted py-4">Nenhuma interação processada ainda.</td></tr>');
        return;
    }

    const groups = groupConversations(messages);
    // Remove grupos que contem apenas mensagens da propria escola (ecos orfaos).
    const ownHandles = getOwnHandles();
    const echoTexts = getEchoTextSet();
    const visibleGroups = groups.filter((g) => g.items.some((i) => !isSchoolAuthor(i, ownHandles, echoTexts)));
    if (!visibleGroups.length) {
        tbody.html('<tr><td colspan="7" class="text-center text-muted py-4">Nenhuma interação processada ainda.</td></tr>');
        return;
    }

    visibleGroups.forEach((g, idx) => {
        const last = g.last;
        const channelKey = String(last?.channel || '').toUpperCase();
        const isComment = channelKey === 'POST_COMMENT' || channelKey === 'REEL_COMMENT' || channelKey === 'STORY_MENTION';
        // Para comentarios, usa o primeiro autor externo (quem iniciou a thread) no cabecalho.
        const headerItem = isComment ? g.first : last;
        const threadId = `sm-thread-${idx}`;
        const count = g.items.length;
        const hasAnyResponse = g.totalResponded > 0;
        const rowStatus = hasAnyResponse ? 'Resolvido' : statusLabel(last.status, last);

        // Linha resumo (cabecalho da conversa)
        const summaryHtml = `
            <tr class="sm-conv-summary" data-toggle="collapse" data-target="#${threadId}" style="cursor:pointer;background:#f7f9fc;">
                <td>${escapeHtml(formatDateTime(last.created_at))}</td>
                <td>${escapeHtml(platformLabel(last.platform))}</td>
                <td>${escapeHtml(channelLabel(last.channel))}</td>
                <td>
                    <div class="font-weight-bold">
                        <i class="fas fa-comments text-info mr-1"></i>
                        ${renderAuthorCell(headerItem)}
                        <span class="badge badge-light ml-1" title="Mensagens na conversa">${count}</span>
                    </div>
                    <div class="small text-muted text-truncate" style="max-width:360px;">
                        <i class="fas fa-angle-right"></i> ${escapeHtml(headerItem.message_text || last.message_text || '')}
                    </div>
                </td>
                <td>${escapeHtml(decisionLabel(headerItem.classification_decision || last.classification_decision))}</td>
                <td>${escapeHtml(rowStatus)}</td>
                <td class="text-right">
                    <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); openMessageModal('${escapeHtml(last.id)}')" title="Abrir ultima interacao">
                        <i class="fas fa-search"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(summaryHtml);

        // Linha expansivel com a thread completa (estilo chat)
        const bubbles = g.items.map((item) => {
            const dt = escapeHtml(formatDateTime(item.created_at));
            const itemAuthor = renderAuthorCell(item);
            const originalBubble = `
                <div class="d-flex mb-2">
                    <div class="p-2 rounded" style="background:#fff;border:1px solid #e3e6ea;max-width:75%;">
                        <div class="small text-muted"><strong>${itemAuthor}</strong> • ${dt} • ${escapeHtml(decisionLabel(item.classification_decision))}</div>
                        <div class="text-dark" style="white-space:pre-wrap;">${escapeHtml(item.message_text || '')}</div>
                        ${item.post_permalink ? `<div class="small mt-1"><a href="${escapeHtml(item.post_permalink)}" target="_blank" rel="noopener">ver postagem</a></div>` : ''}
                    </div>
                </div>
            `;
            const responseText = item.manual_reply_text || item.ai_response_text || '';
            const responseKind = item.manual_reply_text ? 'Resposta manual' : (item.ai_response_text ? 'Resposta da IA' : '');
            const responseBubble = responseText ? `
                <div class="d-flex justify-content-end mb-2">
                    <div class="p-2 rounded" style="background:#eaf6ef;border:1px solid #b7dfc5;max-width:75%;">
                        <div class="small text-success font-weight-bold"><i class="fas fa-reply"></i> ${escapeHtml(responseKind)}</div>
                        <div class="text-dark" style="white-space:pre-wrap;">${escapeHtml(responseText)}</div>
                        <div class="small text-muted mt-1">${dt} • ${escapeHtml(statusLabel(item.status, item))}</div>
                    </div>
                </div>
            ` : '';
            return originalBubble + responseBubble;
        }).join('');

        const threadHtml = `
            <tr class="collapse" id="${threadId}">
                <td colspan="7" style="background:#f0f3f7;padding:14px 20px;">
                    <div class="mb-2 small text-muted">
                        <i class="fas fa-user-circle"></i> Conversa com <strong>${renderAuthorCell(headerItem)}</strong> —
                        ${escapeHtml(platformLabel(last.platform))} / ${escapeHtml(channelLabel(last.channel))} • ${count} mensagem(ns)
                    </div>
                    ${bubbles}
                </td>
            </tr>
        `;
        tbody.append(threadHtml);
    });
}

function findAlertById(alertId) {
    return socialState.alerts.find((item) => item.id === alertId) || null;
}

function findMessageById(messageId) {
    return socialState.messages.find((item) => item.id === messageId) || null;
}

function postMediaType() {
    return $('#sm-post-type-video').hasClass('active') ? 'video' : 'image';
}

function updateVideoSectionVisibility() {
    $('#sm-post-video-file-section').show();
}

function switchPostMediaType(type) {
    if (type === 'video') {
        $('#sm-post-image-section').hide();
        $('#sm-post-video-section').show();
        $('#sm-post-type-image').removeClass('btn-primary active').addClass('btn-outline-primary');
        $('#sm-post-type-video').removeClass('btn-outline-primary').addClass('btn-primary active');
    } else {
        $('#sm-post-video-section').hide();
        $('#sm-post-image-section').show();
        $('#sm-post-type-video').removeClass('btn-primary active').addClass('btn-outline-primary');
        $('#sm-post-type-image').removeClass('btn-outline-primary').addClass('btn-primary active');
    }
    renderPostNetworkCheckboxes(socialState.configs);
    updateVideoSectionVisibility();
}

function renderPostNetworkCheckboxes(configs) {
    const container = $('#sm-post-networks');
    container.empty();

    const connected = (configs || []).filter(
        (cfg) => String(cfg.connection_status || '').toUpperCase() === 'CONNECTED' && cfg.enabled
    );

    if (!connected.length) {
        container.html('<span class="text-muted small">Nenhuma rede conectada disponível. Configure um canal na aba Monitoramento.</span>');
        return;
    }

    const isVideo = postMediaType() === 'video';

    connected.forEach((cfg) => {
        const platform = escapeHtml(cfg.platform || '');
        const label = escapeHtml(platformLabel(cfg.platform));
        const id = `sm-post-net-${platform.toLowerCase()}`;
        const videoOnly = (platform === 'TIKTOK' || platform === 'YOUTUBE') && !isVideo;
        const disabled = videoOnly ? 'disabled' : '';
        const titleAttr = videoOnly ? `title="${platformLabel(platform)} só aceita vídeo. Mude para o modo Vídeo."` : '';
        container.append(`
            <div class="custom-control custom-checkbox" ${titleAttr}>
                <input type="checkbox" class="custom-control-input sm-post-network-check" id="${id}" value="${platform}" ${videoOnly ? '' : 'checked'} ${disabled}>
                <label class="custom-control-label${videoOnly ? ' text-muted' : ''}" for="${id}">${label}${videoOnly ? ' <small>(só vídeo)</small>' : ''}</label>
            </div>
        `);
    });
}

function renderPostResult(resultado) {
    const card = $('#sm-post-result-card');
    const body = $('#sm-post-result-body');
    body.empty();

    const redes = Object.keys(resultado || {});
    if (!redes.length) {
        body.html('<div class="text-muted small">Nenhuma rede processada.</div>');
        card.show();
        return;
    }

    redes.forEach((rede) => {
        const r = resultado[rede] || {};
        const ok = !!r.success;
        const icon = ok ? 'fas fa-check-circle text-success' : 'fas fa-times-circle text-danger';
        const msg = ok
            ? (r.externalId ? `Enviado (ID: ${escapeHtml(String(r.externalId))})` : 'Enviado com sucesso')
            : escapeHtml(r.error || 'Falha no envio');
        body.append(`
            <div class="d-flex align-items-start mb-2">
                <i class="${icon} mt-1 mr-2"></i>
                <div>
                    <div class="font-weight-bold small">${escapeHtml(platformLabel(rede))}</div>
                    <div class="small text-muted">${msg}</div>
                </div>
            </div>
        `);
    });

    card.show();
}

function setPostUploadStatus(message, tone) {
    const el = $('#sm-post-upload-status');
    if (!message) {
        el.hide().removeClass('text-danger text-success text-muted').empty();
        return;
    }
    const toneClass = tone === 'error' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-muted';
    el.removeClass('text-danger text-success text-muted').addClass(toneClass).text(message).show();
}

function setPostImagePreview(url) {
    const wrap = $('#sm-post-upload-preview');
    const img = $('#sm-post-upload-preview-img');
    if (!url) {
        img.attr('src', '');
        wrap.hide();
        return;
    }
    img.attr('src', url);
    wrap.show();
}

function resetPostImageUploadUi() {
    $('#sm-post-image-file').val('');
    $('#sm-post-image-url').val('');
    setPostUploadStatus('', 'muted');
    setPostImagePreview('');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
        reader.readAsDataURL(file);
    });
}

function compressImageToDataUrl(file, maxPx, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxPx || height > maxPx) {
                    if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
                    else { width = Math.round(width * maxPx / height); height = maxPx; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadSelectedPostImage(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type || '')) {
        throw new Error('Selecione um arquivo de imagem válido.');
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
        throw new Error('A imagem excede o limite de 8 MB.');
    }

    setPostUploadStatus('Comprimindo imagem...', 'muted');
    const dataUrl = await compressImageToDataUrl(file, 1080, 0.85);
    setPostUploadStatus('Enviando imagem...', 'muted');
    const res = await fetch('/api/social/upload-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-school-id': socialState.schoolId
        },
        body: JSON.stringify({
            school_id: socialState.schoolId,
            file_name: file.name,
            data_url: dataUrl
        })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Falha ao enviar imagem.');

    $('#sm-post-image-url').val(body.url || '');
    setPostImagePreview(body.url || '');
    setPostUploadStatus('Imagem enviada com sucesso. A URL pública foi preenchida automaticamente.', 'success');
}

async function uploadVideoToYouTube(title, description, file) {
    const initRes = await fetch('/api/social/youtube/init-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            school_id: socialState.schoolId,
            title,
            description,
            mime_type: file.type || 'video/mp4',
            file_size: file.size,
            is_short: true
        })
    });
    const initBody = await initRes.json();
    if (!initRes.ok) throw new Error(initBody?.error || 'Falha ao iniciar upload no YouTube');

    const uploadUri = initBody.upload_uri;

    const videoId = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUri);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round(e.loaded / e.total * 100);
                $('#sm-post-video-progress-bar').css('width', `${pct}%`).text(`${pct}%`);
                $('#sm-post-video-progress-text').text(`Enviando para YouTube... ${pct}%`);
            }
        };
        xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
                try { resolve(JSON.parse(xhr.responseText).id); }
                catch { reject(new Error('Resposta inválida do YouTube após upload')); }
            } else {
                reject(new Error(`YouTube rejeitou o vídeo (status ${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error('Falha de rede ao enviar para YouTube'));
        xhr.send(file);
    });

    const finalRes = await fetch('/api/social/youtube/finalize-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: socialState.schoolId, video_id: videoId, title })
    });
    const finalBody = await finalRes.json();
    if (!finalRes.ok) throw new Error(finalBody?.error || 'Falha ao finalizar publicação no YouTube');
    return finalBody;
}

async function uploadVideoToTikTok(title, file, onProgress) {
    const initRes = await fetch('/api/social/tiktok/init-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            school_id: socialState.schoolId,
            title,
            file_size: file.size
        })
    });
    const initBody = await initRes.json();
    if (!initRes.ok) throw new Error(initBody?.error || 'Falha ao iniciar upload no TikTok');

    const { upload_url, publish_id } = initBody;

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`TikTok rejeitou o video (status ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Falha de rede ao enviar para TikTok'));
        xhr.send(file);
    });

    const finalRes = await fetch('/api/social/tiktok/finalize-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: socialState.schoolId, publish_id, title })
    });
    const finalBody = await finalRes.json();
    if (!finalRes.ok) throw new Error(finalBody?.error || 'Falha ao finalizar publicação no TikTok');
    return finalBody;
}

async function uploadVideoToBlob(file, onProgress) {
    // 1. Servidor gera o pathname e o clientToken juntos — garante que batem no JWT
    const tokenRes = await fetch('/api/blob/video-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error || 'Falha ao obter token de upload');
    const { clientToken, pathname } = tokenData;
    if (!clientToken || !pathname) throw new Error('Resposta de token invalida. Verifique BLOB_READ_WRITE_TOKEN no servidor.');

    // 2. PUT direto ao Vercel Blob API com progresso via XHR
    const blobUrl = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const params = new URLSearchParams({ pathname });
        xhr.open('PUT', `https://vercel.com/api/blob/?${params}`);
        xhr.setRequestHeader('authorization', `Bearer ${clientToken}`);
        xhr.setRequestHeader('x-api-version', '12');
        xhr.setRequestHeader('x-vercel-blob-access', 'public');
        xhr.setRequestHeader('x-content-type', file.type || 'video/mp4');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText).url); }
                catch { reject(new Error('Resposta invalida do storage apos upload')); }
            } else {
                reject(new Error(`Storage rejeitou o video (${xhr.status}): ${xhr.responseText?.slice(0, 200)}`));
            }
        };
        xhr.onerror = () => reject(new Error('Falha de rede ao enviar video. Abra F12 > Console para detalhes.'));
        xhr.send(file);
    });

    return blobUrl;
}

async function publicarNasRedes() {
    const texto = String($('#sm-post-text').val() || '').trim();
    const isVideo = postMediaType() === 'video';
    const imageUrl = isVideo ? '' : String($('#sm-post-image-url').val() || '').trim();
    const videoUrl = '';
    const videoFile = isVideo ? ($('#sm-post-video-file')[0]?.files?.[0] || null) : null;
    const enableSchedule = $('#sm-schedule-enable').is(':checked');
    const scheduledFor = String($('#sm-schedule-datetime').val() || '').trim();
    const timezone = String($('#sm-schedule-timezone').val() || 'America/Sao_Paulo').trim();

    if (!texto) {
        Swal.fire('Atenção', 'Escreva o texto da postagem antes de publicar.', 'warning');
        return;
    }

    const destinos = $('.sm-post-network-check:checked:not(:disabled)').map(function() {
        return $(this).val();
    }).get();

    if (!destinos.length) {
        Swal.fire('Atenção', 'Selecione ao menos uma rede social para publicar.', 'warning');
        return;
    }

    if (enableSchedule) {
        if (!scheduledFor) {
            Swal.fire('Atenção', 'Defina a data e hora para o agendamento.', 'warning');
            return;
        }
        if (new Date(scheduledFor) <= new Date()) {
            Swal.fire('Atenção', 'A data de agendamento deve ser no futuro.', 'warning');
            return;
        }
        if (destinos.length > 1) {
            Swal.fire('Atenção', 'O agendamento suporta apenas uma rede por vez. Selecione somente uma rede.', 'warning');
            return;
        }
        const platform = destinos[0];
        const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

        const btn = $('#sm-post-submit-btn');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Agendando...');
        try {
            let mediaUrl = isVideo ? null : imageUrl;

            if (isVideo && videoFile) {
                $('#sm-post-video-progress-wrap').show();
                $('#sm-post-video-progress-bar').css('width', '0%').text('0%');
                $('#sm-post-video-progress-text').text('Enviando vídeo...');
                mediaUrl = await uploadVideoToBlob(videoFile, (pct) => {
                    $('#sm-post-video-progress-bar').css('width', `${pct}%`).text(`${pct}%`);
                    $('#sm-post-video-progress-text').text(`Enviando vídeo... ${pct}%`);
                });
                $('#sm-post-video-progress-wrap').hide();
            }

            const res = await fetch('/api/social/schedule-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform,
                    content: texto,
                    media_url: mediaUrl || null,
                    media_type: mediaType,
                    scheduled_for: new Date(scheduledFor).toISOString(),
                    timezone
                })
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Falha ao agendar.');
            Swal.fire('Agendado!', `Post agendado para ${new Date(scheduledFor).toLocaleString('pt-BR')} em ${platform}.`, 'success');
            $('#sm-post-text').val('');
            $('#sm-post-image-url').val('');
            $('#sm-post-video-file').val('');
            $('#sm-post-char-count').text('0');
            resetPostImageUploadUi();
        } catch (err) {
            Swal.fire('Erro', err.message || 'Não foi possível agendar a postagem.', 'error');
        } finally {
            btn.prop('disabled', false).html('<i class="fas fa-calendar-check mr-1"></i>Agendar publicação');
        }
        return;
    }

    const youtubeSelected = destinos.includes('YOUTUBE');
    const tiktokSelected = destinos.includes('TIKTOK');
    const outrasRedes = destinos.filter(d => d !== 'YOUTUBE' && d !== 'TIKTOK');

    if (isVideo && !videoFile) {
        Swal.fire('Atenção', 'Selecione um arquivo de vídeo antes de publicar.', 'warning');
        return;
    }
    if (!isVideo && destinos.includes('INSTAGRAM') && !imageUrl) {
        Swal.fire('Atenção', 'Para publicar no Instagram, envie uma imagem antes de continuar.', 'warning');
        return;
    }

    const btn = $('#sm-post-submit-btn');
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Publicando...');

    const resultado = {};
    let anyPost = null;

    try {
        if (isVideo && youtubeSelected && videoFile) {
            $('#sm-post-video-progress-wrap').show();
            $('#sm-post-video-progress-bar').css('width', '0%').text('0%');
            $('#sm-post-video-progress-text').text('Enviando para YouTube...');
            try {
                const ytResult = await uploadVideoToYouTube(texto.slice(0, 100), texto, videoFile);
                resultado['YOUTUBE'] = { success: true, permalink: ytResult.permalink };
                if (ytResult.post) anyPost = ytResult.post;
            } catch (err) {
                resultado['YOUTUBE'] = { success: false, error: err.message };
            }
            $('#sm-post-video-progress-wrap').hide();
        }

        if (isVideo && tiktokSelected && videoFile) {
            $('#sm-post-video-progress-wrap').show();
            $('#sm-post-video-progress-bar').css('width', '0%').text('0%');
            $('#sm-post-video-progress-text').text('Enviando para TikTok...');
            try {
                const ttResult = await uploadVideoToTikTok(texto.slice(0, 150), videoFile, (pct) => {
                    $('#sm-post-video-progress-bar').css('width', `${pct}%`).text(`${pct}%`);
                    $('#sm-post-video-progress-text').text(`Enviando para TikTok... ${pct}%`);
                });
                resultado['TIKTOK'] = { success: true, permalink: ttResult.permalink || null };
                if (ttResult.post) anyPost = ttResult.post;
            } catch (err) {
                resultado['TIKTOK'] = { success: false, error: err.message };
            }
            $('#sm-post-video-progress-wrap').hide();
        }

        if (outrasRedes.length) {
            let mediaUrl = null;

            if (isVideo && videoFile) {
                $('#sm-post-video-progress-wrap').show();
                $('#sm-post-video-progress-bar').css('width', '0%').text('0%');
                $('#sm-post-video-progress-text').text('Enviando vídeo...');
                mediaUrl = await uploadVideoToBlob(videoFile, (pct) => {
                    $('#sm-post-video-progress-bar').css('width', `${pct}%`).text(`${pct}%`);
                    $('#sm-post-video-progress-text').text(`Enviando vídeo... ${pct}%`);
                });
                $('#sm-post-video-progress-wrap').hide();
            }

            const media = isVideo
                ? (mediaUrl ? { video_url: mediaUrl, url: mediaUrl, type: 'VIDEO' } : null)
                : (imageUrl ? { image_url: imageUrl, url: imageUrl, type: 'IMAGE' } : null);

            const res = await fetch('/api/social/post-multi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-school-id': socialState.schoolId },
                body: JSON.stringify({ school_id: socialState.schoolId, conteudo: { text: texto, media }, destinos: outrasRedes })
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Falha ao publicar.');
            Object.assign(resultado, body.resultado || {});
            if (body.post && !anyPost) anyPost = body.post;
        }

        renderPostResult(resultado);

        if (anyPost) {
            $('#sm-post-text').val('');
            $('#sm-post-image-url').val('');
            $('#sm-post-video-file').val('');
            $('#sm-post-char-count').text('0');
            resetPostImageUploadUi();
            await feedFetchMonth(calState.viewYear, calState.viewMonth);
            feedRender();
            calRenderMonth();
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível publicar nas redes.', 'error');
    } finally {
        btn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i>Publicar agora');
    }
}

async function loadMonitor() {
    $('#sm-refresh-btn').prop('disabled', true);
    try {
        const overview = await fetchOverview();
        socialState.alerts = Array.isArray(overview.alerts) ? overview.alerts : [];
        socialState.messages = Array.isArray(overview.recentMessages) ? overview.recentMessages : [];
        socialState.configs = Array.isArray(overview.configs) ? overview.configs : [];

        renderMetrics(overview.metrics || {});
        renderConnectors(socialState.configs);
        renderPostNetworkCheckboxes(socialState.configs);
        renderAlerts(socialState.alerts);
        renderMessages(socialState.messages);
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível carregar o monitor social.', 'error');
    } finally {
        $('#sm-refresh-btn').prop('disabled', false);
    }
}

async function postManualAction(messageId, payload) {
    const res = await fetch(`/api/social-monitor/messages/${encodeURIComponent(messageId)}/manual-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            school_id: socialState.schoolId,
            performed_by: sessionStorage.getItem('USER_NAME') || 'Diretoria',
            ...payload
        })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Falha ao registrar ação manual.');
    return body;
}

async function saveConnectorConfig() {
    const platform = String($('#sm-config-platform').val() || '').trim();
    if (!platform) {
        Swal.fire('Erro', 'Plataforma não identificada para salvar a configuração.', 'error');
        return;
    }

    const allowedChannels = checkedChannelsFromDom();
    if (!allowedChannels.length) {
        Swal.fire('Atenção', 'Selecione ao menos um canal monitorado.', 'warning');
        return;
    }

    const btn = $('#sm-config-save-btn');
    btn.prop('disabled', true);

    try {
        const payload = {
            school_id: socialState.schoolId,
            platform,
            enabled: $('#sm-config-enabled').is(':checked'),
            connection_status: $('#sm-config-connection-status').val(),
            account_label: $('#sm-config-account-label').val(),
            webhook_verify_token: $('#sm-config-verify-token').val(),
            auto_reply_enabled: $('#sm-config-auto-reply').is(':checked'),
            notify_director_on_sensitive: $('#sm-config-notify-director').is(':checked'),
            allowed_channels: allowedChannels,
            metadata: {
                app_id: $('#sm-config-app-id').val(),
                page_id: $('#sm-config-page-id').val(),
                instagram_business_id: $('#sm-config-instagram-business-id').val(),
                tiktok_account_id: $('#sm-config-tiktok-account-id').val(),
                linkedin_org_id: $('#sm-config-linkedin-org-id').val(),
                webhook_path: $('#sm-config-webhook-path').val()
            },
            credentials: {
                access_token: $('#sm-config-access-token').val(),
                refresh_token: $('#sm-config-refresh-token').val(),
                app_secret: $('#sm-config-app-secret').val()
            }
        };

        const res = await fetch('/api/social-monitor/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao salvar configuração do conector.');

        $('#sm-config-modal').modal('hide');
        Swal.fire('Sucesso', 'Configuração do conector salva.', 'success');
        await loadMonitor();
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível salvar a configuração.', 'error');
    } finally {
        btn.prop('disabled', false);
    }
}

async function ingestSimulation() {
    const author = String($('#sm-sim-author').val() || '').trim();
    const message = String($('#sm-sim-message').val() || '').trim();
    if (!author || !message) {
        Swal.fire('Atenção', 'Preencha autor e mensagem para simular a interação.', 'warning');
        return;
    }

    const btn = $('#sm-sim-submit');
    btn.prop('disabled', true);

    try {
        const res = await fetch('/api/social-monitor/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                school_id: socialState.schoolId,
                platform: $('#sm-sim-platform').val(),
                channel: $('#sm-sim-channel').val(),
                sender_handle: author,
                sender_name: author.replace(/^@/, ''),
                message_text: message,
                post_permalink: $('#sm-sim-link').val() || null,
                metadata: {
                    source: 'manual-simulator'
                }
            })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao enviar item para a central.');

        const dispatchText = body?.dispatch?.sent
            ? ' A resposta automática já foi enviada.'
            : body?.message?.classification_decision === 'AUTO_REPLY'
                ? ' A resposta automática ficou pronta, aguardando conector.'
                : '';
        Swal.fire('Sucesso', `Interação enviada para a central de triagem.${dispatchText}`, 'success');
        $('#sm-sim-message').val('');
        $('#sm-sim-link').val('');
        await loadMonitor();
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível simular a interação.', 'error');
    } finally {
        btn.prop('disabled', false);
    }
}

window.openMessageModal = async function openMessageModal(messageId) {
    const item = findMessageById(messageId);
    if (!item) return;

    const autoReplyHtml = item.ai_response_text
        ? `<div class="mt-3"><strong>Resposta sugerida pela IA</strong><div class="mt-2 p-2 bg-light rounded text-break-safe">${escapeHtml(item.ai_response_text)}</div></div>`
        : '';

    const manualStatusRaw = item.manual_reply_status || '';
    const manualStatusMap = {
        SENT: { label: 'Enviada pelo canal', cls: 'text-success' },
        LOGGED: { label: 'Registrada (resposta feita externamente)', cls: 'text-info' },
        READY: { label: 'Pronta para envio (aguardando conector)', cls: 'text-warning' },
        PENDING: { label: 'Pendente', cls: 'text-muted' }
    };
    const manualStatusInfo = manualStatusMap[manualStatusRaw] || (manualStatusRaw ? { label: manualStatusRaw, cls: 'text-muted' } : null);
    const dispatchReason = item.metadata?.manual_dispatch_result?.reason;
    const manualReplyHtml = item.manual_reply_text
        ? `<div class="mt-3">
                <strong>Resposta manual registrada</strong>
                ${manualStatusInfo ? `<span class="ml-2 small ${manualStatusInfo.cls}">(${escapeHtml(manualStatusInfo.label)})</span>` : ''}
                <div class="mt-2 p-2 bg-light rounded text-break-safe">${escapeHtml(item.manual_reply_text)}</div>
                ${dispatchReason ? `<div class="small text-muted mt-1">Obs.: ${escapeHtml(dispatchReason)}</div>` : ''}
           </div>`
        : '';
    const notesHtml = item.notes
        ? `<div class="mt-3"><strong>Observações internas</strong><div class="small text-muted mt-1">${escapeHtml(item.notes)}</div></div>`
        : '';

    await Swal.fire({
        title: 'Detalhes da interação',
        width: 760,
        html: `
            <div class="text-left">
                <div class="mb-2"><strong>Origem:</strong> ${buildOriginLine(item)}</div>
                <div class="mb-2"><strong>Autor:</strong> ${renderAuthorCell(item)}</div>
                <div class="mb-2"><strong>Decisão:</strong> ${escapeHtml(decisionLabel(item.classification_decision))}</div>
                <div class="mb-2"><strong>Status:</strong> ${escapeHtml(statusLabel(item.status))}</div>
                <div class="mb-2"><strong>Mensagem:</strong></div>
                <div class="p-3 bg-light rounded text-break-safe">${escapeHtml(item.message_text || '')}</div>
                <div class="mt-3"><strong>Justificativa da central:</strong><div class="small text-muted mt-1">${escapeHtml(item.classification_rationale || 'Sem justificativa registrada.')}</div></div>
                ${autoReplyHtml}
                ${manualReplyHtml}
                ${notesHtml}
            </div>
        `,
        confirmButtonText: 'Fechar'
    });
};

window.openAlertModal = async function openAlertModal(alertId) {
    const alert = findAlertById(alertId);
    if (!alert) return;
    const item = alert.message || {};

    const { value: formValues, isConfirmed } = await Swal.fire({
        title: 'Providência manual da diretoria',
        width: 860,
        html: `
            <div class="text-left">
                <div class="mb-2"><strong>Origem:</strong> ${buildOriginLine(item)}</div>
                <div class="mb-2"><strong>Autor:</strong> ${renderAuthorCell(item)}</div>
                <div class="mb-2"><strong>Categoria:</strong> ${escapeHtml(item.classification_category || 'Sensível')}</div>
                <div class="p-3 bg-light rounded text-break-safe mb-3">${escapeHtml(item.message_text || '')}</div>
                <div class="form-group">
                    <label for="sm-manual-reply" class="font-weight-bold d-block">Resposta manual</label>
                    <textarea id="sm-manual-reply" class="form-control" rows="4" style="width:100%;display:block;resize:vertical;" placeholder="Escreva aqui a resposta que a equipe enviará manualmente.">${escapeHtml(item.manual_reply_text || '')}</textarea>
                </div>
                <div class="custom-control custom-checkbox mb-3 text-left">
                    <input type="checkbox" class="custom-control-input" id="sm-skip-dispatch">
                    <label class="custom-control-label" for="sm-skip-dispatch">
                        Já respondi no canal externo — apenas registrar (não reenviar)
                    </label>
                </div>
                <div class="form-group mb-0">
                    <label for="sm-manual-notes" class="font-weight-bold d-block">Observações internas</label>
                    <textarea id="sm-manual-notes" class="form-control" rows="3" style="width:100%;display:block;resize:vertical;" placeholder="Ex.: ligar para a família, acionar pedagógico, revisar postagem...">${escapeHtml(alert.resolution_notes || item.notes || '')}</textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Salvar e encaminhar manualmente',
        cancelButtonText: 'Fechar',
        focusConfirm: false,
        preConfirm: () => ({
            manual_reply_text: document.getElementById('sm-manual-reply').value,
            notes: document.getElementById('sm-manual-notes').value,
            skip_dispatch: document.getElementById('sm-skip-dispatch')?.checked === true
        })
    });

    if (!isConfirmed) return;

    try {
        const result = await postManualAction(item.id, {
            action: 'SEND_MANUAL_REPLY',
            manual_reply_text: formValues.manual_reply_text,
            notes: formValues.notes,
            skip_dispatch: formValues.skip_dispatch,
            alert_id: alert.id
        });
        const sent = !!result?.dispatch?.sent;
        const loggedOnly = result?.dispatch?.status === 'LOGGED_ONLY';
        const successMsg = loggedOnly
            ? 'Resposta registrada no histórico (envio externo ignorado).'
            : sent
                ? 'A providência foi registrada e a resposta foi enviada no canal.'
                : 'A providência foi registrada. A resposta ficou pronta para envio pelo conector.';
        Swal.fire('Sucesso', successMsg, 'success');
        await loadMonitor();
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível salvar a providência.', 'error');
    }
};

window.markAlertResolved = async function markAlertResolved(alertId) {
    const alert = findAlertById(alertId);
    if (!alert?.message?.id) return;

    try {
        await postManualAction(alert.message.id, {
            action: 'MARK_RESOLVED',
            alert_id: alert.id,
            notes: 'Item marcado como resolvido pela diretoria.'
        });
        Swal.fire('Sucesso', 'O alerta foi marcado como resolvido.', 'success');
        await loadMonitor();
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message || 'Não foi possível concluir o alerta.', 'error');
    }
};

window.openConfigModal = function openConfigModal(platform) {
    const cfg = getConfigByPlatform(platform) || {};
    const refs = cfg.references || {};
    const allowedChannels = Array.isArray(cfg.allowed_channels) ? cfg.allowed_channels : ['DIRECT', 'POST_COMMENT'];
    const platformUpper = String(platform || '').toUpperCase();
    toggleConfigFieldsByPlatform(platformUpper);

    $('#sm-config-modal-title').text(`Configurar ${platformLabel(platform)}`);
    $('#sm-config-platform').val(platform || '');
    $('#sm-config-account-label').val(cfg.account_label || '');
    $('#sm-config-connection-status').val(cfg.connection_status || 'PENDING');
    $('#sm-config-enabled').prop('checked', !!cfg.enabled);
    $('#sm-config-auto-reply').prop('checked', cfg.auto_reply_enabled !== false);
    $('#sm-config-notify-director').prop('checked', cfg.notify_director_on_sensitive !== false);
    $('.sm-config-channel').prop('checked', false);
    allowedChannels.forEach((channel) => {
        $(`.sm-config-channel[value="${channel}"]`).prop('checked', true);
    });

    $('#sm-config-app-id').val(refs.app_id || '');
    $('#sm-config-page-id').val(refs.page_id || '');
    $('#sm-config-instagram-business-id').val(refs.instagram_business_id || '');
    $('#sm-config-tiktok-account-id').val(refs.tiktok_account_id || '');
    $('#sm-config-linkedin-org-id').val(refs.linkedin_org_id || '');
    $('#sm-config-verify-token').val(cfg.webhook_verify_token || '');
    $('#sm-config-webhook-path').val(refs.webhook_path || '');
    $('#sm-config-access-token').val('');
    $('#sm-config-refresh-token').val('');
    $('#sm-config-app-secret').val('');

    const hasAccess = !!cfg.has_credentials?.access_token;
    const hasRefresh = !!cfg.has_credentials?.refresh_token;
    const hasAppSecret = !!cfg.has_credentials?.app_secret;

    const setBadge = (el, ok, okText = 'SALVO', emptyText = 'vazio') => {
        el.text(ok ? okText : emptyText)
          .removeClass('badge-secondary badge-success')
          .addClass(ok ? 'badge-success' : 'badge-secondary');
    };
    setBadge($('#sm-config-access-token-badge'), hasAccess);
    setBadge($('#sm-config-refresh-token-badge'), hasRefresh);
    setBadge($('#sm-config-app-secret-badge'), hasAppSecret);

    $('#sm-config-access-token-status').text(hasAccess ? 'Já existe um access token salvo. Preencha para substituir.' : 'Nenhum access token salvo.');
    $('#sm-config-refresh-token-status').text(hasRefresh ? 'Já existe um refresh token salvo. Preencha para substituir.' : 'Nenhum refresh token salvo (opcional).');
    $('#sm-config-app-secret-status').text(hasAppSecret ? 'App Secret já cadastrado. Preencha para substituir.' : 'Nenhum App Secret salvo.');

    // Resumo com pills por campo obrigatório
    const requirementsByPlatform = {
        INSTAGRAM: [
            { key: 'app_id', label: 'App ID', ok: !!refs.app_id },
            { key: 'app_secret', label: 'App Secret', ok: hasAppSecret },
            { key: 'ig_biz', label: 'IG Business ID', ok: !!refs.instagram_business_id },
            { key: 'page_id', label: 'Page ID', ok: !!refs.page_id },
            { key: 'verify', label: 'Verify Token', ok: !!cfg.webhook_verify_token },
            { key: 'access', label: 'Access Token', ok: hasAccess }
        ],
        FACEBOOK: [
            { key: 'app_id', label: 'App ID', ok: !!refs.app_id },
            { key: 'app_secret', label: 'App Secret', ok: hasAppSecret },
            { key: 'page_id', label: 'Page ID', ok: !!refs.page_id },
            { key: 'verify', label: 'Verify Token', ok: !!cfg.webhook_verify_token },
            { key: 'access', label: 'Access Token', ok: hasAccess }
        ],
        TIKTOK: [
            { key: 'tt_acc', label: 'TikTok Account ID', ok: !!refs.tiktok_account_id },
            { key: 'verify', label: 'Verify Token', ok: !!cfg.webhook_verify_token },
            { key: 'access', label: 'Access Token', ok: hasAccess }
        ],
        LINKEDIN: [
            { key: 'li_org', label: 'LinkedIn Org ID', ok: !!refs.linkedin_org_id },
            { key: 'verify', label: 'Verify Token', ok: !!cfg.webhook_verify_token },
            { key: 'access', label: 'Access Token', ok: hasAccess }
        ],
        YOUTUBE: [
            { key: 'access', label: 'Access Token', ok: hasAccess },
            { key: 'refresh', label: 'Refresh Token', ok: hasRefresh }
        ]
    };
    const reqs = requirementsByPlatform[platformUpper] || requirementsByPlatform.INSTAGRAM;
    const filled = reqs.filter((r) => r.ok).length;
    const total = reqs.length;
    const complete = filled === total;

    const pillsHtml = reqs.map((r) => {
        const cls = r.ok ? 'badge-success' : 'badge-light border text-muted';
        const icon = r.ok ? '&#10003;' : '&#9888;';
        return `<span class="badge ${cls}" style="padding:.4rem .6rem; font-size:.78rem;">${icon} ${r.label}</span>`;
    }).join('');
    $('#sm-config-summary-pills').html(pillsHtml);

    const overall = $('#sm-config-summary-overall');
    overall.removeClass('badge-secondary badge-success badge-warning badge-danger');
    if (complete && cfg.enabled) {
        overall.addClass('badge-success').text(`Completo (${filled}/${total})`);
    } else if (complete && !cfg.enabled) {
        overall.addClass('badge-warning').text(`Pronto — ative o canal (${filled}/${total})`);
    } else if (filled === 0) {
        overall.addClass('badge-secondary').text(`Pendente (0/${total})`);
    } else {
        overall.addClass('badge-warning').text(`Incompleto (${filled}/${total})`);
    }

    $('#sm-config-summary-hint').html(
        complete
            ? 'Todos os campos necessários estão preenchidos. ' + (cfg.enabled ? 'Canal ativo — o webhook já responde.' : 'Ative o switch <strong>Canal ativo</strong> para começar a receber eventos.')
            : 'Preencha os campos marcados em cinza. Credenciais sensíveis ficam marcadas como <strong>SALVO</strong> quando guardadas; elas não são reexibidas por segurança.'
    );

    $('#sm-config-modal').modal('show');
};

async function loadReplyConfig() {
    if (!socialState.schoolId) return;
    try {
        const res = await fetch(`/api/social-monitor/reply-config?school_id=${encodeURIComponent(socialState.schoolId)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar configuração de respostas.');
        const cfg = body.config || {};
        $('#sm-reply-bot-name').val(cfg.bot_name || 'Alva');
        $('#sm-reply-identity').val(cfg.identity_phrase || '');
        $('#sm-reply-short-name').val(cfg.school_short_name || '');
        if (cfg.updated_at) {
            $('#sm-reply-config-status').removeClass('badge-secondary badge-danger').addClass('badge-success').text('salvo');
        }
    } catch (err) {
        console.warn('Não foi possível carregar configuração de respostas:', err.message);
    }
}

async function saveReplyConfig() {
    const btn = $('#sm-reply-config-save-btn');
    btn.prop('disabled', true);
    try {
        const res = await fetch('/api/social-monitor/reply-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                school_id: socialState.schoolId,
                bot_name: String($('#sm-reply-bot-name').val() || 'Alva').trim(),
                identity_phrase: String($('#sm-reply-identity').val() || '').trim() || null,
                school_short_name: String($('#sm-reply-short-name').val() || '').trim() || null
            })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao salvar configuração de respostas.');
        $('#sm-reply-config-status').removeClass('badge-secondary badge-danger').addClass('badge-success').text('salvo');
        Swal.fire('Sucesso', 'Personalização das respostas automáticas salva.', 'success');
    } catch (err) {
        console.error(err);
        $('#sm-reply-config-status').removeClass('badge-secondary badge-success').addClass('badge-danger').text('erro');
        Swal.fire('Erro', err.message || 'Não foi possível salvar a personalização.', 'error');
    } finally {
        btn.prop('disabled', false);
    }
}

// ─── Feed do Monitor Social ─────────────────────────────────────────────────

const calState = {
    monthsLoaded: [],   // [{year, month}] cronológico decrescente
    postsByDay: {},     // 'YYYY-MM-DD' -> [posts]
    warnings: [],
    viewYear: 0,        // mês exibido no calendário lateral
    viewMonth: 0,
    activeDay: null,    // dia destacado no calendário (post visível no scroll)
    observer: null,
    initialized: false,
    loading: false,
};

const CAL_MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CAL_DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function calISODate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function calMonthKey(y, m) { return `${y}-${String(m + 1).padStart(2,'0')}`; }

// Renderiza o mini calendário do mês `viewYear`/`viewMonth`. Marca dias com posts
// (qualquer mês carregado) e o dia ativo (do post visível no scroll).
function calRenderMonth() {
    const { viewYear: year, viewMonth: month, postsByDay, activeDay } = calState;
    $('#sm-cal-title').text(`${CAL_MONTHS_PT[month]} ${year}`);

    const head = $('#sm-cal-head').empty();
    CAL_DAYS_PT.forEach(d => head.append(`<th>${d}</th>`));

    const body = $('#sm-cal-body').empty();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayISO = calISODate(today.getFullYear(), today.getMonth(), today.getDate());

    let row = $('<tr>');
    for (let i = 0; i < firstDay; i++) row.append('<td></td>');

    for (let d = 1; d <= daysInMonth; d++) {
        const iso = calISODate(year, month, d);
        const hasPosts = !!(postsByDay[iso] && postsByDay[iso].length);
        const isToday = iso === todayISO;
        const isActive = iso === activeDay;
        const cell = $(`<td class="sm-cal-cell${isToday ? ' today' : ''}${isActive ? ' selected' : ''}${hasPosts ? ' has-posts' : ''}" data-day="${iso}">
            <div>${d}</div><div class="sm-cal-dot"></div>
        </td>`);
        cell.on('click', () => feedScrollToDay(iso));
        row.append(cell);
        if ((firstDay + d - 1) % 7 === 6) {
            body.append(row);
            row = $('<tr>');
        }
    }
    if (row.children().length) {
        const remaining = 7 - row.children().length;
        for (let i = 0; i < remaining; i++) row.append('<td></td>');
        body.append(row);
    }
}

async function feedFetchMonth(year, month) {
    const from = calISODate(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = calISODate(year, month, lastDay);
    try {
        const res = await fetch(`/api/social/posts?school_id=${encodeURIComponent(socialState.schoolId)}&from=${from}&to=${to}`, {
            headers: { 'x-school-id': socialState.schoolId }
        });
        const data = await res.json();
        (data.posts || []).forEach(post => {
            const dateStr = (post.published_at || post.created_at || '').slice(0, 10);
            if (!dateStr) return;
            if (!calState.postsByDay[dateStr]) calState.postsByDay[dateStr] = [];
            // evita duplicar caso o mesmo post venha de mais de uma chamada
            const extId = post.results?.[0]?.externalId;
            const exists = extId && calState.postsByDay[dateStr].some(p => p.results?.[0]?.externalId === extId);
            if (!exists) calState.postsByDay[dateStr].push(post);
        });
        if (data.warnings && data.warnings.length) calState.warnings = data.warnings;
    } catch (err) {
        console.error('Erro ao buscar postagens do feed:', err);
    }
}

function calRenderWarnings() {
    let bar = $('#sm-cal-warnings');
    if (!bar.length) {
        bar = $('<div id="sm-cal-warnings" class="alert alert-warning py-2 px-3 mb-3" style="font-size:13px;display:none;"></div>');
        $('#sm-feed-loading').before(bar);
    }
    const ws = calState.warnings || [];
    if (!ws.length) { bar.hide().empty(); return; }
    bar.html('<i class="fas fa-exclamation-triangle mr-1"></i><strong>Atenção:</strong> ' +
        ws.map(escapeHtml).join(' • ')).show();
}

function calNetworkBadges(results) {
    return (results || []).map(r => {
        const cls = r.success ? 'ok' : 'fail';
        const icon = r.success ? 'fa-check' : 'fa-times';
        const label = escapeHtml(platformLabel(r.platform || ''));
        return `<span class="sm-net-badge ${cls}"><i class="fas ${icon}"></i>${label}</span>`;
    }).join('');
}

// Renderiza um único card de post (estilo feed).
function feedRenderCard(post, idx) {
    const dt = post.published_at || post.created_at || '';
    const dayISO = dt.slice(0, 10);
    const time = dt ? new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const fullText = post.content || '';
    const isLong = fullText.length > 220;
    const preview = escapeHtml(isLong ? fullText.slice(0, 220) : fullText);
    const badges = calNetworkBadges(post.results || []);

    const postId = post.id || null;
    const extId  = (post.results || []).find(r => r.externalId)?.externalId || null;
    const wrapKey = postId || `api-${extId || idx}`;

    const username = post.account_username || (post.results?.[0]?.platform === 'INSTAGRAM' ? 'Instagram' : (post.results?.[0]?.platform || 'Postagem'));
    const avatar = post.account_avatar
        ? `<img src="${escapeHtml(post.account_avatar)}" class="sm-post-avatar" alt="" onerror="this.outerHTML='<span class=\\'sm-post-avatar-fallback\\'><i class=\\'fab fa-instagram\\'></i></span>'"/>`
        : `<span class="sm-post-avatar-fallback"><i class="fab fa-instagram"></i></span>`;

    const isVideo = post.media_type === 'VIDEO';
    const imgSrc = post.thumbnail_url || post.media_url;
    const mediaBlock = imgSrc
        ? `<div class="sm-post-media"><img src="${escapeHtml(imgSrc)}" alt="" loading="lazy" onerror="this.parentElement.outerHTML='<div class=\\'sm-post-no-media\\'>Mídia indisponível</div>'"/>${isVideo ? '<i class="fas fa-play-circle sm-media-play"></i>' : ''}</div>`
        : `<div class="sm-post-no-media"><i class="far fa-image mr-1"></i>Sem mídia disponível</div>`;

    const likes = post.like_count || 0;
    const comments = post.comments_count || 0;
    const statsBlock = (likes || comments) ? `<div class="sm-post-stats">${likes ? `<span><i class="fas fa-heart"></i>${likes}</span>` : ''}${comments ? `<span><i class="fas fa-comment"></i>${comments}</span>` : ''}</div>` : '';

    const captionBlock = fullText ? `<div class="sm-post-text"><span class="sm-post-username-inline">${escapeHtml(username)}</span>${preview}${isLong ? '<span class="sm-post-text-more"> mais</span>' : ''}</div>` : '';
    const permalinkBlock = post.permalink ? `<a href="${escapeHtml(post.permalink)}" target="_blank" rel="noopener" class="sm-post-permalink"><i class="fas fa-external-link-alt mr-1"></i>Ver na rede social</a>` : '';

    const isInstagram = post.results?.[0]?.platform === 'INSTAGRAM';
    const menuBlock = (isInstagram && extId) ? `
        <div class="sm-post-menu dropdown">
            <button class="sm-post-menu-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <i class="fas fa-ellipsis-h"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-right">
                <a class="dropdown-item sm-act-edit" href="#"><i class="fas fa-edit mr-2"></i>Editar legenda</a>
                <a class="dropdown-item sm-act-delete text-danger" href="#"><i class="fas fa-trash mr-2"></i>Apagar postagem</a>
            </div>
        </div>` : '';

    const card = $(`<div class="sm-post-card" data-day="${dayISO}" data-external-id="${escapeHtml(extId || '')}">
        <div class="sm-post-header">
            ${avatar}
            <div class="sm-post-userblock">
                <div class="sm-post-username">${escapeHtml(username)}</div>
                <div class="sm-post-time">${time}${badges ? ' · ' + badges : ''}</div>
            </div>
            ${menuBlock}
        </div>
        ${mediaBlock}
        ${statsBlock}
        ${captionBlock}
        ${permalinkBlock}
        <div class="sm-post-actions">
            <div class="sm-interactions-toggle"
                data-post-id="${escapeHtml(postId || '')}"
                data-external-id="${escapeHtml(extId || '')}"
                data-wrap-key="${escapeHtml(wrapKey)}"
                data-loaded="0">
                <i class="fas fa-comments mr-1"></i>Ver interações
            </div>
            <div class="sm-interactions-wrap" id="sm-int-${escapeHtml(wrapKey)}" style="display:none;"></div>
        </div>
    </div>`);

    if (isLong) {
        card.find('.sm-post-text-more').on('click', function() {
            $(this).parent().html(`<span class="sm-post-username-inline">${escapeHtml(username)}</span>${escapeHtml(fullText)}`);
        });
    }

    // Ações de edição/exclusão (Instagram)
    card.find('.sm-act-edit').on('click', async function(e) {
        e.preventDefault();
        const { value: newCaption } = await Swal.fire({
            title: 'Editar legenda',
            input: 'textarea',
            inputValue: fullText,
            inputAttributes: { rows: 8, maxlength: 2200 },
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            inputValidator: (v) => !v && 'A legenda não pode ficar vazia.'
        });
        if (newCaption === undefined) return;
        try {
            const r = await fetch(`/api/social/posts/${encodeURIComponent(extId)}/caption`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-school-id': socialState.schoolId },
                body: JSON.stringify({ school_id: socialState.schoolId, caption: newCaption })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Falha ao editar.');
            Swal.fire('Sucesso', 'Legenda atualizada.', 'success');
            // Atualiza visualmente
            post.content = newCaption;
            const newCard = feedRenderCard(post, idx);
            card.replaceWith(newCard);
        } catch (e) {
            Swal.fire('Erro', e.message || 'Não foi possível editar.', 'error');
        }
    });

    card.find('.sm-act-delete').on('click', async function(e) {
        e.preventDefault();
        const { isConfirmed } = await Swal.fire({
            title: 'Apagar postagem?',
            text: 'Essa ação é irreversível e remove o post da rede social.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Apagar',
            confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancelar'
        });
        if (!isConfirmed) return;
        try {
            const r = await fetch(`/api/social/posts/${encodeURIComponent(extId)}?school_id=${encodeURIComponent(socialState.schoolId)}`, {
                method: 'DELETE',
                headers: { 'x-school-id': socialState.schoolId }
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Falha ao apagar.');
            Swal.fire('Apagado', 'A postagem foi removida.', 'success');
            card.fadeOut(300, () => card.remove());
        } catch (e) {
            Swal.fire('Erro', e.message || 'Não foi possível apagar.', 'error');
        }
    });

    card.find('.sm-interactions-toggle').on('click', async function() {
        const pid = $(this).data('post-id');
        const extIdLocal = $(this).data('external-id');
        const loaded = $(this).data('loaded');
        const wrap = $(`#sm-int-${$(this).data('wrap-key')}`);
        if (loaded) { wrap.toggle(); return; }
        $(this).html('<i class="fas fa-spinner fa-spin mr-1"></i>Carregando...');
        try {
            const urlPath = pid ? `/api/social/posts/${pid}/interactions?school_id=${encodeURIComponent(socialState.schoolId)}`
                : `/api/social/posts/_/interactions?school_id=${encodeURIComponent(socialState.schoolId)}&external_id=${encodeURIComponent(extIdLocal)}`;
            const res = await fetch(urlPath, { headers: { 'x-school-id': socialState.schoolId } });
            const data = await res.json();
            const msgs = data.messages || [];
            wrap.empty();
            if (!msgs.length) {
                wrap.html('<div class="text-muted small">Nenhuma interação registrada para esta postagem.</div>');
            } else {
                const renderItem = (msg, isReply) => {
                    const sender = escapeHtml(msg.sender_name || msg.sender_handle || 'Anônimo');
                    const text   = escapeHtml(msg.message_text || '');
                    const ch     = escapeHtml(msg.channel || '');
                    const ts     = msg.created_at ? new Date(msg.created_at).toLocaleString('pt-BR') : '';
                    const isComment = ch === 'POST_COMMENT' || ch === 'REEL_COMMENT';
                    const sourceMsgId = escapeHtml(msg.source_message_id || msg.id || '');
                    // Não permite responder uma reply (Instagram só suporta 1 nível)
                    const replyAction = (isComment && !isReply) ? `
                        <span class="sm-int-reply-toggle" data-source-id="${sourceMsgId}">
                            <i class="fas fa-reply mr-1"></i>Responder
                        </span>` : '';
                    return `<div class="sm-interaction-item ${isReply ? 'sm-interaction-reply' : ''}" data-msg-id="${sourceMsgId}">
                        <div class="sm-int-sender">${sender}${isReply ? ' <span class="text-muted small">↳ resposta</span>' : ` <span class="text-muted font-weight-normal">(${ch})</span>`}</div>
                        <div class="sm-int-text">${text}</div>
                        <div class="sm-int-meta">${ts}</div>
                        ${replyAction}
                        <div class="sm-int-reply-form-wrap"></div>
                    </div>`;
                };

                msgs.forEach(msg => {
                    let html = renderItem(msg, false);
                    if (Array.isArray(msg.replies) && msg.replies.length) {
                        const repliesHtml = msg.replies
                            .slice()
                            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
                            .map(r => renderItem(r, true))
                            .join('');
                        html += `<div class="sm-interaction-replies">${repliesHtml}</div>`;
                    }
                    wrap.append(html);
                });

                // Bind reply toggles
                wrap.find('.sm-int-reply-toggle').on('click', function() {
                    const wrapForm = $(this).siblings('.sm-int-reply-form-wrap');
                    if (wrapForm.children().length) { wrapForm.empty(); return; }
                    const sourceId = $(this).data('source-id');
                    const form = $(`<div class="sm-int-reply-form">
                        <input type="text" placeholder="Escreva sua resposta..."/>
                        <button class="btn btn-primary btn-sm">Enviar</button>
                    </div>`);
                    form.find('button').on('click', async () => {
                        const text = form.find('input').val().trim();
                        if (!text) return;
                        form.find('button').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
                        try {
                            const r = await fetch(`/api/social/comments/${encodeURIComponent(sourceId)}/reply`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-school-id': socialState.schoolId },
                                body: JSON.stringify({ school_id: socialState.schoolId, message: text })
                            });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.error || 'Falha ao responder.');
                            wrapForm.html(`<div class="text-success small mt-1"><i class="fas fa-check mr-1"></i>Resposta enviada.</div>`);
                        } catch (e) {
                            Swal.fire('Erro', e.message || 'Não foi possível responder.', 'error');
                            form.find('button').prop('disabled', false).text('Enviar');
                        }
                    });
                    wrapForm.append(form);
                    form.find('input').focus();
                });
            }
            $(this).data('loaded', 1).html('<i class="fas fa-comments mr-1"></i>Interações');
            wrap.show();
        } catch (err) {
            console.error(err);
            $(this).data('loaded', 0).html('<i class="fas fa-comments mr-1"></i>Ver interações');
            Swal.fire('Erro', 'Não foi possível carregar as interações.', 'error');
        }
    });

    return card;
}

// Retorna plataformas ativas no filtro (array vazio = todas)
function feedActiveFilter() {
    const active = [];
    $('.sm-net-pill.active').each(function() {
        active.push($(this).data('platform'));
    });
    return active;
}

// Atualiza contadores e exibe/oculta pills sem posts
function feedUpdatePillCounts() {
    const counts = {};
    Object.values(calState.postsByDay).forEach(posts => {
        posts.forEach(p => {
            const plat = (p.platform || p.results?.[0]?.platform || '').toUpperCase();
            if (plat) counts[plat] = (counts[plat] || 0) + 1;
        });
    });
    $('.sm-net-pill').each(function() {
        const plat = $(this).data('platform');
        const n = counts[plat] || 0;
        $(this).find('.pill-count').text(n ? `(${n})` : '');
        $(this).toggle(n > 0);
    });
}

// Renderiza o feed inteiro (todos os posts dos meses carregados, ordem decrescente).
function feedRender() {
    const list = $('#sm-feed-list').empty();
    const filter = feedActiveFilter();

    // Junta todos os dias em ordem decrescente
    const days = Object.keys(calState.postsByDay).sort().reverse();
    if (!days.length) {
        $('#sm-feed-empty').show();
        $('#sm-feed-loading').hide();
        return;
    }
    $('#sm-feed-empty').hide();
    $('#sm-feed-loading').hide();

    let totalVisible = 0;
    days.forEach(iso => {
        let posts = (calState.postsByDay[iso] || []).slice().sort((a, b) =>
            new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0)
        );
        if (filter.length) {
            posts = posts.filter(p => {
                const plat = (p.platform || p.results?.[0]?.platform || '').toUpperCase();
                return filter.includes(plat);
            });
        }
        if (!posts.length) return;
        totalVisible += posts.length;
        const [y, m, d] = iso.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const label = `${weekday}, ${parseInt(d, 10)} de ${CAL_MONTHS_PT[parseInt(m, 10) - 1]} de ${y}`;
        list.append(`<div class="sm-feed-day-header" data-day-header="${iso}">${escapeHtml(label)}</div>`);
        posts.forEach((p, i) => list.append(feedRenderCard(p, i)));
    });

    if (!totalVisible) {
        $('#sm-feed-empty').show();
    }

    feedSetupObserver();
    feedUpdateLoadButtons();
}

// IntersectionObserver: ao scrollar, marca o dia do post mais visível como ativo
function feedSetupObserver() {
    if (calState.observer) calState.observer.disconnect();

    const cards = document.querySelectorAll('#sm-feed-list .sm-post-card[data-day]');
    if (!cards.length) return;

    calState.observer = new IntersectionObserver((entries) => {
        // pega a entry mais visível
        let top = null;
        entries.forEach(e => {
            if (e.isIntersecting && (!top || e.intersectionRatio > top.intersectionRatio)) top = e;
        });
        if (!top) return;
        const iso = top.target.getAttribute('data-day');
        if (!iso || iso === calState.activeDay) return;
        calState.activeDay = iso;
        // atualiza calendário se mudou de mês
        const [y, m] = iso.split('-').map(Number);
        if (y !== calState.viewYear || (m - 1) !== calState.viewMonth) {
            calState.viewYear = y;
            calState.viewMonth = m - 1;
        }
        calRenderMonth();
    }, { rootMargin: '-30% 0px -50% 0px', threshold: [0.1, 0.3, 0.6] });

    cards.forEach(c => calState.observer.observe(c));
}

// Click no dia do calendário → scrolla até o primeiro post desse dia (ou avisa se não há)
function feedScrollToDay(iso) {
    const target = document.querySelector(`#sm-feed-list .sm-post-card[data-day="${iso}"]`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        calState.activeDay = iso;
        calRenderMonth();
        return;
    }
    // Se o dia está fora do range carregado, sugere carregar mais
    const oldest = calState.monthsLoaded[calState.monthsLoaded.length - 1];
    const [y, m] = iso.split('-').map(Number);
    const targetKey = calMonthKey(y, m - 1);
    const oldestKey = oldest ? calMonthKey(oldest.year, oldest.month) : null;
    if (oldestKey && targetKey < oldestKey) {
        Swal.fire({
            title: 'Carregar postagens mais antigas?',
            text: `Esse dia está fora do período carregado.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Carregar',
            cancelButtonText: 'Cancelar'
        }).then(async (r) => {
            if (!r.isConfirmed) return;
            // Carrega meses até alcançar o targetKey
            while (calState.monthsLoaded.length && calMonthKey(calState.monthsLoaded[calState.monthsLoaded.length - 1].year, calState.monthsLoaded[calState.monthsLoaded.length - 1].month) > targetKey) {
                await feedLoadMore(true);
            }
            feedScrollToDay(iso);
        });
    } else {
        Swal.fire('Sem postagens', 'Nenhuma postagem foi feita neste dia.', 'info');
    }
}

// Carrega o próximo mês mais antigo
async function feedLoadMore(skipRender) {
    if (calState.loading) return;
    calState.loading = true;
    const oldest = calState.monthsLoaded[calState.monthsLoaded.length - 1];
    let y = oldest.year, m = oldest.month - 1;
    if (m < 0) { m = 11; y -= 1; }
    calState.monthsLoaded.push({ year: y, month: m });
    const btn = $('#sm-feed-load-more').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Carregando...');
    await feedFetchMonth(y, m);
    btn.prop('disabled', false).html('<i class="fas fa-chevron-down mr-1"></i>Ver postagens mais antigas');
    if (!skipRender) { feedUpdatePillCounts(); feedRender(); calRenderMonth(); }
    calState.loading = false;
}

// Recolhe: mantém só o mês mais recente carregado
function feedLoadLess() {
    if (calState.monthsLoaded.length <= 1) return;
    const keep = calState.monthsLoaded[0];
    const keepKey = calMonthKey(keep.year, keep.month);
    Object.keys(calState.postsByDay).forEach(iso => {
        const [y, m] = iso.split('-').map(Number);
        if (calMonthKey(y, m - 1) !== keepKey) delete calState.postsByDay[iso];
    });
    calState.monthsLoaded = [keep];
    feedRender();
    calRenderMonth();
    document.querySelector('#sm-feed-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function feedUpdateLoadButtons() {
    $('#sm-feed-load-more-wrap').show();
    if (calState.monthsLoaded.length > 1) $('#sm-feed-load-less-wrap').show();
    else $('#sm-feed-load-less-wrap').hide();
}

async function feedInit() {
    if (calState.initialized) return;
    calState.initialized = true;
    const now = new Date();
    calState.viewYear = now.getFullYear();
    calState.viewMonth = now.getMonth();
    calState.monthsLoaded = [{ year: calState.viewYear, month: calState.viewMonth }];
    calRenderMonth();

    // Carrega o mês atual; se ficar vazio, retrocede até 6 meses pra trás até achar posts
    await feedFetchMonth(calState.viewYear, calState.viewMonth);
    let attempts = 0;
    while (Object.keys(calState.postsByDay).length === 0 && attempts < 6) {
        const oldest = calState.monthsLoaded[calState.monthsLoaded.length - 1];
        let y = oldest.year, m = oldest.month - 1;
        if (m < 0) { m = 11; y -= 1; }
        calState.monthsLoaded.push({ year: y, month: m });
        await feedFetchMonth(y, m);
        attempts++;
    }

    // Posiciona o calendário lateral no mês mais recente que tem posts
    if (Object.keys(calState.postsByDay).length > 0) {
        const latestDay = Object.keys(calState.postsByDay).sort().reverse()[0];
        const [yy, mm] = latestDay.split('-').map(Number);
        calState.viewYear = yy;
        calState.viewMonth = mm - 1;
    }

    calRenderWarnings();
    feedUpdatePillCounts();
    feedRender();
    calRenderMonth();
}

function calInit() {
    $('#sm-cal-prev').on('click', () => {
        let { viewYear: y, viewMonth: m } = calState;
        m--; if (m < 0) { m = 11; y--; }
        calState.viewYear = y; calState.viewMonth = m;
        calRenderMonth();
    });
    $('#sm-cal-next').on('click', () => {
        let { viewYear: y, viewMonth: m } = calState;
        m++; if (m > 11) { m = 0; y++; }
        calState.viewYear = y; calState.viewMonth = m;
        calRenderMonth();
    });
    $('#sm-cal-toggle').on('click', () => {
        $('#sm-cal-card').toggleClass('sm-cal-open');
        const open = $('#sm-cal-card').hasClass('sm-cal-open');
        $('#sm-cal-toggle').html(`<i class="fas fa-calendar-alt mr-1"></i>${open ? 'Ocultar calendário' : 'Mostrar calendário'}`);
    });
    $('#sm-feed-load-more').on('click', () => feedLoadMore(false));
    $('#sm-feed-load-less').on('click', feedLoadLess);

    // Pills de filtro por rede social
    $(document).on('click', '.sm-net-pill', function() {
        $(this).toggleClass('active');
        feedRender();
        feedSetupObserver();
        feedUpdateLoadButtons();
    });

    // Inicializa imediatamente já que a aba é a active por default
    feedInit();
    // Reinicializa caso o usuário troque de aba e volte
    $('#tab-calendario-link').on('shown.bs.tab', feedInit);
}

// ─── Posts Agendados ──────────────────────────────────────────────────────────

const SCHED_PLATFORM_META = {
    INSTAGRAM: { label: 'Instagram', icon: 'fab fa-instagram', color: '#E1306C' },
    FACEBOOK:  { label: 'Facebook',  icon: 'fab fa-facebook',  color: '#1877F2' },
    TIKTOK:    { label: 'TikTok',    icon: 'fab fa-tiktok',    color: '#010101' },
    YOUTUBE:   { label: 'YouTube',   icon: 'fab fa-youtube',   color: '#FF0000' },
};

const SCHED_STATUS_META = {
    pending:   { label: 'Pendente',  cls: 'badge-info' },
    published: { label: 'Publicado', cls: 'badge-success' },
    failed:    { label: 'Falhou',    cls: 'badge-danger' },
    cancelled: { label: 'Cancelado', cls: 'badge-secondary' },
};

function schedFormatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function schedCountdown(isoStr) {
    const diff = new Date(isoStr) - Date.now();
    if (diff <= 0) return 'Processando...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) {
        const days = Math.floor(h / 24);
        return `em ${days} dia${days > 1 ? 's' : ''}`;
    }
    if (h > 0) return `em ${h}h ${m}min`;
    return `em ${m} min`;
}

function schedRenderCard(post) {
    const plt = SCHED_PLATFORM_META[post.platform] || { label: post.platform, icon: 'fas fa-globe', color: '#888' };
    const st  = SCHED_STATUS_META[post.status]   || { label: post.status, cls: 'badge-secondary' };
    const isPending = post.status === 'pending';
    const preview = (post.content || '').slice(0, 120) + ((post.content || '').length > 120 ? '…' : '');
    const mediaIcon = post.media_type === 'VIDEO'
        ? '<span class="badge badge-dark badge-sm ml-1"><i class="fas fa-video mr-1"></i>Vídeo</span>'
        : (post.media_url ? '<span class="badge badge-secondary badge-sm ml-1"><i class="fas fa-image mr-1"></i>Imagem</span>' : '');

    return `
    <div class="card mb-2 sm-sched-card" data-id="${post.id}">
        <div class="card-body py-2 px-3">
            <div class="d-flex align-items-start" style="gap:12px;">
                ${post.media_url && post.media_type !== 'VIDEO'
                    ? `<img src="${post.media_url}" alt="" class="rounded" style="width:60px;height:60px;object-fit:cover;flex-shrink:0;">`
                    : `<div class="rounded d-flex align-items-center justify-content-center" style="width:60px;height:60px;background:#f3f4f6;flex-shrink:0;color:#9ca3af;font-size:22px;"><i class="${post.media_type === 'VIDEO' ? 'fas fa-video' : 'fas fa-align-left'}"></i></div>`
                }
                <div class="flex-grow-1 min-width-0">
                    <div class="d-flex align-items-center flex-wrap mb-1" style="gap:6px;">
                        <i class="${plt.icon}" style="color:${plt.color};font-size:16px;" title="${plt.label}"></i>
                        <span class="font-weight-bold small">${plt.label}</span>
                        ${mediaIcon}
                        <span class="badge ${st.cls} ml-auto">${st.label}</span>
                    </div>
                    <div class="small text-muted text-truncate mb-1" style="max-width:100%;" title="${post.content || ''}">${preview || '<em>Sem texto</em>'}</div>
                    <div class="d-flex align-items-center flex-wrap" style="gap:8px;">
                        <span class="small"><i class="fas fa-calendar-alt mr-1 text-info"></i>${schedFormatDate(post.scheduled_for)}</span>
                        ${isPending ? `<span class="small text-muted">(${schedCountdown(post.scheduled_for)})</span>` : ''}
                        ${post.post_id ? `<span class="small text-success"><i class="fas fa-check-circle mr-1"></i>ID: ${post.post_id}</span>` : ''}
                        ${post.error_message ? `<span class="small text-danger" title="${post.error_message}"><i class="fas fa-exclamation-circle mr-1"></i>${post.error_message.slice(0, 60)}</span>` : ''}
                    </div>
                </div>
                ${isPending ? `<button class="btn btn-sm btn-outline-danger flex-shrink-0 sm-sched-cancel-btn" data-id="${post.id}" data-text="${(preview).replace(/"/g,'&quot;')}" title="Cancelar agendamento">
                    <i class="fas fa-times"></i>
                </button>` : ''}
            </div>
        </div>
    </div>`;
}

async function schedLoad() {
    const statusFilter = $('#sm-sched-filter-status').val();

    $('#sm-sched-loading').show();
    $('#sm-sched-empty').hide();
    $('#sm-sched-list').html('');

    // Busca: passado 7 dias + próximos 30 dias para cobrir publicados/falhos recentes e pendentes
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        const r = await fetch(`/api/social/scheduled-posts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erro ao buscar posts agendados');

        let posts = data.posts || [];
        if (statusFilter) posts = posts.filter(p => p.status === statusFilter);

        // Ordena: pendentes primeiro (por data asc), depois os demais (mais recentes primeiro)
        posts.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (b.status === 'pending' && a.status !== 'pending') return 1;
            return new Date(a.scheduled_for) - new Date(b.scheduled_for);
        });

        const pendingCount = posts.filter(p => p.status === 'pending').length;
        if (pendingCount > 0) {
            $('#sm-scheduled-badge').text(pendingCount).show();
        } else {
            $('#sm-scheduled-badge').hide();
        }

        $('#sm-sched-loading').hide();

        if (posts.length === 0) {
            $('#sm-sched-empty').show();
            return;
        }

        const html = posts.map(schedRenderCard).join('');
        $('#sm-sched-list').html(html);
    } catch (e) {
        $('#sm-sched-loading').hide();
        $('#sm-sched-list').html(`<div class="alert alert-danger"><i class="fas fa-exclamation-circle mr-2"></i>${e.message}</div>`);
    }
}

function schedInit() {
    $('#sm-sched-refresh-btn').on('click', schedLoad);
    $('#sm-sched-filter-status').on('change', schedLoad);

    // Botão cancelar (delegado ao documento pois os cards são dinâmicos)
    $(document).on('click', '.sm-sched-cancel-btn', async function() {
        const id   = $(this).data('id');
        const text = $(this).data('text') || '';
        const res  = await Swal.fire({
            title: 'Cancelar agendamento?',
            html: `<small class="text-muted">${text}</small>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, cancelar',
            cancelButtonText: 'Voltar',
            confirmButtonColor: '#d33'
        });
        if (!res.isConfirmed) return;
        try {
            const r = await fetch(`/api/social/scheduled-posts/${id}`, { method: 'DELETE' });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Erro ao cancelar');
            Swal.fire({ title: 'Cancelado', text: 'O agendamento foi cancelado.', icon: 'success', timer: 1800, showConfirmButton: false });
            schedLoad();
        } catch (e) {
            Swal.fire('Erro', e.message, 'error');
        }
    });

    // Link do empty-state para aba Criar postagem
    $(document).on('click', '[data-target="#tab-publicar"]', function(e) {
        e.preventDefault();
        $('#tab-publicar-link').tab('show');
    });

    // Carrega ao abrir a aba
    $('#tab-agendados-link').on('shown.bs.tab', schedLoad);
}

// ─────────────────────────────────────────────────────────────────────────────

$(document).ready(async function() {
    socialState.schoolId = sessionStorage.getItem('SCHOOL_ID');

    $('#sm-refresh-btn').on('click', loadMonitor);
    $('#sm-sim-submit').on('click', ingestSimulation);
    $('#sm-post-submit-btn').on('click', publicarNasRedes);
    $('#sm-schedule-enable').on('change', function() {
        const enabled = $(this).is(':checked');
        $('#sm-schedule-fields').toggle(enabled);
        $('#sm-post-submit-btn').html(
            enabled
                ? '<i class="fas fa-calendar-check mr-1"></i>Agendar publicação'
                : '<i class="fas fa-paper-plane mr-1"></i>Publicar agora'
        );
    });
    // Pre-fill datetime-local with tomorrow at current time
    (function() {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        $('#sm-schedule-datetime').val(local);
    })();
    $('#sm-post-media-type-group').on('click', 'button[data-type]', function() {
        switchPostMediaType($(this).data('type'));
    });
    $(document).on('change', '.sm-post-network-check', updateVideoSectionVisibility);
    $('#sm-post-text').on('input', function() {
        $('#sm-post-char-count').text($(this).val().length);
    });
    $('#sm-post-image-file').on('change', async function() {
        const file = this.files && this.files[0] ? this.files[0] : null;
        if (!file) {
            resetPostImageUploadUi();
            return;
        }
        try {
            await uploadSelectedPostImage(file);
        } catch (err) {
            console.error(err);
            $('#sm-post-image-url').val('');
            setPostUploadStatus(err.message || 'Falha ao enviar imagem.', 'error');
            setPostImagePreview('');
            Swal.fire('Erro', err.message || 'Não foi possível enviar a imagem.', 'error');
        }
    });
    $('#sm-config-save-btn').on('click', saveConnectorConfig);
    $('#sm-reply-config-save-btn').on('click', saveReplyConfig);

    const waitForSession = async () => {
        for (let i = 0; i < 30; i += 1) {
            socialState.schoolId = sessionStorage.getItem('SCHOOL_ID');
            if (socialState.schoolId) return true;
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return false;
    };

    const hasSession = await waitForSession();
    if (!hasSession) {
        Swal.fire('Erro', 'Sessão da escola não encontrada para o monitor social.', 'error');
        return;
    }

    calInit();
    schedInit();

    await Promise.all([loadMonitor(), loadReplyConfig()]);
});
