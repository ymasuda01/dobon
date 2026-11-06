/* DOBON Master - Core Game Logic (Restored Picture Card Images) */
const VERSION = "2026.00.005";

// グローバル状態
let deck = [];
let players = [];
let currentPlayerIndex = 0;
let playDirection = 1; // 1: 時計回り, -1: 反時計回り
let currentDiscard = null;
let currentSuit = '';
let isGameActive = false;
let isMyTurn = false;
let roundNumber = 1;
let currentMultiplier = 1;
let drawStackCount = 0;
let chomboPlayer = null;
let selectedHandIndices = [];

// タイマー関連
let turnTimer = null;
let maxTurnTime = 25;
let remainingTime = 25;

// 設定
let configPlayerCount = 4;
let configChomboMode = 'strict';

// 初期化
window.addEventListener('DOMContentLoaded', () => {
  initGameUI();
});

function initGameUI() {
  document.getElementById('version-tag')?.innerText = VERSION;
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn && localStorage.getItem('dobon_saved_state')) {
    resumeBtn.style.display = 'block';
  }
}

function startCpuDirect() {
  const pSelect = document.getElementById('player-count-select');
  if (pSelect) configPlayerCount = parseInt(pSelect.value) || 4;
  
  const cSelect = document.getElementById('chombo-mode-select');
  if (cSelect) configChomboMode = cSelect.value;

  const tSelect = document.getElementById('timer-mode-select');
  if (tSelect) maxTurnTime = parseInt(tSelect.value) || 25;

  document.getElementById('start-modal').style.display = 'none';
  startNewGame();
}

function startNewGame() {
  isGameActive = true;
  deck = createDeck();
  shuffle(deck);

  players = [];
  players.push({ id: 'user', name: 'YOU', isCpu: false, hand: [], score: 0, isLast: false });
  for (let i = 1; i < configPlayerCount; i++) {
    players.push({ id: `cpu_${i}`, name: `CPU ${i}`, isCpu: true, hand: [], score: 0, isLast: false });
  }

  // 配牌 (5枚ずつ)
  for (let r = 0; r < 5; r++) {
    players.forEach(p => {
      if (deck.length > 0) p.hand.push(deck.pop());
    });
  }

  // 最初の捨て札
  currentDiscard = deck.pop();
  currentSuit = currentDiscard.suit;

  currentPlayerIndex = 0;
  playDirection = 1;
  drawStackCount = 0;

  updateUI();
  startTurn();
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  let newDeck = [];
  for (let s of suits) {
    for (let v of values) {
      newDeck.push({ suit: s, value: v });
    }
  }
  return newDeck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/* =========================================================
   絵札（K, Q, J）および数字カードの画像・見た目生成ロジック
   （初期コードの画像参照方式を完全復元）
   ========================================================= */
function getCardImageFilename(card) {
  if (!card) return '';
  let suitPrefix = '';
  switch (card.suit) {
    case '♠': suitPrefix = 's'; break;
    case '♥': suitPrefix = 'h'; break;
    case '♦': suitPrefix = 'd'; break;
    case '♣': suitPrefix = 'c'; break;
  }
  let valStr = card.value;
  if (card.value === 1) valStr = 'a';
  else if (card.value === 11) valStr = 'j';
  else if (card.value === 12) valStr = 'q';
  else if (card.value === 13) valStr = 'k';

  // J, Q, K や各カードの画像ファイル名形式 (例: s_j.png, h_q.png, d_10.png 等)
  return `${suitPrefix}_${valStr}.png`;
}

function renderCardElement(card, isSelectable = false, index = -1) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card-fan-item';
  if (selectedHandIndices.includes(index)) {
    cardDiv.classList.add('selected');
  }

  // J, Q, K やカード画像が存在する場合は img 要素を生成してはめ込む
  const isPictureCard = (card.value === 11 || card.value === 12 || card.value === 13);
  const imgFilename = getCardImageFilename(card);

  // カード表面のHTML構造
  cardDiv.innerHTML = `
    <div class="card-inner" style="position:relative; width:100%; height:100%; border-radius:6px; overflow:hidden; background:#fff;">
      <div class="card-corner top-left" style="position:absolute; top:2px; left:4px; font-size:11px; font-weight:bold; color:${(card.suit==='♥'||card.suit==='♦')?'#c0392b':'#111'};">
        <div>${getCardValueStr(card.value)}</div>
        <div style="font-size:9px;">${card.suit}</div>
      </div>
      
      <!-- 画像参照領域 -->
      <div class="card-center-img" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:80%; height:75%; display:flex; justify-content:center; align-items:center;">
        <img src="${imgFilename}" alt="${card.suit}${card.value}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <!-- 画像読み込みエラー時のテキストフォールバック -->
        <div class="fallback-center-symbol" style="display:none; font-size:22px; color:${(card.suit==='♥'||card.suit==='♦')?'#c0392b':'#111'};">
          ${card.suit}<br><span style="font-size:14px;">${getCardValueStr(card.value)}</span>
        </div>
      </div>

      <div class="card-corner bottom-right" style="position:absolute; bottom:2px; right:4px; font-size:11px; font-weight:bold; transform:rotate(180deg); color:${(card.suit==='♥'||card.suit==='♦')?'#c0392b':'#111'};">
        <div>${getCardValueStr(card.value)}</div>
        <div style="font-size:9px;">${card.suit}</div>
      </div>
    </div>
  `;

  if (isSelectable && index >= 0) {
    cardDiv.onclick = () => onHandCardClick(index);
  }

  return cardDiv;
}

function getCardValueStr(val) {
  if (val === 1) return 'A';
  if (val === 11) return 'J';
  if (val === 12) return 'Q';
  if (val === 13) return 'K';
  return val.toString();
}

function updateUI() {
  // 山札・捨て札枚数
  document.getElementById('deck-count').innerText = deck.length;
  document.getElementById('discard-sum-val').innerText = currentDiscard ? currentDiscard.value : 0;
  document.getElementById('giant-suit-symbol').innerText = currentSuit || '♠';
  document.getElementById('giant-suit-symbol').style.color = (currentSuit === '♥' || currentSuit === '♦') ? '#c0392b' : '#fff';

  // CPU領域描画
  const cpuContainer = document.getElementById('cpu-arc-container');
  if (cpuContainer) {
    cpuContainer.innerHTML = '';
    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      const box = document.createElement('div');
      box.className = `cpu-player-box ${currentPlayerIndex === i ? 'active-turn' : ''}`;
      box.innerHTML = `
        <div style="font-size:10px; color:#fff; font-weight:bold;">${p.name}</div>
        <div style="font-size:9px; color:var(--gold);">手札: ${p.hand.length}枚</div>
        <div style="font-size:9px; color:#aaa;">Score: ${p.score}</div>
      `;
      cpuContainer.appendChild(box);
    }
  }

  // ユーザー手札（扇状描画）
  const fanContainer = document.getElementById('user-fan');
  if (fanContainer) {
    fanContainer.innerHTML = '';
    const user = players[0];
    const totalCards = user.hand.length;
    
    user.hand.forEach((card, idx) => {
      const cardEl = renderCardElement(card, true, idx);
      
      // 扇状の配置計算
      const angle = (idx - (totalCards - 1) / 2) * 8; // 回転角度
      const xOffset = (idx - (totalCards - 1) / 2) * 32; // 横ずらし
      const yOffset = Math.abs(idx - (totalCards - 1) / 2) * 4; // 弧を描く縦ずらし

      cardEl.style.transform = `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${angle}deg)`;
      fanContainer.appendChild(cardEl);
    });
  }

  // ターンバッジ
  const turnBadge = document.getElementById('user-turn-badge');
  if (turnBadge) {
    turnBadge.style.display = (currentPlayerIndex === 0) ? 'block' : 'none';
  }
}

function startTurn() {
  const p = players[currentPlayerIndex];
  isMyTurn = (currentPlayerIndex === 0);

  const statusMsg = document.getElementById('status-msg');
  if (statusMsg) {
    statusMsg.innerText = isMyTurn ? "あなたの番です！カードをタップして出してください" : `${p.name} の思考中...`;
  }

  startTimer();

  if (p.isCpu) {
    setTimeout(() => {
      cpuPlayTurn(p);
    }, 1200);
  }
}

function startTimer() {
  clearInterval(turnTimer);
  remainingTime = maxTurnTime;
  const timerSec = document.getElementById('timer-sec');
  if (timerSec) timerSec.innerText = remainingTime;

  turnTimer = setInterval(() => {
    remainingTime--;
    if (timerSec) timerSec.innerText = remainingTime;
    if (remainingTime <= 0) {
      clearInterval(turnTimer);
      onTimeOut();
    }
  }, 1000);
}

function onTimeOut() {
  if (isMyTurn) {
    onDeckClick(); // タイムアウト時は自動山引き
  }
}

function onHandCardClick(index) {
  if (!isMyTurn) return;
  const user = players[0];
  const card = user.hand[index];

  if (isValidPlay(card)) {
    // カード出し実行
    user.hand.splice(index, 1);
    currentDiscard = card;
    currentSuit = card.suit;
    selectedHandIndices = [];

    // 8出しのマーク変更判定
    if (card.value === 8) {
      document.getElementById('suit-select-floating').style.display = 'block';
      return;
    }

    checkWinOrNextTurn();
  }
}

function selectSuit(suit) {
  currentSuit = suit;
  document.getElementById('suit-select-floating').style.display = 'none';
  checkWinOrNextTurn();
}

function onDeckClick() {
  if (!isMyTurn) return;
  if (deck.length > 0) {
    const drawn = deck.pop();
    players[0].hand.push(drawn);
  }
  nextTurn();
}

function isValidPlay(card) {
  if (!currentDiscard) return true;
  return (card.suit === currentSuit || card.value === currentDiscard.value || card.value === 8);
}

function cpuPlayTurn(cpu) {
  const validCards = cpu.hand.filter(c => isValidPlay(c));
  if (validCards.length > 0) {
    const playCard = validCards[0];
    const idx = cpu.hand.indexOf(playCard);
    cpu.hand.splice(idx, 1);
    currentDiscard = playCard;
    currentSuit = playCard.suit;

    if (playCard.value === 8) {
      const suits = ['♠', '♥', '♦', '♣'];
      currentSuit = suits[Math.floor(Math.random() * suits.length)];
    }
  } else {
    if (deck.length > 0) {
      cpu.hand.push(deck.pop());
    }
  }
  checkWinOrNextTurn();
}

function checkWinOrNextTurn() {
  const currentP = players[currentPlayerIndex];
  if (currentP.hand.length === 0) {
    alert(`${currentP.name} の勝利（上がり）です！`);
    startNewGame();
    return;
  }
  nextTurn();
}

function nextTurn() {
  clearInterval(turnTimer);
  currentPlayerIndex = (currentPlayerIndex + playDirection + players.length) % players.length;
  updateUI();
  startTurn();
}

function triggerUserDobon() {
  if (!isGameActive) return;
  alert("DOBON宣言！");
}

function toggleUserLast() {
  players[0].isLast = !players[0].isLast;
  alert(`LAST宣言: ${players[0].isLast ? 'ON' : 'OFF'}`);
}

function toggleConfigAccordion() {
  const panel = document.getElementById('cpu-config-panel');
  const arrow = document.getElementById('config-arrow');
  if (panel) {
    if (panel.style.display === 'none' || !panel.style.display) {
      panel.style.display = 'block';
      if (arrow) arrow.innerText = '▲';
    } else {
      panel.style.display = 'none';
      if (arrow) arrow.innerText = '▼';
    }
  }
}

function openPayoutModal() { document.getElementById('payout-modal').style.display = 'flex'; }
function closePayoutModal() { document.getElementById('payout-modal').style.display = 'none'; }
function openScoreHistoryModal() { document.getElementById('history-modal').style.display = 'flex'; }
function closeScoreHistoryModal() { document.getElementById('history-modal').style.display = 'none'; }
function suspendGame() { alert("ゲームを中断しました"); }
function quitToTitle() { location.reload(); }
