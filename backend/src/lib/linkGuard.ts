import https from 'node:https';

/*
 * 發文、留言、自介裡的連結檢查（Markdown 的 [文字](網址)、直接貼的網址、www. 開頭的都算）
 *   1. 連結太多 → 擋（洗版、廣告）
 *   2. 短網址、直接用 IP 的網址、黑名單網域 → 擋（看不出真正要去哪）
 *   3. VM 有設 SAFE_BROWSING_API_KEY 才會查 Google Safe Browsing（釣魚、惡意程式），沒設就跳過
 *      Google 那邊連不上或逾時就放行，不要因為外部服務掛掉讓大家都發不了文
 * 黑名單可以用環境變數 LINK_BLOCKLIST 追加（逗號分隔，例：bad.com,evil.net），不用改程式
 */

const MAX_LINKS = 10;
const SAFE_BROWSING_TIMEOUT_MS = 3000;

// 常見短網址：點下去才知道會去哪，一律不給貼
const SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'ow.ly', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at',
    's.id', 't.ly', 'x.gd', 'v.gd', 'rb.gy', 'tiny.cc', 'bl.ink', 'short.io',
    'reurl.cc', 'ppt.cc', 'myppt.cc', 'pse.is', 'lihi.cc', 'lihi1.cc', 'lihi2.cc', 'lihi3.cc', '0rz.tw', 'url.cc', 'gg.gg',
];
const BLOCKED_DOMAINS = [
    ...SHORTENERS,
    ...(process.env.LINK_BLOCKLIST ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
];

// 網址到空白、引號、括號、角括號、中文字、全形標點為止（大家常常網址後面直接接中文）；
// Markdown 的 [文字](網址) 也抓得到裡面的網址
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`()[\]{}　-〿一-鿿＀-￯]+/gi;

export const extractUrls = (text: string): string[] => {
    const found = text.match(URL_RE) ?? [];
    return [...new Set(found.map(u => u.replace(/[.,!?;:，。！？；：、]+$/u, '')))];
};

const hostOf = (raw: string) => {
    try {
        return new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).hostname.toLowerCase();
    } catch {
        return null;
    }
};

const isIpHost = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
const isBlockedHost = (host: string) => BLOCKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));

/* 查 Google Safe Browsing：回傳有問題的網址；沒設金鑰、連不上、逾時都當作沒問題 */
const safeBrowsingHits = (urls: string[]): Promise<string[]> => {
    const key = process.env.SAFE_BROWSING_API_KEY;
    if (!key || urls.length === 0) return Promise.resolve([]);

    const body = JSON.stringify({
        client: { clientId: 'drift-bottles', clientVersion: '1.0' },
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: urls.map(url => ({ url })),
        },
    });

    return new Promise(resolve => {
        const req = https.request(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: SAFE_BROWSING_TIMEOUT_MS },
            res => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.error(`[連結檢查] Safe Browsing 回應 ${res.statusCode}，先放行`);
                        return resolve([]);
                    }
                    try {
                        const matches: { threat?: { url?: string } }[] = JSON.parse(data || '{}').matches ?? [];
                        resolve(matches.map(m => m.threat?.url).filter((u): u is string => !!u));
                    } catch {
                        resolve([]);
                    }
                });
            },
        );
        req.on('timeout', () => { req.destroy(); console.error('[連結檢查] Safe Browsing 逾時，先放行'); resolve([]); });
        req.on('error', err => { console.error('[連結檢查] Safe Browsing 連線失敗，先放行:', err.message); resolve([]); });
        req.end(body);
    });
};

/* 檢查一組文字（標題、內容、投票選項…）裡的連結；沒問題回 null，有問題回要給使用者看的訊息 */
export const checkLinks = async (...texts: unknown[]): Promise<string | null> => {
    const urls = [...new Set(texts.flat().filter((t): t is string => typeof t === 'string').flatMap(extractUrls))];
    if (urls.length === 0) return null;
    if (urls.length > MAX_LINKS) return `一篇最多只能放 ${MAX_LINKS} 個連結喔`;

    for (const url of urls) {
        const host = hostOf(url);
        if (!host) return '有連結的格式怪怪的，請檢查一下';
        if (isIpHost(host)) return '不能貼直接用 IP 位址的連結，請改用一般網址';
        if (isBlockedHost(host)) {
            return SHORTENERS.some(d => host === d || host.endsWith(`.${d}`))
                ? `不能使用短網址（${host}），請貼完整的原始網址`
                : `這個網站（${host}）的連結不能貼喔`;
        }
    }

    const normalized = urls.map(u => (/^https?:\/\//i.test(u) ? u : `http://${u}`));
    const hits = await safeBrowsingHits(normalized);
    if (hits.length > 0) {
        const host = hostOf(hits[0]!) ?? hits[0];
        return `連結（${host}）被 Google 標示為危險網站（釣魚或惡意程式），不能貼喔`;
    }
    return null;
};
