/* 資料庫 Int 欄位的上限 (32 位元有號整數) */
const MAX_INT = 2147483647;

/* 檢查是否為合法的資料庫 ID：1 ~ 2147483647 的整數 */
export const isValidId = (value: unknown): value is number => {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_INT;
}

/* 解析分頁/筆數參數：不合法時用預設值，太大時限制在 max */
export const parseLimit = (value: unknown, fallback: number, max: number): number => {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) return fallback;
    return Math.min(num, max);
}
