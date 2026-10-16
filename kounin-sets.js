/* 江原予備校 漢字クイズ 共通スクリプト
 *  ・?set=N で「5問セット」だけを出題する
 *  ・結果をセットごとの達成度として localStorage に保存(インデックスが読み取る)
 *  ・練習プリント(印刷ページ)へのボタンを表示する
 */
(function () {
  var U = window.KSET_UNIT, D = window.KDATA && window.KDATA[U];
  if (!D) return;
  var params = new URLSearchParams(location.search);
  var setNo = parseInt(params.get('set'), 10) || 0;
  var SET = setNo ? D.sets[setNo - 1] : null;
  if (setNo && !SET) { setNo = 0; }
  var KP = 'kounin-progress-v1';
  var PASS = 0.8; // 80%以上で「合格」

  function loadP() { try { return JSON.parse(localStorage.getItem(KP) || '{}'); } catch (e) { return {}; } }
  function saveP(p) { try { localStorage.setItem(KP, JSON.stringify(p)); } catch (e) {} }
  var $ = function (id) { return document.getElementById(id); };

  // ---------- スタイル ----------
  var st = document.createElement('style');
  st.textContent =
    '.kset-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}' +
    '.kset-bar a,.kset-bar button{font:inherit;font-size:13px;font-weight:bold;text-decoration:none;cursor:pointer;' +
    'padding:7px 14px;border-radius:20px;border:2px solid #001858;background:#fff;color:#001858}' +
    '.kset-bar a:hover,.kset-bar button:hover{background:#fef6e4}' +
    '.kset-bar .print{background:#001858;color:#fff}.kset-bar .print:hover{background:#172554}' +
    '.kset-bar .sp{flex:1}' +
    '.kset-banner{background:#fef6e4;border:2px solid #f582ae;border-radius:12px;padding:12px 16px;margin-bottom:14px}' +
    '.kset-banner .t{font-size:18px;font-weight:bold;color:#001858}' +
    '.kset-banner .w{font-size:14px;color:#5e6472;margin-top:4px;word-break:keep-all}' +
    '.kset-next{display:inline-block;margin-top:10px;text-decoration:none}';
  document.head.appendChild(st);

  // ---------- 5問セットの絞り込み ----------
  if (SET) {
    var nos = {};
    SET.items.forEach(function (e) { nos[e.no] = true; });
    var pick = function (arr) { return (arr || []).filter(function (q) { return nos[q.no]; }); };
    if (typeof COURSES !== 'undefined') {
      // レッスン/ランク別ページ: 全レッスンから該当問題を集めて1つの擬似コースにする
      var merged = { A: [], C: [], B: [] };
      Object.keys(COURSES).forEach(function (k) {
        ['A', 'C', 'B'].forEach(function (s) { merged[s] = merged[s].concat(pick(COURSES[k][s])); });
      });
      Object.keys(COURSES).forEach(function (k) { delete COURSES[k]; });
      COURSES.S = { A: merged.A, C: merged.C, B: merged.B, count: SET.items.length };
      currentCourse = 'S';
      QUESTIONS_A = merged.A; QUESTIONS_C = merged.C; QUESTIONS_B = merged.B;
      if (typeof buildStepInfo === 'function') buildStepInfo();
      window.renderCourseSelector = function () {};
      var cs = $('course-selector'); if (cs) cs.style.display = 'none';
    } else {
      [QUESTIONS_A, QUESTIONS_C, QUESTIONS_B].forEach(function (arr) {
        var f = pick(arr); arr.splice.apply(arr, [0, arr.length].concat(f));
      });
    }
    // 苦手カード・最高得点はセットごとに別管理
    var pre = (typeof STORAGE_PREFIX !== 'undefined') ? STORAGE_PREFIX : STORAGE_PREFIX_BASE;
    window.weakKey = function (step) { return pre + 'set' + setNo + '-weak-' + step; };
    window.scoreKey = function (step) { return pre + 'set' + setNo + '-score-' + step; };
    var chip = $('course-info-chip');
    if (chip) {
      chip.textContent = '📚 セット' + setNo + ':' + SET.items.length + '問';
    }
  }

  // ---------- ホーム画面のバナー ----------
  var home = $('panel-home');
  if (home) {
    var printHref = 'kounin-print.html?unit=' + U + (setNo ? '&set=' + setNo : '');
    var bar = document.createElement('div');
    bar.className = 'kset-bar';
    var h = '<a href="kounin-kanji-index.html">🏠 インデックスへ</a>';
    if (setNo) {
      if (setNo > 1) h += '<a href="' + D.file + '?set=' + (setNo - 1) + '">◀ 前のセット</a>';
      if (setNo < D.sets.length) h += '<a href="' + D.file + '?set=' + (setNo + 1) + '">次のセット ▶</a>';
      h += '<a href="' + D.file + '">このユニット全体で練習</a>';
    }
    h += '<span class="sp"></span><a href="' + printHref + '" target="_blank" rel="noopener">👁 ' +
      (setNo ? 'このセットのプリントを閲覧' : 'プリントを閲覧(全セット)') + '</a>' +
      '<a class="print" href="' + printHref + '&print=1" target="_blank" rel="noopener">🖨 ' +
      (setNo ? 'このセットのプリントを印刷' : 'プリントを印刷(全セット)') + '</a>';
    bar.innerHTML = h;
    home.insertBefore(bar, home.firstChild);

    if (setNo) {
      var words = SET.items.map(function (e) { return e.kanji; }).join('　');
      var banner = document.createElement('div');
      banner.className = 'kset-banner';
      banner.innerHTML = '<div class="t">セット ' + setNo + ' / ' + D.sets.length + '(' + SET.items.length + '問)</div>' +
        '<div class="w">' + words + '</div>';
      home.insertBefore(banner, bar.nextSibling);
      // 全体向けの説明(全問数など)は隠し、ステップ選択だけ見せる
      var keepH3 = false;
      Array.prototype.slice.call(home.children).forEach(function (el) {
        if (el === bar || el === banner || el.id === 'step-cards' || el.id === 'course-selector') return;
        if (!keepH3 && el.tagName === 'H3') { keepH3 = true; el.style.marginTop = '4px'; return; }
        if (keepH3 === true && el.tagName === 'P') { keepH3 = 'done'; return; }
        el.style.display = 'none';
      });
    }
  }

  // ---------- 達成度の記録 ----------
  if (SET) {
    var origShow = window.showResult;
    window.showResult = function () {
      var total = currentQuestions.length;
      if (!isWeakMode && total > 0) {
        var p = loadP();
        var key = 'U' + U + 'S' + setNo + currentStep;
        var prev = p[key];
        var rate = correctCount / total;
        if (!prev || rate > prev.c / prev.t) p[key] = { c: correctCount, t: total, d: Date.now() };
        else { prev.d = Date.now(); }
        p[key].n = ((prev && prev.n) || 0) + 1;
        saveP(p);
      }
      origShow.apply(this, arguments);
      var btns = document.querySelector('.result-buttons');
      if (btns && !isWeakMode) {
        if (setNo < D.sets.length) {
          var a = document.createElement('a');
          a.className = 'start-btn secondary';
          a.style.textDecoration = 'none';
          a.href = D.file + '?set=' + (setNo + 1);
          a.textContent = '次のセット ▶';
          btns.appendChild(a);
        }
        var b = document.createElement('a');
        b.className = 'start-btn gray';
        b.style.textDecoration = 'none';
        b.href = 'kounin-kanji-index.html';
        b.textContent = '📋 インデックスへ';
        btns.appendChild(b);
      }
      var pr = loadP()['U' + U + 'S' + setNo + currentStep];
      if (pr && !isWeakMode) {
        var ok = pr.c / pr.t >= PASS;
        var card = document.querySelector('.result-card');
        if (card) {
          var d = document.createElement('div');
          d.style.cssText = 'margin-top:10px;padding:10px;border-radius:8px;font-size:14px;font-weight:bold;background:' +
            (ok ? '#d1fae5;color:#065f46' : '#fef6e4;color:#001858');
          d.textContent = ok ? '✅ このステップは達成!(最高 ' + pr.c + '/' + pr.t + ')'
            : '🎯 80%以上で達成です。もう一度チャレンジ!(最高 ' + pr.c + '/' + pr.t + ')';
          card.insertBefore(d, card.querySelector('.result-buttons'));
        }
      }
    };
  }

  // ---------- 画面の再描画と自動スタート ----------
  if (typeof renderStepCards === 'function') renderStepCards();
  if (typeof updateWeakCountChip === 'function') updateWeakCountChip();
  var autoStep = params.get('step');
  if (SET && autoStep && /^[ACB]$/.test(autoStep) && STEP_INFO[autoStep] &&
      STEP_INFO[autoStep].questions && STEP_INFO[autoStep].questions.length) {
    startStep(autoStep);
  }
})();
