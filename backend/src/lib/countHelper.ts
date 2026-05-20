/*將使用者 ID 轉換為 6 位數的字串*/
export const countHelper = (id: number): string => {
    return id.toString().padStart(6, '0');
}