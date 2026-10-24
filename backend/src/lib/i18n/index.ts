import type { NextFunction, Request, Response } from "express";
import { EN } from "./en.js";

/*
 * 🌐 中英切換：前端切成英文時，每個請求都會帶 X-Site-Lang: en
 * - 回傳 JSON 的 message / error 自動翻成英文（字典在 en.ts，{x} 是會變的部分）
 * - 程式裡丟出、比對的中文錯誤訊息完全不動，只在送出去的那一刻翻
 * - 通知內容存在資料庫是中文，讀取時用 translateText 翻
 * 字典找不到的句子就原樣回傳中文
 */

export type SiteLang = "zh" | "en";

const exact = new Map<string, string>();
const patterns: { re: RegExp; en: string; len: number }[] = [];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const [zh, en] of Object.entries(EN)) {
    if (zh.includes("{x}")) {
        const re = new RegExp("^" + zh.split("{x}").map(escapeRe).join("([\\s\\S]+?)") + "$");
        patterns.push({ re, en, len: zh.length });
    } else {
        exact.set(zh, en);
    }
}
patterns.sort((a, b) => b.len - a.len); // 越長越精準，先比對

const CJK = /[㐀-鿿]/;

/*被代進 {x} 的部分（例如「通過」、名字清單）也試著翻；用「、」接起來的清單逐項翻*/
const translatePart = (s: string, depth: number): string => {
    const t = s.trim();
    if (!CJK.test(t)) return s;
    const r = lookup(t, depth + 1);
    if (r !== null) return s.replace(t, r);
    if (t.includes("、")) {
        const parts = t.split("、").map(p => lookup(p.trim(), depth + 1));
        if (parts.every(p => p !== null)) return s.replace(t, parts.join(", "));
    }
    return s;
};

const lookup = (t: string, depth = 0): string | null => {
    const hit = exact.get(t);
    if (hit !== undefined) return hit;
    if (depth > 2) return null;
    for (const p of patterns) {
        const m = p.re.exec(t);
        if (!m) continue;
        let i = 1;
        return p.en.replace(/\{x\}/g, () => translatePart(m[i++] ?? "", depth));
    }
    return null;
};

export const translateText = (text: string, lang: SiteLang): string => {
    if (lang !== "en" || !text || !CJK.test(text)) return text;
    return lookup(text.trim()) ?? text;
};

export const getLang = (req: Request): SiteLang =>
    String(req.headers["x-site-lang"] ?? "").toLowerCase() === "en" ? "en" : "zh";

/*放在所有路由前面：英文請求的回傳訊息自動翻譯*/
export const i18nMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (getLang(req) !== "en") return next();
    const json = res.json.bind(res);
    res.json = (body?: any) => {
        if (body && typeof body === "object" && !Array.isArray(body)) {
            const out = { ...body };
            for (const key of ["message", "error"]) {
                if (typeof out[key] === "string") out[key] = translateText(out[key], "en");
            }
            return json(out);
        }
        return json(body);
    };
    next();
};
