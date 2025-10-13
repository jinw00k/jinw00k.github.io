(()=> {
  const $ = s => document.querySelector(s);
  const dealerEl = $("#bj-dealer");
  const playerEl = $("#bj-player");
  const dealerTotalEl = $("#bj-dealer-total");
  const playerTotalEl = $("#bj-player-total");
  const statusEl = $("#bj-status");
  const btnNew = $("#bj-new");
  const btnHit = $("#bj-hit");
  const btnStand = $("#bj-stand");
  const btnReshuffle = $("#bj-redeal");

  let deck = [];
  let dealer = [];
  let player = [];
  let roundOver = false;

  // for detecting "new" cards in render()
  let prevDealerLen = 0;
  let prevPlayerLen = 0;

  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  function buildDeck(){
    const suits = ["♠","♥","♦","♣"];
    const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    const d=[]; for(const s of suits){ for(const r of ranks){ d.push({rank:r,suit:s}); } }
    return d;
  }
  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }
  function ensureDeck(){ if(deck.length<10) deck = shuffle(buildDeck()); }

  function handValue(hand){
    let total = 0, aces = 0;
    for(const c of hand){
      if(c.rank==="A"){ total+=11; aces++; }
      else if(["K","Q","J"].includes(c.rank)){ total+=10; }
      else total+=Number(c.rank);
    }
    while(total>21 && aces>0){ total-=10; aces--; }
    return total;
  }

  function cardEl(card, back=false, animate=false){
    const el = document.createElement("div");
    el.className = "card" + (back ? " back" : "") + (["♥","♦"].includes(card?.suit) ? " red" : "");
    if(animate) el.classList.add("deal");
    if(!back){
      const r = document.createElement("div"); r.className="rank"; r.textContent=card.rank;
      const s = document.createElement("div"); s.className="suit"; s.textContent=card.suit;
      el.append(r,s);
    } else {
      el.setAttribute("aria-label","뒷면 카드");
    }
    return el;
  }

  // render with animation only for newly added card
  function render(hideDealerHole=true){
    const dealerGrew = dealer.length > prevDealerLen;
    const playerGrew = player.length > prevPlayerLen;

    // dealer
    dealerEl.innerHTML="";
    dealer.forEach((c,i)=>{
      const isHole = hideDealerHole && i===0 && !roundOver;
      const isNew = dealerGrew && i===dealer.length-1;
      dealerEl.appendChild(cardEl(c, isHole, isNew && !isHole));
    });

    // player
    playerEl.innerHTML="";
    player.forEach((c,i)=>{
      const isNew = playerGrew && i===player.length-1;
      playerEl.appendChild(cardEl(c, false, isNew));
    });

    dealerTotalEl.textContent = roundOver ? handValue(dealer) : (dealer.length? "?" : "0");
    playerTotalEl.textContent = handValue(player);

    prevDealerLen = dealer.length;
    prevPlayerLen = player.length;
  }

  function dealOne(to){
    ensureDeck();
    const c = deck.pop();
    to.push(c);
    return c;
  }

  async function initialDeal(){
    // 딜러 1 (뒷면) → 플레이어 1 → 딜러 2 → 플레이어 2
    dealOne(dealer); render(true); await sleep(120);
    dealOne(player); render(true); await sleep(120);
    dealOne(dealer); render(true); await sleep(120);
    dealOne(player); render(true);
  }

  async function startRound(){
    roundOver=false;
    statusEl.textContent="행운을 빌어요!";
    dealer=[]; player=[];
    prevDealerLen=0; prevPlayerLen=0;
    btnHit.disabled=false; btnStand.disabled=false;

    await initialDeal();

    const p = handValue(player), d = handValue(dealer);
    if(p===21 || d===21){
      await revealDealerHole();
      await dealerDrawIfNeeded();
      finishResult();
    }
  }

  async function revealDealerHole(){
    // 뒷면 공개(원하면 flip 효과)
    roundOver = true; // 합계 표시를 위해 임시 true
    render(false);
    // 첫 카드에 flip 효과 한번 (선택)
    const first = dealerEl.querySelector(".card");
    if(first){ first.classList.add("flip"); await sleep(380); }
    roundOver = false; // 라운드 진행 계속
  }

  async function dealerDrawIfNeeded(){
    // 딜러는 17 이상에서 스탠드 (소프트17 포함 스탠드)
    while(handValue(dealer) < 17){
      await sleep(200);
      dealOne(dealer);
      render(false);
    }
    await sleep(60);
  }

  function finishResult(){
    roundOver = true;
    render(false);
    const p = handValue(player), d = handValue(dealer);
    let msg="";
    if(p>21) msg="버스트! 딜러 승";
    else if(d>21) msg="딜러 버스트! 플레이어 승 🎉";
    else if(p>d) msg="플레이어 승 🎉";
    else if(p<d) msg="딜러 승";
    else msg="무승부(푸시)";
    statusEl.textContent = msg;
    btnHit.disabled=true; btnStand.disabled=true;
  }

  // events
  btnNew.addEventListener("click", async ()=>{
    if(deck.length<10){ deck = shuffle(buildDeck()); }
    await startRound();
  });

  btnHit.addEventListener("click", async ()=>{
    if(roundOver) return;
    dealOne(player);
    render(true);
    if(handValue(player) >= 21){
      // 딜러 공개 & 마무리
      await revealDealerHole();
      await dealerDrawIfNeeded();
      finishResult();
    }
  });

  btnStand.addEventListener("click", async ()=>{
    if(roundOver) return;
    await revealDealerHole();
    await dealerDrawIfNeeded();
    finishResult();
  });

  btnReshuffle.addEventListener("click", ()=>{
    deck = shuffle(buildDeck());
    statusEl.textContent="덱을 새로 섞었습니다.";
  });

  // init
  deck = shuffle(buildDeck());
  statusEl.textContent = "‘새 게임’을 눌러 시작하세요.";
  render(true);
})();
