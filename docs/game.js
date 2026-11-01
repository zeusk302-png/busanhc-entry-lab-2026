'use strict';
function aimedShot(player,enemies){
  let target=null,nearest=Infinity;
  for(const enemy of enemies){
    if(!(enemy.hp>0))continue;
    const distance=(enemy.x-player.x)**2+(enemy.y-player.y)**2;
    if(distance<nearest){nearest=distance;target=enemy;}
  }
  if(!target)return null;
  const dx=target.x-player.x,dy=target.y-player.y,length=Math.hypot(dx,dy);
  return {x:player.x,y:player.y,dx:length?dx/length:1,dy:length?dy/length:0,life:1.25};
}
function initGame(){
  const canvas=document.querySelector('#demo-game');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.imageSmoothingEnabled=false;
  const W=640,H=400,overlay=document.querySelector('#game-overlay'),status=document.querySelector('#game-status');
  const images={};['player','enemy','arena','crystal'].forEach(n=>{images[n]=new Image();images[n].src=`assets/game/${n}.png`;});
  let running=false,choosing=false,destroyed=false,frame,previous=0,time=0,spawn=0,fire=0,hp=5,score=0,invuln=0,level=1,xp=0,need=3;
  let speed=200,damage=1,interval=.65,player={x:W/2,y:H/2},enemies=[],bullets=[],drops=[],keys=new Set();
  const sprite=(name,x,y,size)=>{const image=images[name];if(image?.complete&&image.naturalWidth)ctx.drawImage(image,x-size/2,y-size/2,size,size);else{ctx.fillStyle=name==='player'?'#3d8f79':'#da7951';ctx.beginPath();ctx.arc(x,y,size/3,0,Math.PI*2);ctx.fill();}};
  function draw(){
    const bg=images.arena;if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,W,H);else{ctx.fillStyle='#b9cbb0';ctx.fillRect(0,0,W,H);}
    drops.forEach(d=>sprite('crystal',d.x,d.y,36));
    bullets.forEach(b=>{ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.dy,b.dx));ctx.fillStyle='#f4f8c7';ctx.shadowColor='#d8f999';ctx.shadowBlur=9;ctx.fillRect(-9,-3,18,6);ctx.restore();});
    enemies.forEach(e=>{sprite('enemy',e.x,e.y,55);if(e.hp<2){ctx.fillStyle='#263f2d';ctx.fillRect(e.x-10,e.y-19,20,3);ctx.fillStyle='#e19b69';ctx.fillRect(e.x-10,e.y-19,Math.max(0,e.hp)/2*20,3);}});
    ctx.globalAlpha=invuln>0&&Math.floor(invuln*12)%2?.45:1;sprite('player',player.x,player.y,67);ctx.globalAlpha=1;
    ctx.fillStyle='#17372fed';ctx.fillRect(12,12,405,34);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(`♥ ${hp}    ${Math.max(0,60-Math.floor(time))}초    처치 ${score}    Lv.${level}    EXP ${xp}/${need}`,23,34);
    ctx.fillStyle='#17372f80';ctx.fillRect(12,47,405,4);ctx.fillStyle='#d7ef8f';ctx.fillRect(12,47,405*Math.min(1,xp/need),4);
  }
  function end(text){running=false;choosing=false;keys.clear();overlay.hidden=false;overlay.innerHTML=`<h3>${text}</h3><p>생존 ${Math.floor(time)}초 · 처치 ${score} · 레벨 ${level}</p><button class="button light" id="game-start">다시 해보기 →</button>`;status.textContent='투사체 → 처치 → 결정 획득 → 레벨업';}
  function upgrade(){choosing=true;keys.clear();overlay.hidden=false;overlay.innerHTML=`<h3>LEVEL ${level+1} · 능력 선택</h3><p>결정을 모아 레벨업 · 선택 중에는 시간이 멈춥니다.</p><div class="upgrade-options"><button data-upgrade="1"><b>1 · 공격력 +1</b><small>적에게 주는 피해 증가</small></button><button data-upgrade="2"><b>2 · 발사 간격 ×0.8</b><small>더 자주 발사</small></button><button data-upgrade="3"><b>3 · 이동 속도 증가</b><small>더 빠르게 이동</small></button></div>`;status.textContent='강화 선택 중 · 버튼 또는 1/2/3키';}
  function choose(n){if(!choosing)return;if(n===1)damage++;if(n===2)interval=Math.max(.18,interval*.8);if(n===3)speed=Math.min(400,speed+40);xp-=need;need+=2;level++;choosing=false;overlay.hidden=true;keys.clear();canvas.focus();status.textContent=`적용됨 · 공격력 ${damage} / 발사 ${interval.toFixed(2)}초 / 이동 ${speed}`;}
  function start(){running=true;choosing=false;time=0;spawn=0;fire=.65;hp=5;score=0;invuln=0;level=1;xp=0;need=3;speed=200;damage=1;interval=.65;player={x:W/2,y:H/2};enemies=[];bullets=[];drops=[];keys.clear();canvas.dataset.seconds='0';overlay.hidden=true;canvas.focus();}
  function tick(now){
    if(destroyed)return;const dt=Math.min((now-(previous||now))/1000,.05);previous=now;
    if(running&&!choosing){
      time+=dt;spawn+=dt;fire+=dt;invuln=Math.max(0,invuln-dt);
      let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
      if(dx||dy){const norm=Math.hypot(dx,dy);player.x=Math.max(24,Math.min(W-24,player.x+dx/norm*speed*dt));player.y=Math.max(65,Math.min(H-24,player.y+dy/norm*speed*dt));}
      if(spawn>=1.2&&enemies.length<50){spawn=0;const side=Math.floor(Math.random()*4);enemies.push({x:side===0?-20:side===1?W+20:Math.random()*W,y:side===2?-20:side===3?H+20:Math.random()*H,hp:2,hit:0});}
      if(fire>=interval&&bullets.length<40){const shot=aimedShot(player,enemies);if(shot){fire=0;bullets.push(shot);}}
      bullets.forEach(b=>{b.x+=b.dx*560*dt;b.y+=b.dy*560*dt;b.life-=dt;});bullets=bullets.filter(b=>b.life>0&&b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30);
      enemies.forEach(e=>{const dist=Math.hypot(player.x-e.x,player.y-e.y)||1;e.x+=(player.x-e.x)/dist*44*dt;e.y+=(player.y-e.y)/dist*44*dt;e.hit=Math.max(0,e.hit-dt);if(e.hit===0&&bullets.some(b=>Math.hypot(b.x-e.x,b.y-e.y)<21)){e.hp-=damage;e.hit=.15;}if(e.hp<=0){score++;drops.push({x:e.x,y:e.y,life:30});}else if(dist<19&&invuln===0){hp--;invuln=1;e.hp=0;}});enemies=enemies.filter(e=>e.hp>0);
      drops=drops.filter(d=>{d.life-=dt;const dist=Math.hypot(player.x-d.x,player.y-d.y);if(dist<32){xp++;return false;}return d.life>0;});
      if(hp<=0)end('다시 도전해 볼까요?');else if(time>=60)end('60초 생존 성공!');else if(xp>=need){upgrade();}
      canvas.dataset.seconds=String(Math.floor(time));canvas.dataset.level=String(level);canvas.dataset.xp=String(xp);canvas.dataset.damage=String(damage);
      if(Math.floor(time)%3===0&&!choosing)status.textContent=`자동 관통탄 · Lv.${level} · 공격력 ${damage} · 발사 ${interval.toFixed(2)}초`;
    }
    draw();frame=requestAnimationFrame(tick);
  }
  function click(e){if(e.target.closest('#game-start'))start();if(e.target.closest('#game-stop')&&running)end('미리보기를 멈췄어요');const u=e.target.closest('[data-upgrade]');if(u)choose(Number(u.dataset.upgrade));}
  function down(e){if(choosing&&['1','2','3'].includes(e.key)){e.preventDefault();choose(Number(e.key));return;}if(running&&!choosing&&document.activeElement===canvas&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keys.add(e.key);}}
  function up(e){keys.delete(e.key);}function blur(){keys.clear();}
  document.addEventListener('click',click);document.addEventListener('keydown',down);document.addEventListener('keyup',up);window.addEventListener('blur',blur);
  document.querySelectorAll('[data-dir]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(running&&!choosing){e.preventDefault();keys.add(b.dataset.dir);b.setPointerCapture(e.pointerId);}});['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,()=>keys.delete(b.dataset.dir)));});
  frame=requestAnimationFrame(tick);gameCleanup=()=>{destroyed=true;cancelAnimationFrame(frame);document.removeEventListener('click',click);document.removeEventListener('keydown',down);document.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
}
