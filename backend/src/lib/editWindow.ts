/* 發文、留言後可以修改的時間（以伺服器時間為準，前端只用來決定要不要顯示按鈕） */
export const EDIT_WINDOW_MINUTES = 20;
export const EDIT_WINDOW_MS = EDIT_WINDOW_MINUTES * 60 * 1000;

export const isWithinEditWindow = (createdAt: Date) =>
    Date.now() - createdAt.getTime() <= EDIT_WINDOW_MS;
