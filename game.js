// DOBON MASTER - Core Game Engine & Audio & Animation

const I18N = {
  ja: {
    ready: '準備完了',
    yourTurn: 'あなたの番です',
    cpuThinking: '思考中...',
    dirCCW: '反時計回り',
    dirCW: '時計回り',
    chooseSuit: '指定するマークを選択',
    lblPlayers: '参加人数:',
    lblChombo: '判定モード:',
    lblTimer: '制限時間:',
    chomboWrongLast: '手札が2枚ではないのに「LAST」状態でカードを出しました（チョンボ）',
    chomboMissLast: '手札が残り1枚になる際に「LAST」を宣言しませんでした（チョンボ）',
    timeoutMsg: '制限時間以内に行動しませんでした（時間切れチョンボ）',
    skipChomboPrompt: '上がり禁止ペナルティを解除しました (-10pt)',
    savedMsg: 'ゲーム状態を保存しました。',
    nakiFailed: 'を宣言しましたがカードを揃えられませんでした（チョンボ）',
    suitChanged: 'マークを {suit} に指定しました',
    drewCards: '累積 {count}枚 を引きました',
    drewOne: '山札から1枚引きました',
    lastCanceled: '山札を引いたため、ラスト宣言が解除されました',
    lastStandby: '「LAST」スタンバイ中（カードを出した瞬間に発声）',
    lastReset: '「LAST」を解除しました',
    ponKanSelect: 'カードを選んでCONFIRMを押してください'
  },
  en: {
    ready: 'READY',
    yourTurn: 'Your Turn',
    cpuThinking: 'Thinking...',
    dirCCW: 'Counter-Clockwise',
    dirCW: 'Clockwise',
    chooseSuit: 'SELECT SUIT',
    lblPlayers: 'PLAYERS:',
    lblChombo: 'RULE MODE:',
    lblTimer: 'TIME LIMIT:',
    chomboWrongLast: 'Played while LAST was active with invalid hand count (Chombo)',
    chomboMissLast: 'Failed to call LAST before reaching 1 card (Chombo)',
    timeoutMsg: 'Did not play within time limit (Timeout Chombo)',
    skipChomboPrompt: 'Lifted win-ban penalty (-10pt applied)',
    savedMsg: 'Game progress has been saved.',
    nakiFailed: 'called but failed to produce cards (Chombo)',
    suitChanged: 'Suit changed to {suit}',
    drewCards: 'Drew {count} stacked cards',
    drewOne: 'Drew 1 card from deck',
    lastCanceled: 'Drew from deck: LAST declaration reset',
    lastStandby: 'LAST armed (will call out upon playing card)',
    lastReset: 'LAST canceled',
    ponKanSelect: 'Select cards and press CONFIRM'
  }
};

let currentLang = 'ja';

// トランプ52枚デッキ設定
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

let numPlayers = 4;
let chomboMode = 'strict';
let userTimeLimit = 10;
let players = [];
let deck = [];
let discardHistory = [];
let lastActionDiscard = null;
let turnIndex = 0;
let direction = -1;
let currentRound = 1;
let roundMultiplier = 1;
let drawTwoStack = 0;
let designatedSuit = null;
let isGameOver = false;

let turnTimer = null;
let remainingTime = 0;
let scoreHistory = [];

let activeNakiType = null; // 2: pon, 3: kan
let selectedIndices = [];
let nextRoundStarter = 0;

// Web Audio API サウンドシステム
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// カードを置く音（パシッ）
function playCardSnapSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
}

// カードを配る音（シュッ）
function playDealSound() {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    whiteNoise.start();
  } catch (e) {}
}

// Web Speech API 音声合成
function speakVoice(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const uttr = new SpeechSynthesisUtterance(text);
  uttr.lang = currentLang === 'ja' ? 'ja-JP' : 'en-US';
  uttr.rate = 1.15;
  window.speechSynthesis.speak(uttr);
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

function suspendGame() {
  const saveData = {
    numPlayers, chomboMode, userTimeLimit, currentRound, roundMultiplier,
    direction, turnIndex, drawTwoStack, designatedSuit,
    players, deck, discardHistory, lastActionDiscard, scoreHistory, nextRoundStarter
  };
  localStorage.setItem('dobon_save_v5', JSON.stringify(saveData));
  alert(I18N[currentLang].savedMsg);
}

function quitToTitle() {
  if (confirm(currentLang === 'ja' ? '対局を終了してタイトル画面に戻りますか？' : 'Quit and return to title screen?')) {
    stopTimer();
    isGameOver = true;
    document.getElementById('result-modal').style.display = 'none';
    document.getElementById('championship-modal').style.display = 'none';
    document.getElementById('start-modal').style.display = 'flex';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('dobon_save_v5')) {
    document.getElementById('resume-btn').style.display = 'block';
  }
});

function resumeGame() {
  const raw = localStorage.getItem('dobon_save_v5');
  if (!raw) return;
  const s = JSON.parse(raw);
  numPlayers = s.numPlayers; chomboMode = s.chomboMode; userTimeLimit = s.userTimeLimit;
  currentRound = s.currentRound; roundMultiplier = s.roundMultiplier; direction = s.direction;
  turnIndex = s.turnIndex; drawTwoStack = s.drawTwoStack; designatedSuit = s.designatedSuit;
  players = s.players; deck = s.deck; discardHistory = s.discardHistory;
  lastActionDiscard = s.lastActionDiscard; scoreHistory = s.scoreHistory;
  nextRoundStarter = s.nextRoundStarter;

  document.getElementById('start-modal').style.display = 'none';
  isGameOver = false;
  updateUI();
  setMessage(I18N[currentLang].ready);
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
  scoreHistory = [];

  const maleSilhouette = `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  const femaleSilhouette = `<svg viewBox="0 0 24 24" width="28" height="28" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><circle cx="12" cy="7" r="1.5" fill="#333"/></svg>`;

  for (let i = 0; i < numPlayers; i++) {
    const isFemale = Math.random() > 0.5;
    players.push({
      id: i,
      name: i === 0 ? 'YOU' : `CPU ${i}`,
      silhouette: isFemale ? femaleSilhouette : maleSilhouette,
      hand: [], score: 0, bannedFromWin: false, declaredLast: false
    });
  }
  startRound();
}

function startRound() {
  isGameOver = false;
  stopTimer();
  createDeck52();
  discardHistory = [];
  drawTwoStack = 0;
  designatedSuit = null;
  direction = -1;
  selectedIndices = [];
  cancelNakiMode();
  document.getElementById('last-btn').classList.remove('active');
  document.getElementById('result-modal').style.display = 'none';
  document.getElementById('championship-modal').style.display = 'none';
  document.getElementById('round-num').innerText = currentRound;
  document.getElementById('multiplier-display').innerText = roundMultiplier + 'x';

  document.getElementById('skip-chombo-btn').style.display = players[0].bannedFromWin ? 'block' : 'none';

  // 配る音演出
  for (let i = 0; i < 5; i++) {
    setTimeout(playDealSound, i * 60);
  }

  for (let p of players) {
    p.hand = deck.splice(0, 5);
    p.declaredLast = false;
  }

  let initialCard = deck.pop();
  while (initialCard.val === 8 || initialCard.val === 2) {
    deck.unshift(initialCard);
    initialCard = deck.pop();
  }
  discardHistory.push(initialCard);
  lastActionDiscard = { cards: [initialCard], totalVal: initialCard.val, playerId: -1 };

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

function renderCardContent(card) {
  const key = `${card.suit}_${card.label}`;
  if (PHOTO_CARDS[key]) {
    return `<img class="card-face-photo" src="${PHOTO_CARDS[key]}" alt="${key}">`;
  }
  if (card.val === 1) return `<div class="pip-lg">${card.suit}</div>`;

  let pips = '';
  for (let i = 0; i < card.val; i++) {
    pips += `<span class="pip">${card.suit}</span>`;
  }
  let cols = card.val <= 3 ? '1fr' : (card.val <= 8 ? '1fr 1fr' : '1fr 1fr 1fr');
  return `<div class="pips-grid" style="grid-template-columns: ${cols};">${pips}</div>`;
}

function renderCardHtml(card, extraClass = '') {
  if (!card) return '';
  return `
    <div class="card ${card.color} ${extraClass}">
      <div class="idx-top">${card.label}<br>${card.suit}</div>
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        ${renderCardContent(card)}
      </div>
      <div class="idx-bottom">${card.label}<br>${card.suit}</div>
    </div>
  `;
}

function updateUI() {
  document.getElementById('dir-display').innerText = direction === -1 ? I18N[currentLang].dirCCW : I18N[currentLang].dirCW;
  
  const suitBadge = document.getElementById('target-suit-badge');
  if (designatedSuit) {
    suitBadge.style.display = 'inline';
    suitBadge.innerText = `[${designatedSuit}]`;
  } else {
    suitBadge.style.display = 'none';
  }

  document.getElementById('draw-stack').innerText = `${drawTwoStack}`;
  document.getElementById('deck-count').innerText = deck.length;

  const stackBox = document.getElementById('discard-stack-box');
  stackBox.innerHTML = '';
  const sliceCount = Math.min(discardHistory.length, 4);
  const visible = discardHistory.slice(-sliceCount);

  visible.forEach((c, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'discard-card-item';
    cardEl.style.left = `${idx * 26}px`;
    cardEl.style.zIndex = 5 + idx;
    cardEl.innerHTML = renderCardHtml(c);
    stackBox.appendChild(cardEl);
  });

  document.getElementById('discard-sum-val').innerText = lastActionDiscard ? lastActionDiscard.totalVal : 0;

  const arcContainer = document.getElementById('cpu-arc-container');
  arcContainer.innerHTML = '';
  const cpuCount = players.length - 1;

  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    const seat = document.createElement('div');
    seat.className = `cpu-seat ${turnIndex === i ? 'active' : ''}`;
    
    const arcPos = (i - 1) - (cpuCount - 1) / 2;
    const yOffset = Math.abs(arcPos) * 12;
    seat.style.transform = `translateY(${yOffset}px)`;

    let fanHtml = '<div class="cpu-fan-cards">';
    const count = Math.min(p.hand.length, 7);
    for (let c = 0; c < count; c++) {
      const rot = (c - (count - 1) / 2) * 12;
      const xOff = (c - (count - 1) / 2) * 6;
      fanHtml += `<div class="cpu-fan-card" style="transform: translate(${xOff}px, 0) rotate(${rot}deg);"></div>`;
    }
    fanHtml += `<img class="cpu-hand-img" src="opponent.png" alt="Hand"></div>`;

    seat.innerHTML = `
      <div class="cpu-silhouette">${p.silhouette}</div>
      ${fanHtml}
      <div class="cpu-info">
        <b>${p.name}</b> (${p.hand.length})<br>
        <span style="color:var(--gold);">${p.score}pt</span>
        ${p.declaredLast ? ' ★LAST' : ''}
      </div>
    `;
    arcContainer.appendChild(seat);
  }

  const user = players[0];
  document.getElementById('user-sum').innerText = user.hand.reduce((s, c) => s + c.val, 0);

  const userFanBox = document.getElementById('user-fan');
  userFanBox.innerHTML = '';
  const total = user.hand.length;
  const angleStep = Math.min(36 / Math.max(total - 1, 1), 8);
  const xStep = Math.min(270 / Math.max(total, 1), 38);

  user.hand.forEach((card, idx) => {
    const isSelected = selectedIndices.includes(idx);
    const angle = (idx - (total - 1) / 2) * angleStep;
    const xOffset = (idx - (total - 1) / 2) * xStep;
    const yOffset = Math.abs(angle) * 0.8;

    const cardEl = document.createElement('div');
    cardEl.className = `fan-card ${isSelected ? 'selected' : ''}`;
    const lift = isSelected ? -26 : 0;
    cardEl.style.transform = `translate(${xOffset}px, ${yOffset + lift}px) rotate(${angle}deg)`;
    cardEl.style.zIndex = isSelected ? 90 : 10 + idx;

    cardEl.innerHTML = renderCardHtml(card);
    cardEl.onclick = () => onCardClick(idx);
    userFanBox.appendChild(cardEl);
  });
}

function setMessage(msg) {
  document.getElementById('status-msg').innerText = msg;
}

// カードと手が一体で相手手札位置（または自分の手元）から中央へ飛ぶ演出
function playCardWithHandAnimation(playerId, card, callback) {
  const unit = document.getElementById('flying-play-unit');
  const cardSlot = document.getElementById('flying-card-slot');
  const handImg = document.getElementById('flying-hand-img');

  cardSlot.innerHTML = renderCardHtml(card);
  unit.style.display = 'block';
  unit.style.opacity = '1';

  let startX = window.innerWidth / 2;
  let startY = window.innerHeight * 0.82;
  let endX = window.innerWidth / 2;
  let endY = window.innerHeight * 0.45;

  if (playerId === 0) {
    // 自分のときは左右反転して右手
    handImg.style.transform = 'scaleX(-1) rotate(-15deg)';
    unit.style.transform = `translate(${startX - 70}px, ${startY - 70}px) scale(0.95)`;
    setTimeout(() => {
      unit.style.transform = `translate(${endX - 70}px, ${endY - 70}px) scale(0.85)`;
    }, 20);
  } else {
    // 相手のときは180度回転して相手の手札位置から中央へ
    handImg.style.transform = 'rotate(180deg)';
    const seats = document.querySelectorAll('.cpu-seat');
    const targetSeat = seats[playerId - 1];
    if (targetSeat) {
      const rect = targetSeat.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }
    unit.style.transform = `translate(${startX - 70}px, ${startY - 70}px) scale(0.7)`;
    setTimeout(() => {
      unit.style.transform = `translate(${endX - 70}px, ${endY - 70}px) scale(0.85)`;
    }, 20);
  }

  setTimeout(() => {
    playCardSnapSound();
    unit.style.opacity = '0';
    setTimeout(() => {
      unit.style.display = 'none';
      if (callback) callback();
    }, 150);
  }, 380);
}

// 汎用タイマー処理（通常手番＆ポンカン共通）
function stopTimer() {
  if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
  document.getElementById('timer-badge').style.background = 'transparent';
  document.getElementById('timer-sec').innerText = '--';
}

function startTimerWithDuration(sec, onTimeout) {
  stopTimer();
  if (sec === 0 || isGameOver) {
    document.getElementById('timer-sec').innerText = '∞';
    return;
  }
  remainingTime = sec;
  updateTimerDisplay();

  turnTimer = setInterval(() => {
    remainingTime--;
    updateTimerDisplay();
    if (remainingTime <= 0) {
      stopTimer();
      if (onTimeout) onTimeout();
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timer-sec').innerText = `${remainingTime}s`;
  const threshold = (userTimeLimit === 5) ? 3 : 5;
  if (remainingTime <= threshold) {
    document.getElementById('timer-badge').style.background = '#c0392b';
  } else {
    document.getElementById('timer-badge').style.background = 'transparent';
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
    updateUI();
    return;
  }

  if (turnIndex !== 0) return;

  if (selectedIndices.includes(index)) {
    playUserCard(index);
  } else {
    selectedIndices = [index];
    updateUI();
  }
}

function playUserCard(index) {
  const card = players[0].hand[index];
  const top = discardHistory[discardHistory.length - 1];

  if (players[0].declaredLast && players[0].hand.length !== 2) {
    commitChombo(players[0], I18N[currentLang].chomboWrongLast);
    return;
  }
  if (!players[0].declaredLast && players[0].hand.length === 2) {
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
      commitChombo(players[0], 'Cannot finish with 8 as All-mighty');
      return;
    }

    stopTimer();

    if (players[0].declaredLast) {
      speakVoice(currentLang === 'ja' ? 'ラスト！' : 'Last!');
    }

    playCardWithHandAnimation(0, card, () => {
      players[0].hand.splice(index, 1);
      discardHistory.push(card);
      selectedIndices = [];
      designatedSuit = null;
      lastActionDiscard = { cards: [card], totalVal: card.val, playerId: 0 };

      if (card.val === 8) {
        document.getElementById('suit-modal').style.display = 'flex';
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
  document.getElementById('suit-modal').style.display = 'none';
  setMessage(I18N[currentLang].suitChanged.replace('{suit}', suit));
  postCardPlayEffect({ val: 8, label: '8', suit: suit }, players[0]);
}

function postCardPlayEffect(card, player) {
  updateUI();

  if (player.hand.length === 0) {
    if (player.bannedFromWin) {
      commitChombo(player, 'Attempted to win while win-banned');
      return;
    }
    endRoundNormalWin(player);
    return;
  }

  let skipCount = 0;
  if (card.val === 2) {
    drawTwoStack += 2;
  } else if (card.val === 9) {
    direction *= -1;
    setMessage('Reverse (9)');
  } else if (card.val === 1) {
    skipCount = 1;
    setMessage('Skip (A)');
  }

  checkCpuInterrupts(card.val, player.id);
  passTurn(skipCount);
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
    scheduleCpuTurn();
  }
}

function scheduleCpuTurn() {
  const delay = Math.floor(Math.random() * (4200 - 1400 + 1)) + 1400;
  setTimeout(cpuTurn, delay);
}

function onDeckClick() {
  if (turnIndex !== 0 || isGameOver) return;
  stopTimer();

  if (players[0].declaredLast) {
    players[0].declaredLast = false;
    document.getElementById('last-btn').classList.remove('active');
    setMessage(I18N[currentLang].lastCanceled);
  }

  playDealSound();

  if (drawTwoStack > 0) {
    for (let i = 0; i < drawTwoStack; i++) drawCard(players[0]);
    setMessage(I18N[currentLang].drewCards.replace('{count}', drawTwoStack));
    drawTwoStack = 0;
  } else {
    drawCard(players[0]);
    setMessage(I18N[currentLang].drewOne);
  }
  selectedIndices = [];
  updateUI();
  passTurn(0);
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

function toggleUserLast() {
  players[0].declaredLast = !players[0].declaredLast;
  const btn = document.getElementById('last-btn');
  btn.classList.toggle('active', players[0].declaredLast);
  setMessage(players[0].declaredLast ? I18N[currentLang].lastStandby : I18N[currentLang].lastReset);
}

// ポン・カンの開始（ゲーム開始前のタイマー設定と連動）
function startNakiMode(type) {
  if (isGameOver) return;
  activeNakiType = type;
  selectedIndices = [];

  document.getElementById('pon-btn').classList.toggle('active', type === 2);
  document.getElementById('kan-btn').classList.toggle('active', type === 3);
  document.getElementById('confirm-naki-btn').style.display = 'block';

  // ポンカン選択タイマーを開始（ゲーム開始時の制限時間設定を使用）
  startTimerWithDuration(userTimeLimit, () => {
    if (turnIndex !== 0) {
      commitChombo(players[0], `${activeNakiType === 2 ? 'Pon' : 'Kan'} ${I18N[currentLang].timeoutMsg}`);
    } else {
      cancelNakiMode();
    }
  });

  if (turnIndex !== 0) {
    speakVoice(type === 2 ? (currentLang === 'ja' ? 'ポン！' : 'Pon!') : (currentLang === 'ja' ? 'カン！' : 'Kan!'));
    setMessage(I18N[currentLang].ponKanSelect);
  } else {
    setMessage(I18N[currentLang].ponKanSelect);
  }
}

function cancelNakiMode() {
  activeNakiType = null;
  selectedIndices = [];
  document.getElementById('pon-btn').classList.remove('active');
  document.getElementById('kan-btn').classList.remove('active');
  document.getElementById('confirm-naki-btn').style.display = 'none';
  if (turnIndex === 0) startTimerWithDuration(userTimeLimit, handleUserTimeout);
  else stopTimer();
}

function confirmNaki() {
  if (!activeNakiType) return;
  const reqCount = activeNakiType;

  if (selectedIndices.length !== reqCount) {
    if (turnIndex !== 0) {
      commitChombo(players[0], `${reqCount === 2 ? 'Pon' : 'Kan'} ${I18N[currentLang].nakiFailed}`);
    } else {
      alert(`Select exactly ${reqCount} cards.`);
    }
    cancelNakiMode();
    return;
  }

  const cards = selectedIndices.map(i => players[0].hand[i]);
  const val = cards[0].val;

  if (!cards.every(c => c.val === val)) {
    if (turnIndex !== 0) {
      commitChombo(players[0], 'Mismatched cards for Pon/Kan (Chombo)');
    } else {
      alert('All cards must match.');
    }
    cancelNakiMode();
    return;
  }

  if (val === 8) {
    commitChombo(players[0], 'No Pon/Kan for 8s (Chombo)');
    cancelNakiMode();
    return;
  }

  const top = discardHistory[discardHistory.length - 1];
  if (top.val !== val) {
    if (turnIndex !== 0 || chomboMode === 'strict') {
      commitChombo(players[0], 'Card does not match pile (Chombo)');
    } else {
      alert('Must match discard pile value.');
    }
    cancelNakiMode();
    return;
  }

  if (turnIndex === 0) {
    speakVoice(reqCount === 2 ? (currentLang === 'ja' ? 'ポン！' : 'Pon!') : (currentLang === 'ja' ? 'カン！' : 'Kan!'));
  }

  selectedIndices.sort((a, b) => b - a).forEach(idx => players[0].hand.splice(idx, 1));
  cards.forEach(c => discardHistory.push(c));

  const isKan = (reqCount === 3);
  const multiplierVal = cards.length * val;
  lastActionDiscard = {
    cards, totalVal: multiplierVal, playerId: 0,
    isPon: !isKan, isKan, baseVal: val
  };

  setMessage(`YOU ${isKan ? 'KAN' : 'PON'}!`);
  cancelNakiMode();
  handlePonKanEffects(cards, players[0]);
}

function handlePonKanEffects(cards, player) {
  const val = cards[0].val;
  const isKan = (cards.length === 3);

  if (val === 2) drawTwoStack += (isKan ? 6 : 4);
  let skips = 0;
  if (val === 1) skips = isKan ? 3 : 2;
  if (val === 9 && isKan) direction *= -1;

  turnIndex = player.id;
  updateUI();
  checkCpuInterrupts(lastActionDiscard.totalVal, player.id);
  passTurn(skips);
}

function triggerUserDobon() {
  if (isGameOver) return;
  const user = players[0];

  speakVoice(currentLang === 'ja' ? 'ドボン！' : 'Dobon!');

  if (user.bannedFromWin) {
    commitChombo(user, 'Attempted Dobon while win-banned');
    return;
  }

  const mySum = user.hand.reduce((s, c) => s + c.val, 0);
  const targetVal = lastActionDiscard ? lastActionDiscard.totalVal : null;

  if (targetVal !== null && mySum === targetVal && user.hand.length > 0) {
    stopTimer();
    executeDobonWin(user, lastActionDiscard);
  } else {
    commitChombo(user, `Hand sum (${mySum}) does not match discard (${targetVal})`);
  }
}

function executeDobonWin(winner, actionDiscard) {
  isGameOver = true;
  stopTimer();
  const loser = players[actionDiscard.playerId] || players[(winner.id - direction + numPlayers) % numPlayers];

  if (actionDiscard.cards) {
    actionDiscard.cards.forEach(c => loser.hand.push(c));
  }

  let points = 0;
  const loserCount = calculateSpecialHandCount(loser.hand);

  if (actionDiscard.cards.length === 1 && actionDiscard.cards[0].val === 2 && winner.hand.length === 2 && winner.hand.every(c => c.val === 1)) {
    points = 20 * roundMultiplier;
  } else if (actionDiscard.isPon && actionDiscard.baseVal === 2) {
    points = 80 * roundMultiplier;
  } else if (actionDiscard.isKan && actionDiscard.baseVal === 2) {
    points = 160 * roundMultiplier;
  } else if (loser.hand.length === actionDiscard.cards.length) {
    points = 20 * roundMultiplier;
  } else if (actionDiscard.isPon) {
    points = 4 * loserCount * roundMultiplier;
  } else if (actionDiscard.isKan) {
    points = 8 * loserCount * roundMultiplier;
  } else {
    points = 2 * loserCount * roundMultiplier;
  }

  const deltas = players.map(p => (p.id === winner.id ? points : (p.id === loser.id ? -points : 0)));
  winner.score += points;
  loser.score -= points;

  recordRoundHistory('DOBON', deltas);

  let detailHtml = `<b>${winner.name}</b> DOBON WIN!<br>Target: <b>${loser.name}</b><br><br>`;
  detailHtml += `<b>${winner.name}: +${points}pt</b><br>`;
  detailHtml += `<b>${loser.name}: -${points}pt</b>`;

  roundMultiplier = 1;
  nextRoundStarter = winner.id;
  showResultModal(`${winner.name} DOBON WIN!`, detailHtml);
}

function calculateSpecialHandCount(hand) {
  let count = 0;
  let eightMult = 1;
  hand.forEach(c => {
    if (c.val === 2) count += 2;
    else count += 1;
    if (c.val === 8) eightMult *= 2;
  });
  return (count + drawTwoStack) * eightMult;
}

function endRoundNormalWin(winner) {
  isGameOver = true;
  stopTimer();
  let totalWinPts = 0;
  const deltas = new Array(players.length).fill(0);
  let detailHtml = `<b>${winner.name}</b> NORMAL WIN!<br><br>`;

  players.forEach(p => {
    if (p.id !== winner.id) {
      const count = calculateSpecialHandCount(p.hand);
      const lostPts = count * 1 * roundMultiplier;
      p.score -= lostPts;
      deltas[p.id] = -lostPts;
      totalWinPts += lostPts;
      detailHtml += `${p.name}: ${count} cards (-${lostPts}pt)<br>`;
    }
  });

  winner.score += totalWinPts;
  deltas[winner.id] = totalWinPts;
  recordRoundHistory('NORMAL WIN', deltas);
  detailHtml += `<br><b>Winner: +${totalWinPts}pt</b>`;

  roundMultiplier = 1;
  nextRoundStarter = winner.id;
  showResultModal(`${winner.name} WIN!`, detailHtml);
}

function commitChombo(offender, reason) {
  isGameOver = true;
  stopTimer();
  speakVoice(currentLang === 'ja' ? 'チョンボ！' : 'Chombo!');
  const penaltyPerPlayer = 5 * roundMultiplier;
  let totalFine = 0;
  const deltas = new Array(players.length).fill(0);
  let detailHtml = `<b style="color:#e74c3c;">CHOMBO (FOUL)</b><br>Offender: <b>${offender.name}</b><br>${reason}<br><br>`;

  players.forEach(p => {
    if (p.id !== offender.id) {
      p.score += penaltyPerPlayer;
      deltas[p.id] = penaltyPerPlayer;
      totalFine += penaltyPerPlayer;
      detailHtml += `${p.name}: +${penaltyPerPlayer}pt<br>`;
    }
  });
  offender.score -= totalFine;
  deltas[offender.id] = -totalFine;
  recordRoundHistory('CHOMBO', deltas);

  offender.bannedFromWin = true;
  detailHtml += `<b>${offender.name}: -${totalFine}pt</b><br>`;
  detailHtml += `<span style="color:#f39c12;">* ${offender.name} is barred from winning next round</span><br>`;

  if (players.every(p => p.bannedFromWin)) {
    players.forEach(p => p.bannedFromWin = false);
    detailHtml += `* All players fouled: Bans reset<br>`;
  }

  roundMultiplier *= 2;
  detailHtml += `* Multiplier stacked to <b>${roundMultiplier}x</b>!`;

  nextRoundStarter = offender.id;
  showResultModal('CHOMBO!', detailHtml);
}

function checkTenho() {
  const targetVal = discardHistory[0].val;
  for (let p of players) {
    if (p.bannedFromWin) continue;
    const sum = p.hand.reduce((s, c) => s + c.val, 0);
    if (sum === targetVal) {
      isGameOver = true;
      stopTimer();
      const pts = 20 * roundMultiplier;
      const deltas = new Array(players.length).fill(0);
      let detailHtml = `<b>${p.name}</b> TENHO DOBON!<br><br>`;

      players.forEach(other => {
        if (other.id !== p.id) {
          other.score -= pts;
          deltas[other.id] = -pts;
          detailHtml += `${other.name}: -${pts}pt<br>`;
        }
      });
      const totalWin = pts * (players.length - 1);
      p.score += totalWin;
      deltas[p.id] = totalWin;
      recordRoundHistory('TENHO', deltas);

      detailHtml += `<br><b>Winner: +${totalWin}pt</b>`;
      showResultModal('TENHO DOBON!', detailHtml);
      return;
    }
  }
}

function cpuTurn() {
  if (isGameOver || turnIndex === 0) return;
  const cpu = players[turnIndex];
  const top = discardHistory[discardHistory.length - 1];

  if (cpu.hand.length <= 2 && !cpu.declaredLast) {
    cpu.declaredLast = true;
  }

  if (drawTwoStack > 0) {
    const twoCardIdx = cpu.hand.findIndex(c => c.val === 2);
    if (twoCardIdx > -1) {
      const played = cpu.hand[twoCardIdx];
      playCardWithHandAnimation(cpu.id, played, () => {
        cpu.hand.splice(twoCardIdx, 1);
        discardHistory.push(played);
        lastActionDiscard = { cards: [played], totalVal: 2, playerId: cpu.id };
        setMessage(`${cpu.name} played 2 (+4 Stack)`);
        postCardPlayEffect(played, cpu);
      });
      return;
    } else {
      for (let i = 0; i < drawTwoStack; i++) drawCard(cpu);
      setMessage(`${cpu.name} drew ${drawTwoStack} cards`);
      drawTwoStack = 0;
      updateUI();
      passTurn(0);
      return;
    }
  }

  const playable = [];
  cpu.hand.forEach((c, idx) => {
    const matchSuit = designatedSuit ? (c.suit === designatedSuit) : (c.suit === top.suit);
    const matchNum = (c.label === top.label);
    if (matchSuit || matchNum || c.val === 8) {
      if (cpu.hand.length === 1 && c.val === 8 && !matchSuit && !matchNum) return;
      playable.push(idx);
    }
  });

  if (playable.length > 0) {
    const pickIdx = playable[Math.floor(Math.random() * playable.length)];
    const played = cpu.hand[pickIdx];

    playCardWithHandAnimation(cpu.id, played, () => {
      cpu.hand.splice(pickIdx, 1);
      discardHistory.push(played);
      lastActionDiscard = { cards: [played], totalVal: played.val, playerId: cpu.id };
      designatedSuit = null;

      if (played.val === 8) {
        const suitCounts = {};
        cpu.hand.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
        designatedSuit = Object.keys(suitCounts).sort((a, b) => suitCounts[b] - suitCounts[a])[0] || '♠';
        setMessage(`${cpu.name} called ${designatedSuit}`);
      } else {
        setMessage(`${cpu.name} played ${played.suit}${played.label}`);
      }
      postCardPlayEffect(played, cpu);
    });
  } else {
    drawCard(cpu);
    if (cpu.declaredLast) cpu.declaredLast = false;
    setMessage(`${cpu.name} drew from deck`);
    updateUI();
    passTurn(0);
  }
}

function checkCpuInterrupts(targetVal, playedPlayerId) {
  if (isGameOver) return;
  for (let p of players) {
    if (p.id === playedPlayerId || p.bannedFromWin) continue;
    const sum = p.hand.reduce((s, c) => s + c.val, 0);
    if (sum === targetVal && p.hand.length > 0) {
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

function recordRoundHistory(type, deltas) {
  scoreHistory.push({
    round: currentRound, type, deltas: [...deltas],
    scoresAfter: players.map(p => p.score)
  });
}

function openScoreHistoryModal() {
  const container = document.getElementById('history-table-container');
  if (scoreHistory.length === 0) {
    container.innerHTML = '<div style="font-size:12px; padding:10px; color:#aaa;">No history recorded yet.</div>';
  } else {
    let html = '<table class="history-table"><thead><tr><th>R</th><th>TYPE</th>';
    players.forEach(p => html += `<th>${p.name}</th>`);
    html += '</tr></thead><tbody>';

    scoreHistory.forEach(h => {
      html += `<tr><td>${h.round}</td><td>${h.type}</td>`;
      h.deltas.forEach((d, idx) => {
        const color = d > 0 ? '#2ecc71' : (d < 0 ? '#e74c3c' : '#bdc3c7');
        const sign = d > 0 ? `+${d}` : `${d}`;
        html += `<td style="color:${color}; font-weight:bold;">${sign}<br><span style="color:#aaa; font-size:8px;">(${h.scoresAfter[idx]})</span></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  document.getElementById('history-modal').style.display = 'flex';
}

function closeScoreHistoryModal() {
  document.getElementById('history-modal').style.display = 'none';
}

function showResultModal(title, html) {
  document.getElementById('result-title').innerText = title;
  document.getElementById('result-detail').innerHTML = html;
  document.getElementById('result-modal').style.display = 'flex';
}

// 次のラウンドへ進む（10回ごとに大会結果画面を挟む）
function nextRound() {
  document.getElementById('result-modal').style.display = 'none';

  if (currentRound % 10 === 0) {
    showChampionshipResult();
  } else {
    currentRound++;
    startRound();
  }
}

// 10回ごとの大会結果発表
function showChampionshipResult() {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const champ = sorted[0];

  let html = `<div style="text-align:center; font-size:14px; margin-bottom:12px;">
    <b>🏆 WINNER: <span style="color:var(--gold); font-size:18px;">${champ.name}</span> (${champ.score} pt)</b>
  </div>`;

  html += `<table class="history-table">
    <thead><tr><th>RANK</th><th>PLAYER</th><th>SCORE</th></tr></thead><tbody>`;

  sorted.forEach((p, idx) => {
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
    html += `<tr>
      <td>${medal}</td>
      <td><b>${p.name}</b></td>
      <td style="color:var(--gold); font-weight:bold;">${p.score} pt</td>
    </tr>`;
  });
  html += `</tbody></table>`;

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
  players.forEach(p => {
    p.score = 0;
    p.bannedFromWin = false;
  });
  scoreHistory = [];
  currentRound = 1;
  startRound();
}