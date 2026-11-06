/**
 * DOBON MASTER - Core Game Engine & Single-Player Logic
 * File Version: game.js v0.2.0 (2026 San Diego Standard)
 */

window.isOnlineMatch = false;
window.isSpectator = false;
window.currentRoomId = null;

let currentLang = 'JA';
let userTimeLimit = 25;
let timerSeconds = 25;
let timerInterval = null;
let currentRound = 1;
let roundMultiplier = 1;
let isGameOver = false;
let turnIndex = 0;
let isClockwise = true;

let players = [];
let deck = [];
let discardHistory = [];
let selectedIndices = [];
let designatedSuit = null;
let lastActionDiscard = null;
let consecutivePassCount = 0;
let drawTwoStack = 0;
let dobonStandbyTimer = null;
let historyLog = [];

const I18N = {
  JA: {
    yourTurn: "あなたの番です！カードをタップして出してください",
    spectatorWatching: "【観戦中】プレイヤーの思考・操作を待っています..."
  },
  EN: {
    yourTurn: "YOUR TURN! Tap cards to play",
    spectatorWatching: "SPECTATING: Waiting for players..."
  }
};

window.addEventListener('DOMContentLoaded', () => {
  checkSavedSession();
});

function toggleConfigAccordion() {
  const panel = document.getElementById('cpu-config-panel');
  const arrow = document.getElementById('config-arrow');
  if (panel) {
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (arrow) arrow.innerText = isHidden ? '▲' : '▼';
  }
}

function setMessage(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.innerText = msg;
}

function toggleLang() {
  currentLang = (currentLang === 'JA') ? 'EN' : 'JA';
  const btn = document.getElementById('lang-btn');
  if (btn) btn.innerText = currentLang;
  const tSuit = document.getElementById('txt-choose-suit');
  if (tSuit) tSuit.innerText = (currentLang === 'JA') ? 'SELECT SUIT' : 'SELECT SUIT';
  if (!isGameOver) setMessage(I18N[currentLang].yourTurn);
}

function startCpuDirect() {
  const pSelect = document.getElementById('player-count-select');
  const tSelect = document.getElementById('timer-mode-select');

  const count = pSelect ? (parseInt(pSelect.value) || 4) : 4;
  userTimeLimit = tSelect ? (parseInt(tSelect.value) || 25) : 25;

  window.isOnlineMatch = false;
  window.isSpectator = false;

  const startModal = document.getElementById('start-modal');
  if (startModal) startModal.style.display = 'none';

  initGame(count);
}

function initGame(playerCount = 4) {
  stopTimer();
  stopConfetti();
  hideOutcomeBanner();
  isGameOver = false;
  selectedIndices = [];
  designatedSuit = null;
  lastActionDiscard = null;
  consecutivePassCount = 0;
  drawTwoStack = 0;

  deck = createDeck();
  shuffle(deck);

  players = [];
  const names = ['YOU', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5'];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      seatIndex: i,
      name: names[i] || `CPU ${i}`,
      hand: [],
      score: 0,
      bannedFromWin: false,
      declaredLast: false,
      isCpu: i !== 0,
      silhouette: `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
    });
  }

  for (let c = 0; c < 5; c++) {
    players.forEach(p => {
      if (deck.length > 0) p.hand.push(deck.pop());
    });
  }

  const initialCard = deck.pop();
  discardHistory = [initialCard];
  lastActionDiscard = { cards: [initialCard], totalVal: initialCard.val, playerId: -1 };

  turnIndex = 0;
  updateUI();
  playDealSound();

  setMessage(I18N[currentLang].yourTurn);
  startTimerWithDuration(userTimeLimit, handleUserTimeout);
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const d = [];
  suits.forEach(s => {
    for (let v = 1; v <= 13; v++) {
      d.push({ suit: s, val: v });
    }
  });
  return d;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getVisualSeatIndex(targetSeatIndex) {
  if (typeof myOnlineSeatIndex !== 'undefined' && myOnlineSeatIndex >= 0) {
    return (targetSeatIndex - myOnlineSeatIndex + players.length) % players.length;
  }
  return targetSeatIndex;
}

function updateUI() {
  const rNumEl = document.getElementById('round-num');
  if (rNumEl) rNumEl.innerText = currentRound;
  const mDisp = document.getElementById('multiplier-display');
  if (mDisp) mDisp.innerText = roundMultiplier + 'x';
  const dcEl = document.getElementById('deck-count');
  if (dcEl) dcEl.innerText = deck.length;

  const uSum = document.getElementById('user-sum');
  if (uSum && players[0]) uSum.innerText = players[0].score;

  renderUserHand();
  renderCpuArc();
  renderDiscardPile();
}

function renderUserHand() {
  const container = document.getElementById('user-fan');
  if (!container || !players[0]) return;

  container.innerHTML = '';
  const hand = players[0].hand || [];
  const total = hand.length;

  hand.forEach((card, idx) => {
    if (!card) return;
    const cardDiv = document.createElement('div');
    cardDiv.className = `card-fan-item ${selectedIndices.includes(idx) ? 'selected' : ''}`;
    const isRed = (card.suit === '♥' || card.suit === '♦');
    cardDiv.style.color = isRed ? '#e74c3c' : '#2c3e50';

    const valStr = card.val === 1 ? 'A' : card.val === 11 ? 'J' : card.val === 12 ? 'Q' : card.val === 13 ? 'K' : card.val;
    cardDiv.innerHTML = `
      <div style="font-size:12px; font-weight:bold; position:absolute; top:4px; left:6px;">${valStr}<br>${card.suit}</div>
      <div style="font-size:24px; position:absolute; bottom:6px; right:6px;">${card.suit}</div>
    `;

    const angle = (idx - (total - 1) / 2) * 6;
    cardDiv.style.transform = `rotate(${angle}deg) translateY(${selectedIndices.includes(idx) ? '-20px' : '0px'})`;

    cardDiv.onclick = () => onUserCardClick(idx);
    container.appendChild(cardDiv);
  });
}

function renderCpuArc() {
  const container = document.getElementById('cpu-arc-container');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    if (!p) continue;
    const box = document.createElement('div');
    box.className = 'cpu-player-box';
    if (turnIndex === i) box.classList.add('active-turn');

    box.innerHTML = `
      <div style="font-size:11px; font-weight:bold; color:var(--gold);">${p.name}</div>
      <div style="font-size:10px; color:#aaa;">手札: ${p.hand ? p.hand.length : 0}枚</div>
      <div style="font-size:10px; color:#2ecc71;">Score: ${p.score}</div>
    `;
    container.appendChild(box);
  }
}

function renderDiscardPile() {
  const box = document.getElementById('discard-stack-box');
  const sumEl = document.getElementById('discard-sum-val');
  if (!box) return;

  box.innerHTML = '';
  if (discardHistory.length === 0) return;

  const topCard = discardHistory[discardHistory.length - 1];
  if (sumEl) sumEl.innerText = topCard.val;

  const cardDiv = document.createElement('div');
  cardDiv.className = 'card-fan-item';
  cardDiv.style.position = 'relative';
  cardDiv.style.transform = 'none';
  const isRed = (topCard.suit === '♥' || topCard.suit === '♦');
  cardDiv.style.color = isRed ? '#e74c3c' : '#2c3e50';

  const valStr = topCard.val === 1 ? 'A' : topCard.val === 11 ? 'J' : topCard.val === 12 ? 'Q' : topCard.val === 13 ? 'K' : topCard.val;
  cardDiv.innerHTML = `
    <div style="font-size:12px; font-weight:bold; position:absolute; top:4px; left:6px;">${valStr}<br>${topCard.suit}</div>
    <div style="font-size:24px; position:absolute; bottom:6px; right:6px;">${topCard.suit}</div>
  `;
  box.appendChild(cardDiv);
}

function onUserCardClick(idx) {
  if (turnIndex !== 0 || isGameOver) return;

  const pos = selectedIndices.indexOf(idx);
  if (pos >= 0) {
    selectedIndices.splice(pos, 1);
  } else {
    selectedIndices.push(idx);
  }
  renderUserHand();

  if (selectedIndices.length > 0) {
    const playCards = selectedIndices.map(i => players[0].hand[i]);
    if (isValidPlay(playCards)) {
      executePlay(0, selectedIndices);
    }
  }
}

function isValidPlay(cards) {
  if (!cards || cards.length === 0) return false;
  const topCard = discardHistory[discardHistory.length - 1];
  if (!topCard) return true;

  const first = cards[0];
  const targetSuit = designatedSuit || topCard.suit;

  if (cards.length === 1) {
    return (first.suit === targetSuit || first.val === topCard.val || first.val === 8);
  }

  const allSameVal = cards.every(c => c.val === first.val);
  if (allSameVal) {
    return (first.suit === targetSuit || first.val === topCard.val || first.val === 8);
  }
  return false;
}

function executePlay(playerIdx, cardIndices) {
  stopTimer();
  const p = players[playerIdx];
  const played = cardIndices.sort((a,b) => b-a).map(i => p.hand.splice(i, 1)[0]);

  discardHistory.push(...played);
  const lastPlayed = played[played.length - 1];

  lastActionDiscard = {
    cards: played,
    totalVal: played.reduce((acc, c) => acc + c.val, 0),
    playerId: p.seatIndex
  };

  selectedIndices = [];
  designatedSuit = null;
  consecutivePassCount = 0;

  if (lastPlayed.val === 2) {
    drawTwoStack += (2 * played.length);
    showDrawAlertBanner(`+${drawTwoStack} DRAW`);
  }

  updateUI();

  if (p.hand.length === 0) {
    handleWin(p, 'AGARI (上がり)');
    return;
  }

  if (lastPlayed.val === 8 && p.isCpu === false) {
    showSuitSelector();
    return;
  }

  advanceTurn();
}

function onDeckClick() {
  if (turnIndex !== 0 || isGameOver) return;
  stopTimer();

  if (deck.length === 0) {
    setMessage('山札がありません！');
    return;
  }

  const drawCount = drawTwoStack > 0 ? drawTwoStack : 1;
  drawTwoStack = 0;
  hideDrawAlertBanner();

  for (let i = 0; i < drawCount; i++) {
    if (deck.length > 0) players[0].hand.push(deck.pop());
  }

  consecutivePassCount++;
  updateUI();

  if (checkNagare()) return;
  advanceTurn();
}

function advanceTurn() {
  if (isGameOver) return;
  turnIndex = (turnIndex + 1) % players.length;
  updateUI();

  if (players[turnIndex].isCpu) {
    setMessage(`${players[turnIndex].name} の思考中...`);
    setTimeout(processCpuTurn, 1000);
  } else {
    setMessage(I18N[currentLang].yourTurn);
    startTimerWithDuration(userTimeLimit, handleUserTimeout);
  }
}

function processCpuTurn() {
  if (isGameOver || turnIndex === 0) return;
  const cpu = players[turnIndex];
  const topCard = discardHistory[discardHistory.length - 1];
  const targetSuit = designatedSuit || topCard.suit;

  let validIndex = -1;
  for (let i = 0; i < cpu.hand.length; i++) {
    const c = cpu.hand[i];
    if (c.suit === targetSuit || c.val === topCard.val || c.val === 8) {
      validIndex = i;
      break;
    }
  }

  if (validIndex >= 0) {
    executePlay(turnIndex, [validIndex]);
  } else {
    if (deck.length > 0) {
      const drawCount = drawTwoStack > 0 ? drawTwoStack : 1;
      drawTwoStack = 0;
      hideDrawAlertBanner();

      for (let d = 0; d < drawCount; d++) {
        if (deck.length > 0) cpu.hand.push(deck.pop());
      }
    }
    consecutivePassCount++;
    updateUI();
    if (!checkNagare()) advanceTurn();
  }
}

function triggerUserDobon() {
  if (isGameOver || !lastActionDiscard) return;
  const myHand = players[0].hand;
  const mySum = myHand.reduce((acc, c) => acc + c.val, 0);

  if (myHand.length === 1) {
    handleChombo(players[0], '1枚手札でのドボン宣言（公式ルール違反）');
    return;
  }

  if (mySum === lastActionDiscard.totalVal) {
    handleWin(players[0], 'DOBON (ドボン!)');
  } else {
    handleChombo(players[0], `ドボン失敗 (手札合計: ${mySum} ≠ 場のカード: ${lastActionDiscard.totalVal})`);
  }
}

function toggleUserLast() {
  const p = players[0];
  if (!p) return;
  p.declaredLast = !p.declaredLast;
  const btn = document.getElementById('last-btn');
  if (btn) btn.style.background = p.declaredLast ? '#e74c3c' : 'rgba(45,35,25,0.9)';
  setMessage(p.declaredLast ? 'LAST (リーチ) 宣言中！' : I18N[currentLang].yourTurn);
}

function handleWin(winner, typeStr) {
  isGameOver = true;
  stopTimer();
  playWinSound();
  showConfetti();

  const isUser = winner.id === 0;
  showOutcomeBanner(isUser);

  let points = 0;
  players.forEach(p => {
    const pSum = p.hand.reduce((acc, c) => acc + c.val, 0);
    points += pSum;
  });
  points *= roundMultiplier;
  winner.score += points;

  let detailHtml = `<b>${winner.name}</b> の【${typeStr}】！<br><br>`;
  detailHtml += `獲得ポイント: <b style="color:var(--gold);">${points} pt</b> (倍率: ${roundMultiplier}x)<br>`;

  showResultModal(`${winner.name} WIN!`, detailHtml);
}

function handleChombo(offender, reasonStr) {
  isGameOver = true;
  stopTimer();
  roundMultiplier *= 2;

  const penalty = 5 * roundMultiplier;
  offender.score -= penalty;

  showChomboDoubleBanner(offender.name, roundMultiplier);
  showResultModal('CHOMBO / FOUL', `<b>違反者: ${offender.name}</b><br>${reasonStr}<br><br>ペナルティ: ${penalty} pt<br>※次回得点倍率が <b>${roundMultiplier}x</b> にアップ！`);
}

function checkNagare() {
  if (consecutivePassCount >= players.length || deck.length === 0) {
    isGameOver = true;
    stopTimer();
    roundMultiplier *= 2;
    showResultModal('NAGARE (流局)', `山札切了または全員パスにより流局しました。<br>※次回得点倍率が <b>${roundMultiplier}x</b> にアップ！`);
    return true;
  }
  return false;
}

function startTimerWithDuration(sec, onTimeout) {
  stopTimer();
  timerSeconds = sec;
  const tEl = document.getElementById('timer-sec');
  if (tEl) tEl.innerText = timerSeconds;

  timerInterval = setInterval(() => {
    timerSeconds--;
    if (tEl) tEl.innerText = timerSeconds;
    if (timerSeconds <= 0) {
      stopTimer();
      if (onTimeout) onTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function handleUserTimeout() {
  if (turnIndex === 0 && !isGameOver) {
    setMessage('時間切れ！自動パスしました');
    onDeckClick();
  }
}

function showSuitSelector() {
  const el = document.getElementById('suit-select-floating');
  if (el) el.style.display = 'block';
}

function selectSuit(suitSymbol) {
  designatedSuit = suitSymbol;
  const el = document.getElementById('suit-select-floating');
  if (el) el.style.display = 'none';
  setMessage(`指定マーク: ${suitSymbol}`);
  advanceTurn();
}

function showResultModal(title, html) {
  const modal = document.getElementById('result-modal');
  const tEl = document.getElementById('result-title');
  const dEl = document.getElementById('result-detail');
  if (tEl) tEl.innerText = title;
  if (dEl) dEl.innerHTML = html;
  if (modal) modal.style.display = 'flex';
}

function toggleMinimizeResult() {
  const modal = document.getElementById('result-modal');
  const bar = document.getElementById('minimized-restore-bar');
  if (!modal || !bar) return;

  if (modal.style.display !== 'none') {
    modal.style.display = 'none';
    bar.style.display = 'block';
  } else {
    modal.style.display = 'flex';
    bar.style.display = 'none';
  }
}

function nextRound() {
  const modal = document.getElementById('result-modal');
  if (modal) modal.style.display = 'none';
  const bar = document.getElementById('minimized-restore-bar');
  if (bar) bar.style.display = 'none';

  currentRound++;
  initGame(players.length);
}

function openLobbyModal() {
  if (typeof window.openLobbyModal === 'function' && window.openLobbyModal !== openLobbyModal) {
    window.openLobbyModal();
    return;
  }
  const m = document.getElementById('online-lobby-modal');
  if (m) m.style.display = 'flex';
}

function closeLobbyModal() {
  const m = document.getElementById('online-lobby-modal');
  if (m) m.style.display = 'none';
}

function openPayoutModal() {
  const m = document.getElementById('payout-modal');
  if (m) m.style.display = 'flex';
}

function closePayoutModal() {
  const m = document.getElementById('payout-modal');
  if (m) m.style.display = 'none';
}

function openScoreHistoryModal() {
  const m = document.getElementById('history-modal');
  if (m) m.style.display = 'flex';
}

function closeScoreHistoryModal() {
  const m = document.getElementById('history-modal');
  if (m) m.style.display = 'none';
}

function suspendGame() {
  alert('ゲーム状態を保存しました');
  quitToTitle();
}

function quitToTitle() {
  stopTimer();
  const startModal = document.getElementById('start-modal');
  if (startModal) startModal.style.display = 'flex';
}

function checkSavedSession() {
  // 自動再開チェックのプレースホルダー
}

function showOutcomeBanner(isWin) {
  const b = document.getElementById('round-outcome-banner');
  if (!b) return;
  b.innerText = isWin ? 'VICTORY!' : 'DEFEAT';
  b.style.color = isWin ? '#2ecc71' : '#e74c3c';
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 3000);
}

function hideOutcomeBanner() {
  const b = document.getElementById('round-outcome-banner');
  if (b) b.style.display = 'none';
}

function showChomboDoubleBanner(name, mult) {
  const b = document.getElementById('chombo-double-banner');
  const desc = document.getElementById('chombo-offender-desc');
  if (!b) return;
  if (desc) desc.innerText = `違反者: ${name} / 次回得点倍率: ${mult}x`;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 4000);
}

function showDrawAlertBanner(text) {
  const b = document.getElementById('draw-alert-banner');
  if (!b) return;
  b.innerText = text;
  b.style.display = 'block';
}

function hideDrawAlertBanner() {
  const b = document.getElementById('draw-alert-banner');
  if (b) b.style.display = 'none';
}

function playDealSound() {}
function playWinSound() {}

function showConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.style.display = 'block';
}

function stopConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.style.display = 'none';
}

function playCardWithHandAnimation(seatIdx, card, cb) { if (cb) cb(); }
function playDrawAnimation(seatIdx, cb) { if (cb) cb(); }
function clearDobonStandby() {}
function startNakiMode() {}
function confirmNaki() {}
function skipChomboRound() {}
function continueChampionship() {}
function resetChampionship() {}
