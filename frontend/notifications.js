// 點擊「全部已讀」的互動邏輯
function markAllAsRead() {
  // 選取所有帶有 'unread' 類別的卡片
  const unreadCards = document.querySelectorAll('.notif-card.unread');
  
  if (unreadCards.length === 0) {
    alert("目前沒有未讀通知喔！🌊");
    return;
  }

  // 將每一張卡片的未讀狀態移除
  unreadCards.forEach(card => {
    card.classList.remove('unread');
    
    // 把卡片裡面的小藍點隱藏起來
    const dot = card.querySelector('.unread-dot');
    if (dot) {
      dot.style.display = 'none';
    }
  });
}