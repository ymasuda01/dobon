// DOBON MASTER - Las Vegas VIP Lounge Engine (Tournament Edition)

const I18N = {
  ja: {
    ready: '準備完了', yourTurn: 'あなたの番です', cpuThinking: '思考中...',
    dirCCW: '反時計回り', dirCW: '時計回り', chooseSuit: '指定マークを選択',
    lblPlayers: '参加人数:', lblChombo: '判定モード:', lblTimer: '制限時間:',
    chomboWrongLast: '手札が3枚以上あるのに「LAST」状態でカードを出しました（チョンボ）',
    chomboMissLast: '「LAST」未宣言のまま次のプレイヤーの手番に進みました（チョンボ）',
    timeoutMsg: '制限時間以内に行動しませんでした（時間切れチョンボ）',
    skipChomboPrompt: '上がり禁止ペナルティを解除しました (-10pt)',
    savedMsg: 'ゲーム状態を保存しました。',
    nakiFailed: 'を宣言しましたがカードを揃えられませんでした（チョンボ）',
    suitChanged: 'マークを {suit} に指定しました',
    drewCards: '累積 {count}枚 を引きました', drewOne: '山札から1枚引きました',
    lastCanceled: '山札を引いたため、ラスト宣言が解除されました',
    lastStandby: '「LAST」スタンバイ中', lastReset: '「LAST」を解除しました',
    ponKanSelect: 'カードを選んでCONFIRMを押してください'
  },
  en: {
    ready: 'READY', yourTurn: 'Your Turn', cpuThinking: 'Thinking...',
    dirCCW: 'Counter-Clockwise', dirCW: 'Clockwise', chooseSuit: 'SELECT SUIT',
    lblPlayers: 'PLAYERS:', lblChombo: 'RULE MODE:', lblTimer: 'TIME LIMIT:',
    chomboWrongLast: 'Played while LAST was active with 3 or more cards (Chombo)',
    chomboMissLast: 'Failed to declare LAST before next player moved (Chombo)',
    timeoutMsg: 'Did not play within time limit (Timeout Chombo)',
    skipChomboPrompt: 'Lifted win-ban penalty (-10pt applied)',
    savedMsg: 'Game progress has been saved.',
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

let numPlayers = 4, chomboMode = 'strict', userTimeLimit = 10;
let players = [], deck = [], discardHistory = [], lastActionDiscard = null;
let turnIndex = 0, direction = -1, currentRound = 1, currentSet = 1;
let roundMultiplier = 1, drawTwoStack = 0, designatedSuit = null;
let isGameOver = false, turnTimer = null, remainingTime = 0;
let setScoreHistory = [];
let activeNakiType = null, selectedIndices = [], nextRoundStarter = 0;
let pendingLastCheck = false;

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

// 画面演出
function triggerFlash() {
  const f = document.getElementById('flash-overlay');
  if (!f) return;
  f.classList.add('active');
  setTimeout(() => f.classList.remove('active'), 80);
}

function setBodyMood(mood) {
  document.body.classList.remove('mood-defeat', 'mood-disaster');
  if (mood) document.body.classList.add(mood);
}

// 噴水キャノン型コンフェッティ物理シミュレーション
let confettiAnimId = null;
function startFountainConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colors = ['#f5cd79', '#ffd700', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#ffffff'];

  // 中央下部から上空へ吹き出す粒子
  for (let i = 0; i < 140; i++) {
    const angle = (Math.random() * 70 + 55) * (Math.PI / 180); // 55〜125度（上方向）
    const speed = Math.random() * 12 + 10;
    particles.push({
      x: canvas.width / 2 + (Math.random() * 40 - 20),
      y: canvas.height * 0.65,
      vx: Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1) * speed * 0.7,
      vy: -Math.sin(angle) * speed,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: Math.random() * 10 - 5,
      gravity: 0.32
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    confettiAnimId = requestAnimationFrame(render);
  }
  cancelAnimationFrame(confettiAnimId);
  render();
}

function stopConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  cancelAnimationFrame(confettiAnimId);
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
  }
  const banner = document.getElementById('winner-jackpot-banner');
  if (banner) banner.classList.remove('show');
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
  document.getElementById('lbl-players').innerText = I18N[currentLang].lblPlayers;
  document.getElementById('lbl-chombo').innerText = I18N[currentLang].lblChombo;
  document.getElementById('lbl-timer').innerText = I18N[currentLang].lblTimer;
  updateUI();
}

// 永続保存・再開・終了
function suspendGame() {
  const save = {
    numPlayers, chomboMode, userTimeLimit, currentRound, currentSet, roundMultiplier,
    direction, turnIndex, drawTwoStack, designatedSuit, players, deck, discardHistory,
    lastActionDiscard, setScoreHistory, nextRoundStarter
  };
  localStorage.setItem('dobon_save_data', JSON.stringify(save));
  alert(I18N[currentLang].savedMsg);
}

function quitToTitle() {
  if (confirm(currentLang === 'ja' ? '対局を終了してタイトルへ戻りますか？（履歴は保存され次回0点スタート）' : 'Quit to title? (History is saved, next game starts at 0pt)')) {
    stopTimer(); isGameOver = true;
    localStorage.setItem('dobon_permanent_history', JSON.stringify(setScoreHistory));
    localStorage.removeItem('dobon_save_data');
    document.getElementById('result-modal').style.display = 'none';
    document.getElementById('championship-modal').style.display = 'none';
    document.getElementById('start-modal').style.display = 'flex';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const savedHistory = localStorage.getItem('dobon_permanent_history');
  if (savedHistory) setScoreHistory = JSON.parse(savedHistory);
  if (localStorage.getItem('dobon_save_data')) {
    document.getElementById('resume-btn').style.display = 'block';
  }
});

function resumeGame() {
  const raw = localStorage.getItem('dobon_save_data');
  if (!raw) return;
  const s = JSON.parse(raw);
  numPlayers = s.numPlayers; chomboMode = s.chomboMode; userTimeLimit = s.userTimeLimit;
  currentRound = s.currentRound; currentSet = s.currentSet || 1; roundMultiplier = s.roundMultiplier;
  direction = s.direction; turnIndex = s.turnIndex; drawTwoStack = s.drawTwoStack;
  designatedSuit = s.designatedSuit; players = s.players; deck = s.deck;
  discardHistory = s.discardHistory; lastActionDiscard = s.lastActionDiscard;
  setScoreHistory = s.setScoreHistory || []; nextRoundStarter = s.nextRoundStarter;

  document.getElementById('start-modal').style.display = 'none';
  isGameOver = false; updateUI(); setMessage(I18N[currentLang].ready);
  if (turnIndex === 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
  else scheduleCpuTurn();
}

function startGame(isResume = false) {
  if (isResume) return;
  numPlayers = parseInt(document.getElementById('player-count-select').value);
  chomboMode = document.getElementById('chombo-mode-select').value;
  userTimeLimit = parseInt(document.getElementById('timer-mode-select').value);
  document.getElementById('start-modal').style.display = 'none';

  players = [];
  currentRound = 1; currentSet = 1;

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

function startRound() {
  isGameOver = false; stopTimer(); stopConfetti(); setBodyMood(null);
  createDeck52(); discardHistory = []; drawTwoStack = 0; designatedSuit = null;
  direction = -1; selectedIndices = []; cancelNakiMode(); pendingLastCheck = false;

  document.getElementById('last-btn').classList.remove('active', 'urgent');
  document.getElementById('result-modal').style.display = 'none';
  document.getElementById('championship-modal').style.display = 'none';
  document.getElementById('minimized-restore-bar').style.display = 'none';
  document.getElementById('suit-select-floating').style.display = 'none';
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
  setMessage(`${players[turnIndex].name} Turn`);

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

// 本物のBicycleトランプ準拠のPip配置（5や9なども正確に配置）
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
  
  // 8特大マーク表示（手前HUD）
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

  // 相手CPU立ち上げ配置
  const arcContainer = document.getElementById('cpu-arc-container');
  if (arcContainer) {
    arcContainer.innerHTML = '';
    const cpuCount = players.length - 1;

    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      const seat = document.createElement('div');
      seat.className = `cpu-seat ${turnIndex === i ? 'active' : ''}`;
      const arcPos = (i - 1) - (cpuCount - 1) / 2;
      seat.style.transform = `translateY(${Math.abs(arcPos) * 12}px)`;

      let fanHtml = '<div class="cpu-fan-cards">';
      if (isGameOver) {
        p.hand.forEach((c, cIdx) => {
          fanHtml += `<div style="position:absolute; left:${cIdx * 18}px; transform:scale(0.42); transform-origin:top left;">${renderCardHtml(c)}</div>`;
        });
      } else {
        const showCount = Math.min(p.hand.length, 7);
        for (let c = 0; c < showCount; c++) {
          const rot = (c - (showCount - 1) / 2) * 12;
          const xOff = (c - (showCount - 1) / 2) * 6;
          fanHtml += `<div class="cpu-fan-card" style="transform: translate(${xOff}px, 0) rotate(${rot}deg);"></div>`;
        }
      }
      fanHtml += `<img class="cpu-hand-img" src="opponent.png" alt="" onerror="this.style.display='none'"></div>`;

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

  // ドボンボタンの手動発動インジケータ（自動では絶対に上がらない！）
  const user = players[0];
  const mySum = user ? user.hand.reduce((s, c) => s + c.val, 0) : 0;
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;
  const dobonBtn = document.getElementById('dobon-btn');
  if (dobonBtn) {
    if (!isGameOver && targetVal !== null && mySum === targetVal && user && user.hand.length > 0 && !user.bannedFromWin) {
      dobonBtn.classList.add('ready'); // 金色に脈動
    } else {
      dobonBtn.classList.remove('ready');
    }
  }

  // ラスト事後猶予のアラート演出
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

  // ユーザー手札展開（8枚超えで前列・後列の2段化）
  const userFanBox = document.getElementById('user-fan');
  if (userFanBox && user) {
    userFanBox.innerHTML = '';
    const total = user.hand.length;
    const isTwoRows = total > 8;

    user.hand.forEach((card, idx) => {
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

      const angleStep = Math.min(28 / Math.max(countInRow - 1, 1), 6);
      const xStep = Math.min(270 / Math.max(countInRow, 1), 38);
      const angle = (indexInRow - (countInRow - 1) / 2) * angleStep;
      const xOffset = (indexInRow - (countInRow - 1) / 2) * xStep;
      const yOffset = Math.abs(angle) * 0.7;

      const cardEl = document.createElement('div');
      cardEl.className = `fan-card ${rowClass} ${isSelected ? 'selected' : ''}`;
      const lift = isSelected ? -30 : 0;
      cardEl.style.transform = `translate(${xOffset}px, ${yOffset + lift}px) rotate(${angle}deg)`;
      cardEl.style.zIndex = isSelected ? 90 : (rowClass === 'row-back' ? 30 + idx : 45 + idx);
      cardEl.innerHTML = renderCardHtml(card);
      cardEl.onclick = () => onCardClick(idx);
      userFanBox.appendChild(cardEl);
    });
  }
}

function setMessage(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.innerText = msg;
}

// 打牌アニメーション
function playCardWithHandAnimation(playerId, card, callback) {
  const unit = document.getElementById('flying-play-unit');
  const cardSlot = document.getElementById('flying-card-slot');
  const handImg = document.getElementById('flying-hand-img');
  if (!unit || !cardSlot || !handImg) { if (callback) callback(); return; }

  cardSlot.innerHTML = renderCardHtml(card);
  unit.style.display = 'block'; unit.style.opacity = '1';

  let sX = window.innerWidth / 2, sY = window.innerHeight * 0.82;
  let eX = window.innerWidth / 2, eY = window.innerHeight * 0.44;

  if (playerId === 0) {
    handImg.style.transform = 'scaleX(-1) rotate(-15deg)';
    unit.style.transform = `translate(${sX - 90}px, ${sY - 90}px) scale(1)`;
    setTimeout(() => { unit.style.transform = `translate(${eX - 90}px, ${eY - 90}px) scale(0.9)`; }, 20);
  } else {
    handImg.style.transform = 'rotate(180deg)';
    const seats = document.querySelectorAll('.cpu-seat');
    const tSeat = seats[playerId - 1];
    if (tSeat) {
      const r = tSeat.getBoundingClientRect();
      sX = r.left + r.width / 2; sY = r.top + r.height / 2;
    }
    unit.style.transform = `translate(${sX - 90}px, ${sY - 90}px) scale(0.7)`;
    setTimeout(() => { unit.style.transform = `translate(${eX - 90}px, ${eY - 90}px) scale(0.9)`; }, 20);
  }

  setTimeout(() => {
    playCardSnapSound();
    unit.style.opacity = '0';
    setTimeout(() => { unit.style.display = 'none'; if (callback) callback(); }, 120);
  }, 360);
}

// ドローアニメーション
function playDrawAnimation(playerId, callback) {
  const c = document.getElementById('flying-draw-card');
  if (!c) { if (callback) callback(); return; }
  c.style.display = 'block';
  const dX = window.innerWidth / 2 - 60, dY = window.innerHeight * 0.44;
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
  const b = document.getElementById('timer-badge-heartbeat');
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
  const b = document.getElementById('timer-badge-heartbeat');
  if (b) {
    if (remainingTime <= t) b.classList.add('urgent');
    else b.classList.remove('urgent');
  }
}

function handleUserTimeout() {
  commitChombo(players[0], I18N[currentLang].timeoutMsg);
}

function onCardClick(index) {
  if (isGameOver) return;
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

  // ★ラスト判定バグ修正★
  // 手札が3枚以上あるのにLASTが点灯したまま出したらチョンボ
  if (players[0].declaredLast && players[0].hand.length >= 3) {
    commitChombo(players[0], I18N[currentLang].chomboWrongLast); return;
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

    // 手札2枚から出して残り1枚になる瞬間
    if (players[0].hand.length === 2) {
      if (players[0].declaredLast) {
        speakVoice(currentLang === 'ja' ? 'ラスト！' : 'Last!');
      } else {
        // 事前未宣言の場合：事後猶予フラグをON
        pendingLastCheck = true;
      }
    }

    playCardWithHandAnimation(0, card, () => {
      players[0].hand.splice(index, 1);
      discardHistory.push(card);
      selectedIndices = []; designatedSuit = null;
      lastActionDiscard = { cards: [card], totalVal: card.val, playerId: 0 };

      if (card.val === 8) {
        document.getElementById('suit-select-floating').style.display = 'block';
        return;
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
  document.getElementById('suit-select-floating').style.display = 'none';
  setMessage(I18N[currentLang].suitChanged.replace('{suit}', suit));
  postCardPlayEffect({ val: 8, label: '8', suit }, players[0]);
}

function postCardPlayEffect(card, player) {
  updateUI();

  // ★通常上がり判定★
  if (player.hand.length === 0) {
    if (player.bannedFromWin) {
      commitChombo(player, 'Attempted to win while win-banned'); return;
    }
    // 手札1枚からラスト点灯のまま最後のカードを出してゲームセット（完全勝利！）
    endRoundNormalWin(player); return;
  }

  let skipCount = 0;
  if (card.val === 2) {
    drawTwoStack += 2;
    showDrawAlertBanner(`+${drawTwoStack} DRAW`);
  } else if (card.val === 9) {
    direction *= -1; setMessage('Reverse (9)');
  } else if (card.val === 1) {
    skipCount = 1; setMessage('Skip (A)');
  }

  checkCpuInterrupts(card.val, player.id);
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
    // プレイヤーが事後猶予中の場合は必ず5秒以上の猶予を与える
    const delay = pendingLastCheck ? 5200 : Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
    setTimeout(cpuTurn, delay);
  }
}

function scheduleCpuTurn() {
  const delay = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
  setTimeout(cpuTurn, delay);
}

function onDeckClick() {
  if (turnIndex !== 0 || isGameOver) return;
  stopTimer();

  // 引いた場合は自動でLAST解除
  if (players[0].declaredLast) {
    players[0].declaredLast = false;
    document.getElementById('last-btn').classList.remove('active', 'urgent');
    setMessage(I18N[currentLang].lastCanceled);
  }
  pendingLastCheck = false;

  playDrawAnimation(0, () => {
    if (drawTwoStack > 0) {
      for (let i = 0; i < drawTwoStack; i++) drawCard(players[0]);
      setMessage(I18N[currentLang].drewCards.replace('{count}', drawTwoStack));
      drawTwoStack = 0;
    } else {
      drawCard(players[0]);
      setMessage(I18N[currentLang].drewOne);
    }
    selectedIndices = []; updateUI(); passTurn(0);
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

// LASTボタン（トグル・事後猶予セーフ）
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

// ポン・カン
function startNakiMode(type) {
  if (isGameOver) return;
  activeNakiType = type; selectedIndices = [];
  document.getElementById('pon-btn').classList.toggle('active', type === 2);
  document.getElementById('kan-btn').classList.toggle('active', type === 3);
  document.getElementById('confirm-naki-btn').style.display = 'block';

  triggerFlash(); // 全体ホワイトフラッシュ演出

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

  if (turnIndex === 0) speakVoice(req === 2 ? (currentLang === 'ja' ? 'ポン！' : 'Pon!') : (currentLang === 'ja' ? 'カン！' : 'Kan!'));

  selectedIndices.sort((a, b) => b - a).forEach(idx => players[0].hand.splice(idx, 1));
  cards.forEach(c => discardHistory.push(c));

  const isKan = (req === 3);
  lastActionDiscard = {
    cards, totalVal: cards.length * val, playerId: 0,
    isPon: !isKan, isKan, baseVal: val
  };

  cancelNakiMode();
  handlePonKanEffects(cards, players[0]);
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
  checkCpuInterrupts(lastActionDiscard.totalVal, player.id);
  passTurn(skips);
}

// ドボン（完全手動：ボタンを押して初めて発動）
function triggerUserDobon() {
  if (isGameOver) return;
  const user = players[0];
  speakVoice(currentLang === 'ja' ? 'ドボン！' : 'Dobon!');

  if (user.bannedFromWin) {
    commitChombo(user, 'Attempted Dobon while win-banned'); return;
  }

  const mySum = user.hand.reduce((s, c) => s + c.val, 0);
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;

  if (targetVal !== null && mySum === targetVal && user.hand.length > 0) {
    stopTimer(); executeDobonWin(user, lastActionDiscard);
  } else {
    commitChombo(user, `Hand sum (${mySum}) does not match discard (${targetVal})`);
  }
}

function executeDobonWin(winner, actionDiscard) {
  isGameOver = true; stopTimer();
  const loser = players[actionDiscard.playerId] || players[(winner.id - direction + numPlayers) % numPlayers];
  if (actionDiscard.cards) actionDiscard.cards.forEach(c => loser.hand.push(c));

  let points = 0;
  const loserCount = calculateSpecialHandCount(loser.hand);

  if (actionDiscard.cards.length === 1 && actionDiscard.cards[0].val === 2 && winner.hand.length === 2 && winner.hand.every(c => c.val === 1)) points = 20 * roundMultiplier;
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

  if (winner.id === 0) {
    document.getElementById('winner-jackpot-banner').classList.add('show');
    startFountainConfetti(); // 噴水キャノン紙吹雪
    setBodyMood(null);
  } else if (loser.id === 0) {
    setBodyMood('mood-disaster'); // 被ドボンで激震・彩度保持の不穏影
  } else {
    setBodyMood('mood-defeat');
  }

  showResultModal(`${winner.name} DOBON WIN!`, `<b>Winner: ${winner.name} (+${points}pt)</b><br>Target: ${loser.name} (-${points}pt)`);
}

function calculateSpecialHandCount(hand) {
  let count = 0, eightMult = 1;
  hand.forEach(c => {
    if (c.val === 2) count += 2;
    else count += 1;
    if (c.val === 8) eightMult *= 2;
  });
  return (count + drawTwoStack) * eightMult;
}

function endRoundNormalWin(winner) {
  isGameOver = true; stopTimer();
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

  if (winner.id === 0) {
    document.getElementById('winner-jackpot-banner').classList.add('show');
    startFountainConfetti();
    setBodyMood(null);
  } else {
    setBodyMood('mood-defeat');
  }

  showResultModal(`${winner.name} WIN!`, `${detailHtml}<b>Winner: +${totalWin}pt</b>`);
}

function commitChombo(offender, reason) {
  isGameOver = true; stopTimer();
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
  roundMultiplier *= 2; nextRoundStarter = offender.id;
  updateUI();

  if (offender.id === 0) setBodyMood('mood-disaster'); // 自分のチョンボで激震
  else setBodyMood('mood-defeat');

  showResultModal('CHOMBO!', `<b>Offender: ${offender.name} (-${totalFine}pt)</b><br>${reason}<br>* Multiplier: ${roundMultiplier}x`);
}

function checkTenho() {
  const targetVal = discardHistory[0].val;
  for (let p of players) {
    if (p.bannedFromWin) continue;
    if (p.hand.reduce((s, c) => s + c.val, 0) === targetVal) {
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
      if (p.id === 0) {
        document.getElementById('winner-jackpot-banner').classList.add('show');
        startFountainConfetti();
      }
      showResultModal('TENHO DOBON!', `<b>${p.name}: +${winPts}pt</b>`);
      return;
    }
  }
}

function cpuTurn() {
  if (isGameOver || turnIndex === 0) return;
  const cpu = players[turnIndex];
  const top = discardHistory[discardHistory.length - 1];

  // 次のCPUが行動を開始した時点で、プレイヤーが事後猶予中にLASTを押していなかったらチョンボ！
  if (pendingLastCheck && !players[0].declaredLast) {
    pendingLastCheck = false;
    commitChombo(players[0], I18N[currentLang].chomboMissLast);
    return;
  }
  pendingLastCheck = false;

  if (cpu.hand.length <= 2 && !cpu.declaredLast) cpu.declaredLast = true;

  if (drawTwoStack > 0) {
    const idx2 = cpu.hand.findIndex(c => c.val === 2);
    if (idx2 > -1) {
      const pl = cpu.hand[idx2];
      playCardWithHandAnimation(cpu.id, pl, () => {
        cpu.hand.splice(idx2, 1);
        discardHistory.push(pl);
        lastActionDiscard = { cards: [pl], totalVal: 2, playerId: cpu.id };
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
          updateUI(); passTurn(0);
        }
      };
      drawStep();
      return;
    }
  }

  const playable = [];
  cpu.hand.forEach((c, idx) => {
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

      if (pl.val === 8) {
        const counts = {};
        cpu.hand.forEach(c => counts[c.suit] = (counts[c.suit] || 0) + 1);
        designatedSuit = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '♠';
      }
      postCardPlayEffect(pl, cpu);
    });
  } else {
    playDrawAnimation(cpu.id, () => {
      drawCard(cpu);
      if (cpu.declaredLast) cpu.declaredLast = false;
      updateUI(); passTurn(0);
    });
  }
}

function checkCpuInterrupts(targetVal, playedPlayerId) {
  if (isGameOver) return;
  for (let p of players) {
    if (p.id === playedPlayerId || p.bannedFromWin) continue;
    if (p.hand.reduce((s, c) => s + c.val, 0) === targetVal && p.hand.length > 0) {
      setTimeout(() => {
        if (!isGameOver) {
          speakVoice(currentLang === 'ja' ? 'ドボン！' : 'Dobon!');
          executeDobonWin(p, lastActionDiscard);
        }
      }, 500);
      return;
    }
  }
}

// 履歴管理（アコーディオン式セット集計・localStorage永続保存）
function recordRoundHistory(type, deltas) {
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
    container.innerHTML = '<div style="font-size:12px; padding:10px; color:#aaa;">No history recorded yet.</div>';
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
            <span>SET ${sObj.set} (R${(sObj.set - 1) * 10 + 1} - R${(sObj.set - 1) * 10 + sObj.rounds.length}) | 🏆 ${champName}</span>
            <span id="acc-arrow-${sIdx}">▼</span>
          </div>
          <div class="accordion-content">
            <div style="font-size:10px; margin-bottom:5px; color:var(--gold);">Set Total: ${players.map((p, i) => `${p.name}: ${totals[i]}pt`).join(' | ')}</div>
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

// WIN画面・最小化切り替え
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

// 10回ごとの大会結果発表
function nextRound() {
  stopConfetti(); setBodyMood(null);
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
  currentSet++;
  startRound();
}

function resetChampionship() {
  document.getElementById('championship-modal').style.display = 'none';
  players.forEach(p => { p.score = 0; p.bannedFromWin = false; });
  currentRound = 1;
  currentSet++;
  startRound();
}
