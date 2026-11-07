/**
 * DOBON MASTER - Online Network Module
 * Game Version: 2026.00.006
 * File Version: online.js v0.1.1
 * Updates: Animation-First Turn Transition Sync, Unified Next Round Broadcast,
 *          Lobby Search/Filter, Quick Match, Spectating, Vote Abort/Expand.
 */

const ONLINE_MODULE_VERSION = "online.js v0.1.1";
console.log(`[DOBON Online Module Loaded] Game: ${GAME_VERSION} | File: ${ONLINE_MODULE_VERSION}`);

const SERVER_URL = 'https://dobon-server-cdpg.onrender.com';
let socket = null;
let currentRoomId = null;
let isOnlineMatch = false;
let isSpectator = false;
let myOnlineSeatIndex = 0;
let currentOnlineTurnSeat = 0;
let cachedLobbyRooms = [];
let currentLobbyFilter = 'all';
let pendingPasswordRoomId = null;
let disconnectingSeatIndex = null;

// ==========================================
// Socket.io 通信リスナー登録
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const savedName = localStorage.getItem('dobon_player_name');
  if (savedName) {
    const nameEl = document.getElementById('lobby-player-name');
    if (nameEl) nameEl.value = savedName;
  }

  if (typeof io !== 'undefined') {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
      const btn = document.getElementById('net-status-btn');
      if (btn) {
        btn.innerText = '🟢 ONLINE';
        btn.style.borderColor = '#2ecc71';
        btn.style.color = '#2ecc71';
      }
      setMessage('オンラインサーバー接続完了！');
    });

    socket.on('disconnect', () => {
      const btn = document.getElementById('net-status-btn');
      if (btn) {
        btn.innerText = '🔴 OFFLINE';
        btn.style.borderColor = '#e74c3c';
        btn.style.color = '#e74c3c';
      }
    });

    socket.on('room_list_updated', (rooms) => {
      cachedLobbyRooms = rooms || [];
      filterAndRenderRooms();
    });

    socket.on('quick_match_found', ({ roomId, isNew }) => {
      const nameInput = document.getElementById('lobby-player-name');
      const pName = (nameInput && nameInput.value.trim()) || 'YOU';
      currentRoomId = roomId;
      saveRecentRoom(roomId, isNew ? `Room ${roomId}` : `Auto Room ${roomId}`);

      socket.emit('join_or_create_room', {
        roomId: roomId,
        roomName: isNew ? `Table ${roomId}` : '',
        playerName: pName,
        targetPlayerCount: 4,
        timeLimit: 25,
        isPrivate: false,
        asSpectatorOnly: false
      });
    });

    socket.on('room_join_error', ({ message }) => {
      alert(`[入室エラー] ${message}`);
    });

    socket.on('entered_as_spectator', ({ roomId, isPlaying }) => {
      isSpectator = true;
      const b = document.getElementById('spectator-hud-banner');
      if (b) b.style.display = 'block';
      setMessage(I18N[currentLang].spectatorWatching);
    });

    socket.on('room_detail_updated', (data) => {
      const rdModal = document.getElementById('room-detail-modal');
      if (rdModal) rdModal.style.display = 'flex';
      const olModal = document.getElementById('online-lobby-modal');
      if (olModal) olModal.style.display = 'none';

      const tEl = document.getElementById('room-detail-title');
      if (tEl) tEl.innerText = data.roomName;
      const dEl = document.getElementById('room-detail-desc');
      if (dEl) dEl.innerText = `部屋ID: ${data.roomId} (${data.players.length} / ${data.targetPlayerCount}人)`;

      let pHtml = '';
      data.players.forEach((p, idx) => {
        pHtml += `<div>${idx + 1}. <b>${p.name}</b> ${p.id === socket.id ? '(あなた)' : ''}</div>`;
      });
      const pBox = document.getElementById('room-detail-players');
      if (pBox) pBox.innerHTML = pHtml;

      const specEl = document.getElementById('room-detail-spectators');
      if (specEl) {
        if (data.spectators && data.spectators.length > 0) {
          specEl.innerText = data.spectators.map(s => s.name).join(', ');
        } else {
          specEl.innerText = 'なし';
        }
      }
    });

    socket.on('prompt_abort_round', (data) => {
      const desc = document.getElementById('vote-abort-desc');
      if (desc) {
        desc.innerHTML = `プレイヤー「<b>${data.applicantName}</b>」が入室しました。<br>現在の回をノーゲームで流し、即座に合流させますか？<br><span style="font-size:10px; color:#ff7675;">※全員一致で可決（拒否者がいれば続行）</span>`;
      }
      const vaModal = document.getElementById('vote-abort-modal');
      if (vaModal) vaModal.style.display = 'flex';
    });

    socket.on('abort_round_result', (data) => {
      const vaModal = document.getElementById('vote-abort-modal');
      if (vaModal) vaModal.style.display = 'none';
      if (data.agreed) {
        setMessage('【流し可決】全員一致によりノーゲームで合流しました！');
      } else {
        setMessage('【流し否決】現在のラウンドを継続します。');
      }
    });

    socket.on('prompt_expand_table', (data) => {
      const desc = document.getElementById('vote-expand-desc');
      if (desc) {
        desc.innerHTML = `定員を超えるプレイヤーが参加希望しています。<br>卓の定員を <b>${data.newCount}人卓</b> に拡張して許可しますか？<br><span style="font-size:10px; color:#ff7675;">※全会一致で拡張可決</span>`;
      }
      const veModal = document.getElementById('vote-expand-modal');
      if (veModal) veModal.style.display = 'flex';
    });

    socket.on('table_expanded_confirmed', (data) => {
      const veModal = document.getElementById('vote-expand-modal');
      if (veModal) veModal.style.display = 'none';
      setMessage(`卓定員が ${data.newCapacity}人卓 に拡張されました！`);
    });

    socket.on('player_turned_cpu', (data) => {
      if (players[data.seatIndex]) {
        players[data.seatIndex].isCpu = true;
        players[data.seatIndex].name = data.newName;
        updateUI();
        setMessage(`[通知] ${data.newName} に切り替わりました`);
      }
    });

    // 新ラウンド開始同期
    socket.on('game_started_sync', (syncData) => {
      const rdModal = document.getElementById('room-detail-modal');
      if (rdModal) rdModal.style.display = 'none';
      const olModal = document.getElementById('online-lobby-modal');
      if (olModal) olModal.style.display = 'none';
      const stModal = document.getElementById('start-modal');
      if (stModal) stModal.style.display = 'none';
      const rsModal = document.getElementById('result-modal');
      if (rsModal) rsModal.style.display = 'none';
      const mrBar = document.getElementById('minimized-restore-bar');
      if (mrBar) mrBar.style.display = 'none';

      isOnlineMatch = true;
      isGameOver = false;
      stopTimer();
      stopConfetti();
      hideOutcomeBanner();

      isSpectator = !!syncData.isSpectator;
      const shBanner = document.getElementById('spectator-hud-banner');
      if (shBanner) shBanner.style.display = isSpectator ? 'block' : 'none';

      currentRound = syncData.roundNum || currentRound;
      roundMultiplier = syncData.multiplier || 1;
      userTimeLimit = syncData.timeLimit || 25;
      drawTwoStack = 0;
      hideDrawAlertBanner();

      // ルールブック準拠：反時計回りに同期
      direction = -1;

      const rNumEl = document.getElementById('round-num');
      if (rNumEl) rNumEl.innerText = currentRound;
      const mDisp = document.getElementById('multiplier-display');
      if (mDisp) mDisp.innerText = roundMultiplier + 'x';
      const dStack = document.getElementById('draw-stack');
      if (dStack) dStack.innerText = '0';

      myOnlineSeatIndex = syncData.mySeatIndex;
      currentOnlineTurnSeat = syncData.turnSeatIndex;

      const reordered = [];
      const baseIdx = (myOnlineSeatIndex >= 0) ? myOnlineSeatIndex : 0;
      for (let i = 0; i < syncData.players.length; i++) {
        const actualIdx = (baseIdx + i) % syncData.players.length;
        const pData = syncData.players[actualIdx];
        reordered.push({
          id: i,
          seatIndex: pData.seatIndex,
          name: (i === 0 && !isSpectator) ? 'YOU' : pData.name,
          hand: (i === 0 && !isSpectator) ? syncData.myHand : new Array(pData.cardCount).fill(null),
          score: 0,
          bannedFromWin: false,
          declaredLast: false,
          isCpu: pData.isCpu,
          silhouette: `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
        });
      }
      players = reordered;

      discardHistory = [syncData.initialCard];
      lastActionDiscard = { cards: [syncData.initialCard], totalVal: syncData.initialCard.val, playerId: -1 };
      deck = new Array(syncData.deckCount).fill(null);

      turnIndex = (!isSpectator && currentOnlineTurnSeat === myOnlineSeatIndex) ? 0 : 1;
      updateUI();
      playDealSound();

      if (isSpectator) {
        setMessage(I18N[currentLang].spectatorWatching);
      } else if (turnIndex === 0) {
        setMessage('【オンライン対戦】あなたの番です！カードを出してください');
        startTimerWithDuration(userTimeLimit, handleUserTimeout);
      } else {
        const actingPlayer = players.find(p => p.seatIndex === currentOnlineTurnSeat);
        const name = actingPlayer ? actingPlayer.name : '相手';
        setMessage(`【オンライン対戦】${name} の手番です。操作を待っています...`);
      }
    });

    // ★【重要】相手の打牌同期：アニメーションが完全に完了した後に手番・UIを更新★
    socket.on('card_played_sync', (data) => {
      if (!isOnlineMatch) return;

      const visualSeatIndex = getVisualSeatIndex(data.senderSeatIndex);
      if (players[visualSeatIndex]) {
        players[visualSeatIndex].hand = new Array(data.remainingCardCount).fill(null);
      }

      playCardWithHandAnimation(visualSeatIndex, data.card, () => {
        // カードのアニメーション演出が終了してから場札を反映！
        discardHistory.push(data.card);
        designatedSuit = data.designatedSuit || null;
        lastActionDiscard = { cards: [data.card], totalVal: data.card.val, playerId: visualSeatIndex };
        consecutivePassCount = 0;

        if (data.card.val === 2) {
          drawTwoStack = data.drawTwoStack || (drawTwoStack + 2);
          showDrawAlertBanner(`+${drawTwoStack} DRAW`);
        }

        updateUI();
      });
    });

    // ★【重要】サーバー主導の手番変更同期：カード打牌アニメ完了後にハイライト切り替え★
    socket.on('turn_changed_sync', (data) => {
      if (!isOnlineMatch || isGameOver) return;
      currentOnlineTurnSeat = data.turnSeatIndex;
      direction = data.direction || direction;
      const isMyTurn = (!isSpectator && currentOnlineTurnSeat === myOnlineSeatIndex);
      turnIndex = isMyTurn ? 0 : 1;
      updateUI();

      if (isSpectator) {
        const actingPlayer = players.find(p => p.seatIndex === currentOnlineTurnSeat);
        const name = actingPlayer ? actingPlayer.name : 'プレイヤー';
        setMessage(`【観戦中】${name} の手番です`);
      } else if (turnIndex === 0) {
        setMessage(I18N[currentLang].yourTurn);
        startTimerWithDuration(userTimeLimit, handleUserTimeout);
      } else {
        const actingPlayer = players.find(p => p.seatIndex === currentOnlineTurnSeat);
        const name = actingPlayer ? actingPlayer.name : '相手';
        setMessage(`${name} の手番です。操作を待っています...`);
      }
    });

    socket.on('game_paused_by_naki', (data) => {
      stopTimer();
      const banner = document.getElementById('naki-pause-banner');
      const text = document.getElementById('naki-pause-text');
      if (banner && text) {
        text.innerText = `【停止中】${data.actorName} が ${data.nakiType} 宣言・考慮中...`;
        banner.style.display = 'block';
      }
    });

    socket.on('game_resumed_from_naki', () => {
      const banner = document.getElementById('naki-pause-banner');
      if (banner) banner.style.display = 'none';
    });

    socket.on('my_card_drawn', (data) => {
      data.cards.forEach(card => {
        players[0].hand.push(card);
      });
      const dcEl = document.getElementById('deck-count');
      if (dcEl) dcEl.innerText = data.deckCount;
      drawTwoStack = 0;
      hideDrawAlertBanner();
      selectedIndices = [];
      updateUI();
      consecutivePassCount++;
      checkNagare();
    });

    socket.on('card_drawn_sync', (data) => {
      if (!isOnlineMatch) return;
      const visualSeat = getVisualSeatIndex(data.senderSeatIndex);
      playDrawAnimation(visualSeat, () => {
        if (players[visualSeat]) {
          for (let i = 0; i < data.drawCount; i++) {
            players[visualSeat].hand.push(null);
          }
        }
        const dcEl = document.getElementById('deck-count');
        if (dcEl) dcEl.innerText = data.deckCount;
        drawTwoStack = 0;
        hideDrawAlertBanner();
        updateUI();
      });
    });

    // ドボン結果全員同期
    socket.on('dobon_result_broadcast', (data) => {
      isGameOver = true;
      stopTimer();
      clearDobonStandby();
      hideDrawAlertBanner();

      const isMeWinner = (!isSpectator && data.winnerSeatIndex === myOnlineSeatIndex);
      updateUI();
      if (!isSpectator) showOutcomeBanner(isMeWinner);

      let detailHtml = `<b>${data.winnerName}</b> の【${data.winType}】！<br><br>`;
      detailHtml += `勝者: <b>${data.winnerName} (+${data.points}pt)</b><br>`;
      detailHtml += `放銃者: <b style="color:#e74c3c;">${data.loserName} (-${data.points}pt)</b><br>`;
      if (data.loserHandCount) {
        detailHtml += `(${data.loserName} 手札換算: ${data.loserHandCount}枚)<br>`;
      }
      detailHtml += `<br>※放銃者以外のプレイヤーは点数変動なし（0pt）`;

      showResultModal(`${data.winnerName} DOBON WIN!`, detailHtml);
    });

    socket.on('chombo_synced', (data) => {
      isGameOver = true;
      stopTimer();
      clearDobonStandby();
      drawTwoStack = 0;
      hideDrawAlertBanner();
      const ds = document.getElementById('draw-stack');
      if (ds) ds.innerText = '0';

      roundMultiplier = data.newMultiplier;
      const md = document.getElementById('multiplier-display');
      if (md) md.innerText = roundMultiplier + 'x';
      updateUI();

      showChomboDoubleBanner(data.offenderName, roundMultiplier);
      showResultModal('CHOMBO / FOUL', `<b>違反者: ${data.offenderName}</b><br>${data.reason}<br><br><span style="color:#ff6b81; font-weight:bold;">※勝者なし・全員に点数支払い ＆ 次回得点倍率は ${roundMultiplier}x に倍々累積！</span>`);
    });

    socket.on('game_ended_sync', (endData) => {
      isGameOver = true;
      stopTimer();
      clearDobonStandby();
      drawTwoStack = 0;
      hideDrawAlertBanner();
      const ds = document.getElementById('draw-stack');
      if (ds) ds.innerText = '0';

      const isIWinner = (!isSpectator && endData.winnerSeatIndex === myOnlineSeatIndex);
      updateUI();
      if (!isSpectator) showOutcomeBanner(isIWinner);

      let detailHtml = `<b>${endData.winnerName}</b> の【${endData.winningType}】！<br><br>`;
      detailHtml += isIWinner ? '<span style="color:#2ecc71; font-weight:bold;">あなたの勝利です！</span>' : '<span style="color:#e74c3c;">相手の勝利です。</span>';
      showResultModal(`${endData.winnerName} WIN!`, detailHtml);
    });

    socket.on('player_disconnected_prompt', (data) => {
      disconnectingSeatIndex = data.leftSeatIndex;
      const desc = document.getElementById('player-left-desc');
      if (desc) desc.innerText = `プレイヤー「${data.leftPlayerName}」が退室しました。\nゲームの続行方法を選択してください。`;
      const plModal = document.getElementById('player-left-modal');
      if (plModal) plModal.style.display = 'flex';
    });
  }
});

function getVisualSeatIndex(absoluteSeatIndex) {
  const p = players.find(player => player.seatIndex === absoluteSeatIndex);
  return p ? p.id : 1;
}

// ==========================================
// ロビー操作 ＆ 検索・フィルター・マッチング
// ==========================================
function selectGameMode(mode) {
  if (mode === 'cpu') {
    const cp = document.getElementById('cpu-config-panel');
    if (cp) cp.style.display = 'block';
  } else if (mode === 'online') {
    openLobbyModal();
  }
}

function openLobbyModal() {
  const m = document.getElementById('online-lobby-modal');
  if (m) m.style.display = 'flex';
  renderRecentRooms();
  fetchRoomList();
}

function closeLobbyModal() {
  const m = document.getElementById('online-lobby-modal');
  if (m) m.style.display = 'none';
}

function fetchRoomList() {
  if (socket && socket.connected) {
    socket.emit('request_room_list');
  }
}

function startQuickMatch() {
  const nameInput = document.getElementById('lobby-player-name');
  const pName = (nameInput && nameInput.value.trim()) || 'YOU';
  localStorage.setItem('dobon_player_name', pName);

  if (socket && socket.connected) {
    socket.emit('quick_match', { playerName: pName });
  } else {
    alert('サーバー接続準備中です。緑色ランプになるまでお待ちください。');
  }
}

function setLobbyFilter(fType) {
  currentLobbyFilter = fType;
  const btnAll = document.getElementById('filter-all-btn');
  const btnOpen = document.getElementById('filter-open-btn');
  const btnSpec = document.getElementById('filter-spec-btn');

  if (btnAll) {
    btnAll.style.background = fType === 'all' ? 'var(--gold)' : 'rgba(45,35,25,0.9)';
    btnAll.style.color = fType === 'all' ? '#111' : 'var(--gold)';
  }
  if (btnOpen) {
    btnOpen.style.background = fType === 'open' ? 'var(--gold)' : 'rgba(45,35,25,0.9)';
    btnOpen.style.color = fType === 'open' ? '#111' : 'var(--gold)';
  }
  if (btnSpec) {
    btnSpec.style.background = fType === 'spec' ? 'var(--gold)' : 'rgba(45,35,25,0.9)';
    btnSpec.style.color = fType === 'spec' ? '#111' : 'var(--gold)';
  }

  filterAndRenderRooms();
}

function filterAndRenderRooms() {
  const sq = document.getElementById('lobby-search-query');
  const query = (sq && sq.value ? sq.value : '').trim().toLowerCase();
  let list = [...cachedLobbyRooms];

  if (query) {
    list = list.filter(r => (r.name && r.name.toLowerCase().includes(query)) || String(r.id).includes(query));
  }

  if (currentLobbyFilter === 'open') {
    list = list.filter(r => r.playerCount < r.maxPlayers && !r.isPlaying);
  } else if (currentLobbyFilter === 'spec') {
    list = list.filter(r => r.isPlaying || r.spectatorCount > 0);
  }

  renderLobbyRoomList(list);
}

function renderLobbyRoomList(rooms) {
  const container = document.getElementById('lobby-room-container');
  if (!container) return;
  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#888; text-align:center; padding:15px;">該当する部屋がありません。<br>下のボタンから新しく部屋を作成してください！</div>';
    return;
  }

  let html = '';
  rooms.forEach(r => {
    const isFull = r.playerCount >= r.maxPlayers;
    const lockIcon = r.isPrivate ? '🔒 ' : '';
    let badge = '';

    if (r.isPlaying) {
      badge = '<span class="badge-playing">対局中 (観戦可)</span>';
    } else if (isFull) {
      badge = '<span class="badge-playing">満員 (観戦可)</span>';
    } else {
      badge = '<span class="badge-open">募集中</span>';
    }

    html += `
      <div class="lobby-room-item ${isFull && !r.isPlaying ? 'full' : ''}" onclick="onLobbyRoomClicked('${r.id}', ${r.isPrivate})">
        <div>
          <b>${lockIcon}${r.name}</b> <span style="font-size:10px; color:#888;">(ID: ${r.id})</span><br>
          <span style="font-size:10px; color:var(--gold);">${r.playerCount} / ${r.maxPlayers}人 | 持ち時間: ${r.timeLimit}s</span>
        </div>
        <div>${badge}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function togglePrivatePasswordInput() {
  const cb = document.getElementById('create-room-private');
  const passInput = document.getElementById('create-room-pass');
  if (passInput && cb) passInput.style.display = cb.checked ? 'block' : 'none';
}

function onLobbyRoomClicked(roomId, isPrivate) {
  if (isPrivate) {
    pendingPasswordRoomId = roomId;
    const pModal = document.getElementById('password-input-modal');
    if (pModal) pModal.style.display = 'flex';
  } else {
    joinSelectedRoom(roomId, '');
  }
}

function submitRoomPassword() {
  const pwEl = document.getElementById('room-join-password');
  const pass = pwEl ? pwEl.value : '';
  const pModal = document.getElementById('password-input-modal');
  if (pModal) pModal.style.display = 'none';

  if (pendingPasswordRoomId) {
    joinSelectedRoom(pendingPasswordRoomId, pass);
    pendingPasswordRoomId = null;
  }
}

function closePasswordModal() {
  const pModal = document.getElementById('password-input-modal');
  if (pModal) pModal.style.display = 'none';
  pendingPasswordRoomId = null;
}

function createOnlineRoom() {
  const nameInput = document.getElementById('lobby-player-name');
  const roomNameInput = document.getElementById('create-room-name');
  const maxSelect = document.getElementById('create-room-max');
  const timeSelect = document.getElementById('create-room-time');
  const privCheck = document.getElementById('create-room-private');
  const passInput = document.getElementById('create-room-pass');

  const pName = (nameInput && nameInput.value.trim()) || 'YOU';
  const rName = (roomNameInput && roomNameInput.value.trim()) || `Table ${Math.floor(Math.random() * 900 + 100)}`;
  const maxP = maxSelect ? (parseInt(maxSelect.value) || 4) : 4;
  const tLimit = timeSelect ? (parseInt(timeSelect.value) || 25) : 25;
  const isPriv = privCheck ? privCheck.checked : false;
  const pass = passInput ? passInput.value.trim() : '';
  const rId = String(Math.floor(Math.random() * 9000 + 1000));

  localStorage.setItem('dobon_player_name', pName);
  saveRecentRoom(rId, rName);

  currentRoomId = rId;
  socket.emit('join_or_create_room', {
    roomId: rId,
    roomName: rName,
    playerName: pName,
    targetPlayerCount: maxP,
    timeLimit: tLimit,
    isPrivate: isPriv,
    password: pass,
    asSpectatorOnly: false
  });
}

function joinSelectedRoom(roomId, password) {
  const nameInput = document.getElementById('lobby-player-name');
  const pName = (nameInput && nameInput.value.trim()) || 'YOU';
  localStorage.setItem('dobon_player_name', pName);
  saveRecentRoom(roomId, `Room ${roomId}`);

  currentRoomId = roomId;
  socket.emit('join_or_create_room', {
    roomId: roomId,
    playerName: pName,
    password: password || '',
    asSpectatorOnly: false
  });
}

function saveRecentRoom(roomId, roomName) {
  try {
    let list = JSON.parse(localStorage.getItem('dobon_recent_rooms') || '[]');
    list = list.filter(r => r.id !== roomId);
    list.unshift({ id: roomId, name: roomName });
    if (list.length > 4) list.pop();
    localStorage.setItem('dobon_recent_rooms', JSON.stringify(list));
  } catch (e) {}
}

function renderRecentRooms() {
  const container = document.getElementById('recent-rooms-container');
  if (!container) return;
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('dobon_recent_rooms') || '[]');
  } catch (e) {
    list = [];
  }
  if (list.length === 0) {
    container.innerHTML = '<span style="font-size:10px; color:#666;">なし</span>';
    return;
  }
  let html = '';
  list.forEach(r => {
    html += `<span class="recent-room-chip" onclick="joinSelectedRoom('${r.id}', '')">${r.name} (${r.id})</span>`;
  });
  container.innerHTML = html;
}

function leaveRoomAndBackToLobby() {
  const m = document.getElementById('room-detail-modal');
  if (m) m.style.display = 'none';
  openLobbyModal();
}

function requestStartOnlineGame() {
  if (socket && currentRoomId) {
    socket.emit('start_online_game', { roomId: currentRoomId });
  }
}

function castAbortVote(agree) {
  const m = document.getElementById('vote-abort-modal');
  if (m) m.style.display = 'none';
  if (socket && currentRoomId) {
    socket.emit('vote_abort_round', { roomId: currentRoomId, agree });
  }
}

function castExpandVote(agree) {
  const m = document.getElementById('vote-expand-modal');
  if (m) m.style.display = 'none';
  if (socket && currentRoomId) {
    socket.emit('vote_expand_table', { roomId: currentRoomId, agree });
  }
}

function resolvePlayerLeft(action) {
  const plModal = document.getElementById('player-left-modal');
  if (plModal) plModal.style.display = 'none';

  if (socket && currentRoomId && disconnectingSeatIndex !== null) {
    socket.emit('resolve_player_left', {
      roomId: currentRoomId,
      seatIndex: disconnectingSeatIndex,
      action: action
    });
    disconnectingSeatIndex = null;
  }
}

// Renderサーバーの5分おきキープアライブ
setInterval(() => {
  if (typeof SERVER_URL !== 'undefined') {
    fetch(SERVER_URL, { mode: 'no-cors' }).catch(() => {});
  }
}, 5 * 60 * 1000);
