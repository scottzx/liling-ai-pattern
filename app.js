import {Viewer,cropFor} from './viewer.js';
import {loadPalette,check} from './check.js';
import {FANS,DPMM,classify,fan,colorFn,download} from './export.js';
import qrcode from './node_modules/qrcode-generator/dist/qrcode.mjs';
const $=s=>document.querySelector(s),main=$('#main'),stage=$('#stage'),vbar=$('#vbar');
// ---------- 写死的演示数据 ----------
const VESSELS=[
 {id:'cup_shengli_13p8_v3',name:'胜利杯',code:'LL-CUP-1958',size:'高 13.8cm · 口径 8.8cm · 带盖',story:'1958 年醴陵为中南海特制的釉下五彩带盖茶杯，杯盖可翻转作杯托，至今仍是醴陵的代表器型。',main:true},
 {id:'vase_fengweizun_46_v3',name:'凤尾尊',code:'LL-VAS-FWZ46',size:'高 46cm · 腹径约 18cm',story:'喇叭口、长颈、鼓腹的传统陈设瓶型，适合整幅花鸟题材。常搭配扁豆双禽题材纹样。'},
 {id:'bowl_maoci_12p5_v3',name:'毛瓷碗',code:'LL-BWL-MC125',size:'口径 12.5cm',story:'醴陵“毛瓷”系列碗型，口沿与外壁窄带适合边饰纹样。'}];
const THEMES=[['biandou','扁豆双禽'],['siji','四季花卉'],['mudan','牡丹'],['qinniao','禽鸟花卉'],['shanshui','醴陵山水']];
const ORDER={no:'DZ-20261030-0018',customer:'湖南某文旅集团',contact:'王经理',product:'胜利杯',qty:100,due:'2026-11-28',theme:'四季花卉',
 brief:'“醴陵窑”文旅伴手礼，要求釉下五彩、四季花卉配醴陵山水意境，清新淡雅，杯身主纹整圈，杯盖配小花。'};
const S=JSON.parse(localStorage.getItem('ll_state')||'{}');S.vessel??='cup_shengli_13p8_v3';S.theme??='siji';S.done??={};
const save=()=>localStorage.setItem('ll_state',JSON.stringify(S));
let pal,viewer,patIndex;const imgCache={};
const loadImg=url=>imgCache[url]??=new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
const patUrl=id=>`patterns/final/${id}.png`,thumb=id=>`patterns_thumb/${id}.jpg`;
const vessel=()=>VESSELS.find(v=>v.id===S.vessel);
const STEPS=[['dash','工作台'],['order','① 订单需求'],['vessel','② 器型选择'],['pattern','③ AI 纹样生成'],['preview','④ 3D 预览确认'],['qc','⑤ 工艺校验'],['export','⑥ 生产稿导出'],['wo','⑦ 下单与工单'],['trace','⑧ 作品档案溯源']];
function nav(){$('#nav').innerHTML=STEPS.map(([k,n],i)=>(i==1?'<div class="sep">定制流程</div>':'')+`<a href="#${k}" class="${cur==k?'on':''} ${S.done[k]?'done':''}"><i>${S.done[k]?'✓':i||'⌂'}</i>${n.replace(/^[①-⑧] /,'')}</a>`).join('')+'<div class="sep"></div>'}
let cur='dash';
const go=k=>location.hash=k;const next=k=>{S.done[cur]=1;save();go(k)};
async function ensureViewer(show){stage.classList.toggle('on',!!show);if(!show)return;if(!viewer){viewer=new Viewer($('#v3d'));window.viewer=viewer}
  await viewer.load(S.vessel);}
function bar(html){vbar.innerHTML=html}
// ---------- 页面 ----------
const P={};
P.dash=()=>{main.innerHTML=`<h2>工作台</h2><div class="sub">今日概览</div>
 <div class="grid g4">${[['近期定制单','3 单'],['标准器型','3 款'],['纹样库','5 题材 · 20 款'],['工艺校验规则','3 项']].map(([a,b])=>`<div class="card kpi"><span>${a}</span><b>${b}</b></div>`).join('')}</div>
 <div class="grid g2"><div class="card"><b>打样周期对比</b><p class="note">传统：微信改稿 + 实物打样，每轮 400–2000 元、7–15 天（公开报价）<br>平台：在线 3D 确稿 + 工艺校验后出花纸稿，目标实物打样压到一次（设计目标，非实测）</p>
 <div class="row"><span style="width:60px" class="note">传统</span><div class="prog" style="flex:1;height:14px"><i style="width:100%;background:#c9bfb2"></i></div><span class="note">7–15 天</span></div>
 <div class="row" style="margin-top:8px"><span style="width:60px" class="note">平台</span><div class="prog" style="flex:1;height:14px"><i style="width:12%"></i></div><span class="note">1–2 天</span></div></div>
 <div class="card"><b>待处理</b><table style="margin-top:8px"><tr><td>${ORDER.no}</td><td>${ORDER.customer}</td><td>胜利杯 × ${ORDER.qty}</td><td><span class="tag warn">待设计</span></td></tr>
 <tr><td>DZ-20261029-0016</td><td>长沙某银行</td><td>毛瓷碗 × 300</td><td><span class="tag ok">生产中</span></td></tr><tr><td>DZ-20261027-0011</td><td>株洲某科技公司</td><td>凤尾尊 × 20</td><td><span class="tag">已发货</span></td></tr></table>
 <div class="row" style="margin-top:12px"><button class="btn p" id="b">处理 ${ORDER.no} →</button></div></div></div>`;$('#b').onclick=()=>next('order')};
P.order=()=>{main.innerHTML=`<h2>订单需求</h2><div class="sub">客户在微信/电话里提的需求，录入为结构化定制单</div>
 <div class="card"><table><tr><th>定制单号</th><td>${ORDER.no}</td></tr><tr><th>客户</th><td>${ORDER.customer}（${ORDER.contact}）</td></tr><tr><th>产品</th><td>${ORDER.product}</td></tr><tr><th>数量</th><td>${ORDER.qty} 只</td></tr><tr><th>期望交期</th><td>${ORDER.due}</td></tr><tr><th>题材偏好</th><td>${ORDER.theme}</td></tr><tr><th>需求描述</th><td>${ORDER.brief}</td></tr><tr><th>工艺</th><td>釉下五彩 · 釉下小膜花纸贴花 + 手工分水补色</td></tr></table></div>
 <button class="btn p" id="b">开始设计 →</button>`;$('#b').onclick=()=>next('vessel')};
P.vessel=async()=>{main.innerHTML=`<h2>器型选择</h2><div class="sub">醴陵代表器型，均为可展开的高精度 3D 模型（右侧可旋转）</div>
 <div class="grid g3">${VESSELS.map(v=>`<div class="card vessel ${S.vessel==v.id?'on':''}" data-id="${v.id}"><img src="thumbs/${v.id}.png"><b>${v.name}</b><div class="note">${v.size}</div></div>`).join('')}</div>
 <div class="card" id="vs"></div><button class="btn p" id="b">用这个器型设计纹样 →</button>`;
 const show=()=>{const v=vessel();$('#vs').innerHTML=`<b>${v.name}</b> <span class="tag">${v.code}</span><p class="note">${v.story}</p>`};show();
 main.querySelectorAll('.vessel').forEach(e=>e.onclick=async()=>{S.vessel=e.dataset.id;save();main.querySelectorAll('.vessel').forEach(x=>x.classList.toggle('on',x==e));show();await viewer.load(S.vessel);applyPattern()});
 $('#b').onclick=()=>next('pattern');await ensureViewer(1);bar(`<button class="btn s" id="lid">开 / 合盖</button><button class="btn s" id="rot">自动旋转</button>`);commonBar();applyPattern()};
function commonBar(){const l=$('#lid'),r=$('#rot');if(l)l.onclick=()=>viewer.toggleLid();if(r)r.onclick=()=>viewer.ctl.autoRotate=!viewer.ctl.autoRotate}
let lastSnap=null;async function applyPattern(){if(viewer){await viewer.setPattern(S.pattern?patUrl(S.pattern):null);setTimeout(()=>{try{if(S.pattern)lastSnap=viewer.snapshot()}catch(e){}},800)}}
P.pattern=async()=>{main.innerHTML=`<h2>AI 纹样生成</h2><div class="sub">用一句话描述想要的纹样，系统按釉下五彩工艺约束（色板、双勾分水白线）出候选</div>
 <div class="card"><textarea id="prompt" rows="2">釉下五彩，四季花卉，醴陵山水意境，清新淡雅，双勾分水</textarea>
 <div class="row" style="margin-top:8px">${THEMES.map(([k,n])=>`<span class="tag" style="cursor:pointer" data-t="${k}">${n}</span>`).join('')}
 <label class="right note"><input type="checkbox" id="real" style="width:auto" disabled> 真实生成（规划中）</label><button class="btn p" id="gen">生成候选</button></div>
 <div class="prog" style="margin-top:10px"><i id="pg"></i></div><div class="note" id="gmsg" style="margin-top:6px">从 AI 预生成纹样库返回候选；实时文生图为规划中，已预留接口</div></div>
 <div class="grid g2" id="cands"></div><div class="row"><button class="btn p" id="b" ${S.pattern?'':'disabled'}>去 3D 预览 →</button></div>`;
 const kw={biandou:'扁豆',siji:'四季',mudan:'牡丹',qinniao:'禽鸟',shanshui:'山水'};
 main.querySelectorAll('[data-t]').forEach(e=>e.onclick=()=>{S.theme=e.dataset.t;$('#prompt').value=`釉下五彩，${THEMES.find(t=>t[0]==S.theme)[1]}，清新淡雅，双勾分水`});
 const render=()=>{const ids=[1,2,3,4].map(i=>`${S.theme}_0${i}`);$('#cands').innerHTML=ids.map(id=>`<div class="pat ${S.pattern==id?'on':''}" data-id="${id}"><img src="${thumb(id)}"><div>${patIndex[id]?.theme||''} · ${id}</div></div>`).join('');
  main.querySelectorAll('.pat').forEach(e=>e.onclick=async()=>{S.pattern=e.dataset.id;S.qc=null;save();main.querySelectorAll('.pat').forEach(x=>x.classList.toggle('on',x==e));$('#b').disabled=false;await applyPattern()})};
 $('#gen').onclick=()=>{const p=$('#prompt').value;for(const k in kw)if(p.includes(kw[k])){S.theme=k;break}
  if($('#real').checked){$('#gmsg').textContent='实时文生图接口为规划中；本次仍从纹样库返回。'}
  const t0=performance.now();const t=setInterval(()=>{const w=(performance.now()-t0)/18;$('#pg').style.width=Math.min(w,100)+'%';if(w>=100){clearInterval(t);done()}},100);let fin=0;const done=()=>{if(fin)return;fin=1;clearInterval(t);$('#pg').style.width='100%';render();save()};setTimeout(done,1900)};
 if(S.pattern)render();$('#b').onclick=()=>next('preview');await ensureViewer(1);bar(`<button class="btn s" id="lid">开 / 合盖</button><button class="btn s" id="rot">自动旋转</button>`);commonBar();applyPattern()};
P.preview=async()=>{const v=vessel();main.innerHTML=`<h2>3D 预览确认</h2><div class="sub">拖动旋转、滚轮缩放；釉面为高光透明釉质感，白色勾线即双勾分水</div>
 <div class="card"><table><tr><th>器型</th><td>${v.name}（${v.code}）</td></tr><tr><th>纹样</th><td>${S.pattern?patIndex[S.pattern].theme+' · '+S.pattern:'未选择'}</td></tr><tr><th>贴图方式</th><td>矩形纹样经极坐标映射到圆锥台扇形 UV，一图适配全部器型</td></tr></table></div>
 <div class="card"><b>分享给客户确认</b><p class="note">生成链接发给客户，在手机上转动查看成品效果，确认后进入工艺校验。</p><div class="row"><button class="btn" id="share">生成确认链接</button><span class="note" id="sh"></span></div></div>
 <button class="btn p" id="b">客户已确认，去工艺校验 →</button>`;
 $('#share').onclick=()=>{$('#sh').textContent='已生成：客户确认于 '+new Date().toLocaleString('zh-CN',{hour12:false})};$('#b').onclick=()=>next('qc');
 await ensureViewer(1);bar(`<button class="btn s" id="lid">开 / 合盖</button><button class="btn s" id="rot">自动旋转</button>`);commonBar();await applyPattern()};
P.qc=async()=>{main.innerHTML=`<h2>工艺校验</h2><div class="sub">按釉下五彩工艺规则逐像素检查，不合格的纹样不能出稿（阈值可按工厂标定调整）</div>
 <div class="card"><div class="row"><b>当前纹样：</b><span>${S.pattern?patIndex[S.pattern].theme+' · '+S.pattern:'未选择'}</span>
 <span class="right note">违规样例（人工构造）：</span><select id="bad" style="width:auto"><option value="">—</option>${THEMES.map(([k,n])=>`<option value="${k}_bad">${n} 违规样例</option>`).join('')}</select></div>
 <div class="row" style="margin-top:10px"><button class="btn p" id="run">运行校验</button><button class="btn" id="hl">原图 / 违规高亮</button></div></div>
 <div class="card" id="res"><span class="note">点击“运行校验”</span></div>
 <div class="card note"><b>规则说明</b><br>① 色板校验：色相必须落在 14 种标准色料之内，同一色料允许 4 档浓淡（分水）。<br>② 禁止叠色：艳黑等深色直接压在海碧、海蓝上，烧成后发闷发脏，需白线隔开。<br>③ 主色数量：单件主色不超过 8 种，控制花纸套色成本。<br>④ 线宽下限、轮廓闭合：规模化版本接入，阈值由工厂按实测标定。</div>
 <div class="row"><button class="btn p" id="b" disabled>校验通过，去导出生产稿 →</button></div>`;
 let hlOn=false,last=null;
 const run=async id=>{$('#res').innerHTML='<span class="note">校验中…</span>';await new Promise(r=>setTimeout(r,30));const img=await loadImg(patUrl(id));const r=check(img,pal,cropFor(S.vessel));last=r;
  const tips={'色板校验':'把色板外的颜色替换为最接近的标准色料','禁止叠色':'深色与海碧之间加白色勾线隔开，或改用浅档','主色数量':'合并相近色料'};
  $('#res').innerHTML=`<div style="font-size:18px;font-weight:700;color:${r.pass?'var(--ok)':'#c0202a'}">${r.pass?'✔ 校验通过':'✘ 校验未通过'}</div><div class="note">纹样 ${id} · 用到色料：${r.used.map(o=>`<span class="sw" style="background:${pal.hexes[pal.names.indexOf(o.n)]}"></span>${o.n}`).join(' ')}</div>`+
   r.items.map(i=>`<div class="chk"><span class="ic">${i.pass?'🟢':'🔴'}</span><div><b>${i.rule}</b><div class="note">${i.detail}</div>${i.pass?'':`<div class="tag bad">修改建议：${tips[i.rule]}</div>`}</div></div>`).join('');
  if(viewer){await viewer.setPattern(patUrl(id));if(!r.pass){viewer.setHighlight(r.highlight);hlOn=true}}
  if(id===S.pattern){S.qc={pass:r.pass,items:r.items,used:r.used.map(o=>o.n),at:new Date().toLocaleString('zh-CN',{hour12:false})};save();$('#b').disabled=!r.pass}else $('#b').disabled=true;
  window.__qc=r;return r};
 window.runQC=run;
 $('#run').onclick=()=>{$('#bad').value='';run(S.pattern)};$('#bad').onchange=e=>e.target.value?run(e.target.value):run(S.pattern);
 $('#hl').onclick=()=>{if(!last)return;hlOn=!hlOn;viewer.setHighlight(hlOn?last.highlight:null)};$('#b').onclick=()=>next('export');
 await ensureViewer(1);bar(`<button class="btn s" id="lid">开 / 合盖</button><button class="btn s" id="rot">自动旋转</button>`);commonBar();await applyPattern();if(S.qc?.pass)$('#b').disabled=false};
P.export=async()=>{const fans=FANS[S.vessel]||FANS.cup_shengli_13p8_v3;main.innerHTML=`<h2>生产稿导出</h2><div class="sub">从确认的纹样自动生成车间能直接用的稿件，尺寸按 3D 模型的扇形展开参数 1:1 输出</div>
 <div class="card"><div class="row"><button class="btn p" data-m="A">模式 A · 釉下小膜花纸分色稿</button><button class="btn" data-m="B">模式 B · 手绘分水工艺图</button><span class="right note" id="st"></span></div></div>
 <div id="out"></div><div class="row"><button class="btn p" id="b">去下单生成工单 →</button></div>`;
 $('#b').onclick=()=>next('wo');if(!S.pattern){$('#out').innerHTML='<div class="card">请先选择纹样</div>';return}
 $('#st').textContent='正在分色…';await new Promise(r=>setTimeout(r,30));const img=await loadImg(patUrl(S.pattern));const src=classify(img,pal,cropFor('cup_shengli_13p8_v3'));
 S.layers=src.layers.map(l=>l.name);save();const PREV=2.2; // 预览缩放（px/mm）
 const modeA=()=>{$('#out').innerHTML=`<div class="card"><b>合成预览（两段扇形花纸）</b><div class="note">红线为裁切线，十字为套准标；每段 1:1，300dpi 下载</div><div class="grid g2" style="margin-top:10px" id="comp"></div></div>
  <div class="card"><b>按色料分层（共 ${src.layers.length} 层，每层一张网版；灰度深浅 = 浓淡档）</b><div class="grid g4" style="margin-top:10px" id="lay"></div></div>`;
  fans.forEach(f=>{const d=document.createElement('div');d.className='layer';d.appendChild(fan(src,f,PREV,colorFn.composite(src)));d.insertAdjacentHTML('beforeend',`<div>${f.name} · ${f.size} mm · R ${f.Rin}/${f.Rout} · ${f.theta}°</div><button class="btn s">下载 300dpi PNG</button>`);
   d.querySelector('button').onclick=()=>download(fan(src,f,DPMM,colorFn.composite(src)),`${ORDER.no}_${f.id}_合成_300dpi.png`);$('#comp').appendChild(d)});
  src.layers.forEach((l,i)=>{const d=document.createElement('div');d.className='layer';d.appendChild(fan(src,fans[1],1.2,colorFn.layer(src,pal,l.pi),false));
   d.insertAdjacentHTML('beforeend',`<div><span class="sw" style="background:${l.hex}"></span>第 ${i+1} 版 · ${l.name} · ${(l.cover*100).toFixed(1)}%</div><button class="btn s">下载两段</button>`);
   d.querySelector('button').onclick=()=>fans.forEach(f=>download(fan(src,f,DPMM,colorFn.layer(src,pal,l.pi)),`${ORDER.no}_${f.id}_第${i+1}版_${l.name}_300dpi.png`));$('#lay').appendChild(d)});};
 const modeB=()=>{$('#out').innerHTML=`<div class="card"><b>手绘分水工艺图</b><div class="note">黑线为双勾白描线位置，色块标注色料与浓淡档，供手工分水补色参照</div><div class="grid g2" style="margin-top:10px" id="la"></div>
  <div style="margin-top:10px">${src.layers.map((l,i)=>`<span class="tag"><span class="sw" style="background:${l.hex}"></span>${String.fromCharCode(65+i)} ${l.name}</span>`).join('')} <span class="tag">浓淡 1.0 / 0.7 / 0.45 / 0.25 → 一至四档</span></div></div>`;
  fans.forEach(f=>{const d=document.createElement('div');d.className='layer';const c=fan(src,f,PREV,colorFn.lineart(src,pal));labelFan(c,src,f,PREV);d.appendChild(c);
   d.insertAdjacentHTML('beforeend',`<div>${f.name} · ${f.size} mm</div><button class="btn s">下载 300dpi PNG</button>`);
   d.querySelector('button').onclick=()=>{const c2=fan(src,f,DPMM,colorFn.lineart(src,pal));labelFan(c2,src,f,DPMM);download(c2,`${ORDER.no}_${f.id}_分水工艺图_300dpi.png`)};$('#la').appendChild(d)})};
 main.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{main.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('p',x==b));(b.dataset.m=='A'?modeA:modeB)();S.done.export=1;save()});
 modeA();$('#st').textContent=`已分 ${src.layers.length} 种色料`;ensureViewer(0)};
// 在线稿上给较大的色块标字母+档位
function labelFan(cv,src,f,scale){const g=cv.getContext('2d'),gs=24,W=src.W,H=src.H;const R1=f.Rin*scale,R2=f.Rout*scale,th=f.theta*Math.PI/180,pad=Math.round(8*scale),cx=cv.width/2,cy=pad+R2;
 g.font=`bold ${Math.max(9,scale*3)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';
 for(let gy=0;gy<gs/3;gy++)for(let gx=0;gx<gs;gx++){const u=(gx+.5)/gs,vv=(gy+.5)/(gs/3);const sy=Math.floor((f.v[0]+vv*(f.v[1]-f.v[0]))*H),sx=Math.floor(u*W);const s=pal.sw[src.cls[sy*W+sx]];
  if(s.pi<0)continue;const li=src.layers.findIndex(l=>l.pi==s.pi);if(li<0)continue;const a=-th/2+u*th,r=R2-vv*(R2-R1);g.fillStyle=src.layers[li].hex;g.fillText(String.fromCharCode(65+li)+(s.li+1),cx+r*Math.sin(a),cy-r*Math.cos(a))}}
P.wo=async()=>{const v=vessel(),fans=FANS.cup_shengli_13p8_v3;const wo='GD-20261030-0042';S.wo=wo;save();
 main.innerHTML=`<h2>下单与工单</h2><div class="sub">确认数量与交期后自动生成车间工单，可直接打印</div>
 <div class="card noprint"><div class="grid g3"><label>数量<input id="qty" value="${ORDER.qty}"></label><label>交期<input id="due" value="${ORDER.due}"></label><label>备损率<input value="8%"></label></div>
 <div class="row" style="margin-top:10px"><button class="btn p" id="mk">生成工单</button><button class="btn" onclick="print()">打印</button></div></div>
 <div class="wo" id="wo" style="display:${S.woMade?'block':'none'}"><h3>生 产 工 单</h3><div class="note" style="text-align:center;margin-bottom:12px">醴陵某瓷厂 · 釉下五彩车间</div>
 <div class="row" style="align-items:flex-start"><table style="flex:1">
 <tr><th>工单号</th><td>${wo}</td><th>定制单号</th><td>${ORDER.no}</td></tr>
 <tr><th>客户</th><td>${ORDER.customer}</td><th>交期</th><td id="wdue">${ORDER.due}</td></tr>
 <tr><th>器型</th><td>${v.name}（${v.code}）</td><th>数量</th><td id="wqty">${ORDER.qty} 只（含备损 8%，投产 108 只）</td></tr>
 <tr><th>纹样</th><td>${S.pattern?patIndex[S.pattern].theme+' · '+S.pattern:'-'}</td><th>工艺校验</th><td>${S.qc?.pass?'<span class="tag ok">通过</span> '+S.qc.at:'<span class="tag warn">未校验</span>'}</td></tr>
 <tr><th>色料清单</th><td colspan="3">${(S.layers||S.qc?.used||[]).map((n,i)=>`<span class="tag"><span class="sw" style="background:${pal.hexes[pal.names.indexOf(n)]}"></span>第${i+1}版 ${n}</span>`).join('')}</td></tr>
 <tr><th>花纸规格</th><td colspan="3">${fans.map(f=>`${f.name}：扇形 ${f.size} mm，R ${f.Rin}/${f.Rout} mm，圆心角 ${f.theta}°`).join('<br>')}，300dpi，每版一张网版</td></tr>
 <tr><th>工序</th><td colspan="3">成型 → 素烧 → 贴釉下小膜花纸 → 手工分水补色 → 施透明釉 → 高温烧成（1350±50℃）→ 检验包装</td></tr>
 <tr><th>烧成参数</th><td>1350 ± 50 ℃ 高温烧成</td><th>釉层厚度</th><td>0.5 – 1.5 mm</td></tr>
 <tr><th>质检要点</th><td colspan="3">纹样无缺失、无叠色发闷；白描线清晰；釉面无针孔、无缩釉</td></tr></table>
 <div style="text-align:center;width:150px"><div id="qr"></div><div class="note">扫码查看作品档案</div></div></div>
 <div class="row note" style="margin-top:14px"><span>下单人：小李</span><span>审核：车间主任</span><span class="right">生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}</span></div></div>
 <div class="row noprint" style="margin-top:14px"><button class="btn p" id="b">查看作品档案与溯源码 →</button></div>`;
 const q=qrcode(0,'M');q.addData(location.href.split('#')[0]+'#trace');q.make();$('#qr').innerHTML=q.createSvgTag({cellSize:4,margin:2});
 $('#mk').onclick=()=>{S.woMade=1;S.done.wo=1;save();$('#wqty').textContent=$('#qty').value+' 只（含备损 8%，投产 '+Math.ceil($('#qty').value*1.08)+' 只）';$('#wdue').textContent=$('#due').value;$('#wo').style.display='block'};
 $('#b').onclick=()=>next('trace');ensureViewer(0)};
P.trace=async()=>{const v=vessel();let snap=lastSnap||('thumbs/'+S.vessel+'.png');
 main.innerHTML=`<h2>作品档案与溯源码</h2><div class="sub">消费者扫码看到的手机页面</div><div class="phone"><div class="hero"><img id="hero" src="${snap}"></div><div class="body">
 <div style="font-size:18px;font-weight:700">${v.name} · ${S.pattern?patIndex[S.pattern].theme:''}</div><div class="note">醴陵釉下五彩 · 国家级非物质文化遗产</div>
 <div style="margin:10px 0"><span class="tag ok">工艺校验通过</span><span class="tag">溯源码 LL-${(S.wo||'').slice(3)}-073</span></div>
 <table><tr><th>器型</th><td>${v.name}（${v.size}）</td></tr><tr><th>纹样</th><td>${S.pattern||''}（AI 辅助设计，设计师确认）</td></tr><tr><th>色料</th><td>${(S.layers||S.qc?.used||[]).join('、')}</td></tr><tr><th>烧成</th><td>贴花施釉后 1350±50℃ 高温烧成</td></tr><tr><th>工单</th><td>${S.wo||''}</td></tr><tr><th>产地</th><td>湖南 · 醴陵</td></tr></table>
 <div style="margin:14px 0 6px;font-weight:600">生产履历</div><div class="tl"><div>10-30 09:12 客户在线确认 3D 效果</div><div>10-30 09:20 工艺校验通过</div><div>10-30 09:25 花纸分色稿出稿</div><div>10-31 贴花、分水、施釉</div><div>11-02 1350℃ 高温烧成，检验合格</div></div>
 <div style="margin:14px 0 6px;font-weight:600">非遗故事</div><p class="note">${v.story} 釉下五彩把颜料画在釉下，坯体 800℃ 素烧、彩绘施釉后经 1350–1410℃ 高温烧成，色彩封在釉层之下。2008 年列入第二批国家级非物质文化遗产名录。</p></div></div>`;
 S.done.trace=1;save();ensureViewer(0)};
const STEPNO={order:1,vessel:2,pattern:3,preview:4,qc:5,export:6,wo:7,trace:8,dash:9};
async function route(){cur=(location.hash||'#dash').slice(1);if(!P[cur])cur='dash';nav();document.querySelector('.user').textContent=`步骤 ${STEPNO[cur]}/9 · 业务员 小李`;main.scrollTop=0;await P[cur]();window.__page=cur;window.__ok=1}
(async()=>{pal=await loadPalette('patterns/palette.json');const idx=await (await fetch('patterns/index.json')).json();patIndex=Object.fromEntries(idx.items.map(i=>[i.id,i]));
 if(new URLSearchParams(location.search).has('reset'))localStorage.removeItem('ll_state');addEventListener('hashchange',route);route()})();
