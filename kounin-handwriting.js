/* 江原予備校 漢字プログラム 手書きチャレンジ（共通スクリプト）
 *  ・各ユニット画面のホームに「✍ 手書きチャレンジ」ボタンを追加します
 *  ・指やペンで漢字を1文字ずつ書き、文字認識で正誤を判定します
 *  ・80%以上で合格 → 花吹雪（桜の花びら）が舞います
 *  ・?set=N のときはそのセットの問題、ユニット全体のときは5問をランダムで出題します
 *  ・結果は localStorage の 'kounin-progress-v1' に U○S○H として保存します
 *  ・文字認識は Google 入力ツールの手書き認識を利用（非公式）。つながらないときは自己採点に切り替わります
 */
(function () {
  var U = window.KSET_UNIT, D = window.KDATA && window.KDATA[U];
  if (!D) return;
  var params = new URLSearchParams(location.search);
  var setNo = parseInt(params.get('set'), 10) || 0;
  var SET = setNo ? D.sets[setNo - 1] : null;
  if (setNo && !SET) setNo = 0;

  var KP = 'kounin-progress-v1', PASS = 0.8, NQ = 5, TOPN = 5;
  var KANJI = /[㐀-鿿々〆]/;

  function eligible(e) {
    return e && e.kanji && e.kanji.length <= 5 && !/[≒⇔\s・]/.test(e.kanji) && KANJI.test(e.kanji);
  }
  var all = [];
  D.sets.forEach(function (s) { all = all.concat(s.items); });
  var pool = (SET ? SET.items : all).filter(eligible);
  if (!pool.length) return;   // 類義語・対義語・慣用句など、手書きに向かないユニットはボタンを出さない

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function loadP() { try { return JSON.parse(localStorage.getItem(KP) || '{}'); } catch (e) { return {}; } }
  function saveP(p) { try { localStorage.setItem(KP, JSON.stringify(p)); } catch (e) {} }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- スタイル ----------
  var st = document.createElement('style');
  st.textContent =
    '.hw-open{background:#f582ae!important;color:#fff!important;border-color:#f582ae!important}' +
    '.hw-ov{position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#fef6e4 0%,#f3d2c1 100%);overflow:auto;padding:16px;font-family:"Hiragino Sans","Yu Gothic",Meiryo,sans-serif;color:#001858}' +
    '.hw-in{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 12px rgba(0,24,88,.1)}' +
    '.hw-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}' +
    '.hw-top b{font-size:18px}.hw-prog{font-size:13px;color:#5e6472}' +
    '.hw-x{font:inherit;font-size:14px;font-weight:bold;border:2px solid #001858;background:#fff;color:#001858;border-radius:20px;padding:6px 14px;cursor:pointer}' +
    '.hw-read{font-size:34px;font-weight:bold;color:#c1121f;margin:8px 0 2px;letter-spacing:.08em}' +
    '.hw-mean{font-size:14px;color:#5e6472;margin-bottom:6px}' +
    '.hw-sent{font-size:20px;line-height:1.9;margin:6px 0 10px}' +
    '.hw-sent u{font-weight:bold;color:#c1121f;text-decoration:none;border-bottom:3px double #c1121f;padding:0 2px}' +
    '.hw-boxes{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;align-items:flex-start}' +
    '.hw-box{text-align:center;width:144px}' +
    '.hw-cv{position:relative;width:140px;height:140px;border:2px solid #001858;border-radius:8px;background:#fff;' +
    'background-image:linear-gradient(#0002 1px,transparent 1px),linear-gradient(90deg,#0002 1px,transparent 1px);background-size:50% 50%}' +
    '.hw-cv canvas{position:absolute;left:0;top:0;width:140px;height:140px;touch-action:none}' +
    '.hw-fix{width:60px;height:140px;display:flex;align-items:center;justify-content:center;font-size:44px;color:#001858}' +
    '.hw-msg{display:block;min-height:1.5em;font-size:13px;margin:2px 0}' +
    '.hw-btn{font:inherit;font-size:15px;font-weight:bold;padding:10px 18px;border:0;border-radius:10px;background:#001858;color:#fff;margin:4px 6px 4px 0;cursor:pointer}' +
    '.hw-btn.s{font-size:12px;padding:5px 10px;margin:2px}' +
    '.hw-btn.hint{background:#10b981}.hw-btn.gray{background:#8a96a8}.hw-btn.ok{background:#10b981}.hw-btn.ng{background:#e67e22}' +
    '.hw-btn.pink{background:#f582ae}' +
    '.hw-res{margin-top:12px;padding:14px;border-radius:12px;font-size:16px;line-height:1.7}' +
    '.hw-res.good{background:#d1fae5;color:#065f46}.hw-res.bad{background:#fef6e4;color:#001858;border:2px solid #f3d2c1}' +
    '.hw-ans{font-size:30px;font-weight:bold;margin:0 4px}' +
    '.hw-big{font-size:28px;font-weight:bold;text-align:center;margin:12px 0}' +
    '.hw-note{font-size:12px;color:#5e6472;margin-top:10px}';
  document.head.appendChild(st);

  // ---------- ボタン設置 ----------
  var home = document.getElementById('panel-home');
  if (!home) return;
  var bar = home.querySelector('.kset-bar');
  if (!bar) { bar = document.createElement('div'); bar.className = 'kset-bar'; home.insertBefore(bar, home.firstChild); }
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hw-open';
  btn.textContent = '✍ 手書きチャレンジ';
  btn.onclick = start;
  var sp = bar.querySelector('.sp');
  bar.insertBefore(btn, sp || null);

  // ---------- 出題 ----------
  var ov, qs, idx, results, cur, boxes;

  function start() {
    var pick = SET ? pool.slice() : shuffle(pool).slice(0, NQ);
    qs = pick; idx = 0; results = [];
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.className = 'hw-ov';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    showQ();
  }
  function closeOv() { if (ov) ov.remove(); ov = null; document.body.style.overflow = ''; }

  function maskSentence(e) {
    var s = e.sentence || '';
    if (!s) return '';
    var rd = '<u>' + esc(e.reading) + '</u>';
    if (s.indexOf(e.kanji) >= 0) return esc(s).replace(esc(e.kanji), rd);
    // 活用していて語がそのまま入っていない場合は、送り仮名を除いた部分で置き換える
    var stem = e.kanji.replace(/[぀-ゟ]+$/, '');
    if (stem && stem !== e.kanji && s.indexOf(stem) >= 0) return esc(s).replace(esc(stem), '<u>（' + esc(stem.length ? '　'.repeat(stem.length) : '') + '）</u>');
    return esc(s);
  }

  function showQ() {
    cur = qs[idx];
    var meaning = (cur.meaning && cur.meaning !== cur.reading) ? '意味：' + esc(cur.meaning) : '';
    ov.innerHTML =
      '<div class="hw-in">' +
      '<div class="hw-top"><b>✍ 手書きチャレンジ　Unit ' + U + (setNo ? '　セット' + setNo : '') + '</b><button class="hw-x" type="button">✕ 閉じる</button></div>' +
      '<div class="hw-prog">第' + (idx + 1) + '問 / ' + qs.length + '問</div>' +
      '<div class="hw-read">' + esc(cur.reading) + '</div>' +
      (meaning ? '<div class="hw-mean">' + meaning + '</div>' : '') +
      (cur.sentence ? '<div class="hw-sent">' + maskSentence(cur) + '</div>' : '') +
      '<div>赤い読みを<b>漢字</b>で書きましょう（1文字ずつ、四角の中に）</div>' +
      '<div class="hw-note" style="margin:2px 0 0">「ヒント」を押すと、漢字の左半分が薄く出ます。なぞって、続きも書いて1文字を完成させましょう。</div>' +
      '<div class="hw-boxes" id="hw-boxes"></div>' +
      '<div><button class="hw-btn" id="hw-judge" type="button">答え合わせ</button>' +
      '<button class="hw-btn gray" id="hw-clear" type="button">全部消す</button></div>' +
      '<div id="hw-result"></div></div>';
    ov.querySelector('.hw-x').onclick = closeOv;
    var host = ov.querySelector('#hw-boxes');
    boxes = [];
    Array.prototype.forEach.call(cur.kanji, function (ch) {
      var wrap = document.createElement('div');
      if (!KANJI.test(ch)) {   // 送り仮名などは最初から印刷しておく
        wrap.className = 'hw-fix'; wrap.textContent = ch; host.appendChild(wrap);
        boxes.push({ ch: ch, fixed: true });
        return;
      }
      wrap.className = 'hw-box';
      var cv = document.createElement('div'); cv.className = 'hw-cv';
      var h = document.createElement('canvas'); h.width = 280; h.height = 280;   // ヒント（下の層）
      var c = document.createElement('canvas'); c.width = 280; c.height = 280;   // 筆記（上の層）
      cv.appendChild(h); cv.appendChild(c);
      var m = document.createElement('span'); m.className = 'hw-msg';
      var hb = document.createElement('button'); hb.type = 'button'; hb.className = 'hw-btn hint s'; hb.textContent = 'ヒント';
      var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'hw-btn gray s'; cb.textContent = '消す';
      wrap.appendChild(cv); wrap.appendChild(m); wrap.appendChild(hb); wrap.appendChild(cb);
      host.appendChild(wrap);
      var box = makePad(c, m); box.ch = ch; box.fixed = false;
      hb.onclick = function () { showHint(h, ch); };
      cb.onclick = function () { box.clear(); };
      boxes.push(box);
    });
    ov.querySelector('#hw-judge').onclick = judge;
    ov.querySelector('#hw-clear').onclick = function () { boxes.forEach(function (b) { if (!b.fixed) b.clear(); }); ov.querySelector('#hw-result').innerHTML = ''; };
  }

  // ---------- 書くパッド ----------
  function makePad(c, msg) {
    var ctx = c.getContext('2d');
    ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#123';
    var strokes = [], curS = null, t0 = 0;
    function pos(e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (x) {}
      if (!strokes.length) t0 = Date.now();
      var p = pos(e); curS = [[p[0]], [p[1]], [Date.now() - t0]]; strokes.push(curS);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    });
    c.addEventListener('pointermove', function (e) {
      if (!curS) return; e.preventDefault();
      var p = pos(e); curS[0].push(p[0]); curS[1].push(p[1]); curS[2].push(Date.now() - t0);
      ctx.lineTo(p[0], p[1]); ctx.stroke();
    });
    var end = function () { curS = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    return {
      strokes: function () { return strokes; },
      clear: function () { strokes = []; ctx.clearRect(0, 0, c.width, c.height); msg.textContent = ''; },
      say: function (t, col) { msg.textContent = t; msg.style.color = col || ''; }
    };
  }

  // ヒント：正解の漢字の左半分だけを薄く表示（筆記の層とは別なので認識に影響しない）
  function showHint(h, ch) {
    var x = h.getContext('2d');
    x.clearRect(0, 0, 280, 280);
    x.save();
    x.beginPath(); x.rect(0, 0, 140, 280); x.clip();
    x.font = '240px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(120,135,160,0.5)';
    x.fillText(ch, 140, 150);
    x.restore();
  }

  // ---------- 文字認識 ----------
  async function recognize(strokes) {
    var body = { options: 'enable_pre_space', requests: [{ writing_guide: { writing_area_width: 280, writing_area_height: 280 }, ink: strokes, language: 'ja' }] };
    var r = await fetch('https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json();
    if (j[0] !== 'SUCCESS') throw new Error('recognize fail');
    return j[1][0][1];
  }

  var judged = false;
  async function judge() {
    var out = ov.querySelector('#hw-result');
    var jb = ov.querySelector('#hw-judge'); jb.disabled = true;
    out.innerHTML = '<div class="hw-res bad">判定中…</div>';
    var allOk = true, failed = false;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.fixed) continue;
      var sk = b.strokes();
      if (!sk.length) { allOk = false; b.say('未記入', '#c1121f'); continue; }
      try {
        var cand = await recognize(sk);
        var ok = cand.slice(0, TOPN).indexOf(b.ch) >= 0;   // 上位5候補に正解があれば○（字の癖に寛容）
        b.say((ok ? '○ ' : '× ') + '読み取り：' + cand.slice(0, 3).join(' '), ok ? '#065f46' : '#c1121f');
        if (!ok) allOk = false;
      } catch (e) { failed = true; break; }
    }
    jb.disabled = false;
    var first = results.length === idx;   // この問題の1回目の判定だけ得点に数える
    if (failed) {
      out.innerHTML = '<div class="hw-res bad">文字認識につながりませんでした。自分で答え合わせをしましょう。<br>正解：<span class="hw-ans">' + esc(cur.kanji) + '</span><br>' +
        '<button class="hw-btn ok" data-self="1" type="button">合っていた</button><button class="hw-btn ng" data-self="0" type="button">まちがえた</button></div>';
      Array.prototype.forEach.call(out.querySelectorAll('[data-self]'), function (x) {
        x.onclick = function () { results[idx] = x.getAttribute('data-self') === '1'; next(); };
      });
      return;
    }
    if (first) results[idx] = allOk;
    var last = idx === qs.length - 1;
    out.innerHTML = '<div class="hw-res ' + (allOk ? 'good' : 'bad') + '"><b>' + (allOk ? '正解です！' : 'おしい！もう一度確かめましょう。') + '</b><br>' +
      '正解：<span class="hw-ans">' + esc(cur.kanji) + '</span><br>' +
      '<button class="hw-btn" id="hw-next" type="button">' + (last ? '結果を見る' : '次へ ▶') + '</button>' +
      (allOk ? '' : '<button class="hw-btn gray" id="hw-retry" type="button">書き直して練習</button>') + '</div>';
    ov.querySelector('#hw-next').onclick = next;
    var rt = ov.querySelector('#hw-retry');
    if (rt) rt.onclick = function () { boxes.forEach(function (b) { if (!b.fixed) b.clear(); }); out.innerHTML = ''; };
  }

  function next() {
    idx++;
    if (idx >= qs.length) return showResult();
    showQ();
  }

  // ---------- 結果 ----------
  function showResult() {
    var c = results.filter(Boolean).length, t = qs.length, pass = c / t >= PASS;
    var p = loadP(), key = 'U' + U + 'S' + setNo + 'H', prev = p[key];
    if (!prev || c / t > prev.c / prev.t) p[key] = { c: c, t: t, d: Date.now(), n: ((prev && prev.n) || 0) + 1 };
    else { prev.d = Date.now(); prev.n = (prev.n || 0) + 1; }
    saveP(p);
    ov.innerHTML =
      '<div class="hw-in"><div class="hw-top"><b>✍ 手書きチャレンジ　結果</b><button class="hw-x" type="button">✕ 閉じる</button></div>' +
      '<div class="hw-big">' + c + ' / ' + t + ' 問 正解</div>' +
      '<div class="hw-res ' + (pass ? 'good' : 'bad') + '" style="text-align:center;font-size:20px;font-weight:bold">' +
      (pass ? '🌸 合格！おめでとう！ 🌸' : '🎯 80%以上で合格です。もう一度チャレンジしましょう！') + '</div>' +
      '<div style="margin-top:14px;text-align:center"><button class="hw-btn pink" id="hw-again" type="button">もう一度</button>' +
      '<button class="hw-btn gray" id="hw-close" type="button">閉じる</button></div></div>';
    ov.querySelector('.hw-x').onclick = closeOv;
    ov.querySelector('#hw-close').onclick = closeOv;
    ov.querySelector('#hw-again').onclick = start;
    if (pass) hanafubuki();
  }

  // ---------- 花吹雪（桜の花びら） ----------
  function hanafubuki() {
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var cols = ['#ffb7c5', '#ffc9d6', '#ffd9e2', '#f9a8c0', '#ffe3ea', '#ff9fb8'];
    var petals = [], t0 = performance.now(), SPAWN_MS = 4500, MAX_MS = 11000;
    function spawn(n) {
      for (var i = 0; i < n; i++) {
        var fromTop = Math.random() < 0.45;   // 上から降り、右から吹き込む
        petals.push({
          x: fromTop ? Math.random() * (W + 200) : W + 20,
          y: fromTop ? -20 : Math.random() * H * 0.8 - 40,
          s: 7 + Math.random() * 9,
          vx: -(1.8 + Math.random() * 3.2), vy: 0.8 + Math.random() * 2.2,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.12,
          tilt: Math.random() * 6.28, vt: 0.04 + Math.random() * 0.08,
          ph: Math.random() * 6.28, fr: 0.01 + Math.random() * 0.02, amp: 0.6 + Math.random() * 1.4,
          col: cols[Math.floor(Math.random() * cols.length)]
        });
      }
    }
    function drawPetal(p) {
      var s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.max(0.25, Math.abs(Math.cos(p.tilt))));
      ctx.fillStyle = p.col; ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s, s * 0.25, -s * 0.95, -s, -s * 0.18, -s * 0.92);
      ctx.lineTo(0, -s * 0.62);
      ctx.lineTo(s * 0.18, -s * 0.92);
      ctx.bezierCurveTo(s * 0.95, -s, s, s * 0.25, 0, s * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function frame(now) {
      var el = now - t0;
      ctx.clearRect(0, 0, W, H);
      if (el < SPAWN_MS) spawn(el < 1200 ? 6 : 3);
      var alive = 0;
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.ph += p.fr * 16;
        p.x += p.vx + Math.sin(p.ph) * p.amp;
        p.y += p.vy + Math.cos(p.ph * 0.7) * 0.6;
        p.rot += p.vr; p.tilt += p.vt;
        if (p.x > -40 && p.y < H + 40) { alive++; drawPetal(p); }
      }
      if ((el < SPAWN_MS || alive > 0) && el < MAX_MS) requestAnimationFrame(frame);
      else cv.remove();
    }
    requestAnimationFrame(frame);
  }
})();
