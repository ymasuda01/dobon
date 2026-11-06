/**
 * DOBON MASTER - Las Vegas VIP Lounge Engine (Local / Core)
 * Game Version: 2026.00.004
 * File Version: game.js v0.1.5
 */

const GAME_VERSION = "2026.00.004";
const FILE_VERSION = "game.js v0.1.5";
console.log(`[DOBON Engine Loaded] Game: ${GAME_VERSION} | File: ${FILE_VERSION}`);

const I18N = {
  ja: {
    ready: '準備完了', yourTurn: 'あなたの番です！', cpuThinking: '思考中...',
    opponentThinking: '相手の手番です。操作を待っています...',
    spectatorWatching: '【観戦中】次のラウンド開始時に合流します',
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
    spectatorWatching: '[SPECTATING] Joining at next round...',
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

let numPlayers = 4, chomboMode = 'strict', userTimeLimit = 25;
let players = [], deck = [], discardHistory = [], lastActionDiscard = null;
let turnIndex = 0, direction = -1, currentRound = 1, currentSet = 1;
let roundMultiplier = 1, drawTwoStack = 0, designatedSuit = null;
let isGameOver = false, turnTimer = null, remainingTime = 0;
let setScoreHistory = [];
let activeNakiType = null, selectedIndices = [], nextRoundStarter = 0;
let pendingLastCheck = false, userLastWarningCount = 0;

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
  const lBtn = document.getElementById('lang-btn');
  if (lBtn) lBtn.innerText = currentLang === 'ja' ? 'EN' : 'JP';
  const cSuit = document.getElementById('txt-choose-suit');
  if (cSuit) cSuit.innerText = I18N[currentLang].chooseSuit;
  updateUI();
}

function openPayoutModal() { 
  const m = document.getElementById('payout-modal');
  if (m) m.style.display = 'flex'; 
}
function closePayoutModal() { 
  const m = document.getElementById('payout-modal');
  if (m) m.style.display = 'none'; 
}

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
  if (confirm(currentLang === 'ja' ? '対局を終了してタイトルへ戻りますか？（履歴は保存され、次回は新規開始となります）' : 'Quit game? (History is archived, next game starts fresh)')) {
    stopTimer(); clearDobonStandby(); isGameOver = true;
    localStorage.removeItem('dobon_suspended_game');
    const rModal = document.getElementById('result-modal');
    if (rModal) rModal.style.display = 'none';
    const cModal = document.getElementById('championship-modal');
    if (cModal) cModal.style.display = 'none';
    const sModal = document.getElementById('start-modal');
    if (sModal) sModal.style.display = 'flex';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    const savedHistory = localStorage.getItem('dobon_permanent_history');
    if (savedHistory) setScoreHistory = JSON.parse(savedHistory);
  } catch (e) {
    setScoreHistory = [];
  }

  if (localStorage.getItem('dobon_suspended_game')) {
    const rBtn = document.getElementById('resume-btn');
    if (rBtn) rBtn.style.display = 'block';
  }

  const savedName = localStorage.getItem('dobon_player_name');
  if (savedName) {
    const nameEl = document.getElementById('lobby-player-name');
    if (nameEl) nameEl.value = savedName;
  }

  document.addEventListener('click', (e) => {
    if (isGameOver || pendingDobonData || activeNakiType !== null || isSpectator) return;
    if (!e.target.closest('.fan-card') && !e.target.closest('button') && !e.target.closest('.deck-3d-stack')) {
      if (selectedIndices.length > 0) {
        selectedIndices = [];
        updateUI();
      }
    }
  });

  // オンライン機能の初期化は online.js 側に移譲
  if (typeof initOnlineSocket === 'function') {
    initOnlineSocket();
  }
});

function startCpuDirect() {
  const pSel = document.getElementById('player-count-select');
  const cSel = document.getElementById('chombo-mode-select');
  const tSel = document.getElementById('timer-mode-select');

  numPlayers = pSel ? parseInt(pSel.value) : 4;
  chomboMode = cSel ? cSel.value : 'strict';
  userTimeLimit = tSel ? parseInt(tSel.value) : 25;

  isOnlineMatch = false;
  isSpectator = false;
  const sBanner = document.getElementById('spectator-hud-banner');
  if (sBanner) sBanner.style.display = 'none';

  const sModal = document.getElementById('start-modal');
  if (sModal) sModal.style.display = 'none';

  players = [];
  currentRound = 1;
  nextRoundStarter = 0;
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

function toggleConfigAccordion() {
  const panel = document.getElementById('cpu-config-panel');
  const arrow = document.getElementById('config-arrow');
  if (!panel) return;
  const isHidden = (panel.style.display === 'none' || panel.style.display === '');
  panel.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.innerText = isHidden ? '▲' : '▼';
}

function resumeGame() {
  const raw = localStorage.getItem('dobon_suspended_game');
  if (!raw) return;
  let s = null;
  try { s = JSON.parse(raw); } catch (e) { return; }

  numPlayers = s.numPlayers; chomboMode = s.chomboMode; userTimeLimit = s.userTimeLimit || 25;
  currentRound = s.currentRound; currentSet = s.currentSet || 1; roundMultiplier = s.roundMultiplier;
  direction = s.direction; turnIndex = s.turnIndex; drawTwoStack = s.drawTwoStack;
  designatedSuit = s.designatedSuit; players = s.players; deck = s.deck;
  discardHistory = s.discardHistory; lastActionDiscard = s.lastActionDiscard;
  nextRoundStarter = s.nextRoundStarter;

  const sm = document.getElementById('start-modal');
  if (sm) sm.style.display = 'none';
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
  hideDrawAlertBanner();

  const dobonBtn = document.getElementById('dobon-btn');
  if (dobonBtn) {
    dobonBtn.innerText = 'DOBON';
    dobonBtn.classList.remove('ready', 'gaeshi-mode');
  }

  const lastBtn = document.getElementById('last-btn');
  if (lastBtn) lastBtn.classList.remove('active', 'urgent');

  const rModal = document.getElementById('result-modal');
  if (rModal) rModal.style.display = 'none';
  const cModal = document.getElementById('championship-modal');
  if (cModal) cModal.style.display = 'none';
  const mBar = document.getElementById('minimized-restore-bar');
  if (mBar) mBar.style.display = 'none';
  const sFloat = document.getElementById('suit-select-floating');
  if (sFloat) sFloat.style.display = 'none';
  const dBanner = document.getElementById('dobon-gaeshi-banner');
  if (dBanner) dBanner.style.display = 'none';
  const nBanner = document.getElementById('naki-pause-banner');
  if (nBanner) nBanner.style.display = 'none';

  const rNum = document.getElementById('round-num');
  if (rNum) rNum.innerText = currentRound;
  const mDisp = document.getElementById('multiplier-display');
  if (mDisp) mDisp.innerText = roundMultiplier + 'x';
  const dStack = document.getElementById('draw-stack');
  if (dStack) dStack.innerText = '0';
  const skBtn = document.getElementById('skip-chombo-btn');
  if (skBtn) skBtn.style.display = (players[0] && players[0].bannedFromWin) ? 'block' : 'none';

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

  turnIndex = (nextRoundStarter !== undefined) ? (nextRoundStarter % numPlayers) : 0;
  updateUI();

  checkTenho();

  if (turnIndex === 0) {
    startTimerWithDuration(userTimeLimit, handleUserTimeout);
  } else {
    scheduleCpuTurn();
  }
}

function skipChomboRound() {
  if (!players[0] || !players[0].bannedFromWin) return;
  players[0].score -= 10;
  players[0].bannedFromWin = false;
  alert(I18N[currentLang].skipChomboPrompt);
  nextRound();
}

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
      
      let isActiveTurn = false;
      if (window.isOnlineMatch) {
        isActiveTurn = (p.seatIndex === window.currentOnlineTurnSeat);
      } else {
        isActiveTurn = (turnIndex === i);
      }

      const seat = document.createElement('div');
      seat.className = `cpu-seat ${isActiveTurn ? 'active' : ''} ${isAttacker ? 'dobon-attacker' : ''}`;
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

  // 自分の手番時ゴールドネオン
  const userFanArea = document.getElementById('user-fan-area');
  const isUserTurn = window.isOnlineMatch ? (!window.isSpectator && window.currentOnlineTurnSeat === window.myOnlineSeatIndex) : (turnIndex === 0);
  if (userFanArea) {
    if (isUserTurn && !isGameOver) {
      userFanArea.classList.add('your-turn-active');
    } else {
      userFanArea.classList.remove('your-turn-active');
    }
  }

  // ドボンボタン ＆ 【修正】自分で出したカードに対してハイライトしない
  const user = players[0];
  const mySum = (user && !window.isSpectator) ? user.hand.reduce((s, c) => s + (c ? c.val : 0), 0) : 0;
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;
  const lastPlayerId = lastActionDiscard ? lastActionDiscard.playerId : null;
  const dobonBtn = document.getElementById('dobon-btn');

  if (dobonBtn) {
    if (window.isSpectator) {
      dobonBtn.style.display = 'none';
    } else {
      dobonBtn.style.display = 'block';
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
        
        // ★修正点：自分が直前に出したカード（lastPlayerId === 0）である場合は、合計値が一致していてもDOBONをハイライトしない
        const isMyOwnDiscard = (lastPlayerId === 0);
        if (!isGameOver && targetVal !== null && mySum === targetVal && user && user.hand.length >= 2 && !user.bannedFromWin && !isMyOwnDiscard) {
          dobonBtn.classList.add('ready');
        } else {
          dobonBtn.classList.remove('ready');
        }
      }
    }
  }

  const lastBtn = document.getElementById('last-btn');
  if (lastBtn) {
    if (window.isSpectator) {
      lastBtn.style.display = 'none';
    } else {
      lastBtn.style.display = 'block';
      if (pendingLastCheck && user && !user.declaredLast) {
        lastBtn.classList.add('urgent');
      } else {
        lastBtn.classList.remove('urgent');
      }
    }
  }

  const userSumEl = document.getElementById('user-sum');
  if (userSumEl) userSumEl.innerText = mySum;

  // 手札展開
  const userFanBox = document.getElementById('user-fan');
  if (userFanBox) {
    userFanBox.innerHTML = '';
    if (!window.isSpectator && user) {
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
}

function setMessage(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.innerText = msg;
}

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
  remainingTime = Math.min(sec || 25, 60);
  updateTimerDisplay();
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
  const t = (userTimeLimit <= 10) ? 3 : 5;
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
  if (isGameOver || pendingDobonData || window.isSpectator) return;
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

      if (card.val === 8) {
        const sf = document.getElementById('suit-select-floating');
        if (sf) sf.style.display = 'block';
        return;
      }

      if (window.isOnlineMatch && typeof window.sendOnlinePlayCard === 'function') {
        window.sendOnlinePlayCard(card, null, players[0].hand.length);
      }

      postCardPlayEffect(card, players[0]);
    });
  } else {
    if (chomboMode === 'strict') commitChombo(players[0], `Cannot play (${card.suit}${card.label})`);
    else setMessage('Cannot play this card');
  }
}

function selectSuit(suit) {
  designatedSuit = suit;
  const sf = document.getElementById('suit-select-floating');
  if (sf) sf.style.display = 'none';
  setMessage(I18N[currentLang].suitChanged.replace('{suit}', suit));

  if (window.isOnlineMatch && typeof window.sendOnlinePlayCard === 'function') {
    window.sendOnlinePlayCard(
      { val: 8, label: '8', suit: suit, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' },
      suit,
      players[0].hand.length
    );
  }

  postCardPlayEffect({ val: 8, label: '8', suit }, players[0]);
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

  if (window.isOnlineMatch) return;

  if (card.val === 1) setMessage('Skip (A)');
  if (checkCpuInterrupts(card.val, player.id)) return;
  passTurn(skipCount);
}

function showDrawAlertBanner(text) {
  const b = document.getElementById('draw-alert-banner');
  if (b) {
    b.innerText = text;
    b.style.display = 'block';
  }
}
function hideDrawAlertBanner() {
  const b = document.getElementById('draw-alert-banner');
  if (b) b.style.display = 'none';
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
    if (window.isOnlineMatch) {
      setMessage(`${players[turnIndex].name} ${I18N[currentLang].opponentThinking}`);
    } else {
      setMessage(`${players[turnIndex].name} ${I18N[currentLang].cpuThinking}`);
      const delay = pendingLastCheck ? 5200 : Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
      setTimeout(cpuTurn, delay);
    }
  }
}

function scheduleCpuTurn() {
  if (window.isOnlineMatch) return;
  const delay = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
  setTimeout(cpuTurn, delay);
}

// 【修正】山札クリック検知：カードサイズいっぱいに反応
function onDeckClick() {
  if (turnIndex !== 0 || isGameOver || pendingDobonData || window.isSpectator) return;
  stopTimer();

  if (players[0].declaredLast) {
    players[0].declaredLast = false;
    const lBtn = document.getElementById('last-btn');
    if (lBtn) lBtn.classList.remove('active', 'urgent');
    setMessage(I18N[currentLang].lastCanceled);
  }
  pendingLastCheck = false;

  playDrawAnimation(0, () => {
    if (window.isOnlineMatch && typeof window.sendOnlineDrawCard === 'function') {
      window.sendOnlineDrawCard(drawTwoStack > 0 ? drawTwoStack : 1);
      return;
    }

    if (drawTwoStack > 0) {
      for (let i = 0; i < drawTwoStack; i++) drawCard(players[0]);
      setMessage(I18N[currentLang].drewCards.replace('{count}', drawTwoStack));
      drawTwoStack = 0;
      hideDrawAlertBanner();
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
  if (btn) {
    btn.classList.toggle('active', players[0].declaredLast);
    btn.classList.remove('urgent');
  }

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
  if (isGameOver || pendingDobonData || window.isSpectator) return;
  activeNakiType = type; selectedIndices = [];
  const pBtn = document.getElementById('pon-btn');
  const kBtn = document.getElementById('kan-btn');
  const cBtn = document.getElementById('confirm-naki-btn');
  if (pBtn) pBtn.classList.toggle('active', type === 2);
  if (kBtn) kBtn.classList.toggle('active', type === 3);
  if (cBtn) cBtn.style.display = 'block';

  triggerFlash();

  if (window.isOnlineMatch && typeof window.sendPauseForNaki === 'function') {
    window.sendPauseForNaki(type === 2 ? 'PON' : 'KAN');
  }

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

  if (window.isOnlineMatch && typeof window.sendResumeFromNaki === 'function') {
    window.sendResumeFromNaki();
  }

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

  if (window.isOnlineMatch && typeof window.sendResumeFromNaki === 'function') {
    window.sendResumeFromNaki();
  }

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
  isGameOver = true; stopTimer(); clearDobonStandby(); hideDrawAlertBanner();

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

  if (window.isOnlineMatch && typeof window.sendDobonDeclared === 'function') {
    window.sendDobonDeclared(winner.seatIndex, loser.seatIndex, isKan ? 'KAN-DOBON' : 'PON-DOBON', points, loserCount);
  }

  showOutcomeBanner(winner.id === 0);
  showResultModal(title, `<b>${winner.name}</b> の【${isKan ? 'KAN-DOBON' : 'PON-DOBON'}】！<br><br>勝者: <b>${winner.name} (+${points}pt)</b><br>放銃者: <b style="color:#e74c3c;">${loser.name} (-${points}pt)</b><br>(${loser.name} 手札換算: ${loserCount}枚)<br><br>※他プレイヤーは点数変動なし`);
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
  if (!window.isOnlineMatch) {
    if (checkCpuInterrupts(lastActionDiscard.totalVal, player.id)) return;
  }
  passTurn(skips);
}

function triggerUserDobon() {
  if (isGameOver || window.isSpectator) return;
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

  if (!window.isOnlineMatch && loser.id !== 0 && loser.hand.length >= 2) {
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
  hideDrawAlertBanner();

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

  if (window.isOnlineMatch && typeof window.sendDobonDeclared === 'function') {
    window.sendDobonDeclared(winner.seatIndex, loser.seatIndex, 'DOBON', points, loserCount);
  }

  showOutcomeBanner(winner.id === 0);
  showResultModal(`${winner.name} DOBON WIN!`, `<b>${winner.name}</b> の【DOBON】！<br><br>勝者: <b>${winner.name} (+${points}pt)</b><br>放銃者: <b style="color:#e74c3c;">${loser.name} (-${points}pt)</b><br>(${loser.name} 手札換算: ${loserCount}枚)<br><br>※他プレイヤーは点数変動なし`);
  pendingDobonData = null;
}

function executeDobonGaeshiWin(winner, loser) {
  isGameOver = true;
  hideDrawAlertBanner();
  const points = 20 * roundMultiplier;

  const deltas = players.map(p => (p.id === winner.id ? points : (p.id === loser.id ? -points : 0)));
  winner.score += points; loser.score -= points;

  recordRoundHistory('DOBON-GAESHI', deltas);
  roundMultiplier = 1; nextRoundStarter = winner.id;
  updateUI();

  if (window.isOnlineMatch && typeof window.sendDobonDeclared === 'function') {
    window.sendDobonDeclared(winner.seatIndex, loser.seatIndex, 'DOBON-GAESHI', points, null);
  }

  showOutcomeBanner(winner.id === 0);
  showResultModal(`DOBON-GAESHI! (カウンター成立)`, `<b>${winner.name}</b> の【DOBON-GAESHI】！<br><br>勝者: <b>${winner.name} (+${points}pt)</b><br>放銃者: <b style="color:#e74c3c;">${loser.name} (-${points}pt)</b><br><br>※他プレイヤーは点数変動なし`);
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
  isGameOver = true; stopTimer(); clearDobonStandby(); hideDrawAlertBanner();
  let totalWin = 0;
  const deltas = new Array(players.length).fill(0);
  let detailHtml = `<b>${winner.name} NORMAL WIN!</b><br><br>`;

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

function commitChombo(offender, reason) {
  isGameOver = true; stopTimer(); clearDobonStandby(); hideDrawAlertBanner();
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
  drawTwoStack = 0;
  const ds = document.getElementById('draw-stack');
  if (ds) ds.innerText = '0';
  const md = document.getElementById('multiplier-display');
  if (md) md.innerText = roundMultiplier + 'x';
  updateUI();

  if (window.isOnlineMatch && typeof window.sendChomboOccurred === 'function') {
    window.sendChomboOccurred(offender.seatIndex !== undefined ? offender.seatIndex : 0, reason);
  }

  showChomboDoubleBanner(offender.name, roundMultiplier);
  showResultModal('CHOMBO / FOUL', `<b>違反者: ${offender.name} (-${totalFine}pt)</b><br>${reason}<br><br><span style="color:#ff6b81; font-weight:bold;">※勝者なし・全員に点数支払い ＆ 次回得点倍率は ${roundMultiplier}x に倍々累積！</span>`);
}

function checkTenho() {
  const targetVal = discardHistory[0].val;
  for (let p of players) {
    if (p.bannedFromWin) continue;
    if (p.hand.reduce((s, c) => s + (c ? c.val : 0), 0) === targetVal) {
      isGameOver = true; stopTimer(); hideDrawAlertBanner();
      const pts = 20 * roundMultiplier;
      const deltas = new Array(players.length).fill(0);
      players.forEach(o => {
        if (o.id !== p.id) { o.score -= pts; deltas[o.id] = -pts; }
      });
      const winPts = pts * (players.length - 1);
      p.score += winPts; deltas[p.id] = winPts;
      recordRoundHistory('TENHO', deltas);
      nextRoundStarter = p.id;
      updateUI();
      showOutcomeBanner(p.id === 0);
      showResultModal('TENHO DOBON!', `<b>${p.name}: +${winPts}pt</b>`);
      return;
    }
  }
}

function cpuTurn() {
  if (isGameOver || turnIndex === 0 || pendingDobonData || window.isOnlineMatch) return;
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
      hideDrawAlertBanner();
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
  if (isGameOver || pendingDobonData || window.isOnlineMatch) return false;

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
  if (!container) return;
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
  const hm = document.getElementById('history-modal');
  if (hm) hm.style.display = 'flex';
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
  const hm = document.getElementById('history-modal');
  if (hm) hm.style.display = 'none';
}

function showResultModal(title, html) {
  const rt = document.getElementById('result-title');
  if (rt) rt.innerText = title;
  const rd = document.getElementById('result-detail');
  if (rd) rd.innerHTML = html;
  const rm = document.getElementById('result-modal');
  if (rm) rm.style.display = 'flex';
  const mb = document.getElementById('minimized-restore-bar');
  if (mb) mb.style.display = 'none';
}

function toggleMinimizeResult() {
  const m = document.getElementById('result-modal');
  const b = document.getElementById('minimized-restore-bar');
  if (!m || !b) return;
  if (m.style.display === 'none') {
    m.style.display = 'flex'; b.style.display = 'none';
  } else {
    m.style.display = 'none'; b.style.display = 'block';
  }
}

function nextRound() {
  stopConfetti();
  hideOutcomeBanner();
  
  const rm = document.getElementById('result-modal');
  if (rm) rm.style.display = 'none';
  const cm = document.getElementById('championship-modal');
  if (cm) cm.style.display = 'none';
  const mb = document.getElementById('minimized-restore-bar');
  if (mb) mb.style.display = 'none';

  // 10ラウンドごとのチャンピオンシップ判定を挟むかどうかのチェック
  if (currentRound > 0 && currentRound % 10 === 0) {
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

  const cr = document.getElementById('champ-rankings');
  if (cr) cr.innerHTML = html;
  const cm = document.getElementById('championship-modal');
  if (cm) cm.style.display = 'flex';
}

function continueChampionship() {
  const cm = document.getElementById('championship-modal');
  if (cm) cm.style.display = 'none';
  currentRound++;
  startRound();
}

function resetChampionship() {
  const cm = document.getElementById('championship-modal');
  if (cm) cm.style.display = 'none';
  players.forEach(p => { p.score = 0; p.bannedFromWin = false; });
  currentRound = 1;
  currentSet = getNextSessionNumber();
  startRound();
}
