/**
 * DOBON MASTER - Online Network Companion Module
 * Game Version: 2026.00.005
 * File Version: online.js v0.1.0
 * Features: Disconnect Resolver, Keep-Alive, Room URL Sharing, Network Diagnostics.
 */

const ONLINE_MODULE_VERSION = "online.js v0.1.0";
console.log(`[DOBON Online Module Loaded] ${ONLINE_MODULE_VERSION}`);

// プレイヤー切断（退室）発生時のホスト選択処理
function resolvePlayerLeft(action) {
  const pModal = document.getElementById('player-left-modal');
  if (pModal) pModal.style.display = 'none';

  if (typeof socket !== 'undefined' && socket && currentRoomId && disconnectingSeatIndex !== null) {
    socket.emit('resolve_player_left', {
      roomId: currentRoomId,
      seatIndex: disconnectingSeatIndex,
      action: action
    });
    disconnectingSeatIndex = null;
  }
}

// Render無料サーバーの居眠り（15分スリープ）を対戦中に自動防止するキープアライブ
setInterval(() => {
  if (typeof SERVER_URL !== 'undefined') {
    fetch(SERVER_URL, { mode: 'no-cors' }).catch(() => {});
  }
}, 5 * 60 * 1000); // 5分おきに自動Ping

// URLパラメータによる部屋直行機能（例: ?room=1234 で自動入室）
window.addEventListener('DOMContentLoaded', () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setTimeout(() => {
        if (typeof joinSelectedRoom === 'function') {
          joinSelectedRoom(roomParam, '');
        }
      }, 1200);
    }
  } catch (e) {}
});

// オンライン対戦中の回線切断セーフガード
window.addEventListener('beforeunload', () => {
  if (typeof isOnlineMatch !== 'undefined' && isOnlineMatch && typeof socket !== 'undefined' && socket) {
    socket.disconnect();
  }
});

