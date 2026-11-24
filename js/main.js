/* =========================================================
   바이브코딩 미션센터 - 동작 스크립트
   ========================================================= */
(function () {
  "use strict";

  var WARMUPS = window.WARMUPS || [];
  var TOPICS = window.TOPICS || [];
  var POWERUPS = window.POWERUPS || [];
  var BUGFIX = window.BUGFIX || [];

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 글자 처리 ---------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 줄 맨 앞의 [제목]은 파란색 소제목, 줄 중간의 [ ]는 노란색 "바꿔도 되는 칸"으로 표시
  function highlight(text) {
    return text.split("\n").map(function (line) {
      var safe = esc(line);
      var m = safe.match(/^(\[[^\]]+\])(.*)$/);
      if (m) {
        return '<span class="sec">' + m[1] + "</span>" + m[2].replace(/\[[^\]]+\]/g, '<span class="fill">$&</span>');
      }
      return safe.replace(/\[[^\]]+\]/g, '<span class="fill">$&</span>');
    }).join("\n");
  }

  var LEVEL_STARS = { 1: "★ 쉬움", 2: "★★ 보통", 3: "★★★ 도전" };
  var CAT_NAME = { game: "게임", study: "학습·퀴즈", make: "창의·생활" };

  function copyButton(targetId, key) {
    return (
      '<div class="copy-row">' +
        '<button type="button" class="copy-btn" data-copy="' + targetId + '" data-key="' + key + '">' +
          '<span class="copy-btn__ico" aria-hidden="true">▶</span>' +
          '<span class="copy-btn__lbl">프롬프트 한번에 복사</span>' +
        "</button>" +
        '<button type="button" class="btn-ghost expand-btn" data-expand="' + targetId + '" hidden>전체 보기 ▼</button>' +
      "</div>"
    );
  }

  function term(id, filename, text, extraClass) {
    return (
      '<div class="term">' +
        '<div class="term__bar"><i></i><i></i><i></i><span>' + esc(filename) + "</span></div>" +
        '<pre class="term__body ' + (extraClass || "") + '" id="' + id + '" tabindex="0">' + highlight(text) + "</pre>" +
      "</div>"
    );
  }


  /* ---------- 효과음 (소리 파일 없이 브라우저에서 직접 만듦) ---------- */
  var Sound = (function () {
    var ctx = null, master = null;
    var on = true;
    try { if (window.localStorage.getItem("vc-sound") === "off") on = false; } catch (e) { /* 저장소 막힘 */ }

    function ac() {
      if (!on) return null;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) {
        try {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.22; // 전체 음량 (0~1)
          master.connect(ctx.destination);
        } catch (e) { ctx = null; return null; }
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    // 음 하나 연주: 주파수, 시작(초), 길이(초), 파형, 크기, 끝 주파수(미끄러지는 소리)
    function tone(freq, start, dur, type, vol, toFreq) {
      var c = ac();
      if (!c) return;
      var t0 = c.currentTime + (start || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    function seq(notes, type, vol, gap) {
      notes.forEach(function (n, i) { tone(n[0], i * (gap || 0.09), n[1] || 0.12, type, vol); });
    }

    return {
      isOn: function () { return on; },
      setOn: function (v) {
        on = !!v;
        try { window.localStorage.setItem("vc-sound", on ? "on" : "off"); } catch (e) { /* 무시 */ }
        if (on) this.coin();
      },
      click: function () { tone(880, 0, 0.06, "square", 0.25, 1320); },             // 딸깍
      select: function () { seq([[660, 0.07], [990, 0.09]], "square", 0.25, 0.06); }, // 메뉴·필터 선택
      coin: function () { seq([[988, 0.08], [1319, 0.32]], "square", 0.35, 0.08); },  // 복사 완료 (코인)
      powerUp: function () { tone(330, 0, 0.22, "triangle", 0.45, 1320); },          // 2단계 열기
      close: function () { tone(880, 0, 0.12, "triangle", 0.35, 330); },             // 닫기
      ding: function () { seq([[1047, 0.1], [1568, 0.3]], "triangle", 0.5, 0.07); },  // 퀘스트 체크
      whoosh: function () { tone(220, 0, 0.3, "sawtooth", 0.18, 1760); },            // 맨위로
      sparkle: function () { seq([[1319, 0.06], [1568, 0.06], [2093, 0.14]], "triangle", 0.35, 0.05); },
      error: function () { seq([[196, 0.12], [147, 0.22]], "sawtooth", 0.25, 0.12); },// 실패
      levelUp: function () {
        seq([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [784, 0.08], [1047, 0.35]], "square", 0.3, 0.09);
      },
      fanfare: function () {
        seq([[523, 0.12], [523, 0.12], [523, 0.12], [698, 0.3], [880, 0.15], [784, 0.12], [1047, 0.6]], "square", 0.3, 0.13);
        seq([[262, 0.4], [349, 0.4], [392, 0.4], [523, 0.8]], "triangle", 0.35, 0.22);
      }
    };
  })();

  function initSound() {
    var btn = document.getElementById("soundBtn");
    function paint() {
      if (!btn) return;
      var on = Sound.isOn();
      btn.classList.toggle("is-off", !on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "효과음 끄기" : "효과음 켜기");
      $(".sound-btn__ico", btn).textContent = on ? "🔊" : "🔇";
      $(".sound-btn__txt", btn).textContent = on ? "소리 ON" : "소리 OFF";
    }
    if (btn) {
      btn.addEventListener("click", function () {
        Sound.setOn(!Sound.isOn());
        paint();
        toast(Sound.isOn() ? "🔊 효과음을 켰어요" : "🔇 효과음을 껐어요");
      });
    }
    paint();

    // 화면의 여러 버튼에 효과음 붙이기 (복사 버튼·소리 버튼은 따로 처리)
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      if (t.closest(".copy-btn, #soundBtn, #q4btn")) return;
      if (t.closest("summary")) {
        var d = t.closest("details");
        (d && !d.open) ? Sound.powerUp() : Sound.close();
        return;
      }
      if (t.closest("#toTop")) { Sound.whoosh(); return; }
      if (t.closest("[data-idea]")) { Sound.sparkle(); return; }
      if (t.closest(".nav a, .filters .chip, .stagemap a")) { Sound.select(); return; }
      if (t.closest("button, .btn-pixel, .logo")) { Sound.click(); return; }
    }, true);
  }

  /* ---------- 화면 만들기 ---------- */
  function renderSimpleCards(list, mountId, prefix, mini) {
    var mount = document.getElementById(mountId);
    if (!mount) return;
    mount.innerHTML = list.map(function (item) {
      var pid = "p-" + item.id;
      return (
        '<article class="card reveal' + (mini ? " card--mini" : "") + '" id="' + item.id + '">' +
          '<div class="card__head">' +
            '<div class="card__icon" aria-hidden="true">' + item.emoji + "</div>" +
            "<div>" +
              '<h3 class="card__title">' + esc(item.title) + "</h3>" +
              (item.desc ? '<p class="card__desc">' + esc(item.desc) + "</p>" : "") +
            "</div>" +
          "</div>" +
          term(pid, prefix + "_" + item.id + ".txt", item.prompt) +
          copyButton(pid, item.id) +
        "</article>"
      );
    }).join("");
  }

  function renderTopics() {
    var mount = document.getElementById("topicList");
    var map = document.getElementById("stageMap");
    if (!mount) return;

    mount.innerHTML = TOPICS.map(function (t, i) {
      var no = String(i + 1).padStart ? String(i + 1).padStart(2, "0") : ("0" + (i + 1)).slice(-2);
      var p1 = "p-" + t.id + "-1";
      var p2 = "p-" + t.id + "-2";
      return (
        '<article class="topic reveal' + (t.isNew ? " is-new" : "") + '" id="' + t.id + '" data-cat="' + t.cat + '" data-new="' + (t.isNew ? 1 : 0) + '">' +
          '<div class="topic__head">' +
            '<div class="topic__icon" aria-hidden="true">' + t.emoji + "</div>" +
            "<div>" +
              '<span class="topic__no">MISSION ' + no + (t.isNew ? ' <em class="newbadge">NEW</em>' : "") + "</span>" +
              '<h3 class="topic__title">' + esc(t.title) + "</h3>" +
              '<div class="topic__tags">' +
                '<span class="tag tag--' + t.cat + '">' + CAT_NAME[t.cat] + "</span>" +
                '<span class="tag">' + esc(t.tag) + "</span>" +
                '<span class="tag tag--lv">' + (LEVEL_STARS[t.level] || "") + "</span>" +
              "</div>" +
              '<p class="topic__desc">' + esc(t.desc) + "</p>" +
            "</div>" +
          "</div>" +
          '<p class="phase-label">STAGE 1 · 1차 제작 프롬프트</p>' +
          term(p1, "mission_" + no + "_make.txt", t.p1) +
          copyButton(p1, t.id + "-p1") +
          '<details class="level2">' +
            '<summary><span><span class="lock"></span>STAGE 2 · 기능 추가 프롬프트</span><span class="arrow" aria-hidden="true">▼</span></summary>' +
            '<div class="level2__body">' +
              '<p class="phase-label">게임이 완성되면 같은 대화창에 붙여넣어요</p>' +
              term(p2, "mission_" + no + "_upgrade.txt", t.p2) +
              copyButton(p2, t.id + "-p2") +
            "</div>" +
          "</details>" +
        "</article>"
      );
    }).join("");

    if (map) {
      map.innerHTML = TOPICS.map(function (t, i) {
        var no = ("0" + (i + 1)).slice(-2);
        return (
          '<a href="#' + t.id + '" data-cat="' + t.cat + '" data-new="' + (t.isNew ? 1 : 0) + '" data-map="' + t.id + '"' + (t.isNew ? ' class="is-new"' : "") + '>' +
            '<span class="n">' + no + "</span>" +
            '<span class="e" aria-hidden="true">' + t.emoji + "</span>" +
            "<span>" + esc(t.title) + "</span>" +
          "</a>"
        );
      }).join("");
    }

    var count = function (c) { return TOPICS.filter(function (t) { return t.cat === c; }).length; };
    setText("nAll", TOPICS.length);
    setText("nGame", count("game"));
    setText("nStudy", count("study"));
    setText("nMake", count("make"));
    setText("nNew", TOPICS.filter(function (t) { return t.isNew; }).length);
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ---------- 분야 필터 ---------- */
  function initFilters() {
    $$(".filters .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter");
        $$(".filters .chip").forEach(function (c) {
          c.classList.toggle("is-on", c === chip);
          c.setAttribute("aria-pressed", c === chip ? "true" : "false");
        });
        var hide = function (el) {
          if (f === "all") return false;
          if (f === "new") return el.getAttribute("data-new") !== "1";
          return el.getAttribute("data-cat") !== f;
        };
        $$(".topic").forEach(function (el) { el.classList.toggle("is-hidden", hide(el)); });
        $$("#stageMap a").forEach(function (el) { el.style.display = hide(el) ? "none" : ""; });
        refreshExpandButtons();
      });
    });

    // 주제 바로가기 → 해당 카드 반짝
    $$("#stageMap a").forEach(function (a) {
      a.addEventListener("click", function () {
        var target = document.getElementById(a.getAttribute("data-map"));
        if (!target) return;
        target.classList.remove("flash");
        setTimeout(function () { target.classList.add("flash"); }, reduceMotion ? 0 : 450);
      });
    });
  }

  /* ---------- 전체 보기 버튼 ---------- */
  function refreshExpandButtons() {
    $$(".expand-btn").forEach(function (btn) {
      var pre = document.getElementById(btn.getAttribute("data-expand"));
      if (!pre || pre.classList.contains("is-open")) return;
      var hiddenNow = pre.offsetParent === null;
      if (hiddenNow) return; // 접혀 있거나 필터로 숨겨진 경우는 나중에 다시 확인
      btn.hidden = pre.scrollHeight <= pre.clientHeight + 4;
    });
  }

  function initExpand() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".expand-btn");
      if (!btn) return;
      var pre = document.getElementById(btn.getAttribute("data-expand"));
      if (!pre) return;
      var open = pre.classList.toggle("is-open");
      btn.textContent = open ? "접기 ▲" : "전체 보기 ▼";
    });
    $$("details.level2").forEach(function (d) {
      d.addEventListener("toggle", refreshExpandButtons);
    });
    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(refreshExpandButtons, 200);
    });
  }

  /* ---------- 복사 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  function selectText(el) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* 무시 */ }
  }

  function setCopied(btn, on) {
    btn.classList.toggle("is-copied", on);
    $(".copy-btn__lbl", btn).textContent = on ? "프롬프트 복사완료" : "프롬프트 한번에 복사";
    $(".copy-btn__ico", btn).textContent = on ? "✔" : "▶";
  }

  function initCopy() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".copy-btn");
      if (!btn) return;
      var pre = document.getElementById(btn.getAttribute("data-copy"));
      if (!pre) return;
      var text = pre.textContent.replace(/ /g, " ").trim();
      var key = btn.getAttribute("data-key");

      copyText(text).then(function () {
        // 다시 눌러도 애니메이션이 보이도록
        btn.classList.remove("is-copied");
        void btn.offsetWidth;
        setCopied(btn, true);
        Sound.coin();
        var gained = gainXP(key);
        floatXP(btn, gained ? "+10 XP" : "복사 OK!");
        if (key === "my" && /\[여기에/.test(text)) {
          toast("✏️ 빈칸이 남아 있어요! 채우고 다시 복사해 보세요");
        } else {
          toast("📋 복사 완료! 제미나이 입력창에 붙여넣기 (Ctrl+V)");
        }
      }).catch(function () {
        Sound.error();
        selectText(pre);
        toast("앗! 자동 복사가 막혔어요. 파랗게 선택된 글자를 Ctrl+C로 복사해요");
      });
    });
  }

  function floatXP(btn, label) {
    if (reduceMotion) return;
    var f = document.createElement("span");
    f.className = "xp-float";
    f.textContent = label;
    btn.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1000);
  }

  /* ---------- XP · 레벨 · 퀘스트 ---------- */
  var copied = {};
  var xp = 0;
  var LEVELS = [
    { at: 0, name: "코딩 새싹" },
    { at: 30, name: "버그 헌터" },
    { at: 60, name: "프롬프트 마법사" },
    { at: 100, name: "바이브 코더" },
    { at: 150, name: "AI 마스터" },
    { at: 210, name: "전설의 개발자" }
  ];
  var currentLevel = 0;
  var questDone = { q1: false, q2: false, q3: false, q4: false };
  var allClearShown = false;

  function levelIndex(v) {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) if (v >= LEVELS[i].at) idx = i;
    return idx;
  }

  function gainXP(key) {
    if (!key || copied[key]) return false;
    copied[key] = true;
    xp += 10;
    updateHUD();
    updateQuests();
    var map = document.querySelector('[data-map="' + key.replace(/-p1$/, "") + '"]');
    if (map && /-p1$/.test(key)) map.classList.add("is-cleared");
    return true;
  }

  function updateHUD() {
    var idx = levelIndex(xp);
    var cur = LEVELS[idx];
    var next = LEVELS[idx + 1];
    var pct = next ? ((xp - cur.at) / (next.at - cur.at)) * 100 : 100;
    setText("xpNum", xp);
    setText("xpLevel", "Lv." + (idx + 1));
    setText("xpName", cur.name);
    var fill = document.getElementById("xpFill");
    if (fill) fill.style.width = Math.max(4, Math.min(100, pct)) + "%";

    if (idx > currentLevel) {
      currentLevel = idx;
      var box = $(".xp");
      if (box) { box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump"); }
      setTimeout(function () { Sound.levelUp(); toast("🆙 LEVEL UP! 이제 너는 「" + cur.name + "」", true); }, 450);
      confetti(40);
    }
  }

  function updateQuests() {
    var keys = Object.keys(copied);
    var has = function (re) { return keys.some(function (k) { return re.test(k); }); };
    var upgrades = keys.filter(function (k) { return /^u\d+$/.test(k) || /-p2$/.test(k); }).length;

    var before = { q1: questDone.q1, q2: questDone.q2, q3: questDone.q3 };
    questDone.q1 = has(/^w\d+$/);
    questDone.q2 = has(/^t\d+-p1$/) || keys.indexOf("my") > -1;
    questDone.q3 = upgrades >= 3;
    setText("q3count", "(" + Math.min(upgrades, 3) + "/3)");
    if (["q1", "q2", "q3"].some(function (q) { return questDone[q] && !before[q]; })) {
      setTimeout(function () { Sound.ding(); }, 380); // 퀘스트 달성 띵동
    }
    paintQuests();
  }

  function paintQuests() {
    var n = 0;
    Object.keys(questDone).forEach(function (q) {
      var li = document.querySelector('[data-quest="' + q + '"]');
      if (li) li.classList.toggle("is-done", questDone[q]);
      if (questDone[q]) n++;
    });
    setText("questDone", n);
    if (n === 4 && !allClearShown) {
      allClearShown = true;
      setTimeout(function () {
        Sound.fanfare();
        toast("🏆 MISSION COMPLETE! 오늘의 퀘스트를 모두 깼어요!", true);
        confetti(120);
      }, 600);
    }
  }

  function initQuest4() {
    var btn = document.getElementById("q4btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      questDone.q4 = !questDone.q4;
      questDone.q4 ? Sound.ding() : Sound.click();
      btn.setAttribute("aria-pressed", questDone.q4 ? "true" : "false");
      paintQuests();
    });
  }

  /* ---------- 알림 · 색종이 ---------- */
  var toastTimer;
  function toast(msg, big) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-big", !!big);
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, big ? 3200 : 2200);
  }

  function confetti(n) {
    if (reduceMotion) return;
    var colors = ["#ffd23f", "#ff5cad", "#34e1ff", "#4ade80", "#8b5cf6", "#ffffff"];
    for (var i = 0; i < n; i++) {
      var c = document.createElement("span");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      c.style.animationDelay = Math.random() * 0.4 + "s";
      c.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      document.body.appendChild(c);
      (function (node) {
        setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 4200);
      })(c);
    }
  }

  /* ---------- 나만의 게임 만들기 ---------- */
  var IDEAS = [
    {
      name: "정답 두더지 대소동",
      what: "화면 위에 수학 문제가 나오고, 구멍 9개에서 숫자가 적힌 두더지가 튀어나와. 정답 숫자가 적힌 두더지만 클릭해서 잡는 게임이야. 틀린 두더지를 잡으면 점수가 줄어.",
      design: "밝은 초록 잔디밭, 귀여운 두더지 캐릭터, 신나는 오락실 분위기",
      goal: "30초 동안 정답 두더지를 10마리 잡으면 성공"
    },
    {
      name: "영어 별똥별 우주선",
      what: "화면 위에 한국어 뜻이 나오고, 영어 단어가 적힌 별들이 떨어져. 방향키로 우주선을 움직여서 뜻이 맞는 영어 단어 별만 먹는 게임이야.",
      design: "까만 우주 배경, 반짝이는 별, 귀여운 로켓 우주선",
      goal: "60초 안에 맞는 단어 별 15개를 먹으면 성공"
    },
    {
      name: "꼬마 셰프 요리 대회",
      what: "손님이 원하는 요리 재료 3가지를 말하면, 재료 버튼을 순서대로 눌러서 요리를 완성하는 게임이야. 맞게 만들면 별점을 받아.",
      design: "알록달록한 주방, 귀여운 요리사 모자, 따뜻한 노란색과 주황색",
      goal: "손님 5명에게 모두 별 3개를 받으면 성공"
    },
    {
      name: "분리수거 영웅",
      what: "위에서 쓰레기(페트병, 종이상자, 캔, 음식물)가 떨어지면 알맞은 분리수거 통으로 드래그하거나 클릭해서 넣는 게임이야. 맞게 넣으면 지구가 점점 깨끗해져.",
      design: "파란 하늘과 초록 공원, 색깔별 분리수거 통, 웃는 지구 캐릭터",
      goal: "40초 동안 20개 이상 맞게 분리하면 지구를 지킨 영웅 칭호를 받아"
    }
  ];

  var BLANK = {
    name: "[여기에 내 작품 이름을 적어요]",
    what: "[여기에 하고 싶은 행동을 적어요]",
    design: "[여기에 원하는 색, 캐릭터, 분위기를 적어요]",
    goal: "[여기에 성공하는 방법을 적어요]"
  };

  function buildPrompt(v) {
    var pick = function (val, k) { val = (val || "").trim(); return val ? val : BLANK[k]; };
    return (
      "나는 초등학교 6학년 학생이야. Gemini 캔버스에서 내가 기획한 프로그램을 직접 실행할 수 있게 만들어줘.\n\n" +
      "[게임 또는 웹앱 이름] " + pick(v.name, "name") + "\n\n" +
      "[무엇을 하는 프로그램인가?] " + pick(v.what, "what") + "\n\n" +
      "[배경과 디자인] " + pick(v.design, "design") + "\n\n" +
      "[성공 조건 또는 목표] " + pick(v.goal, "goal") + "\n\n" +
      "[꼭 필요한 기능] 시작 버튼 / 조작 방법 안내 / 결과 표시 / 다시 시작 버튼\n\n" +
      "[제작 조건] 초등학생이 쓰기 쉽게 버튼과 글자를 크게 하고, 모든 글자는 한국어로 표시해줘. 로그인이나 외부 서버 없이 Gemini Canvas에서 실제로 작동하는 앱으로 만들어줘. 설명만 작성하지 말고 완성된 웹앱과 미리보기를 보여줘."
    );
  }

  function initBuilder() {
    var out = document.getElementById("builderPrompt");
    if (!out) return;
    var f = {
      name: document.getElementById("fName"),
      what: document.getElementById("fWhat"),
      design: document.getElementById("fDesign"),
      goal: document.getElementById("fGoal")
    };
    var btn = $('.copy-btn[data-copy="builderPrompt"]');

    function render() {
      out.innerHTML = highlight(buildPrompt({
        name: f.name.value, what: f.what.value, design: f.design.value, goal: f.goal.value
      }));
      if (btn) setCopied(btn, false); // 내용이 바뀌면 다시 초록 버튼으로
    }

    Object.keys(f).forEach(function (k) { f[k].addEventListener("input", render); });

    $$("[data-idea]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var idea = IDEAS[+chip.getAttribute("data-idea")];
        if (!idea) return;
        f.name.value = idea.name;
        f.what.value = idea.what;
        f.design.value = idea.design;
        f.goal.value = idea.goal;
        render();
        toast("💡 아이디어를 불러왔어요! 내 마음대로 고쳐 보세요");
      });
    });

    var reset = document.getElementById("builderReset");
    if (reset) {
      reset.addEventListener("click", function () {
        Object.keys(f).forEach(function (k) { f[k].value = ""; });
        render();
        f.name.focus();
      });
    }
    render();
  }

  /* ---------- 상단 HUD 높이 · 메뉴 강조 ---------- */
  function syncHudHeight() {
    var hud = document.getElementById("hud");
    if (!hud) return;
    document.documentElement.style.setProperty("--hud-h", hud.offsetHeight + 12 + "px");
  }

  function initScrollSpy() {
    var links = $$(".nav a");
    var nav = $(".nav");
    if (!("IntersectionObserver" in window) || !links.length) return;
    var setActive = function (id) {
      links.forEach(function (a) {
        var on = a.getAttribute("data-nav") === id;
        a.classList.toggle("is-active", on);
        if (on) {
          a.setAttribute("aria-current", "true");
          if (nav && nav.scrollWidth > nav.clientWidth) {
            nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
          }
        } else {
          a.removeAttribute("aria-current");
        }
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setActive(en.target.id === "home" ? "" : en.target.id);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    ["home", "howto", "warmup", "quest", "powerup", "bugfix", "mygame"].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------- 맨위 버튼 ---------- */
  function initToTop() {
    var btn = document.getElementById("toTop");
    if (!btn) return;
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        btn.classList.toggle("is-show", (window.pageYOffset || document.documentElement.scrollTop) > 480);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    btn.addEventListener("click", function () {
      try {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      } catch (e) {
        window.scrollTo(0, 0);
      }
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    });
  }

  /* ---------- 스크롤 등장 효과 ---------- */
  function initReveal() {
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 배경 별 ---------- */
  function initStars() {
    var sky = $(".sky");
    if (!sky) return;
    var n = window.innerWidth < 720 ? 28 : 55;
    var kinds = ["", "", "c", "p", "y"];
    var html = "";
    for (var i = 0; i < n; i++) {
      var size = Math.random() < 0.15 ? 4 : 2;
      html += '<span class="star ' + kinds[i % kinds.length] + '" style="left:' + (Math.random() * 100).toFixed(2) +
        "%;top:" + (Math.random() * 100).toFixed(2) + "%;width:" + size + "px;height:" + size +
        "px;animation-delay:" + (Math.random() * 3).toFixed(2) + "s;animation-duration:" + (2 + Math.random() * 3).toFixed(2) + 's"></span>';
    }
    sky.innerHTML = html;
  }


  /* ---------- 바이브코딩 미리보기 (글자가 타이핑되고 게임이 완성되는 연출) ---------- */
  function initDemo() {
    var typeEl = document.getElementById("demoType");
    var screen = document.getElementById("demoScreen");
    var emoji = document.getElementById("demoEmoji");
    var title = document.getElementById("demoTitle");
    if (!typeEl || !screen) return;
    var SAMPLES = [
      { text: "두더지 잡기 게임을 만들어줘. 구멍 9개, 30초, 잡으면 +1점!", emoji: "🐹", title: "두더지 잡기" },
      { text: "우주선으로 운석을 피하는 게임을 만들어줘. 방향키로 움직이고 하트는 3개!", emoji: "🚀", title: "우주선 운석 피하기" },
      { text: "도레미파솔라시도 피아노를 만들어줘. 건반을 누르면 소리가 나게!", emoji: "🎹", title: "나만의 피아노" },
      { text: "손님 주문대로 아이스크림을 만드는 가게 게임을 만들어줘!", emoji: "🍦", title: "아이스크림 가게" }
    ];
    if (reduceMotion) return; // 움직임 줄이기 설정이면 첫 예시만 보여줌
    var i = 0, timer;
    function play() {
      var sm = SAMPLES[i % SAMPLES.length];
      var n = 0;
      typeEl.textContent = "";
      screen.classList.remove("is-done");
      screen.classList.add("is-loading");
      (function type() {
        n++;
        typeEl.textContent = sm.text.slice(0, n);
        if (n < sm.text.length) {
          timer = setTimeout(type, 55);
        } else {
          timer = setTimeout(function () {
            emoji.textContent = sm.emoji;
            title.textContent = sm.title;
            screen.classList.remove("is-loading");
            screen.classList.add("is-done");
            i++;
            timer = setTimeout(play, 3200);
          }, 500);
        }
      })();
    }
    // 화면에 보일 때만 움직이기
    if ("IntersectionObserver" in window) {
      var running = false;
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !running) { running = true; play(); }
        else if (!en[0].isIntersecting && running) { running = false; clearTimeout(timer); }
      }).observe(screen);
    } else {
      play();
    }
  }

  /* ---------- 시작 ---------- */
  function init() {
    document.documentElement.classList.remove("no-js");
    renderSimpleCards(WARMUPS, "warmupList", "warmup", false);
    renderSimpleCards(POWERUPS, "powerupList", "powerup", true);
    renderSimpleCards(BUGFIX, "bugfixList", "bugfix", true);
    renderTopics();

    initStars();
    initFilters();
    initExpand();
    initCopy();
    initQuest4();
    initSound();
    initBuilder();
    initDemo();
    initToTop();
    syncHudHeight();
    initScrollSpy();
    initReveal();
    updateHUD();
    updateQuests();

    window.addEventListener("resize", syncHudHeight);
    // 글꼴이 늦게 로드되면 높이가 바뀌므로 한 번 더
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { syncHudHeight(); refreshExpandButtons(); });
    }
    setTimeout(refreshExpandButtons, 300);

    // 주소에 #이 있으면 해당 위치로 (렌더링 후)
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) setTimeout(function () { target.scrollIntoView(); }, 50);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
