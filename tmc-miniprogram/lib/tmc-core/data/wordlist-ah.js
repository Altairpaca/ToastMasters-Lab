/* tmc-core/data/wordlist-ah.js
 * 哼哈官默认词表（中英赘词 / 过渡词）。移植自 gc-ah-counter.html 的 DEFAULT_WORDS。
 * cls: 'filler' 赘词（无意识停顿音，默认阈值 3）/ 'overused' 过渡词（口头禅，默认阈值 5）
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const DEFAULT_WORDS = [
  // ---- filler class: 赘词，默认阈值 3 ----
  { w: 'um', cls: 'filler', lang: 'en', gloss: '' },
  { w: 'uh', cls: 'filler', lang: 'en', gloss: '' },
  { w: 'er', cls: 'filler', lang: 'en', gloss: '' },
  { w: 'ah', cls: 'filler', lang: 'en', gloss: '' },
  { w: '嗯', cls: 'filler', lang: 'zh', gloss: 'ēn' },
  { w: '啊', cls: 'filler', lang: 'zh', gloss: 'a' },
  { w: '呃', cls: 'filler', lang: 'zh', gloss: 'è' },

  // ---- overused class: 过渡词，默认阈值 5 ----
  { w: 'like', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'you know', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'so', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'actually', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'basically', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'I mean', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'right', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'well', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'and', cls: 'overused', lang: 'en', gloss: '' },
  { w: 'but', cls: 'overused', lang: 'en', gloss: '' },
  { w: '那个', cls: 'overused', lang: 'zh', gloss: 'nà ge' },
  { w: '就是', cls: 'overused', lang: 'zh', gloss: 'jiù shì' },
  { w: '然后', cls: 'overused', lang: 'zh', gloss: 'rán hòu' },
  { w: '所以说', cls: 'overused', lang: 'zh', gloss: 'suǒ yǐ shuō' },
];

/** 哼哈官默认设置 */
const DEFAULT_AH_SETTINGS = {
  fTh: 3,          // 赘词类进入报表阈值
  oTh: 5,          // 过渡词类进入报表阈值
  split: false,
  lang: 'zh',
  meetingLang: 'zh',
  mode: 'single',
  reportMode: 'rate',
};

/**
 * 猜词语言：含中日韩表意文字判为 zh，否则 en。
 * @param {string} w
 * @returns {'zh'|'en'}
 */
function guessWordLang(w) {
  return /[\u4e00-\u9fff]/.test(w) ? 'zh' : 'en';
}

/**
 * 深拷贝默认词表（避免调用方篡改原表）。
 * @returns {Array<Object>}
 */
function cloneDefaultWords() {
  return DEFAULT_WORDS.map(function (x) { return { w: x.w, cls: x.cls, lang: x.lang, gloss: x.gloss }; });
}

module.exports = {
  DEFAULT_WORDS: DEFAULT_WORDS,
  DEFAULT_AH_SETTINGS: DEFAULT_AH_SETTINGS,
  guessWordLang: guessWordLang,
  cloneDefaultWords: cloneDefaultWords,
};
