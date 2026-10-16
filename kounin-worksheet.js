/* 江原予備校 漢字練習プリント 問題生成ロジック(ブラウザ/Node 共通)
 * makeRounds(unit, set, rng) → 3回分の問題(書き5+読み5 をランダムに並べたもの)
 * 問題の形式
 *   {no, kind:'write'|'read', parts:[{t:'文字列', u:true|false(下線=答える部分)}...],
 *    hint:'意味などのヒント', cells:[{pre:'あ'}|{}...] (書き: 解答マス), n: 読み解答マス数,
 *    answer:'答え'}
 */
(function (root) {
  const isKana = c => /[ぁ-ゖァ-ヺー]/.test(c);
  const h2k = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 例文のうち target を差し替えて parts にする。見つからなければ null
  function partsReplace(sentence, target, repl) {
    if (!sentence) return null;
    const i = sentence.indexOf(target);
    if (i < 0) return null;
    return [
      { t: sentence.slice(0, i) },
      { t: repl, u: true },
      { t: sentence.slice(i + target.length) }
    ].filter(p => p.t !== '');
  }

  // 送りがなを分離: {head:漢字部分, okuri:送りがな, stem:語幹の読み}
  function splitOkuri(kanji, reading) {
    const m = kanji.match(/([ぁ-ゖ]+)$/);
    if (m && kanji.length > m[1].length && reading.endsWith(m[1]) && reading.length > m[1].length) {
      return { head: kanji.slice(0, -m[1].length), okuri: m[1], stem: reading.slice(0, -m[1].length) };
    }
    return { head: kanji, okuri: '', stem: reading };
  }

  // Unit7 の例文(カタカナ混じり)から漢字版の例文を復元する
  function restoreKanjiSentence(e) {
    const o = splitOkuri(e.kanji, e.reading);
    const tries = [[h2k(o.stem) + o.okuri, e.kanji], [h2k(e.reading), e.kanji], [o.stem + o.okuri, e.kanji],
                   [h2k(o.stem), o.head], [o.stem, o.head]];
    for (const [t, r] of tries) {
      if (t && e.sentence.indexOf(t) >= 0) return e.sentence.replace(t, r);
    }
    return null;
  }

  function cellsFor(text) {
    return Array.from(text).map(c => (isKana(c) ? { pre: c } : {}));
  }

  // 1語(エントリ)から 書き・読み の問題を作る。side は類義語/対義語の出題側(1 or 2)
  function makeItem(unit, e, kind, side) {
    // ---- 類義語・対義語(ペア) ----
    if (unit === 9 || unit === 10) {
      const rel = unit === 9 ? '≒' : '⇔';
      const given = side === 1 ? e.w2 : e.w1, givenR = side === 1 ? e.r2 : e.r1;
      const target = side === 1 ? e.w1 : e.w2, targetR = side === 1 ? e.r1 : e.r2;
      if (kind === 'write') {
        return {
          no: e.no, kind, parts: [{ t: given + ' ' + rel + ' ' }, { t: targetR, u: true }],
          hint: unit === 9 ? '同じ意味の言葉' : '反対の意味の言葉', cells: cellsFor(target), answer: target
        };
      }
      const parts = side === 1
        ? [{ t: target, u: true }, { t: ' ' + rel + ' ' + given }]
        : [{ t: given + ' ' + rel + ' ' }, { t: target, u: true }];
      return { no: e.no, kind, parts, hint: '下線の言葉の読み', n: targetR.length, answer: targetR };
    }
    // ---- 慣用句・ことわざ ----
    if (unit === 11) {
      if (kind === 'write') {
        return {
          no: e.no, kind, parts: [{ t: '意味:' + e.meaning }], hint: '読み:' + e.reading,
          cells: cellsFor(e.kanji), answer: e.kanji
        };
      }
      return { no: e.no, kind, parts: [{ t: e.kanji, u: true }], hint: '読みをひらがなで', n: e.reading.length, answer: e.reading };
    }
    // ---- 熟字訓 ----
    if (unit === 12) {
      if (kind === 'write') {
        return { no: e.no, kind, parts: [{ t: e.reading, u: true }], hint: '漢字で書く', cells: cellsFor(e.kanji), answer: e.kanji };
      }
      return { no: e.no, kind, parts: [{ t: e.kanji, u: true }], hint: '読みをひらがなで', n: e.reading.length, answer: e.reading };
    }
    // ---- 訓読み・音読み・同訓異字・同音異義語・書き取り・四字熟語・読み誤り ----
    let kSentence = e.sentence;
    if (unit === 7) kSentence = restoreKanjiSentence(e);
    const hintUnits = { 5: 1, 6: 1, 8: 1 };
    // 例文中の対象: 原形そのまま → なければ送りがな手前までの漢字部分(活用形)
    const o = splitOkuri(e.kanji, e.reading);
    let target = e.kanji, tReading = e.reading;
    if (kSentence && kSentence.indexOf(e.kanji) < 0 && o.okuri && kSentence.indexOf(o.head) >= 0) {
      target = o.head; tReading = o.stem;
    }
    if (kind === 'write') {
      let parts = kSentence ? partsReplace(kSentence, target, tReading) : null;
      if (!parts) { parts = [{ t: e.reading, u: true }]; target = e.kanji; }
      const hint = hintUnits[unit] && e.meaning ? '意味:' + e.meaning : '漢字で書く';
      return { no: e.no, kind, parts, hint, cells: cellsFor(target), answer: target };
    }
    let parts = kSentence ? partsReplace(kSentence, target, target) : null;
    if (!parts) { parts = [{ t: e.kanji, u: true }]; tReading = e.reading; }
    return { no: e.no, kind, parts, hint: '下線の漢字の読み', n: tReading.length, answer: tReading };
  }

  // 3回分 (書き+読み をランダムに並べる)
  function makeRounds(unit, items, rng) {
    rng = rng || Math.random;
    const base = items.map(() => (rng() < 0.5 ? 1 : 2));
    const rounds = [];
    for (let r = 0; r < 3; r++) {
      const list = [];
      items.forEach((e, i) => {
        const sw = base[i], so = 3 - base[i];
        // 書き: 1回目 base, 2回目 逆, 3回目 base / 読み: 1回目 逆, 2回目 base, 3回目 逆
        const wSide = r === 1 ? so : sw, rSide = r === 1 ? sw : so;
        list.push(makeItem(unit, e, 'write', wSide));
        list.push(makeItem(unit, e, 'read', rSide));
      });
      rounds.push(shuffle(list, rng));
    }
    return rounds;
  }

  const api = { makeRounds, makeItem, mulberry32, shuffle, h2k, isKana, restoreKanjiSentence };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KWS = api;
})(typeof window !== 'undefined' ? window : globalThis);
