/**
 * DOBON MASTER - Las Vegas VIP Lounge Engine
 * Game Version: 2026.00.001
 * File Version: game.js v0.1.0
 */

const GAME_VERSION = "2026.00.001";
const FILE_VERSION = "game.js v0.1.0";
console.log(`[DOBON Engine Loaded] Game: ${GAME_VERSION} | File: ${FILE_VERSION}`);

const I18N = {
  ja: {
    ready: '準備完了', yourTurn: 'あなたの番です！', cpuThinking: '思考中...',
    opponentThinking: '相手の手番です。操作を待っています...',
    skipContinued: 'Aでスキップ成功！あなたの手番が続きます！',
    skipByOpponent: '相手のAでスキップされました！相手の手番が続きます...',
    dirCCW: '反時計回り', dirCW: '時計回り', chooseSuit: '指定マークを選択',
    chomboWrongLast: '手札が3枚以上あるのに「LAST」状態でカードを出しました（チョンボ）',
    chomboMissLast: '「LAST」未宣言のまま次の手番に進んだか、上がろうとしました（チョンボ）',
    chomboSingleCardDobon: '手札1枚でのドボンは禁止されています（手札1枚ドボンチョンボ）',
    timeoutMsg: '制限時間以内に行動しませんでした（時間切れチョンボ）',
    skipChomboPrompt: '上がり禁止ペナルティを解除しました (-10pt)',
    savedMsg: '対局状態を中断保存しました。',
    nakiFailed: 'を宣言しましたがカードを揃えられませんでした（チョンボ）',
    suitChanged: 'マークを {suit} に指定しました',
    drewCards: '累積 {count}枚 を引きました', drewOne: '山札から1枚引きました',
    lastCanceled: '山札を引いたため、ラスト宣言が解除されました',
    lastStandby: '「LAST」スタンバイ中', lastReset: '「LAST」を解除しました',
    ponKanSelect: 'カードを選んでCONFIRMを押してください'
  },
  en: {
    ready: 'READY', yourTurn: 'Your Turn!', cpuThinking: 'Thinking...',
    opponentThinking: 'Waiting for opponent...',
    skipContinued: 'Skip! Your turn continues!',
    skipByOpponent: 'Skipped by opponent! Their turn continues...',
    dirCCW: 'Counter-Clockwise', dirCW: 'Clockwise', chooseSuit: 'SELECT SUIT',
    chomboWrongLast: 'Played while LAST was active with 3 or more cards (Chombo)',
    chomboMissLast: 'Failed to declare LAST before proceeding or finishing (Chombo)',
    chomboSingleCardDobon: 'Dobon with only 1 card left is strictly prohibited (Chombo)',
    timeoutMsg: 'Did not play within time limit (Timeout Chombo)',
    skipChomboPrompt: 'Lifted win-ban penalty (-10pt applied)',
    savedMsg: 'Game progress has been suspended and saved.',
    nakiFailed: 'called but failed to produce cards (Chombo)',
    suitChanged: 'Suit changed to {suit}',
    drewCards: 'Drew {count} stacked cards', drewOne: 'Drew 1 card from deck',
    lastCanceled: 'Drew from deck: LAST declaration reset',
    lastStandby: 'LAST armed', lastReset: 'LAST canceled',
    ponKanSelect: 'Select cards and press CONFIRM'
  }
};

let currentLang = 'ja';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = [
  { label: 'A', val: 1 }, { label: '2', val: 2 }, { label: '3', val: 3 },
  { label: '4', val: 4 }, { label: '5', val: 5 }, { label: '6', val: 6 },
  { label: '7', val: 7 }, { label: '8', val: 8 }, { label: '9', val: 9 },
  { label: '10', val: 10 }, { label: 'J', val: 11 }, { label: 'Q', val: 12 }, { label: 'K', val: 13 }
];

const PHOTO_CARDS = {
  '♠_A': 'spadeA.jpg',
  '♠_J': 'spadeJ.jpg', '♠_Q': 'spadeQ.jpg', '♠_K': 'spadeK.jpg',
  '♥_J': 'heartJ.jpg', '♥_Q': 'heartQ.jpg', '♥_K': 'heartK.jpg',
  '♦_J': 'diamondJ.jpg', '♦_Q': 'diamondQ.jpg', '♦_K': 'diamondK.jpg',
  '♣_J': 'clubJ.jpg', '♣_Q': 'clubQ.jpg', '♣_K': 'clubK.jpg'
};

let numPlayers = 4, chomboMode = 'strict', userTimeLimit = 0;
let players = [], deck = [], discardHistory = [], lastActionDiscard = null;
let turnIndex = 0, direction = -1, currentRound = 1, currentSet = 1;
let roundMultiplier = 1, drawTwoStack = 0, designatedSuit = null;
let isGameOver = false, turnTimer = null, remainingTime = 0;
let setScoreHistory = [];
let activeNakiType = null, selectedIndices = [], nextRoundStarter = 0;
let pendingLastCheck = false, userLastWarningCount = 0;

// オンライン通信 ＆ ロビー管理
const SERVER_URL = 'https://dobon-server-cdpg.onrender.com';
let socket = null;
let currentRoomId = null;
let isOnlineMatch = false;
let myOnlineSeatIndex = 0;

// ドボン返し猶予
let dobonStandbyTimer = null, dobonStandbySec = 10, pendingDobonData = null;
let consecutivePassCount = 0;

// Web Audio API
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCardSnapSound() {
  try {
    const ctx = getAudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
}

function playDealSound() {
  try {
    const ctx = getAudioContext(), bSize = ctx.sampleRate * 0.04;
    const buf = ctx.createBuffer(1, bSize, ctx.sampleRate), out = buf.getChannelData(0);
    for (let i = 0; i < bSize; i++) out[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

function speakVoice(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const uttr = new SpeechSynthesisUtterance(text);
  uttr.lang = currentLang === 'ja' ? 'ja-JP' : 'en-US';
  uttr.rate = 1.15;
  window.speechSynthesis.speak(uttr);
}

function triggerFlash() {
  const f = document.getElementById('flash-overlay');
  if (f) { f.classList.add('active'); setTimeout(() => f.classList.remove('active'), 80); }
}

function showOutcomeBanner(isWin) {
  const b = document.getElementById('round-outcome-banner');
  if (!b) return;
  if (isWin) {
    b.innerText = 'WINNER!'; b.className = 'winner show'; startConfetti();
  } else {
    b.innerText = 'LOSE...'; b.className = 'lose show';
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 500);
  }
}

function hideOutcomeBanner() {
  const b = document.getElementById('round-outcome-banner');
  if (b) { b.className = ''; b.innerText = ''; }
}

// チョンボ時×2倍強調バナー
function showChomboDoubleBanner(offenderName, newMult) {
  const b = document.getElementById('chombo-double-banner');
  const d = document.getElementById('chombo-offender-desc');
  if (!b) return;
  if (d) d.innerText = `${offenderName} の反則により全員へ点数支払い ＆ 次回倍率が【${newMult}x】に累積！`;
  b.classList.add('show');
  document.body.classList.add('shake-screen');
  setTimeout(() => document.body.classList.remove('shake-screen'), 500);
  setTimeout(() => b.classList.remove('show'), 3800);
}

let confettiAnimationId = null;
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d'), pieces = [];
  const colors = ['#f5cd79', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#ffffff'];
  const centerX = canvas.width / 2, centerY = canvas.height * 0.44;

  for (let i = 0; i < 140; i++) {
    const angle = Math.random() * Math.PI * 2, speed = Math.random() * 12 + 6;
    pieces.push({
      x: centerX, y: centerY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
      size: Math.random() * 9 + 5, color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360, rotSpeed: Math.random() * 10 - 5,
      gravity: 0.28, drag: 0.96
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.rotation += p.rotSpeed;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    confettiAnimationId = requestAnimationFrame(draw);
  }
  cancelAnimationFrame(confettiAnimationId); draw();
}

function stopConfetti() {
  cancelAnimationFrame(confettiAnimationId);
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
  }
}

function createDeck52() {
  deck = [];
  for (let s of SUITS) {
    for (let v of VALUES) {
      deck.push({ suit: s, label: v.label, val: v.val, color: (s === '♥' || s === '♦') ? 'red' : 'black' });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[r]] = [deck[r], deck[i]];
  }
}

function toggleLang() {
  currentLang = currentLang === 'ja' ? 'en' : 'ja';
  document.getElementById('lang-btn').innerText = currentLang === 'ja' ? 'EN' : 'JP';
  document.getElementById('txt-choose-suit').innerText = I18N[currentLang].chooseSuit;
  updateUI();
}

function openPayoutModal() { document.getElementById('payout-modal').style.display = 'flex'; }
function closePayoutModal() { document.getElementById('payout-modal').style.display = 'none'; }

function suspendGame() {
  const save = {
    numPlayers, chomboMode, userTimeLimit, currentRound, currentSet, roundMultiplier,
    direction, turnIndex, drawTwoStack, designatedSuit, players, deck, discardHistory,
    lastActionDiscard, nextRoundStarter
  };
  localStorage.setItem('dobon_suspended_game', JSON.stringify(save));
  alert(I18N[currentLang].savedMsg);
}

function quitToTitle() {
  if (confirm(currentLang === 'ja' ? '対局を終了してタイトルへ戻りますか？（履歴は保存され、次回は0点から開始します）' : 'Quit game? (History is archived, next game starts from 0pt)')) {
    stopTimer(); clearDobonStandby(); isGameOver = true;
    localStorage.removeItem('dobon_suspended_game');
    document.getElementById('result-modal').style.display = 'none';
    document.getElementById('championship-modal').style.display = 'none';
    document.getElementById('start-modal').style.display = 'flex';
  }
}

// ==========================================
// 初期化 ＆ ロビー・オンライン通信
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const savedHistory = localStorage.getItem('dobon_permanent_history');
  if (savedHistory) setScoreHistory = JSON.parse(savedHistory);

  if (localStorage.getItem('dobon_suspended_game')) {
    document.getElementById('resume-btn').style.display = 'block';
  }

  document.addEventListener('click', (e) => {
    if (isGameOver || pendingDobonData || activeNakiType !== null) return;
    if (!e.target.closest('.fan-card') && !e.target.closest('button') && !e.target.closest('.deck-3d-stack')) {
      if (selectedIndices.length > 0) {
        selectedIndices = [];
        updateUI();
      }
    }
  });

  if (typeof io !== 'undefined') {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
      const btn = document.getElementById('net-status-btn');
      if (btn) {
        btn.innerText = '🟢 ONLINE'; btn.style.borderColor = '#2ecc71'; btn.style.color = '#2ecc71';
      }
      setMessage('オンラインサーバー接続完了！');
    });

    socket.on('disconnect', () => {
      const btn = document.getElementById('net-status-btn');
      if (btn) {
        btn.innerText = '🔴 OFFLINE'; btn.style.borderColor = '#e74c3c'; btn.style.color = '#e74c3c';
      }
    });

    socket.on('room_list_updated', (rooms) => {
      renderLobbyRoomList(rooms);
    });

    socket.on('room_detail_updated', (data) => {
      document.getElementById('room-detail-modal').style.display = 'flex';
      document.getElementById('online-lobby-modal').style.display = 'none';
      document.getElementById('room-detail-title').innerText = data.roomName;
      document.getElementById('room-detail-desc').innerText = `部屋ID: ${data.roomId} (${data.players.length} / ${data.targetPlayerCount}人)`;
      
      let html = '';
      data.players.forEach((p, idx) => {
        html += `<div>${idx + 1}. <b>${p.name}</b> ${p.id === socket.id ? '(あなた)' : ''}</div>`;
      });
      document.getElementById('room-detail-players').innerHTML = html;
    });

    socket.on('game_started_sync', (syncData) => {
      document.getElementById('room-detail-modal').style.display = 'none';
      document.getElementById('online-lobby-modal').style.display = 'none';
      document.getElementById('start-modal').style.display = 'none';
      document.getElementById('result-modal').style.display = 'none';
      document.getElementById('minimized-restore-bar').style.display = 'none';
      isOnlineMatch = true;
      isGameOver = false;
      stopTimer();
      stopConfetti();
      hideOutcomeBanner();
      currentRound = syncData.roundNum || currentRound;
      roundMultiplier = syncData.multiplier || 1;
      drawTwoStack = 0; // ドロー2累積リセット
      document.getElementById('round-num').innerText = currentRound;
      document.getElementById('multiplier-display').innerText = roundMultiplier + 'x';

      myOnlineSeatIndex = syncData.mySeatIndex;
      const reordered = [];
      for (let i = 0; i < syncData.players.length; i++) {
        const actualIdx = (myOnlineSeatIndex + i) % syncData.players.length;
        const pData = syncData.players[actualIdx];
        reordered.push({
          id: i,
          seatIndex: pData.seatIndex,
          name: i === 0 ? 'YOU' : pData.name,
          hand: i === 0 ? syncData.myHand : new Array(pData.cardCount).fill(null),
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

      turnIndex = (syncData.turnSeatIndex === myOnlineSeatIndex) ? 0 : 1;
      updateUI();
      playDealSound();

      if (turnIndex === 0) {
        setMessage('【オンライン対戦】あなたの番です！カードを出してください');
        if (userTimeLimit > 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
      } else {
        setMessage('【オンライン対戦】相手の手番です。操作を待っています...');
      }
    });

    // 誰かがカードを出した時の同期受信
    socket.on('card_played_sync', (data) => {
      if (!isOnlineMatch) return;

      const visualSeatIndex = getVisualSeatIndex(data.senderSeatIndex);
      if (players[visualSeatIndex]) {
        players[visualSeatIndex].hand = new Array(data.remainingCardCount).fill(null);
      }

      playCardWithHandAnimation(visualSeatIndex, data.card, () => {
        discardHistory.push(data.card);
        designatedSuit = data.designatedSuit || null;
        lastActionDiscard = { cards: [data.card], totalVal: data.card.val, playerId: visualSeatIndex };
        consecutivePassCount = 0;

        // 2のドロー累積処理（スキップ誤表示を完全防止）
        if (data.card.val === 2) {
          drawTwoStack = data.drawTwoStack || (drawTwoStack + 2);
          showDrawAlertBanner(`+${drawTwoStack} DRAW`);
        }

        updateUI();
      });
    });

    // ★サーバー主導の手番変更同期（これでCPUもスキップも100%正確に連動）★
    socket.on('turn_changed_sync', (data) => {
      if (!isOnlineMatch || isGameOver) return;
      const isMyTurn = (data.turnSeatIndex === myOnlineSeatIndex);
      turnIndex = isMyTurn ? 0 : 1;
      updateUI();

      if (turnIndex === 0) {
        setMessage(I18N[currentLang].yourTurn);
        if (userTimeLimit > 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
      } else {
        const actingPlayer = players.find(p => p.seatIndex === data.turnSeatIndex);
        const name = actingPlayer ? actingPlayer.name : '相手';
        setMessage(`${name} の手番です。操作を待っています...`);
      }
    });

    // 自分が山札を引いた時
    socket.on('my_card_drawn', (data) => {
      data.cards.forEach(card => {
        players[0].hand.push(card);
      });
      document.getElementById('deck-count').innerText = data.deckCount;
      drawTwoStack = 0;
      selectedIndices = [];
      updateUI();
      consecutivePassCount++;
      checkNagare();
    });

    // 誰かが山札を引いた時
    socket.on('card_drawn_sync', (data) => {
      if (!isOnlineMatch) return;
      const visualSeat = getVisualSeatIndex(data.senderSeatIndex);
      playDrawAnimation(visualSeat, () => {
        if (players[visualSeat]) {
          for (let i = 0; i < data.drawCount; i++) {
            players[visualSeat].hand.push(null);
          }
        }
        document.getElementById('deck-count').innerText = data.deckCount;
        drawTwoStack = 0;
        updateUI();
      });
    });

    // チョンボ発生同期（勝者なし・2倍強調）
    socket.on('chombo_synced', (data) => {
      isGameOver = true;
      stopTimer();
      clearDobonStandby();
      drawTwoStack = 0; // 累積クリア
      roundMultiplier = data.newMultiplier;
      document.getElementById('multiplier-display').innerText = roundMultiplier + 'x';
      updateUI();

      showChomboDoubleBanner(data.offenderName, roundMultiplier);
      showResultModal('CHOMBO / FOUL', `<b>違反者: ${data.offenderName}</b><br>${data.reason}<br><br><span style="color:#ff6b81; font-weight:bold;">※勝者なし・全員に点数支払い ＆ 次回得点倍率は ${roundMultiplier}x に倍々累積！</span>`);
    });

    // 全員同時に勝敗結果を受信
    socket.on('game_ended_sync', (endData) => {
      isGameOver = true;
      stopTimer();
      clearDobonStandby();
      drawTwoStack = 0;

      const isIWinner = (endData.winnerSeatIndex === myOnlineSeatIndex);
      updateUI();
      showOutcomeBanner(isIWinner);

      let detailHtml = `<b>${endData.winnerName}</b> の【${endData.winningType}】！<br><br>`;
      detailHtml += isIWinner ? '<span style="color:#2ecc71; font-weight:bold;">あなたの勝利です！</span>' : '<span style="color:#e74c3c;">相手の勝利です。</span>';
      showResultModal(`${endData.winnerName} WIN!`, detailHtml);
    });
  }
});

// 座席インデックスの視覚的位置への変換
function getVisualSeatIndex(absoluteSeatIndex) {
  const p = players.find(player => player.seatIndex === absoluteSeatIndex);
  return p ? p.id : 1;
}

// ==========================================
// スタート画面 ＆ ロビー操作
// ==========================================
function selectGameMode(mode) {
  if (mode === 'cpu') {
    document.getElementById('cpu-config-panel').style.display = 'block';
  } else if (mode === 'online') {
    openLobbyModal();
  }
}

function openLobbyModal() {
  document.getElementById('online-lobby-modal').style.display = 'flex';
  fetchRoomList();
}

function closeLobbyModal() {
  document.getElementById('online-lobby-modal').style.display = 'none';
}

function fetchRoomList() {
  if (socket && socket.connected) {
    socket.emit('request_room_list');
  }
}

function renderLobbyRoomList(rooms) {
  const container = document.getElementById('lobby-room-container');
  if (!container) return;
  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#888; text-align:center; padding:15px;">募集中・対局中の部屋はありません。<br>下のボタンから新しく部屋を作成してください！</div>';
    return;
  }

  let html = '';
  rooms.forEach(r => {
    const isFull = r.isPlaying || r.playerCount >= r.maxPlayers;
    const badge = r.isPlaying 
      ? '<span class="badge-playing">対局中</span>' 
      : '<span class="badge-open">募集中</span>';

    html += `
      <div class="lobby-room-item ${isFull ? 'full' : ''}" onclick="joinSelectedRoom('${r.id}')">
        <div>
          <b>${r.name}</b> <span style="font-size:10px; color:#888;">(ID: ${r.id})</span><br>
          <span style="font-size:10px; color:var(--gold);">${r.playerCount} / ${r.maxPlayers}人</span>
        </div>
        <div>${badge}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function createOnlineRoom() {
  const nameInput = document.getElementById('lobby-player-name');
  const roomNameInput = document.getElementById('create-room-name');
  const maxSelect = document.getElementById('create-room-max');

  const pName = (nameInput && nameInput.value.trim()) || 'YOU';
  const rName = (roomNameInput && roomNameInput.value.trim()) || `Table ${Math.floor(Math.random() * 900 + 100)}`;
  const maxP = parseInt(maxSelect.value) || 4;
  const rId = String(Math.floor(Math.random() * 9000 + 1000));

  currentRoomId = rId;
  socket.emit('join_or_create_room', {
    roomId: rId, roomName: rName, playerName: pName, targetPlayerCount: maxP
  });
}

function joinSelectedRoom(roomId) {
  const nameInput = document.getElementById('lobby-player-name');
  const pName = (nameInput && nameInput.value.trim()) || 'YOU';
  currentRoomId = roomId;

  socket.emit('join_or_create_room', {
    roomId: roomId, playerName: pName
  });
}

function leaveRoomAndBackToLobby() {
  document.getElementById('room-detail-modal').style.display = 'none';
  openLobbyModal();
}

function requestStartOnlineGame() {
  if (socket && currentRoomId) {
    socket.emit('start_online_game', { roomId: currentRoomId });
  }
}

function requestNextRound() {
  if (isOnlineMatch && socket && currentRoomId) {
    socket.emit('request_next_round', { roomId: currentRoomId });
  } else {
    nextRound();
  }
}

// ==========================================
// ゲーム開始（一人プレイ／再開）
// ==========================================
function startCpuNewGame() {
  isOnlineMatch = false;
  numPlayers = parseInt(document.getElementById('player-count-select').value);
  chomboMode = document.getElementById('chombo-mode-select').value;
  userTimeLimit = parseInt(document.getElementById('timer-mode-select').value);
  document.getElementById('start-modal').style.display = 'none';

  players = [];
  currentRound = 1;
  currentSet = getNextSessionNumber();

  const maleSvg = `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  const femaleSvg = `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><circle cx="12" cy="7" r="1.5" fill="#333"/></svg>`;

  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: i, name: i === 0 ? 'YOU' : `CPU ${i}`,
      silhouette: Math.random() > 0.5 ? femaleSvg : maleSvg,
      hand: [], score: 0, bannedFromWin: false, declaredLast: false
    });
  }
  startRound();
}

function resumeGame() {
  const raw = localStorage.getItem('dobon_suspended_game');
  if (!raw) return;
  const s = JSON.parse(raw);
  numPlayers = s.numPlayers; chomboMode = s.chomboMode; userTimeLimit = s.userTimeLimit;
  currentRound = s.currentRound; currentSet = s.currentSet || 1; roundMultiplier = s.roundMultiplier;
  direction = s.direction; turnIndex = s.turnIndex; drawTwoStack = s.drawTwoStack;
  designatedSuit = s.designatedSuit; players = s.players; deck = s.deck;
  discardHistory = s.discardHistory; lastActionDiscard = s.lastActionDiscard;
  nextRoundStarter = s.nextRoundStarter;

  document.getElementById('start-modal').style.display = 'none';
  isGameOver = false; updateUI(); setMessage(I18N[currentLang].ready);
  if (turnIndex === 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
  else scheduleCpuTurn();
}

function startRound() {
  isGameOver = false; stopTimer(); clearDobonStandby(); stopConfetti();
  hideOutcomeBanner();
  createDeck52(); discardHistory = []; drawTwoStack = 0; designatedSuit = null;
  direction = -1; selectedIndices = []; cancelNakiMode(); pendingLastCheck = false;
  consecutivePassCount = 0;

  const dobonBtn = document.getElementById('dobon-btn');
  if (dobonBtn) {
    dobonBtn.innerText = 'DOBON';
    dobonBtn.classList.remove('ready', 'gaeshi-mode');
  }

  document.getElementById('last-btn').classList.remove('active', 'urgent');
  document.getElementById('result-modal').style.display = 'none';
  document.getElementById('championship-modal').style.display = 'none';
  document.getElementById('minimized-restore-bar').style.display = 'none';
  document.getElementById('suit-select-floating').style.display = 'none';
  document.getElementById('dobon-gaeshi-banner').style.display = 'none';
  document.getElementById('round-num').innerText = currentRound;
  document.getElementById('multiplier-display').innerText = roundMultiplier + 'x';
  document.getElementById('skip-chombo-btn').style.display = players[0].bannedFromWin ? 'block' : 'none';

  for (let i = 0; i < 5; i++) setTimeout(playDealSound, i * 60);

  for (let p of players) {
    p.hand = deck.splice(0, 5);
    p.declaredLast = false;
  }

  let initCard = deck.pop();
  while (initCard.val === 8 || initCard.val === 2) {
    deck.unshift(initCard);
    initCard = deck.pop();
  }
  discardHistory.push(initCard);
  lastActionDiscard = { cards: [initCard], totalVal: initCard.val, playerId: -1 };

  turnIndex = nextRoundStarter % numPlayers;
  updateUI();

  checkTenho();

  if (turnIndex === 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
  else scheduleCpuTurn();
}

function skipChomboRound() {
  if (!players[0].bannedFromWin) return;
  players[0].score -= 10;
  players[0].bannedFromWin = false;
  alert(I18N[currentLang].skipChomboPrompt);
  nextRound();
}

// ==========================================
// トランプ描画（Bicycle準拠）
// ==========================================
function renderRealPips(card) {
  const suit = card.suit;
  const positions = {
    1: [[50, 50, false, true]],
    2: [[50, 24, false], [50, 76, true]],
    3: [[50, 24, false], [50, 50, false], [50, 76, true]],
    4: [[30, 24, false], [70, 24, false], [30, 76, true], [70, 76, true]],
    5: [[30, 24, false], [70, 24, false], [50, 50, false], [30, 76, true], [70, 76, true]],
    6: [[30, 24, false], [70, 24, false], [30, 50, false], [70, 50, false], [30, 76, true], [70, 76, true]],
    7: [[30, 24, false], [70, 24, false], [50, 37, false], [30, 50, false], [70, 50, false], [30, 76, true], [70, 76, true]],
    8: [[30, 24, false], [70, 24, false], [50, 36, false], [30, 50, false], [70, 50, false], [50, 64, true], [30, 76, true], [70, 76, true]],
    9: [[30, 22, false], [70, 22, false], [30, 40, false], [70, 40, false], [50, 50, false], [30, 60, true], [70, 60, true], [30, 78, true], [70, 78, true]],
    10: [[30, 22, false], [70, 22, false], [50, 32, false], [30, 40, false], [70, 40, false], [30, 60, true], [70, 60, true], [50, 68, true], [30, 78, true], [70, 78, true]]
  };

  const list = positions[card.val] || [];
  let html = '<div class="pips-container-real">';
  list.forEach(p => {
    if (p[3]) {
      html += `<div class="pip-center-huge">${suit}</div>`;
    } else {
      html += `<div class="pip-real ${p[2] ? 'flip' : ''}" style="left:${p[0]}%; top:${p[1]}%;">${suit}</div>`;
    }
  });
  html += '</div>';
  return html;
}

function renderCardContent(card) {
  const key = `${card.suit}_${card.label}`;
  if (PHOTO_CARDS[key]) {
    return `<img class="card-face-photo" src="${PHOTO_CARDS[key]}" alt="${key}">`;
  }
  return renderRealPips(card);
}

function renderCardHtml(card, extraClass = '') {
  if (!card) return '';
  return `
    <div class="card ${card.color} ${extraClass}">
      <div class="idx-top">${card.label}<br>${card.suit}</div>
      ${renderCardContent(card)}
      <div class="idx-bottom">${card.label}<br>${card.suit}</div>
    </div>
  `;
}

// ==========================================
// 画面UIの更新
// ==========================================
function updateUI() {
  const dirEl = document.getElementById('dir-display');
  if (dirEl) dirEl.innerText = direction === -1 ? I18N[currentLang].dirCCW : I18N[currentLang].dirCW;
  
  const giantBox = document.getElementById('giant-suit-indicator');
  const giantSym = document.getElementById('giant-suit-symbol');
  if (giantBox && giantSym) {
    if (designatedSuit) {
      giantSym.innerText = designatedSuit;
      giantSym.style.color = (designatedSuit === '♥' || designatedSuit === '♦') ? 'var(--card-red)' : '#fff';
      giantBox.style.display = 'flex';
    } else {
      giantBox.style.display = 'none';
    }
  }

  const drawStackEl = document.getElementById('draw-stack');
  if (drawStackEl) drawStackEl.innerText = `${drawTwoStack}`;
  const deckCountEl = document.getElementById('deck-count');
  if (deckCountEl) deckCountEl.innerText = deck.length;

  const stackBox = document.getElementById('discard-stack-box');
  if (stackBox) {
    stackBox.innerHTML = '';
    const visible = discardHistory.slice(-Math.min(discardHistory.length, 4));
    visible.forEach((c, idx) => {
      const el = document.createElement('div');
      el.className = 'discard-card-item';
      el.style.left = `${idx * 28}px`;
      el.style.zIndex = 5 + idx;
      el.innerHTML = renderCardHtml(c);
      stackBox.appendChild(el);
    });
  }

  const discardSumEl = document.getElementById('discard-sum-val');
  if (discardSumEl) discardSumEl.innerText = lastActionDiscard ? lastActionDiscard.totalVal : 0;

  // 相手座席
  const arcContainer = document.getElementById('cpu-arc-container');
  if (arcContainer) {
    arcContainer.innerHTML = '';
    const cpuCount = players.length - 1;

    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      const isAttacker = pendingDobonData && pendingDobonData.winner.id === p.id;
      const seat = document.createElement('div');
      seat.className = `cpu-seat ${turnIndex === i ? 'active' : ''} ${isAttacker ? 'dobon-attacker' : ''}`;
      const arcPos = (i - 1) - (cpuCount - 1) / 2;
      seat.style.transform = `translateY(${Math.abs(arcPos) * 10}px)`;

      let fanHtml = '<div class="cpu-fan-cards">';
      if (isGameOver || isAttacker) {
        p.hand.forEach((c, cIdx) => {
          if (c) {
            fanHtml += `<div style="position:absolute; left:${cIdx * 18}px; transform:scale(0.42); transform-origin:top left;">${renderCardHtml(c)}</div>`;
          } else {
            fanHtml += `<div class="cpu-fan-card" style="position:absolute; left:${cIdx * 12}px;"></div>`;
          }
        });
      } else {
        const showCount = Math.min(p.hand.length, 7);
        for (let c = 0; c < showCount; c++) {
          const rot = (c - (showCount - 1) / 2) * 12;
          const xOff = (c - (showCount - 1) / 2) * 6;
          fanHtml += `<div class="cpu-fan-card" style="transform: translate(${xOff}px, 0) rotate(${rot}deg);"></div>`;
        }
      }
      fanHtml += `<img class="cpu-hand-img" src="opponent.png" alt="Hand"></div>`;

      seat.innerHTML = `
        <div class="cpu-billboard-stand">
          <div class="turn-indicator-badge">▼ TURN ▼</div>
          <div class="cpu-silhouette">${p.silhouette}</div>
          ${fanHtml}
          <div class="cpu-info">
            <b>${p.name}</b> (${p.hand.length})<br>
            <span style="color:var(--gold);">${p.score}pt</span>
            ${p.declaredLast ? ' ★LAST' : ''}
          </div>
        </div>
      `;
      arcContainer.appendChild(seat);
    }
  }

  // ドボンボタン判定（完全手動）
  const user = players[0];
  const mySum = user ? user.hand.reduce((s, c) => s + (c ? c.val : 0), 0) : 0;
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;
  const dobonBtn = document.getElementById('dobon-btn');

  if (dobonBtn) {
    if (pendingDobonData && pendingDobonData.loser.id === 0) {
      dobonBtn.innerText = 'DOBON-GAESHI';
      if (mySum === pendingDobonData.actionDiscard.totalVal && user.hand.length >= 2) {
        dobonBtn.classList.add('gaeshi-mode');
      } else {
        dobonBtn.classList.remove('gaeshi-mode');
      }
    } else {
      dobonBtn.innerText = 'DOBON';
      dobonBtn.classList.remove('gaeshi-mode');
      if (!isGameOver && targetVal !== null && mySum === targetVal && user && user.hand.length >= 2 && !user.bannedFromWin) {
        dobonBtn.classList.add('ready');
      } else {
        dobonBtn.classList.remove('ready');
      }
    }
  }

  const lastBtn = document.getElementById('last-btn');
  if (lastBtn) {
    if (pendingLastCheck && user && !user.declaredLast) {
      lastBtn.classList.add('urgent');
    } else {
      lastBtn.classList.remove('urgent');
    }
  }

  const userSumEl = document.getElementById('user-sum');
  if (userSumEl) userSumEl.innerText = mySum;

  // 手札展開
  const userFanBox = document.getElementById('user-fan');
  if (userFanBox && user) {
    userFanBox.innerHTML = '';
    const total = user.hand.length;
    const isTwoRows = total > 8;

    user.hand.forEach((card, idx) => {
      if (!card) return;
      const isSelected = selectedIndices.includes(idx);
      let rowClass = '';
      let indexInRow = idx;
      let countInRow = total;

      if (isTwoRows) {
        const isBack = idx % 2 === 0;
        rowClass = isBack ? 'row-back' : 'row-front';
        indexInRow = Math.floor(idx / 2);
        countInRow = Math.ceil(total / 2);
      }

      const angleStep = Math.min(26 / Math.max(countInRow - 1, 1), 5.5);
      const xStep = Math.min(260 / Math.max(countInRow, 1), 36);
      const angle = (indexInRow - (countInRow - 1) / 2) * angleStep;
      const xOffset = (indexInRow - (countInRow - 1) / 2) * xStep;
      const yOffset = Math.abs(angle) * 0.6;

      const cardEl = document.createElement('div');
      cardEl.className = `fan-card ${rowClass} ${isSelected ? 'selected' : ''}`;
      const lift = isSelected ? -28 : 0;
      cardEl.style.transform = `translate(${xOffset}px, ${yOffset + lift}px) rotate(${angle}deg)`;
      cardEl.style.zIndex = isSelected ? 90 : (rowClass === 'row-back' ? 30 + idx : 45 + idx);
      cardEl.innerHTML = renderCardHtml(card);
      cardEl.onclick = (e) => {
        e.stopPropagation();
        onCardClick(idx);
      };
      userFanBox.appendChild(cardEl);
    });
  }
}

function setMessage(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.innerText = msg;
}

// ==========================================
// 打牌・ドロー演出
// ==========================================
function playCardWithHandAnimation(playerId, card, callback) {
  const unit = document.getElementById('flying-play-unit');
  const cardSlot = document.getElementById('flying-card-slot');
  const handImg = document.getElementById('flying-hand-img');
  if (!unit || !cardSlot || !handImg) { if (callback) callback(); return; }

  cardSlot.innerHTML = renderCardHtml(card);
  unit.style.display = 'block'; unit.style.opacity = '1';

  let sX = window.innerWidth / 2, sY = window.innerHeight * 0.82;
  let eX = window.innerWidth / 2, eY = window.innerHeight * 0.45;

  if (playerId === 0) {
    handImg.style.transform = 'scaleX(-1) rotate(-15deg)';
    unit.style.transform = `translate(${sX - 85}px, ${sY - 85}px) scale(1)`;
    setTimeout(() => { unit.style.transform = `translate(${eX - 85}px, ${eY - 85}px) scale(0.9)`; }, 20);
  } else {
    handImg.style.transform = 'rotate(180deg)';
    const seats = document.querySelectorAll('.cpu-seat');
    const tSeat = seats[playerId - 1];
    if (tSeat) {
      const r = tSeat.getBoundingClientRect();
      sX = r.left + r.width / 2; sY = r.top + r.height / 2;
    }
    unit.style.transform = `translate(${sX - 85}px, ${sY - 85}px) scale(0.7)`;
    setTimeout(() => { unit.style.transform = `translate(${eX - 85}px, ${eY - 85}px) scale(0.9)`; }, 20);
  }

  setTimeout(() => {
    playCardSnapSound();
    unit.style.opacity = '0';
    setTimeout(() => { unit.style.display = 'none'; if (callback) callback(); }, 120);
  }, 360);
}

function playDrawAnimation(playerId, callback) {
  const c = document.getElementById('flying-draw-card');
  if (!c) { if (callback) callback(); return; }
  c.style.display = 'block';
  const dX = window.innerWidth / 2 - 50, dY = window.innerHeight * 0.45;
  let tX = window.innerWidth / 2, tY = window.innerHeight * 0.82;

  if (playerId !== 0) {
    const seats = document.querySelectorAll('.cpu-seat');
    const tSeat = seats[playerId - 1];
    if (tSeat) {
      const r = tSeat.getBoundingClientRect();
      tX = r.left + r.width / 2; tY = r.top + r.height / 2;
    }
  }

  c.style.transform = `translate(${dX}px, ${dY}px) scale(0.9)`;
  setTimeout(() => {
    playDealSound();
    c.style.transform = `translate(${tX - 44}px, ${tY - 64}px) scale(0.4)`;
  }, 20);

  setTimeout(() => { c.style.display = 'none'; if (callback) callback(); }, 360);
}

function stopTimer() {
  if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
  const b = document.getElementById('timer-badge');
  if (b) b.classList.remove('urgent');
  const s = document.getElementById('timer-sec');
  if (s) s.innerText = '--';
}

function startTimerWithDuration(sec, onTimeout) {
  stopTimer();
  if (sec === 0 || isGameOver) {
    const s = document.getElementById('timer-sec');
    if (s) s.innerText = '∞';
    return;
  }
  remainingTime = sec; updateTimerDisplay();
  turnTimer = setInterval(() => {
    remainingTime--; updateTimerDisplay();
    if (remainingTime <= 0) {
      stopTimer();
      if (onTimeout) onTimeout();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const s = document.getElementById('timer-sec');
  if (s) s.innerText = `${remainingTime}s`;
  const t = (userTimeLimit === 5) ? 3 : 5;
  const b = document.getElementById('timer-badge');
  if (b) {
    if (remainingTime <= t) b.classList.add('urgent');
    else b.classList.remove('urgent');
  }
}

function handleUserTimeout() {
  commitChombo(players[0], I18N[currentLang].timeoutMsg);
}

function onCardClick(index) {
  if (isGameOver || pendingDobonData) return;
  if (activeNakiType !== null) {
    const pos = selectedIndices.indexOf(index);
    if (pos > -1) selectedIndices.splice(pos, 1);
    else selectedIndices.push(index);
    updateUI(); return;
  }
  if (turnIndex !== 0) return;

  if (selectedIndices.includes(index)) playUserCard(index);
  else { selectedIndices = [index]; updateUI(); }
}

// カードを出す処理（★8の二重送信バグ完全修正★）
function playUserCard(index) {
  const card = players[0].hand[index];
  const top = discardHistory[discardHistory.length - 1];

  if (players[0].declaredLast && players[0].hand.length >= 3) {
    commitChombo(players[0], I18N[currentLang].chomboWrongLast);
    return;
  }

  if (players[0].hand.length === 2 && !players[0].declaredLast && !pendingLastCheck) {
    if (userLastWarningCount === 0) {
      userLastWarningCount++;
      alert('【警告】ラスト宣言を忘れています！先にLASTを押してから出してください（1回目は免除）');
      selectedIndices = [];
      updateUI();
      return;
    } else {
      commitChombo(players[0], I18N[currentLang].chomboMissLast);
      return;
    }
  }

  if (players[0].hand.length === 1 && !players[0].declaredLast) {
    commitChombo(players[0], I18N[currentLang].chomboMissLast);
    return;
  }

  if (drawTwoStack > 0 && card.val !== 2) {
    if (chomboMode === 'strict') commitChombo(players[0], 'Stacked Draw Two violation');
    else setMessage('Must play 2 or draw from deck');
    return;
  }

  const isSuitMatch = designatedSuit ? (card.suit === designatedSuit) : (card.suit === top.suit);
  const isNumMatch = card.label === top.label;
  const isAllMighty8 = (card.val === 8);

  if (isSuitMatch || isNumMatch || isAllMighty8) {
    if (players[0].hand.length === 1 && isAllMighty8 && !isSuitMatch && !isNumMatch) {
      commitChombo(players[0], 'Cannot finish with 8 as All-mighty'); return;
    }

    stopTimer();
    consecutivePassCount = 0;

    if (players[0].hand.length === 2) {
      if (players[0].declaredLast) {
        speakVoice(currentLang === 'ja' ? 'ラスト！' : 'Last!');
      } else {
        pendingLastCheck = true;
      }
    }

    playCardWithHandAnimation(0, card, () => {
      players[0].hand.splice(index, 1);
      discardHistory.push(card);
      selectedIndices = [];
      designatedSuit = null;
      lastActionDiscard = { cards: [card], totalVal: card.val, playerId: 0 };

      // ★8の場合はマーク選択後に送信するため、ここでは送信しない（二重送信根絶）★
      if (card.val === 8) {
        document.getElementById('suit-select-floating').style.display = 'block';
        return;
      }

      // 8以外の通常カードのみここで送信
      if (isOnlineMatch && socket && currentRoomId) {
        socket.emit('play_card', {
          roomId: currentRoomId,
          card: card,
          designatedSuit: null,
          remainingCardCount: players[0].hand.length
        });
      }

      postCardPlayEffect(card, players[0]);
    });
  } else {
    if (chomboMode === 'strict') commitChombo(players[0], `Cannot play (${card.suit}${card.label})`);
    else setMessage('Cannot play this card');
  }
}

// 8のマーク選択（★ここで1回だけオンライン送信する！★）
function selectSuit(suit) {
  designatedSuit = suit;
  document.getElementById('suit-select-floating').style.display = 'none';
  setMessage(I18N[currentLang].suitChanged.replace('{suit}', suit));

  // オンライン送信（8のカード情報と指定マークを1回だけ送信）
  if (isOnlineMatch && socket && currentRoomId) {
    socket.emit('play_card', {
      roomId: currentRoomId,
      card: { val: 8, label: '8', suit: suit, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' },
      designatedSuit: suit,
      remainingCardCount: players[0].hand.length
    });
  }

  postCardPlayEffect({ val: 8, label: '8', suit: suit }, players[0]);
}

function postCardPlayEffect(card, player) {
  updateUI();

  if (player.hand.length === 0) {
    if (player.bannedFromWin) {
      commitChombo(player, 'Attempted to win while win-banned'); return;
    }
    endRoundNormalWin(player); return;
  }

  let skipCount = 0;
  if (card.val === 2) {
    drawTwoStack += 2;
    showDrawAlertBanner(`+${drawTwoStack} DRAW`);
  } else if (card.val === 9) {
    direction *= -1; setMessage('Reverse (9)');
  } else if (card.val === 1) {
    skipCount = 1;
  }

  // オンライン対戦時はサーバー主導の手番変更（turn_changed_sync）に任せる
  if (isOnlineMatch) {
    return;
  }

  // オフライン（一人プレイ）時の処理
  if (card.val === 1) setMessage('Skip (A)');
  if (checkCpuInterrupts(card.val, player.id)) return;
  passTurn(skipCount);
}

function showDrawAlertBanner(text) {
  const b = document.getElementById('draw-alert-banner');
  if (b) {
    b.innerText = text; b.style.display = 'block';
    setTimeout(() => b.style.display = 'none', 1400);
  }
}

function passTurn(skips = 0) {
  stopTimer();
  turnIndex = (turnIndex + (1 + skips) * direction) % numPlayers;
  while (turnIndex < 0) turnIndex += numPlayers;
  updateUI();

  if (turnIndex === 0) {
    setMessage(I18N[currentLang].yourTurn);
    startTimerWithDuration(userTimeLimit, handleUserTimeout);
  } else {
    setMessage(`${players[turnIndex].name} ${I18N[currentLang].cpuThinking}`);
    const delay = pendingLastCheck ? 5200 : Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
    setTimeout(cpuTurn, delay);
  }
}

function scheduleCpuTurn() {
  if (isOnlineMatch) return;
  const delay = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
  setTimeout(cpuTurn, delay);
}

function onDeckClick() {
  if (turnIndex !== 0 || isGameOver || pendingDobonData) return;
  stopTimer();

  if (players[0].declaredLast) {
    players[0].declaredLast = false;
    document.getElementById('last-btn').classList.remove('active', 'urgent');
    setMessage(I18N[currentLang].lastCanceled);
  }
  pendingLastCheck = false;

  playDrawAnimation(0, () => {
    if (isOnlineMatch && socket && currentRoomId) {
      socket.emit('draw_card', { roomId: currentRoomId, count: drawTwoStack > 0 ? drawTwoStack : 1 });
      return;
    }

    if (drawTwoStack > 0) {
      for (let i = 0; i < drawTwoStack; i++) drawCard(players[0]);
      setMessage(I18N[currentLang].drewCards.replace('{count}', drawTwoStack));
      drawTwoStack = 0;
    } else {
      drawCard(players[0]);
      setMessage(I18N[currentLang].drewOne);
    }
    selectedIndices = []; updateUI();
    consecutivePassCount++;
    checkNagare();
    passTurn(0);
  });
}

function drawCard(player) {
  if (deck.length === 0) {
    const top = discardHistory.pop();
    deck = discardHistory.slice();
    discardHistory = [top];
    for (let i = deck.length - 1; i > 0; i--) {
      const r = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[r]] = [deck[r], deck[i]];
    }
  }
  if (deck.length > 0) player.hand.push(deck.pop());
}

function checkNagare() {
  if (consecutivePassCount >= numPlayers * 2) {
    isGameOver = true; stopTimer(); clearDobonStandby();
    roundMultiplier *= 2;
    showResultModal('NAGARE (流局)', `全員が出せないまま一周流局しました。<br>次ゲームの得点倍率は <b>${roundMultiplier}x</b> に累積されます！`);
  }
}

function toggleUserLast() {
  players[0].declaredLast = !players[0].declaredLast;
  const btn = document.getElementById('last-btn');
  btn.classList.toggle('active', players[0].declaredLast);
  btn.classList.remove('urgent');

  if (players[0].declaredLast) {
    if (pendingLastCheck) {
      pendingLastCheck = false;
      speakVoice(currentLang === 'ja' ? 'ラスト！' : 'Last!');
      setMessage('「LAST」宣言が成立しました！');
    } else {
      setMessage(I18N[currentLang].lastStandby);
    }
  } else {
    setMessage(I18N[currentLang].lastReset);
  }
}

function startNakiMode(type) {
  if (isGameOver || pendingDobonData) return;
  activeNakiType = type; selectedIndices = [];
  document.getElementById('pon-btn').classList.toggle('active', type === 2);
  document.getElementById('kan-btn').classList.toggle('active', type === 3);
  document.getElementById('confirm-naki-btn').style.display = 'block';

  triggerFlash();

  startTimerWithDuration(userTimeLimit, () => {
    if (turnIndex !== 0) commitChombo(players[0], `${activeNakiType === 2 ? 'Pon' : 'Kan'} ${I18N[currentLang].timeoutMsg}`);
    else cancelNakiMode();
  });

  if (turnIndex !== 0) {
    speakVoice(type === 2 ? (currentLang === 'ja' ? 'ポン！' : 'Pon!') : (currentLang === 'ja' ? 'カン！' : 'Kan!'));
  }
  setMessage(I18N[currentLang].ponKanSelect);
}

function cancelNakiMode() {
  activeNakiType = null; selectedIndices = [];
  const pBtn = document.getElementById('pon-btn');
  const kBtn = document.getElementById('kan-btn');
  const cBtn = document.getElementById('confirm-naki-btn');
  if (pBtn) pBtn.classList.remove('active');
  if (kBtn) kBtn.classList.remove('active');
  if (cBtn) cBtn.style.display = 'none';
  if (turnIndex === 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
  else stopTimer();
}

function confirmNaki() {
  if (!activeNakiType) return;
  const req = activeNakiType;

  if (selectedIndices.length !== req) {
    if (turnIndex !== 0) commitChombo(players[0], `${req === 2 ? 'Pon' : 'Kan'} ${I18N[currentLang].nakiFailed}`);
    else alert(`Select exactly ${req} cards.`);
    cancelNakiMode(); return;
  }

  const cards = selectedIndices.map(i => players[0].hand[i]);
  const val = cards[0].val;

  if (!cards.every(c => c.val === val)) {
    if (turnIndex !== 0) commitChombo(players[0], 'Mismatched cards for Pon/Kan (Chombo)');
    else alert('All cards must match.');
    cancelNakiMode(); return;
  }
  if (val === 8) {
    commitChombo(players[0], 'No Pon/Kan for 8s (Chombo)');
    cancelNakiMode(); return;
  }
  const top = discardHistory[discardHistory.length - 1];
  if (top.val !== val) {
    if (turnIndex !== 0 || chomboMode === 'strict') commitChombo(players[0], 'Card does not match pile (Chombo)');
    else alert('Must match discard pile value.');
    cancelNakiMode(); return;
  }

  selectedIndices.sort((a, b) => b - a).forEach(idx => players[0].hand.splice(idx, 1));
  cards.forEach(c => discardHistory.push(c));

  const isKan = (req === 3);
  const isPon = !isKan;
  lastActionDiscard = {
    cards, totalVal: cards.length * val, playerId: 0,
    isPon: isPon, isKan: isKan, baseVal: val
  };

  if (players[0].hand.length === 0) {
    cancelNakiMode();
    executePonDobonWin(players[0], top, isKan, val);
    return;
  }

  if (turnIndex === 0) speakVoice(req === 2 ? (currentLang === 'ja' ? 'ポン！' : 'Pon!') : (currentLang === 'ja' ? 'カン！' : 'Kan!'));

  cancelNakiMode();
  handlePonKanEffects(cards, players[0]);
}

function executePonDobonWin(winner, discardCard, isKan, baseVal) {
  isGameOver = true; stopTimer(); clearDobonStandby();

  const loserId = lastActionDiscard && lastActionDiscard.playerId !== -1 ? lastActionDiscard.playerId : (winner.id - direction + numPlayers) % numPlayers;
  const loser = players[loserId];

  loser.hand.push(discardCard);

  let points = 0, title = '';
  const loserCount = calculateSpecialHandCount(loser.hand);

  if (isKan && baseVal === 2) {
    points = 160 * roundMultiplier; title = '"2" KAN-DOBON WIN! (固定160点)';
    speakVoice(currentLang === 'ja' ? 'カンドボン！' : 'Kan Dobon!');
  } else if (isKan) {
    points = 8 * loserCount * roundMultiplier; title = 'KAN-DOBON WIN! (8pt/枚)';
    speakVoice(currentLang === 'ja' ? 'カンドボン！' : 'Kan Dobon!');
  } else if (isPon && baseVal === 2) {
    points = 80 * roundMultiplier; title = '"2" PON-DOBON WIN! (固定80点)';
    speakVoice(currentLang === 'ja' ? 'ポンドボン！' : 'Pon Dobon!');
  } else {
    points = 4 * loserCount * roundMultiplier; title = 'PON-DOBON WIN! (4pt/枚)';
    speakVoice(currentLang === 'ja' ? 'ポンドボン！' : 'Pon Dobon!');
  }

  const deltas = players.map(p => (p.id === winner.id ? points : (p.id === loser.id ? -points : 0)));
  winner.score += points; loser.score -= points;

  recordRoundHistory(isKan ? 'KAN-DOBON' : 'PON-DOBON', deltas);
  roundMultiplier = 1; nextRoundStarter = winner.id;
  updateUI();

  showOutcomeBanner(winner.id === 0);
  showResultModal(title, `<b>Winner: ${winner.name} (+${points}pt)</b><br>Target: ${loser.name} (-${points}pt)<br>${loser.name}手札換算: ${loserCount}枚`);
}

function handlePonKanEffects(cards, player) {
  const val = cards[0].val, isKan = (cards.length === 3);
  if (val === 2) {
    drawTwoStack += (isKan ? 6 : 4);
    showDrawAlertBanner(`+${drawTwoStack} DRAW`);
  }
  let skips = 0;
  if (val === 1) skips = isKan ? 3 : 2;
  if (val === 9 && isKan) direction *= -1;

  turnIndex = player.id; updateUI();
  if (!isOnlineMatch) {
    if (checkCpuInterrupts(lastActionDiscard.totalVal, player.id)) return;
  }
  passTurn(skips);
}

// ドボン（完全手動）
function triggerUserDobon() {
  if (isGameOver) return;
  const user = players[0];

  if (user.hand.length === 1) {
    commitChombo(user, I18N[currentLang].chomboSingleCardDobon);
    return;
  }

  if (pendingDobonData && pendingDobonData.loser.id === 0) {
    const targetVal = pendingDobonData.actionDiscard.totalVal;
    const mySum = user.hand.reduce((s, c) => s + (c ? c.val : 0), 0);

    if (mySum === targetVal) {
      speakVoice(currentLang === 'ja' ? 'ドボン返し！' : 'Counter Dobon!');
      clearDobonStandby();
      executeDobonGaeshiWin(user, pendingDobonData.winner);
      return;
    } else {
      commitChombo(user, `手札合計(${mySum})が一致していません（誤ドボン返し）`);
      return;
    }
  }

  speakVoice(currentLang === 'ja' ? 'ドボン！' : 'Dobon!');

  if (user.bannedFromWin) {
    commitChombo(user, 'Attempted Dobon while win-banned'); return;
  }

  const mySum = user.hand.reduce((s, c) => s + (c ? c.val : 0), 0);
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;

  if (targetVal !== null && mySum === targetVal && user.hand.length >= 2) {
    stopTimer();
    const loser = players[lastActionDiscard.playerId] || players[(user.id - direction + numPlayers) % numPlayers];
    startDobonStandby(user, loser, lastActionDiscard);
  } else {
    commitChombo(user, `Hand sum (${mySum}) does not match discard (${targetVal})`);
  }
}

function startDobonStandby(winner, loser, actionDiscard) {
  stopTimer();
  pendingDobonData = { winner, loser, actionDiscard };
  dobonStandbySec = 10;

  const banner = document.getElementById('dobon-gaeshi-banner');
  const countEl = document.getElementById('gaeshi-countdown');
  if (banner) banner.style.display = 'block';
  if (countEl) countEl.innerText = `${dobonStandbySec}`;

  updateUI();

  if (!isOnlineMatch && loser.id !== 0 && loser.hand.length >= 2) {
    const lSum = loser.hand.reduce((s, c) => s + (c ? c.val : 0), 0);
    if (lSum === actionDiscard.totalVal && !loser.bannedFromWin) {
      setTimeout(() => {
        if (pendingDobonData) {
          speakVoice(currentLang === 'ja' ? 'ドボン返し！' : 'Counter Dobon!');
          clearDobonStandby();
          executeDobonGaeshiWin(loser, winner);
        }
      }, 3500);
    }
  }

  dobonStandbyTimer = setInterval(() => {
    dobonStandbySec--;
    if (countEl) countEl.innerText = `${dobonStandbySec}`;
    if (dobonStandbySec <= 0) {
      clearDobonStandby();
      finalizeNormalDobon(pendingDobonData.winner, pendingDobonData.loser, pendingDobonData.actionDiscard);
    }
  }, 1000);
}

function clearDobonStandby() {
  if (dobonStandbyTimer) { clearInterval(dobonStandbyTimer); dobonStandbyTimer = null; }
  const banner = document.getElementById('dobon-gaeshi-banner');
  if (banner) banner.style.display = 'none';
  const seats = document.querySelectorAll('.cpu-seat');
  seats.forEach(s => s.classList.remove('dobon-attacker'));
}

function finalizeNormalDobon(winner, loser, actionDiscard) {
  isGameOver = true;

  if (actionDiscard.cards) {
    actionDiscard.cards.forEach(c => loser.hand.push(c));
  }

  let points = 0;
  const loserCount = calculateSpecialHandCount(loser.hand);

  if (actionDiscard.cards.length === 1 && actionDiscard.cards[0].val === 2 && winner.hand.length === 2 && winner.hand.every(c => c && c.val === 1)) points = 20 * roundMultiplier;
  else if (actionDiscard.isPon && actionDiscard.baseVal === 2) points = 80 * roundMultiplier;
  else if (actionDiscard.isKan && actionDiscard.baseVal === 2) points = 160 * roundMultiplier;
  else if (loser.hand.length === actionDiscard.cards.length) points = 20 * roundMultiplier;
  else if (actionDiscard.isPon) points = 4 * loserCount * roundMultiplier;
  else if (actionDiscard.isKan) points = 8 * loserCount * roundMultiplier;
  else points = 2 * loserCount * roundMultiplier;

  const deltas = players.map(p => (p.id === winner.id ? points : (p.id === loser.id ? -points : 0)));
  winner.score += points; loser.score -= points;

  recordRoundHistory('DOBON', deltas);
  roundMultiplier = 1; nextRoundStarter = winner.id;
  updateUI();

  showOutcomeBanner(winner.id === 0);
  showResultModal(`${winner.name} DOBON WIN!`, `<b>Winner: ${winner.name} (+${points}pt)</b><br>Target: ${loser.name} (-${points}pt)`);
  pendingDobonData = null;
}

function executeDobonGaeshiWin(winner, loser) {
  isGameOver = true;
  const points = 20 * roundMultiplier;
  const deltas = players.map(p => (p.id === winner.id ? points : (p.id === loser.id ? -points : 0)));
  winner.score += points; loser.score -= points;

  recordRoundHistory('DOBON-GAESHI', deltas);
  roundMultiplier = 1; nextRoundStarter = winner.id;
  updateUI();

  showOutcomeBanner(winner.id === 0);
  showResultModal(`DOBON-GAESHI! (カウンター成立)`, `<b>Counter Winner: ${winner.name} (+${points}pt)</b><br>Dobon Discarder: ${loser.name} (-${points}pt)`);
  pendingDobonData = null;
}

function calculateSpecialHandCount(hand) {
  let count = 0, eightMult = 1;
  hand.forEach(c => {
    if (!c) { count += 1; return; }
    if (c.val === 2) count += 2;
    else count += 1;
    if (c.val === 8) eightMult *= 2;
  });
  return (count + drawTwoStack) * eightMult;
}

function endRoundNormalWin(winner) {
  isGameOver = true; stopTimer(); clearDobonStandby();
  let totalWin = 0;
  const deltas = new Array(players.length).fill(0);
  let detailHtml = `<b>${winner.name} NORMAL WIN!</b><br>`;

  players.forEach(p => {
    if (p.id !== winner.id) {
      const c = calculateSpecialHandCount(p.hand);
      const lost = c * 1 * roundMultiplier;
      p.score -= lost; deltas[p.id] = -lost; totalWin += lost;
      detailHtml += `${p.name}: ${c} cards (-${lost}pt)<br>`;
    }
  });

  winner.score += totalWin; deltas[winner.id] = totalWin;
  recordRoundHistory('NORMAL WIN', deltas);
  roundMultiplier = 1; nextRoundStarter = winner.id;
  updateUI();

  showOutcomeBanner(winner.id === 0);
  showResultModal(`${winner.name} WIN!`, `${detailHtml}<b>Winner: +${totalWin}pt</b>`);
}

// チョンボ発生（オンライン同期 ＆ 次回2倍強調）
function commitChombo(offender, reason) {
  isGameOver = true; stopTimer(); clearDobonStandby();
  speakVoice(currentLang === 'ja' ? 'チョンボ！' : 'Chombo!');

  const penalty = 5 * roundMultiplier;
  let totalFine = 0;
  const deltas = new Array(players.length).fill(0);

  players.forEach(p => {
    if (p.id !== offender.id) {
      p.score += penalty; deltas[p.id] = penalty; totalFine += penalty;
    }
  });
  offender.score -= totalFine; deltas[offender.id] = -totalFine;
  recordRoundHistory('CHOMBO', deltas);

  offender.bannedFromWin = true;
  if (players.every(p => p.bannedFromWin)) players.forEach(p => p.bannedFromWin = false);
  roundMultiplier *= 2;
  nextRoundStarter = offender.id;
  document.getElementById('multiplier-display').innerText = roundMultiplier + 'x';
  updateUI();

  // オンラインなら全員にチョンボと2倍を送信
  if (isOnlineMatch && socket && currentRoomId) {
    socket.emit('chombo_occurred', {
      roomId: currentRoomId,
      offenderSeatIndex: offender.seatIndex !== undefined ? offender.seatIndex : 0,
      reason: reason
    });
  }

  showChomboDoubleBanner(offender.name, roundMultiplier);
  showResultModal('CHOMBO / FOUL', `<b>違反者: ${offender.name} (-${totalFine}pt)</b><br>${reason}<br><br><span style="color:#ff6b81; font-weight:bold;">※勝者なし・全員に点数支払い ＆ 次回得点倍率は ${roundMultiplier}x に倍々累積！</span>`);
}

function checkTenho() {
  const targetVal = discardHistory[0].val;
  for (let p of players) {
    if (p.bannedFromWin) continue;
    if (p.hand.reduce((s, c) => s + (c ? c.val : 0), 0) === targetVal) {
      isGameOver = true; stopTimer();
      const pts = 20 * roundMultiplier;
      const deltas = new Array(players.length).fill(0);
      players.forEach(o => {
        if (o.id !== p.id) { o.score -= pts; deltas[o.id] = -pts; }
      });
      const winPts = pts * (players.length - 1);
      p.score += winPts; deltas[p.id] = winPts;
      recordRoundHistory('TENHO', deltas);
      updateUI();
      showOutcomeBanner(p.id === 0);
      showResultModal('TENHO DOBON!', `<b>${p.name}: +${winPts}pt</b>`);
      return;
    }
  }
}

function cpuTurn() {
  if (isGameOver || turnIndex === 0 || pendingDobonData || isOnlineMatch) return;
  const cpu = players[turnIndex];
  const top = discardHistory[discardHistory.length - 1];

  if (pendingLastCheck && !players[0].declaredLast) {
    pendingLastCheck = false;
    commitChombo(players[0], I18N[currentLang].chomboMissLast);
    return;
  }
  pendingLastCheck = false;

  if (cpu.hand.length <= 2 && !cpu.declaredLast) cpu.declaredLast = true;

  if (drawTwoStack > 0) {
    const idx2 = cpu.hand.findIndex(c => c && c.val === 2);
    if (idx2 > -1) {
      const pl = cpu.hand[idx2];
      playCardWithHandAnimation(cpu.id, pl, () => {
        cpu.hand.splice(idx2, 1);
        discardHistory.push(pl);
        lastActionDiscard = { cards: [pl], totalVal: 2, playerId: cpu.id };
        consecutivePassCount = 0;
        postCardPlayEffect(pl, cpu);
      });
      return;
    } else {
      let dCount = drawTwoStack;
      drawTwoStack = 0;
      const drawStep = () => {
        if (dCount > 0) {
          dCount--;
          playDrawAnimation(cpu.id, () => {
            drawCard(cpu);
            drawStep();
          });
        } else {
          updateUI();
          consecutivePassCount++;
          checkNagare();
          passTurn(0);
        }
      };
      drawStep();
      return;
    }
  }

  const playable = [];
  cpu.hand.forEach((c, idx) => {
    if (!c) return;
    const mSuit = designatedSuit ? (c.suit === designatedSuit) : (c.suit === top.suit);
    const mNum = (c.label === top.label);
    if (mSuit || mNum || c.val === 8) {
      if (cpu.hand.length === 1 && c.val === 8 && !mSuit && !mNum) return;
      playable.push(idx);
    }
  });

  if (playable.length > 0) {
    const pIdx = playable[Math.floor(Math.random() * playable.length)];
    const pl = cpu.hand[pIdx];

    playCardWithHandAnimation(cpu.id, pl, () => {
      cpu.hand.splice(pIdx, 1);
      discardHistory.push(pl);
      lastActionDiscard = { cards: [pl], totalVal: pl.val, playerId: cpu.id };
      designatedSuit = null;
      consecutivePassCount = 0;

      if (pl.val === 8) {
        const counts = {};
        cpu.hand.forEach(c => { if (c) counts[c.suit] = (counts[c.suit] || 0) + 1; });
        designatedSuit = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '♠';
      }
      postCardPlayEffect(pl, cpu);
    });
  } else {
    playDrawAnimation(cpu.id, () => {
      drawCard(cpu);
      if (cpu.declaredLast) cpu.declaredLast = false;
      consecutivePassCount++;
      checkNagare();
      updateUI(); passTurn(0);
    });
  }
}

function checkCpuInterrupts(targetVal, playedPlayerId) {
  if (isGameOver || pendingDobonData || isOnlineMatch) return false;

  for (let p of players) {
    if (p.id === 0 || p.id === playedPlayerId || p.bannedFromWin || p.hand.length < 2) continue;

    if (p.hand.reduce((s, c) => s + (c ? c.val : 0), 0) === targetVal) {
      setTimeout(() => {
        if (!isGameOver && !pendingDobonData) {
          speakVoice(currentLang === 'ja' ? 'ドボン！' : 'Dobon!');
          const loser = players[playedPlayerId];
          startDobonStandby(p, loser, lastActionDiscard);
        }
      }, 500);
      return true;
    }
  }
  return false;
}

// ==========================================
// 履歴管理（セッション独立計上）
// ==========================================
function getNextSessionNumber() {
  if (setScoreHistory.length === 0) return 1;
  return Math.max(...setScoreHistory.map(s => s.set)) + 1;
}

function recordRoundHistory(type, deltas) {
  if (currentRound === 1 && (!setScoreHistory.length || setScoreHistory[setScoreHistory.length - 1].rounds.length > 0)) {
    currentSet = getNextSessionNumber();
  }

  let setObj = setScoreHistory.find(s => s.set === currentSet);
  if (!setObj) {
    setObj = { set: currentSet, rounds: [] };
    setScoreHistory.push(setObj);
  }

  setObj.rounds.push({
    round: currentRound, type, deltas: [...deltas],
    scoresAfter: players.map(p => p.score)
  });
  localStorage.setItem('dobon_permanent_history', JSON.stringify(setScoreHistory));
}

function openScoreHistoryModal() {
  const container = document.getElementById('accordion-history-container');
  if (setScoreHistory.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#888; text-align:center; padding:15px;">対戦履歴はありません。</div>';
  } else {
    let html = '';
    setScoreHistory.forEach((sObj, sIdx) => {
      const totals = new Array(players.length).fill(0);
      sObj.rounds.forEach(r => r.deltas.forEach((d, pIdx) => totals[pIdx] += d));
      const champIdx = totals.indexOf(Math.max(...totals));
      const champName = players[champIdx] ? players[champIdx].name : `P${champIdx}`;

      html += `
        <div class="accordion-item" id="acc-item-${sIdx}">
          <div class="accordion-header" onclick="toggleAccordion(${sIdx})">
            <span>SESSION ${sObj.set} (計${sObj.rounds.length}回) | 🏆 ${champName}</span>
            <span id="acc-arrow-${sIdx}">▼</span>
          </div>
          <div class="accordion-content">
            <div style="font-size:10px; margin-bottom:5px; color:var(--gold);">Total: ${players.map((p, i) => `${p.name}: ${totals[i]}pt`).join(' | ')}</div>
            <table class="history-table">
              <thead><tr><th>R</th><th>TYPE</th>${players.map(p => `<th>${p.name}</th>`).join('')}</tr></thead>
              <tbody>
                ${sObj.rounds.map(r => `
                  <tr>
                    <td>${r.round}</td><td>${r.type}</td>
                    ${r.deltas.map((d, i) => `<td style="color:${d > 0 ? '#2ecc71' : (d < 0 ? '#e74c3c' : '#aaa')}">${d > 0 ? `+${d}` : d}<br>(${r.scoresAfter[i]})</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }
  document.getElementById('history-modal').style.display = 'flex';
}

function toggleAccordion(sIdx) {
  const el = document.getElementById(`acc-item-${sIdx}`);
  if (el) {
    el.classList.toggle('open');
    const arr = document.getElementById(`acc-arrow-${sIdx}`);
    if (arr) arr.innerText = el.classList.contains('open') ? '▲' : '▼';
  }
}

function closeScoreHistoryModal() {
  document.getElementById('history-modal').style.display = 'none';
}

function showResultModal(title, html) {
  document.getElementById('result-title').innerText = title;
  document.getElementById('result-detail').innerHTML = html;
  document.getElementById('result-modal').style.display = 'flex';
  document.getElementById('minimized-restore-bar').style.display = 'none';
}

function toggleMinimizeResult() {
  const m = document.getElementById('result-modal');
  const b = document.getElementById('minimized-restore-bar');
  if (m.style.display === 'none') {
    m.style.display = 'flex'; b.style.display = 'none';
  } else {
    m.style.display = 'none'; b.style.display = 'block';
  }
}

function nextRound() {
  stopConfetti();
  hideOutcomeBanner();
  document.getElementById('result-modal').style.display = 'none';
  document.getElementById('minimized-restore-bar').style.display = 'none';

  if (currentRound % 10 === 0) {
    showChampionshipResult();
  } else {
    currentRound++;
    startRound();
  }
}

function showChampionshipResult() {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const champ = sorted[0];

  let html = `<div style="text-align:center; font-size:14px; margin-bottom:10px;">
    <b>🏆 WINNER: <span style="color:var(--gold); font-size:18px;">${champ.name}</span> (${champ.score} pt)</b>
  </div><table class="history-table"><thead><tr><th>RANK</th><th>PLAYER</th><th>SCORE</th></tr></thead><tbody>`;

  sorted.forEach((p, idx) => {
    html += `<tr><td>${idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : idx + 1))}</td><td><b>${p.name}</b></td><td style="color:var(--gold); font-weight:bold;">${p.score} pt</td></tr>`;
  });
  html += '</tbody></table>';

  document.getElementById('champ-rankings').innerHTML = html;
  document.getElementById('championship-modal').style.display = 'flex';
}

function continueChampionship() {
  document.getElementById('championship-modal').style.display = 'none';
  currentRound++;
  startRound();
}

function resetChampionship() {
  document.getElementById('championship-modal').style.display = 'none';
  players.forEach(p => { p.score = 0; p.bannedFromWin = false; });
  currentRound = 1;
  currentSet = getNextSessionNumber();
  startRound();
}
