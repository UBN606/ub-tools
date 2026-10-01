/*
 * UB Tools — Daily Quote Widget (embed-quote.js)
 *
 * A zero-dependency, zero-network embeddable quote-of-the-day widget.
 * Drop it on any website with:
 *
 *   <div data-ub-quote></div>
 *   <script src="https://ubn606.github.io/ub-tools/app/embed-quote.js"></script>
 *
 * The quote bank below is MACHINE-GENERATED from the book text by
 * build-embed-bank.mjs (every quote sliced verbatim and PASS-verified with
 * ub-verify.js). Do not hand-edit the bank section; rebuild it instead:
 *
 *   node app/build-embed-bank.mjs
 *
 * Public API: window.UBQuoteWidget = { mount(el, opts), pick(date) }
 */
(function () {
  'use strict';

  /*__BANK__*/
  var UBQ_BANK = [
    {
      "q": "The goodness of God rests at the bottom of the divine free-willness—the universal tendency to love, show mercy, manifest patience, and minister forgiveness.",
      "c": "2:6.9",
      "t": "love"
    },
    {
      "q": "Health, sanity, and happiness are integrations of truth, beauty, and goodness as they are blended in human experience.",
      "c": "2:7.11",
      "t": "joy"
    },
    {
      "q": "God is unlimited in power, divine in nature, final in will, infinite in attributes, eternal in wisdom, and absolute in reality.",
      "c": "3:2.15",
      "t": "wisdom"
    },
    {
      "q": "God created the universes of his own free and sovereign will, and he created them in accordance with his all-wise and eternal purpose.",
      "c": "4:0.1",
      "t": "wisdom"
    },
    {
      "q": "Jesus revealed a God of love, and love is all-embracing of truth, beauty, and goodness.",
      "c": "5:4.6",
      "t": "love"
    },
    {
      "q": "Spiritually he thrives in the experience of divine companionship, in the spiritual satisfactions of true worship.",
      "c": "5:5.10",
      "t": "worship"
    },
    {
      "q": "The mandates of the Eternal Son, as they go forth over the spirit circuits of the Second Source and Center, are keyed in tones of mercy.",
      "c": "6:3.2",
      "t": "forgiveness"
    },
    {
      "q": "The Eternal Son is truly a merciful minister, a divine spirit, a spiritual power, and a real personality.",
      "c": "6:7.3",
      "t": "forgiveness"
    },
    {
      "q": "In spirit nature, divine wisdom, and co-ordinate creative power, these Creator Sons are potentially equal with God the Father and God the Son.",
      "c": "7:6.3",
      "t": "wisdom"
    },
    {
      "q": "God is love, the Son is mercy, the Spirit is ministry—the ministry of divine love and endless mercy to all intelligent creation.",
      "c": "8:4.2",
      "t": "love"
    },
    {
      "q": "The Son is infinite in wisdom and truth, in spiritual expression and interpretation; he is the universal revealer.",
      "c": "9:0.2",
      "t": "wisdom"
    },
    {
      "q": "Man rejoices in the goodness of God, Havoners exult in the divine beauty, while you both enjoy the ministry of the liberty of living truth.",
      "c": "14:4.13",
      "t": "joy"
    },
    {
      "q": "Worship, the sincere pursuit of divine values and the wholehearted love of the divine Value-Giver.",
      "c": "16:8.14",
      "t": "love"
    },
    {
      "q": "As the bestowal Sons of mercy, the Avonals reveal the matchless nature of the Eternal Son of infinite compassion.",
      "c": "20:10.4",
      "t": "forgiveness"
    },
    {
      "q": "The satisfying joy of high duty is the eclipsing emotion of spiritual beings.",
      "c": "25:1.6",
      "t": "joy"
    },
    {
      "q": "While the Isle of Paradise contains certain places of worship, it is more nearly one vast sanctuary of divine service.",
      "c": "27:7.2",
      "t": "service"
    },
    {
      "q": "Worship is the highest joy of Paradise existence; it is the refreshing play of Paradise.",
      "c": "27:7.5",
      "t": "worship"
    },
    {
      "q": "While the spirit techniques of mercy ministry are beyond your concept, you should even now understand that mercy is a quality of growth.",
      "c": "28:6.8",
      "t": "forgiveness"
    },
    {
      "q": "The pursuit of happiness is an experience of joy and satisfaction.",
      "c": "55:5.6",
      "t": "joy"
    },
    {
      "q": "The struggles of these early ages were characterized by courage, bravery, and even heroism.",
      "c": "64:7.20",
      "t": "courage"
    },
    {
      "q": "A universal language promotes peace, insures culture, and augments happiness.",
      "c": "81:6.18",
      "t": "peace"
    },
    {
      "q": "Prayer, therefore, very early became a mighty promoter of social evolution, moral progress, and spiritual attainment.",
      "c": "91:1.2",
      "t": "prayer"
    },
    {
      "q": "The psychic and spiritual concomitants of the prayer of faith are immediate, personal, and experiential.",
      "c": "91:6.7",
      "t": "prayer"
    },
    {
      "q": "Ever since those eventful days the highest God concept in the Occident has embraced universal justice, divine mercy, and eternal righteousness.",
      "c": "97:7.13",
      "t": "forgiveness"
    },
    {
      "q": "Spiritual growth yields lasting joy, peace which passes all understanding.",
      "c": "100:4.3",
      "t": "peace"
    },
    {
      "q": "The more healthful attitude of spiritual meditation is to be found in reflective worship and in the prayer of thanksgiving.",
      "c": "100:5.10",
      "t": "prayer"
    },
    {
      "q": "Spiritual philosophy, the wisdom of spirit realities, is the endowment of the Spirit of Truth, the combined gift of the bestowal Sons to the children of men.",
      "c": "101:3.2",
      "t": "wisdom"
    },
    {
      "q": "Generates profound courage and confidence despite natural adversity and physical calamity.",
      "c": "101:3.7",
      "t": "courage"
    },
    {
      "q": "What knowledge and reason cannot do for us, true wisdom admonishes us to allow faith to accomplish through religious insight and spiritual transformation.",
      "c": "102:1.2",
      "t": "faith"
    },
    {
      "q": "Prayer may enrich the life, but worship illuminates destiny.",
      "c": "102:4.5",
      "t": "prayer"
    },
    {
      "q": "When reason once recognizes right and wrong, it exhibits wisdom; when wisdom chooses between right and wrong, truth and error, it demonstrates spirit leading.",
      "c": "103:9.10",
      "t": "wisdom"
    },
    {
      "q": "Through truth man attains beauty and by spiritual love ascends to goodness.",
      "c": "103:9.10",
      "t": "love"
    },
    {
      "q": "Thinking surrenders to wisdom, and wisdom is lost in enlightened and reflective worship.",
      "c": "112:2.11",
      "t": "worship"
    },
    {
      "q": "In time, thinking leads to wisdom and wisdom leads to worship; in eternity, worship leads to wisdom, and wisdom eventuates in the finality of thought.",
      "c": "112:2.13",
      "t": "worship"
    },
    {
      "q": "In following this leading you are sure to encounter, and if you have the courage, to traverse, the rugged hills of moral choosing and spiritual progress.",
      "c": "113:4.3",
      "t": "courage"
    },
    {
      "q": "In the eternal ages men and angels will co-operate in the divine service as they did in the career of time.",
      "c": "113:7.6",
      "t": "service"
    },
    {
      "q": "Truth, beauty, and goodness are correlated in the ministry of the Spirit, the grandeur of Paradise, the mercy of the Son, and the experience of the Supreme.",
      "c": "117:1.7",
      "t": "forgiveness"
    },
    {
      "q": "Happiness and peace of mind follow pure thinking and virtuous living as the shadow follows the substance of material things.",
      "c": "131:3.3",
      "t": "peace"
    },
    {
      "q": "Faith must be very near the truth of things, and I do not see how a man can live without this good faith.",
      "c": "131:9.3",
      "t": "faith"
    },
    {
      "q": "The supremely happy and efficiently unified mind is the one wholly dedicated to the doing of the will of the Father in heaven.",
      "c": "133:7.12",
      "t": "joy"
    },
    {
      "q": "If different religions recognize the spirit sovereignty of God the Father, then will all such religions remain at peace.",
      "c": "134:4.3",
      "t": "peace"
    },
    {
      "q": "If you would enter the kingdom, you must have a righteousness that consists in love, mercy, and truth—the sincere desire to do the will of my Father in heaven.",
      "c": "140:6.3",
      "t": "love"
    },
    {
      "q": "Have faith—confidence in the eventual triumph of divine justice and eternal goodness.",
      "c": "140:8.8",
      "t": "faith"
    },
    {
      "q": "God is spirit, and they who worship him must worship him in spirit and in truth.",
      "c": "143:5.6",
      "t": "worship"
    },
    {
      "q": "Worship—contemplation of the spiritual—must alternate with service, contact with material reality.",
      "c": "143:7.3",
      "t": "service"
    },
    {
      "q": "Prayer, when indited by the spirit, leads to co-operative spiritual progress.",
      "c": "144:2.2",
      "t": "prayer"
    },
    {
      "q": "The ideal prayer is a form of spiritual communion which leads to intelligent worship.",
      "c": "144:2.2",
      "t": "prayer"
    },
    {
      "q": "By faith you are justified; by faith are you saved; and by this same faith are you eternally advanced in the way of progressive and divine perfection.",
      "c": "150:5.3",
      "t": "faith"
    },
    {
      "q": "Blessed are you, Yahweh, who blesses his people Israel with peace.",
      "c": "150:8.7",
      "t": "peace"
    },
    {
      "q": "I have come to proclaim spiritual liberty, teach eternal truth, and foster living faith.",
      "c": "153:2.6",
      "t": "faith"
    },
    {
      "q": "Bid them be of good courage and put their trust in the Father of the kingdom.",
      "c": "154:6.5",
      "t": "courage"
    },
    {
      "q": "Admonish them to find no offense in me but rather to seek for a knowledge of the will of God and for grace and courage to do that will.",
      "c": "154:6.12",
      "t": "courage"
    },
    {
      "q": "Spiritual destiny is dependent on faith, love, and devotion to truth—hunger and thirst for righteousness—the wholehearted desire to find God and to be like him.",
      "c": "156:5.7",
      "t": "faith"
    },
    {
      "q": "Future generations shall know also the radiance of our joy, the buoyance of our good will, and the inspiration of our good humor.",
      "c": "159:3.10",
      "t": "joy"
    },
    {
      "q": "If your religion is a spiritual experience, your object of worship must be the universal spirit reality and ideal of all your spiritualized concepts.",
      "c": "160:5.3",
      "t": "worship"
    },
    {
      "q": "Spiritual worship cannot be shared with material devotions; no man can serve two masters.",
      "c": "163:3.1",
      "t": "service"
    },
    {
      "q": "Very soon must I leave you and take up the work the Father has intrusted to my hands, but be of good courage, for I will sometime return.",
      "c": "176:2.3",
      "t": "courage"
    },
    {
      "q": "Truth is living; the Spirit of Truth is ever leading the children of light into new realms of spiritual reality and divine service.",
      "c": "176:3.7",
      "t": "service"
    },
    {
      "q": "In this world you will have tribulation, but be of good cheer; I have triumphed in the world and shown you the way to eternal joy and everlasting service.",
      "c": "181:1.6",
      "t": "service"
    },
    {
      "q": "The religion of Jesus provides the joy and peace of another and spiritual existence to enhance and ennoble the life which men now live in the flesh.",
      "c": "194:3.3",
      "t": "peace"
    }
  ];
  /*__END_BANK__*/

  var UB_TOOLS_URL = 'https://ubn606.github.io/ub-tools/app/';
  var STYLE_ID = 'ubq-widget-styles';
  var THEMES = { light: 1, dark: 1, auto: 1 };

  var CSS = [
    '.ubq-widget{font-family:Georgia,"Times New Roman",serif;margin:0;padding:1em 1.25em;',
    'border-left:4px solid #b98a2f;background:#faf7ef;color:#2b2b2b;border-radius:0 8px 8px 0;',
    'max-width:34em;box-sizing:border-box}',
    '.ubq-widget.ubq-dark{background:#1d1a13;color:#e8e0cd;border-left-color:#d4a94e}',
    '.ubq-quote{margin:0 0 .6em;padding:0;font-size:1.05em;line-height:1.55;font-style:italic}',
    '.ubq-quote:before{content:"\\201C";margin-right:.1em}',
    '.ubq-quote:after{content:"\\201D";margin-left:.1em}',
    '.ubq-meta{display:flex;justify-content:space-between;align-items:baseline;gap:1em;flex-wrap:wrap;',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-style:normal;font-size:.78em;line-height:1.4}',
    '.ubq-cite{color:#6b5d3f}',
    '.ubq-dark .ubq-cite{color:#b3a67f}',
    '.ubq-verified{color:#8a6d2b;text-decoration:none;white-space:nowrap}',
    '.ubq-dark .ubq-verified{color:#d4a94e}',
    '.ubq-verified:hover{text-decoration:underline}',
    '@media (prefers-color-scheme:dark){',
    '.ubq-widget.ubq-auto{background:#1d1a13;color:#e8e0cd;border-left-color:#d4a94e}',
    '.ubq-widget.ubq-auto .ubq-cite{color:#b3a67f}',
    '.ubq-widget.ubq-auto .ubq-verified{color:#d4a94e}',
    '}'
  ].join('\n');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === 'string' || typeof v === 'number') {
      var p = new Date(v);
      if (!isNaN(p.getTime())) return p;
    }
    return new Date();
  }

  // Deterministic quote for a date: index = days-since-epoch % bank.length.
  // UTC date parts keep it identical in every timezone.
  function pick(date) {
    if (!UBQ_BANK || !UBQ_BANK.length) return null;
    var d = toDate(date);
    var days = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
    var i = ((days % UBQ_BANK.length) + UBQ_BANK.length) % UBQ_BANK.length;
    return UBQ_BANK[i];
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById && document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    if (st.setAttribute) st.setAttribute('id', STYLE_ID);
    else st.id = STYLE_ID;
    if (st.styleSheet) { st.styleSheet.cssText = CSS; }
    else if (document.createTextNode) { st.appendChild(document.createTextNode(CSS)); }
    var heads = document.getElementsByTagName ? document.getElementsByTagName('head') : [];
    var parent = heads && heads[0] ? heads[0] : document.documentElement;
    if (parent && parent.appendChild) parent.appendChild(st);
  }

  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var theme = THEMES[opts.theme] ? opts.theme : 'auto';
    var showCitation = opts.showCitation !== false;
    var item = pick(opts.date);
    if (!item) return null;
    ensureStyles();
    var html = '<figure class="ubq-widget ubq-' + theme + '">' +
      '<blockquote class="ubq-quote">' + esc(item.q) + '</blockquote>';
    if (showCitation) {
      html += '<figcaption class="ubq-meta">' +
        '<span class="ubq-cite">(The Urantia Book, ' + esc(item.c) + ')</span>' +
        '<a class="ubq-verified" href="' + UB_TOOLS_URL + '" target="_blank" rel="noopener noreferrer">' +
        'Verified with UB Tools</a></figcaption>';
    }
    html += '</figure>';
    el.innerHTML = html;
    return item;
  }

  function autoMount() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var els = document.querySelectorAll('[data-ub-quote]');
    for (var i = 0; i < els.length; i++) {
      var theme = els[i].getAttribute ? (els[i].getAttribute('data-theme') || 'auto') : 'auto';
      mount(els[i], { theme: theme });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && document.addEventListener) {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }

  if (typeof window !== 'undefined') {
    window.UBQuoteWidget = { mount: mount, pick: pick };
  }
})();
