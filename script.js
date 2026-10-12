(function () {
  "use strict";

  const STORAGE_KEY = "small-theater-lp-generator-data";
  const AUTOSAVE_DELAY_MS = 500;
  const MAX_IMAGE_FILE_SIZE_BYTES = 1024 * 1024;
  const DEFAULT_FAQ_QUESTIONS = [
    "上演時間はどれくらいですか",
    "開場は何分前ですか",
    "開演に遅れた場合は入れますか",
    "当日券はありますか",
    "未就学児は入場できますか",
    "車椅子での観劇は可能ですか",
    "大きな荷物は持ち込めますか",
    "写真撮影はできますか"
  ];
  const COLLECTION_CONFIG = {
    highlights: { path: "highlights", min: 1, label: "見どころ" },
    cast: { path: "cast", min: 1, label: "キャスト" },
    staff: { path: "staff", min: 1, label: "スタッフ" },
    scheduleRows: { path: "schedule.rows", min: 1, label: "日程" },
    prices: { path: "ticket.prices", min: 1, label: "料金" },
    faq: { path: "faq", min: 1, label: "FAQ" }
  };
  let lpData = null;
  let previewMode = "mobile";
  let autosaveTimer = null;

  function createDefaultData() {
    return {
      page: { title: "公演タイトル" },
      hero: {
        companyName: "劇団名",
        headline: "キャッチコピー",
        subtext: "公演期間・会場・短い案内",
        imageUrl: "",
        buttonText: "チケット予約",
        buttonUrl: "#ticket",
        layout: { mobile: "centered", desktop: "two-column" }
      },
      overview: {
        title: "公演概要",
        authorDirector: "",
        genre: "",
        duration: "",
        periodSummary: "",
        venue: "",
        description: ""
      },
      story: { lead: "", body: "" },
      highlights: [
        { title: "", text: "" },
        { title: "", text: "" },
        { title: "", text: "" }
      ],
      cast: Array.from({ length: 4 }, function () {
        return { name: "", role: "", profile: "", imageUrl: "" };
      }),
      staff: Array.from({ length: 4 }, function () {
        return { role: "", name: "" };
      }),
      schedule: {
        noteReception: "",
        noteOpen: "",
        noteRuntime: "",
        noteOther: "",
        rows: Array.from({ length: 5 }, function () {
          return { date: "", weekday: "", time: "", status: "" };
        })
      },
      ticket: {
        title: "チケット情報",
        buttonText: "予約する",
        buttonUrl: "",
        seatType: "",
        paymentNote: "",
        sameDayTicket: "",
        ageNote: "",
        notes: "",
        prices: Array.from({ length: 3 }, function () {
          return { label: "", amount: "", note: "" };
        })
      },
      access: {
        venueName: "",
        address: "",
        venueUrl: "",
        mapUrl: "",
        accessText: "",
        station1: "",
        station2: "",
        notice: ""
      },
      faq: DEFAULT_FAQ_QUESTIONS.slice(0, 4).map(function (question) {
        return { question: question, answer: "" };
      }),
      contact: {
        email: "",
        phone: "",
        websiteUrl: "",
        xUrl: "",
        instagramUrl: ""
      },
      cta: {
        title: "ご予約はこちら",
        text: "",
        buttonText: "チケット予約",
        buttonUrl: ""
      },
      footer: { organizer: "", copyright: "© 2026" },
      sections: {
        story: true,
        highlights: true,
        cast: true,
        staff: true,
        faq: true,
        contact: true
      },
      design: {
        primaryColor: "#111827",
        accentColor: "#c026d3",
        useAutoCtaButtonColor: true,
        ctaButtonColor: "#ffffff",
        backgroundColor: "#f9fafb",
        textColor: "#111827",
        borderRadius: 16,
        sectionPadding: 24,
        buttonStyle: "solid",
        fontFamily: "sans-serif"
      },
      seo: {
        metaDescription: "",
        ogTitle: "",
        ogDescription: "",
        ogImageURL: "",
        faviconURL: ""
      }
    };
  }

  function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    var out = {};
    for (var k in obj) {
      if (isSafeKey(k) && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = deepClone(obj[k]);
    }
    return out;
  }

  function deepMerge(base, override) {
    if (override === null || typeof override !== "object") return override;
    if (Array.isArray(override)) return deepClone(override);
    var result = deepClone(base || {});
    for (var k in override) {
      if (!isSafeKey(k) || !Object.prototype.hasOwnProperty.call(override, k)) continue;
      if (
        override[k] !== null &&
        typeof override[k] === "object" &&
        !Array.isArray(override[k]) &&
        base &&
        typeof base[k] === "object" &&
        !Array.isArray(base[k])
      ) {
        result[k] = deepMerge(result[k], override[k]);
      } else {
        result[k] = deepClone(override[k]);
      }
    }
    return result;
  }

  function getByPath(obj, path) {
    var parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setByPath(obj, path, value) {
    var parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      var nextKey = parts[i + 1];
      var isArray = /^\d+$/.test(nextKey);
      if (cur[key] == null) cur[key] = isArray ? [] : {};
      cur = cur[key];
    }
    if (parts.length) cur[parts[parts.length - 1]] = value;
  }

  function createCollectionItem(collectionKey, index) {
    if (collectionKey === "highlights") return { title: "", text: "" };
    if (collectionKey === "cast") return { name: "", role: "", profile: "", imageUrl: "" };
    if (collectionKey === "staff") return { role: "", name: "" };
    if (collectionKey === "scheduleRows") return { date: "", weekday: "", time: "", status: "" };
    if (collectionKey === "prices") return { label: "", amount: "", note: "" };
    if (collectionKey === "faq") {
      return { question: DEFAULT_FAQ_QUESTIONS[index] || "", answer: "" };
    }
    return {};
  }

  function getCollectionArray(data, collectionKey) {
    var config = COLLECTION_CONFIG[collectionKey];
    if (!config) return [];
    var current = getByPath(data, config.path);
    return Array.isArray(current) ? current : [];
  }

  function setCollectionArray(data, collectionKey, arr) {
    var config = COLLECTION_CONFIG[collectionKey];
    if (!config) return;
    setByPath(data, config.path, arr);
  }

  function normalizeDynamicCollections() {
    Object.keys(COLLECTION_CONFIG).forEach(function (collectionKey) {
      var config = COLLECTION_CONFIG[collectionKey];
      var current = getCollectionArray(lpData, collectionKey);
      var normalized = current.map(function (item, index) {
        return deepMerge(createCollectionItem(collectionKey, index), item || {});
      });

      while (normalized.length < config.min) {
        normalized.push(createCollectionItem(collectionKey, normalized.length));
      }
      setCollectionArray(lpData, collectionKey, normalized);
    });
  }

  function escapeHtml(str) {
    if (str == null || typeof str !== "string") return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function isSafeKey(key) {
    return key !== "__proto__" && key !== "prototype" && key !== "constructor";
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    var hex = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      return "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return fallback;
  }

  function getContrastColor(hex) {
    var normalized = normalizeHexColor(hex, "#111827");
    var r = parseInt(normalized.slice(1, 3), 16);
    var g = parseInt(normalized.slice(3, 5), 16);
    var b = parseInt(normalized.slice(5, 7), 16);
    var brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness >= 160 ? "#111827" : "#ffffff";
  }

  function formatRichText(value) {
    if (value == null) return "";
    var escaped = escapeHtml(String(value));
    escaped = escaped.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    return escaped.replace(/\r\n|\r|\n/g, "<br>");
  }

  function trimValue(value) {
    return value == null ? "" : String(value).trim();
  }

  function isValidLink(value, kind) {
    var v = trimValue(value);
    if (!v) return true;
    if (/[\u0000-\u001f\u007f]/.test(v)) return false;
    try {
      var parsed = new URL(v, "https://lp.invalid/");
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return true;
      if (kind === "email") return parsed.protocol === "mailto:";
      if (kind === "phone") return parsed.protocol === "tel:";
      if (!kind) return parsed.protocol === "mailto:" || parsed.protocol === "tel:";
      if (kind === "image" && parsed.protocol === "data:") {
        return /^data:image\/(png|jpeg|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/]+={0,2}$/i.test(v);
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function safeUrl(value, kind) {
    return isValidLink(value, kind) ? trimValue(value) : "";
  }

  // Preserve drafts as entered; enforce URL policy at the shared preview/export sink.
  function dataForOutput(data) {
    var d = deepClone(data);
    ["hero.buttonUrl", "ticket.buttonUrl", "access.venueUrl", "access.mapUrl",
      "contact.websiteUrl", "contact.xUrl", "contact.instagramUrl", "cta.buttonUrl"].forEach(function (path) {
      setByPath(d, path, safeUrl(getByPath(d, path)));
    });
    ["hero.imageUrl", "seo.ogImageURL", "seo.faviconURL"].forEach(function (path) {
      setByPath(d, path, safeUrl(getByPath(d, path), "image"));
    });
    (d.cast || []).forEach(function (item) { item.imageUrl = safeUrl(item.imageUrl, "image"); });
    return d;
  }

  function getImageSourceLabel(value) {
    var v = trimValue(value);
    if (!v) return "未設定";
    if (/^data:image\//i.test(v)) return "ローカル画像を使用中";
    return "URL画像を使用中";
  }

  function sectionVisible(data, key) {
    return data.sections && data.sections[key] === true;
  }

  function collectPublishChecks(data) {
    var d = data || lpData;
    var errors = [];
    var warnings = [];

    function pushError(message) {
      errors.push(message);
    }

    function pushWarning(message) {
      warnings.push(message);
    }

    function requireText(value, label) {
      if (!trimValue(value)) pushError(label + " が未入力です。");
    }

    function requirePair(textValue, urlValue, label) {
      var hasText = !!trimValue(textValue);
      var hasUrl = !!trimValue(urlValue);
      if (hasText !== hasUrl) {
        pushError(label + " は文言とURLをセットで入力してください。");
      }
    }

    function validateUrl(value, label, kind) {
      if (!isValidLink(value, kind)) pushError(label + " の形式が正しくありません。安全でないURLはプレビューから除外されます。");
    }

    requireText(d.page && d.page.title, "ページタイトル");
    requireText(d.hero && d.hero.headline, "Hero見出し");

    requirePair(d.hero && d.hero.buttonText, d.hero && d.hero.buttonUrl, "Heroボタン");
    requirePair(d.ticket && d.ticket.buttonText, d.ticket && d.ticket.buttonUrl, "チケットボタン");
    requirePair(d.cta && d.cta.buttonText, d.cta && d.cta.buttonUrl, "Final CTAボタン");

    var hasAnyReservationLink = (
      trimValue(d.hero && d.hero.buttonText) && trimValue(d.hero && d.hero.buttonUrl)
    ) || (
      trimValue(d.ticket && d.ticket.buttonText) && trimValue(d.ticket && d.ticket.buttonUrl)
    ) || (
      trimValue(d.cta && d.cta.buttonText) && trimValue(d.cta && d.cta.buttonUrl)
    );
    if (!hasAnyReservationLink) {
      pushError("予約導線となるボタンがありません。Hero / チケット / Final CTA のいずれかに文言とURLを入れてください。");
    }

    var scheduleRows = ((d.schedule && d.schedule.rows) || []);
    if (!scheduleRows.some(function (row) { return trimValue(row.date) && trimValue(row.time); })) {
      pushError("公演日程は少なくとも1件、日付と開演時間を入力してください。");
    }

    validateUrl(d.hero && d.hero.imageUrl, "メインビジュアルURL", "image");
    validateUrl(d.hero && d.hero.buttonUrl, "HeroボタンURL");
    validateUrl(d.ticket && d.ticket.buttonUrl, "チケットボタンURL");
    validateUrl(d.access && d.access.venueUrl, "会場URL");
    validateUrl(d.access && d.access.mapUrl, "地図URL");
    validateUrl(d.contact && d.contact.websiteUrl, "ウェブサイトURL");
    validateUrl(d.contact && d.contact.xUrl, "X URL");
    validateUrl(d.contact && d.contact.instagramUrl, "Instagram URL");
    validateUrl(d.cta && d.cta.buttonUrl, "Final CTAボタンURL");
    validateUrl(d.seo && d.seo.ogImageURL, "OG画像URL", "image");
    validateUrl(d.seo && d.seo.faviconURL, "favicon URL", "image");
    if (d.contact && trimValue(d.contact.email)) validateUrl("mailto:" + d.contact.email, "メール", "email");
    if (d.contact && trimValue(d.contact.phone)) validateUrl("tel:" + d.contact.phone, "電話", "phone");

    ((d.cast || [])).forEach(function (castItem, index) {
      validateUrl(castItem && castItem.imageUrl, "キャスト " + (index + 1) + " の画像URL", "image");
    });

    if (sectionVisible(d, "story") && !trimValue(d.story && d.story.lead) && !trimValue(d.story && d.story.body)) {
      pushWarning("あらすじを出力設定にしていますが、本文が空です。");
    }
    if (sectionVisible(d, "highlights") && !(d.highlights || []).some(function (item) { return trimValue(item.title) || trimValue(item.text); })) {
      pushWarning("見どころを出力設定にしていますが、内容が空です。");
    }
    if (sectionVisible(d, "cast") && !(d.cast || []).some(function (item) { return trimValue(item.name) || trimValue(item.role) || trimValue(item.profile); })) {
      pushWarning("キャストを出力設定にしていますが、内容が空です。");
    }
    if (sectionVisible(d, "contact") && !(d.contact && (d.contact.email || d.contact.phone || d.contact.websiteUrl || d.contact.xUrl || d.contact.instagramUrl))) {
      pushWarning("お問い合わせを出力設定にしていますが、連絡先が空です。");
    }

    return { errors: errors, warnings: warnings };
  }

  function renderPublishCheckSummary(result) {
    var summary = document.getElementById("publish-check-summary");
    if (!summary) return;
    var checks = result || collectPublishChecks(lpData);
    summary.className = "validation-summary is-visible";
    if (checks.errors.length) {
      summary.classList.add("is-error");
      summary.innerHTML = "<p>出力前に修正が必要です。</p><ul>" + checks.errors.map(function (message) {
        return "<li>" + escapeHtml(message) + "</li>";
      }).join("") + "</ul>";
      return;
    }
    if (checks.warnings.length) {
      summary.classList.add("is-warning");
      summary.innerHTML = "<p>出力はできますが、確認しておくと安全です。</p><ul>" + checks.warnings.map(function (message) {
        return "<li>" + escapeHtml(message) + "</li>";
      }).join("") + "</ul>";
      return;
    }
    summary.classList.add("is-success");
    summary.innerHTML = "<p>出力前チェックは通過しています。</p>";
  }

  function generateLPHTML(data, options) {
    var d = dataForOutput(data || lpData);
    var opts = options || {};
    var esc = escapeAttribute;
    var title = esc(d.page && d.page.title ? d.page.title : "公演");
    var metaDesc = esc((d.seo && d.seo.metaDescription) || "");
    var ogTitle = esc((d.seo && d.seo.ogTitle) || (d.page && d.page.title) || "公演");
    var ogDesc = esc((d.seo && d.seo.ogDescription) || (d.seo && d.seo.metaDescription) || "");
    var ogImg = esc((d.seo && d.seo.ogImageURL) || "");
    var favicon = esc((d.seo && d.seo.faviconURL) || "");
    var fontFamily = (d.design && d.design.fontFamily) || "sans-serif";
    var googleFont = "";

    if (fontFamily === "modern") {
      googleFont = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">';
    } else if (fontFamily === "serif") {
      googleFont = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet">';
    }

    var styleTag = opts.inlineCss ? "  <style>\n" + generateLPCSS(d) + "\n  </style>\n" : "  <link rel=\"stylesheet\" href=\"style.css\">\n";
    var html = "<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>" + title + "</title>\n  <meta name=\"description\" content=\"" + metaDesc + "\">\n  <meta property=\"og:title\" content=\"" + ogTitle + "\">\n  <meta property=\"og:description\" content=\"" + ogDesc + "\">\n  <meta property=\"og:image\" content=\"" + ogImg + "\">\n  <meta property=\"og:type\" content=\"website\">\n" + (favicon ? "  <link rel=\"icon\" href=\"" + favicon + "\">\n" : "") + "  " + googleFont + "\n" + styleTag + "</head>\n<body>\n<main class=\"lp-page\">\n";

    var hero = d.hero || {};
    var heroImg = hero.imageUrl ? "<img src=\"" + esc(hero.imageUrl) + "\" alt=\"\" class=\"hero-image\">" : "";
    var heroBtn = (hero.buttonText && hero.buttonUrl) ? "<a href=\"" + esc(hero.buttonUrl) + "\" class=\"btn hero-cta\" target=\"_blank\" rel=\"noopener\">" + esc(hero.buttonText) + "</a>" : "";
    html += "  <!-- Hero -->\n  <section class=\"hero hero-mobile-" + esc(hero.layout && hero.layout.mobile || "centered") + " hero-desktop-" + esc(hero.layout && hero.layout.desktop || "two-column") + "\">\n    <div class=\"hero-inner\">\n      " + (hero.layout && hero.layout.mobile === "image-first" ? heroImg + "\n      " : "") + "<div class=\"hero-text\">\n        " + (hero.companyName ? "<p class=\"hero-company\">" + esc(hero.companyName) + "</p>" : "") + "\n        " + (hero.headline ? "<h1 class=\"hero-headline\">" + esc(hero.headline) + "</h1>" : "") + "\n        " + (hero.subtext ? "<p class=\"hero-subtext\">" + esc(hero.subtext) + "</p>" : "") + "\n        " + heroBtn + "\n      </div>\n      " + (hero.layout && hero.layout.mobile !== "image-first" && heroImg ? heroImg + "\n    " : "") + "</div>\n  </section>\n";

    var overview = d.overview || {};
    if (overview.title || overview.authorDirector || overview.venue || overview.description) {
      html += "  <!-- Overview -->\n  <section class=\"section overview\">\n    <h2 class=\"section-title\">" + esc(overview.title || "公演概要") + "</h2>\n    <div class=\"overview-body\">\n";
      if (overview.authorDirector) html += "      <p><strong>作・演出</strong> " + esc(overview.authorDirector) + "</p>\n";
      if (overview.genre) html += "      <p><strong>ジャンル</strong> " + esc(overview.genre) + "</p>\n";
      if (overview.duration) html += "      <p><strong>上演時間</strong> " + esc(overview.duration) + "</p>\n";
      if (overview.periodSummary) html += "      <p><strong>公演期間</strong> " + esc(overview.periodSummary) + "</p>\n";
      if (overview.venue) html += "      <p><strong>会場</strong> " + esc(overview.venue) + "</p>\n";
      if (overview.description) html += "      <div class=\"overview-desc\">" + formatRichText(overview.description) + "</div>\n";
      html += "    </div>\n  </section>\n";
    }

    if (sectionVisible(d, "story") && d.story && (d.story.lead || d.story.body)) {
      html += "  <!-- Story -->\n  <section class=\"section story\">\n    <h2 class=\"section-title\">あらすじ</h2>\n    <div class=\"story-body\">\n";
      if (d.story.lead) html += "      <p class=\"story-lead\">" + formatRichText(d.story.lead) + "</p>\n";
      if (d.story.body) html += "      <div class=\"story-text\">" + formatRichText(d.story.body) + "</div>\n";
      html += "    </div>\n  </section>\n";
    }

    if (sectionVisible(d, "highlights") && d.highlights && d.highlights.some(function (h) { return h.title || h.text; })) {
      html += "  <!-- Highlights -->\n  <section class=\"section highlights\">\n    <h2 class=\"section-title\">見どころ</h2>\n    <div class=\"highlights-grid\">\n";
      d.highlights.forEach(function (h) {
        if (!h.title && !h.text) return;
        html += "      <div class=\"highlight-card\"><h3>" + esc(h.title) + "</h3><p>" + formatRichText(h.text) + "</p></div>\n";
      });
      html += "    </div>\n  </section>\n";
    }

    if (sectionVisible(d, "cast") && d.cast && d.cast.some(function (c) { return c.name || c.role || c.profile; })) {
      html += "  <!-- Cast -->\n  <section class=\"section cast\" id=\"cast\">\n    <h2 class=\"section-title\">キャスト</h2>\n    <div class=\"cast-grid\">\n";
      d.cast.forEach(function (c) {
        if (!c.name && !c.role && !c.profile) return;
        var img = c.imageUrl ? "<img src=\"" + esc(c.imageUrl) + "\" alt=\"" + esc(c.name) + "\" class=\"cast-photo\">" : "";
        html += "      <div class=\"cast-card\">" + img + "<div class=\"cast-info\"><p class=\"cast-name\">" + esc(c.name) + "</p><p class=\"cast-role\">" + esc(c.role) + "</p><p class=\"cast-profile\">" + formatRichText(c.profile) + "</p></div></div>\n";
      });
      html += "    </div>\n  </section>\n";
    }

    if (sectionVisible(d, "staff") && d.staff && d.staff.some(function (s) { return s.role || s.name; })) {
      html += "  <!-- Staff -->\n  <section class=\"section staff\">\n    <h2 class=\"section-title\">スタッフ</h2>\n    <ul class=\"staff-list\">\n";
      d.staff.forEach(function (s) {
        if (!s.role && !s.name) return;
        html += "      <li><span class=\"staff-role\">" + esc(s.role) + "</span><span class=\"staff-name\">" + esc(s.name) + "</span></li>\n";
      });
      html += "    </ul>\n  </section>\n";
    }

    var schedule = d.schedule || {};
    var rows = schedule.rows || [];
    var hasSchedule = schedule.noteReception || schedule.noteOpen || schedule.noteRuntime || schedule.noteOther || rows.some(function (r) { return r.date || r.time || r.status || r.weekday; });
    if (hasSchedule) {
      html += "  <!-- Schedule -->\n  <section class=\"section schedule\" id=\"schedule\">\n    <h2 class=\"section-title\">公演日程</h2>\n";
      if (schedule.noteReception) html += "    <p class=\"schedule-note\">" + esc(schedule.noteReception) + "</p>\n";
      if (schedule.noteOpen) html += "    <p class=\"schedule-note\">" + esc(schedule.noteOpen) + "</p>\n";
      if (schedule.noteRuntime) html += "    <p class=\"schedule-note\">" + esc(schedule.noteRuntime) + "</p>\n";
      if (schedule.noteOther) html += "    <p class=\"schedule-note\">" + esc(schedule.noteOther) + "</p>\n";
      html += "    <div class=\"schedule-table-wrap\"><table class=\"schedule-table\"><thead><tr><th>日付</th><th>開演</th><th></th></tr></thead><tbody>\n";
      rows.forEach(function (r) {
        if (!r.date && !r.time && !r.status && !r.weekday) return;
        html += "      <tr><td>" + esc(r.date) + " " + esc(r.weekday) + "</td><td>" + esc(r.time) + "</td><td>" + esc(r.status) + "</td></tr>\n";
      });
      html += "    </tbody></table></div>\n  </section>\n";
    }

    var ticket = d.ticket || {};
    var hasTicket = ticket.title || ticket.buttonUrl || (ticket.prices && ticket.prices.some(function (p) { return p.label || p.amount; }));
    if (hasTicket) {
      html += "  <!-- Ticket -->\n  <section class=\"section ticket\" id=\"ticket\">\n    <h2 class=\"section-title\">" + esc(ticket.title || "チケット情報") + "</h2>\n";
      if (ticket.seatType) html += "    <p>" + esc(ticket.seatType) + "</p>\n";
      if (ticket.prices && ticket.prices.length) {
        html += "    <table class=\"prices-table\"><tbody>\n";
        ticket.prices.forEach(function (p) {
          if (!p.label && !p.amount) return;
          html += "      <tr><td>" + esc(p.label) + "</td><td>" + esc(p.amount) + "</td><td>" + esc(p.note || "") + "</td></tr>\n";
        });
        html += "    </tbody></table>\n";
      }
      if (ticket.paymentNote) html += "    <p>" + esc(ticket.paymentNote) + "</p>\n";
      if (ticket.sameDayTicket) html += "    <p>当日券: " + esc(ticket.sameDayTicket) + "</p>\n";
      if (ticket.ageNote) html += "    <p>" + esc(ticket.ageNote) + "</p>\n";
      if (ticket.notes) html += "    <p>" + esc(ticket.notes) + "</p>\n";
      if (ticket.buttonText && ticket.buttonUrl) html += "    <p><a href=\"" + esc(ticket.buttonUrl) + "\" class=\"btn ticket-cta\" target=\"_blank\" rel=\"noopener\">" + esc(ticket.buttonText) + "</a></p>\n";
      html += "  </section>\n";
    }

    var access = d.access || {};
    if (access.venueName || access.address || access.accessText || access.mapUrl) {
      html += "  <!-- Access -->\n  <section class=\"section access\">\n    <h2 class=\"section-title\">会場・アクセス</h2>\n    <div class=\"access-body\">\n";
      if (access.venueName) html += "      <h3>" + esc(access.venueName) + "</h3>\n";
      if (access.address) html += "      <p class=\"access-address\">" + esc(access.address) + "</p>\n";
      if (access.venueUrl) html += "      <p><a href=\"" + esc(access.venueUrl) + "\" target=\"_blank\" rel=\"noopener\">会場サイト</a></p>\n";
      if (access.station1) html += "      <p>" + esc(access.station1) + "</p>\n";
      if (access.station2) html += "      <p>" + esc(access.station2) + "</p>\n";
      if (access.accessText) html += "      <div class=\"access-text\">" + formatRichText(access.accessText) + "</div>\n";
      if (access.mapUrl) html += "      <p><a href=\"" + esc(access.mapUrl) + "\" class=\"btn btn-sm\" target=\"_blank\" rel=\"noopener\">地図を開く</a></p>\n";
      if (access.notice) html += "      <p class=\"access-notice\">" + esc(access.notice) + "</p>\n";
      html += "    </div>\n  </section>\n";
    }

    if (sectionVisible(d, "faq") && d.faq && d.faq.some(function (f) { return f.answer; })) {
      html += "  <!-- FAQ -->\n  <section class=\"section faq\">\n    <h2 class=\"section-title\">よくある質問</h2>\n    <dl class=\"faq-list\">\n";
      d.faq.forEach(function (f) {
        if (!f.answer) return;
        html += "      <dt>" + esc(f.question) + "</dt><dd>" + esc(f.answer) + "</dd>\n";
      });
      html += "    </dl>\n  </section>\n";
    }

    if (sectionVisible(d, "contact") && d.contact && (d.contact.email || d.contact.phone || d.contact.websiteUrl || d.contact.xUrl || d.contact.instagramUrl)) {
      var c = d.contact;
      html += "  <!-- Contact -->\n  <section class=\"section contact\">\n    <h2 class=\"section-title\">お問い合わせ</h2>\n    <ul class=\"contact-list\">\n";
      if (c.email) html += "      <li>メール: " + (safeUrl("mailto:" + c.email, "email") ? "<a href=\"" + esc(safeUrl("mailto:" + c.email, "email")) + "\">" + esc(c.email) + "</a>" : esc(c.email)) + "</li>\n";
      if (c.phone) html += "      <li>電話: " + (safeUrl("tel:" + c.phone, "phone") ? "<a href=\"" + esc(safeUrl("tel:" + c.phone, "phone")) + "\">" + esc(c.phone) + "</a>" : esc(c.phone)) + "</li>\n";
      if (c.websiteUrl) html += "      <li><a href=\"" + esc(c.websiteUrl) + "\" target=\"_blank\" rel=\"noopener\">公式サイト</a></li>\n";
      if (c.xUrl) html += "      <li><a href=\"" + esc(c.xUrl) + "\" target=\"_blank\" rel=\"noopener\">X (Twitter)</a></li>\n";
      if (c.instagramUrl) html += "      <li><a href=\"" + esc(c.instagramUrl) + "\" target=\"_blank\" rel=\"noopener\">Instagram</a></li>\n";
      html += "    </ul>\n  </section>\n";
    }

    var cta = d.cta || {};
    if (cta.title || (cta.buttonText && cta.buttonUrl)) {
      html += "  <!-- CTA -->\n  <section class=\"section cta\">\n    <h2 class=\"section-title\">" + esc(cta.title || "ご予約はこちら") + "</h2>\n";
      if (cta.text) html += "    <p>" + formatRichText(cta.text) + "</p>\n";
      if (cta.buttonText && cta.buttonUrl) html += "    <p><a href=\"" + esc(cta.buttonUrl) + "\" class=\"btn cta-btn\" target=\"_blank\" rel=\"noopener\">" + esc(cta.buttonText) + "</a></p>\n";
      html += "  </section>\n";
    }

    var footer = d.footer || {};
    html += "  <!-- Footer -->\n  <footer class=\"footer\">\n    " + (footer.organizer ? "<p>" + esc(footer.organizer) + "</p>\n    " : "") + "    <p class=\"copyright\">" + esc(footer.copyright || "© 2026") + "</p>\n  </footer>\n";
    html += "</main>\n</body>\n</html>";
    return html;
  }

  function generateLPCSS(data) {
    var d = data || lpData;
    var design = d.design || {};
    var primary = normalizeHexColor(design.primaryColor, "#111827");
    var accent = normalizeHexColor(design.accentColor, "#c026d3");
    var autoCtaButtonColor = design.useAutoCtaButtonColor !== false;
    var ctaButtonBg = autoCtaButtonColor
      ? getContrastColor(primary)
      : normalizeHexColor(design.ctaButtonColor, getContrastColor(primary));
    var ctaButtonText = getContrastColor(ctaButtonBg);
    var bg = normalizeHexColor(design.backgroundColor, "#f9fafb");
    var text = normalizeHexColor(design.textColor, "#111827");
    var radius = Number.isFinite(Number(design.borderRadius)) ? Math.max(0, Math.min(100, Number(design.borderRadius))) : 16;
    var pad = Number.isFinite(Number(design.sectionPadding)) ? Math.max(0, Math.min(200, Number(design.sectionPadding))) : 24;
    var btnStyle = design.buttonStyle || "solid";
    var fontFamily = design.fontFamily === "serif" ? "'Noto Serif JP', serif" : design.fontFamily === "modern" ? "'Noto Sans JP', sans-serif" : "sans-serif";

    var btnBg = primary;
    var btnColor = "#fff";
    var btnBorder = primary;
    if (btnStyle === "outline") {
      btnBg = "transparent";
      btnColor = primary;
      btnBorder = primary;
    } else if (btnStyle === "ghost") {
      btnBg = "transparent";
      btnColor = primary;
      btnBorder = "transparent";
    }

    var css = "/* Generated LP styles */\n";
    css += ".lp-page { font-family: " + fontFamily + "; color: " + text + "; background: " + bg + "; margin: 0; padding: 0; }\n";
    css += ".lp-page * { box-sizing: border-box; }\n";
    css += ".lp-page p, .lp-page h1, .lp-page h2, .lp-page h3, .lp-page li, .lp-page td, .lp-page dd, .lp-page dt, .lp-page a, .lp-page div { overflow-wrap: anywhere; word-break: break-word; }\n";
    css += ".section { padding: " + pad + "px 20px; max-width: 100%; }\n";
    css += "@media (min-width: 768px) { .section { padding: " + (pad + 8) + "px 40px; } }\n";
    css += ".section-title { font-size: 1.5rem; margin: 0 0 1rem 0; color: " + primary + "; border-bottom: 2px solid " + accent + "; padding-bottom: 8px; }\n";
    css += ".hero { background: " + primary + "; color: #fff; padding: " + pad + "px 20px; text-align: center; }\n";
    css += ".hero-inner { max-width: 1200px; margin: 0 auto; }\n";
    css += ".hero-company { font-size: 0.9rem; opacity: 0.9; margin: 0 0 4px 0; }\n";
    css += ".hero-headline { font-size: 1.75rem; margin: 0 0 8px 0; line-height: 1.3; }\n";
    css += ".hero-subtext { font-size: 0.95rem; margin: 0 0 16px 0; opacity: 0.95; }\n";
    css += ".hero-image { max-width: 100%; height: auto; border-radius: " + radius + "px; }\n";
    css += ".hero-cta { display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: " + radius + "px; font-weight: 600; margin-top: 8px; }\n";
    css += ".hero-cta:hover { opacity: 0.9; }\n";
    css += ".hero-mobile-image-first .hero-inner { display: flex; flex-direction: column; gap: 20px; }\n";
    css += ".hero-mobile-text-first .hero-inner, .hero-mobile-centered .hero-inner { display: flex; flex-direction: column; gap: 20px; }\n";
    css += ".hero-desktop-centered .hero-inner { max-width: 900px; text-align: center; }\n";
    css += ".hero-desktop-wide .hero-inner { max-width: 1400px; text-align: left; }\n";
    css += ".hero-desktop-wide .hero-image { width: 100%; max-width: 100%; margin-top: 20px; }\n";
    css += "@media (min-width: 768px) { .hero-desktop-two-column .hero-inner { display: flex; align-items: center; gap: 32px; text-align: left; }\n";
    css += ".hero-desktop-two-column .hero-text { flex: 1; }\n";
    css += ".hero-desktop-two-column .hero-image { max-width: 45%; }\n";
    css += ".hero-desktop-centered .hero-image { margin: 24px auto 0; }\n";
    css += ".hero-desktop-wide .hero-text { max-width: 900px; } }\n";
    css += ".overview-body p { margin: 0 0 8px 0; }\n";
    css += ".overview-desc { margin-top: 12px; }\n";
    css += ".story-lead { font-size: 1.05rem; margin: 0 0 12px 0; }\n";
    css += ".story-text { line-height: 1.8; }\n";
    css += ".highlights-grid { display: grid; gap: 16px; margin-top: 16px; }\n";
    css += "@media (min-width: 768px) { .highlights-grid { grid-template-columns: repeat(3, 1fr); } }\n";
    css += ".highlight-card { background: #fff; border: 1px solid #e5e7eb; border-radius: " + radius + "px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }\n";
    css += ".highlight-card h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: " + primary + "; }\n";
    css += ".highlight-card p { margin: 0; font-size: 0.95rem; }\n";
    css += ".cast-grid { display: grid; gap: 20px; margin-top: 16px; }\n";
    css += "@media (min-width: 600px) { .cast-grid { grid-template-columns: repeat(2, 1fr); } }\n";
    css += "@media (min-width: 900px) { .cast-grid { grid-template-columns: repeat(3, 1fr); } }\n";
    css += ".cast-card { background: #fff; border-radius: " + radius + "px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }\n";
    css += ".cast-photo { width: 100%; aspect-ratio: 1; object-fit: cover; }\n";
    css += ".cast-info { padding: 12px; }\n";
    css += ".cast-name { font-weight: 600; margin: 0 0 4px 0; }\n";
    css += ".cast-role { font-size: 0.9rem; color: " + accent + "; margin: 0 0 4px 0; }\n";
    css += ".cast-profile { font-size: 0.85rem; margin: 0; white-space: normal; }\n";
    css += ".staff-list { list-style: none; padding: 0; margin: 0; }\n";
    css += ".staff-list li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; gap: 16px; }\n";
    css += ".staff-role { font-weight: 500; min-width: 100px; color: " + primary + "; }\n";
    css += ".schedule-note { margin: 0 0 8px 0; font-size: 0.9rem; }\n";
    css += ".schedule-table-wrap { overflow-x: auto; margin-top: 16px; }\n";
    css += ".schedule-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }\n";
    css += ".schedule-table th, .schedule-table td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }\n";
    css += ".schedule-table th { background: " + primary + "; color: #fff; }\n";
    css += ".prices-table { width: 100%; max-width: 400px; border-collapse: collapse; margin: 16px 0; }\n";
    css += ".prices-table td { border: 1px solid #e5e7eb; padding: 10px; }\n";
    css += ".ticket-cta { display: inline-block; padding: 14px 28px; margin-top: 12px; }\n";
    css += ".btn { display: inline-block; padding: 10px 20px; border-radius: " + radius + "px; text-decoration: none; font-weight: 500; border: 2px solid " + btnBorder + "; background: " + btnBg + "; color: " + btnColor + "; }\n";
    css += ".btn:hover { opacity: 0.9; }\n";
    css += ".btn-sm { padding: 6px 12px; font-size: 0.9rem; }\n";
    css += ".btn.hero-cta, .btn.ticket-cta, .btn.cta-btn { background: " + ctaButtonBg + "; color: " + ctaButtonText + "; border-color: " + ctaButtonBg + "; }\n";
    css += ".access-body h3 { margin: 0 0 8px 0; }\n";
    css += ".access-address { margin: 0 0 8px 0; }\n";
    css += ".access-notice { font-size: 0.9rem; margin-top: 12px; color: #6b7280; }\n";
    css += ".faq-list { margin: 0; }\n";
    css += ".faq-list dt { font-weight: 600; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; }\n";
    css += ".faq-list dt:first-child { margin-top: 0; padding-top: 0; border-top: none; }\n";
    css += ".faq-list dd { margin: 4px 0 0 0; padding-bottom: 8px; }\n";
    css += ".contact-list { list-style: none; padding: 0; margin: 0; }\n";
    css += ".contact-list li { padding: 4px 0; }\n";
    css += ".contact-list a { color: " + accent + "; }\n";
    css += ".cta { text-align: center; background: " + primary + "; color: #fff; }\n";
    css += ".cta .section-title { color: #fff; border-bottom-color: rgba(255,255,255,0.5); }\n";
    css += ".cta-btn { padding: 14px 32px; font-size: 1.1rem; }\n";
    css += ".footer { text-align: center; padding: 24px 20px; font-size: 0.9rem; color: #6b7280; border-top: 1px solid #e5e7eb; }\n";
    css += ".footer .copyright { margin: 8px 0 0 0; }\n";
    return css;
  }

  function renderPreview() {
    var iframe = document.getElementById("preview-frame");
    if (!iframe || !lpData) return;
    iframe.setAttribute("sandbox", "");
    iframe.srcdoc = generateLPHTML(lpData, { inlineCss: true });
  }

  function updateFormFromData() {
    if (!lpData) return;
    document.querySelectorAll("[data-bind]").forEach(function (el) {
      var path = el.getAttribute("data-bind");
      var val = getByPath(lpData, path);
      if (val === undefined) return;
      var tag = (el.tagName || "").toLowerCase();
      var type = (el.type || "").toLowerCase();
      if (type === "checkbox") {
        el.checked = !!val;
      } else if (type === "color") {
        el.value = val || "#000000";
      } else if (el.hasAttribute("data-image-url-input")) {
        el.value = /^data:image\//i.test(String(val || "")) ? "" : (val !== null && val !== undefined ? String(val) : "");
      } else if (tag === "select" || type === "number") {
        el.value = val !== "" && val !== null && val !== undefined ? String(val) : "";
      } else {
        el.value = val !== null && val !== undefined ? String(val) : "";
      }
    });
    syncDesignControls();
    syncImageSourceStatus();
  }

  function syncDesignControls() {
    var ctaColorInput = document.getElementById("input-cta-button-color");
    if (!ctaColorInput || !lpData || !lpData.design) return;
    var autoMode = lpData.design.useAutoCtaButtonColor !== false;
    ctaColorInput.disabled = autoMode;
    ctaColorInput.title = autoMode ? "自動調整が有効です" : "";
  }

  function syncImageSourceStatus() {
    document.querySelectorAll("[data-image-status-target]").forEach(function (el) {
      var path = el.getAttribute("data-image-status-target");
      el.textContent = getImageSourceLabel(getByPath(lpData, path));
    });
  }

  function setAccordionState(panel, expanded) {
    if (!panel) return;
    var toggle = panel.querySelector(".panel-toggle");
    var body = panel.querySelector(".panel-body");
    panel.classList.toggle("is-open", expanded);
    if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (body) body.hidden = !expanded;
  }

  function initAccordions() {
    document.querySelectorAll(".panel-accordion").forEach(function (panel) {
      setAccordionState(panel, panel.classList.contains("is-open"));
    });

    var formColumn = document.querySelector(".form-column");
    if (!formColumn) return;
    formColumn.addEventListener("click", function (e) {
      var toggle = e.target.closest(".panel-toggle");
      if (!toggle) return;
      var panel = toggle.closest(".panel-accordion");
      if (!panel) return;
      setAccordionState(panel, !panel.classList.contains("is-open"));
    });
  }

  function setSaveStatus(message) {
    var el = document.getElementById("save-status");
    if (el) el.textContent = message;
  }

  function saveToLocal(options) {
    var opts = options || {};
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lpData));
      setSaveStatus(opts.message || "下書きを保存しました。");
      if (!opts.silent) alert("LocalStorageに保存しました。");
    } catch (e) {
      setSaveStatus("保存に失敗しました。");
      if (!opts.silent) alert("保存に失敗しました: " + (e.message || e) + "\nローカル画像を多く使うと、ブラウザ保存の容量上限を超えることがあります。");
    }
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    setSaveStatus("下書きを保存中...");
    autosaveTimer = setTimeout(function () {
      saveToLocal({ silent: true, message: "下書きを自動保存しました。" });
    }, AUTOSAVE_DELAY_MS);
  }

  function loadFromLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        alert("保存データがありません。");
        return;
      }
      var loaded = JSON.parse(raw);
      lpData = deepMerge(deepClone(createDefaultData()), loaded);
      normalizeDynamicCollections();
      updateFormFromData();
      buildDynamicFormFields();
      renderPreview();
      renderPublishCheckSummary();
      setSaveStatus("下書きを読み込みました。");
      alert("LocalStorageから読み込みました。");
    } catch (e) {
      alert("読み込みに失敗しました: " + (e.message || e));
    }
  }

  function resetProject() {
    if (!window.confirm("現在の入力内容と下書き保存データを消して、初期状態に戻します。よろしいですか？")) {
      return;
    }
    lpData = createDefaultData();
    normalizeDynamicCollections();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore storage cleanup failure and still reset the in-memory state
    }
    buildDynamicFormFields();
    renderPreview();
    renderPublishCheckSummary();
    setSaveStatus("初期状態に戻しました。新しいページをここから作れます。");
    alert("画面を初期化しました。");
  }

  function onDownloadJSON() {
    var blob = new Blob([JSON.stringify(lpData, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "small-theater-lp-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onUploadJSON(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var loaded = JSON.parse(reader.result);
        lpData = deepMerge(deepClone(createDefaultData()), loaded);
        normalizeDynamicCollections();
        updateFormFromData();
        buildDynamicFormFields();
        renderPreview();
        renderPublishCheckSummary();
        alert("JSONを読み込みました。");
      } catch (e) {
        alert("JSONの解析に失敗しました: " + (e.message || e));
      }
    };
    reader.readAsText(file);
  }

  function onDownloadHTML() {
    var checks = collectPublishChecks(lpData);
    renderPublishCheckSummary(checks);
    if (checks.errors.length) {
      alert("HTMLを書き出す前に修正が必要です。\n\n- " + checks.errors.join("\n- "));
      return;
    }
    if (checks.warnings.length && !window.confirm("気になる点がありますが、このまま完成HTMLをダウンロードしますか？\n\n- " + checks.warnings.join("\n- "))) {
      return;
    }
    var blob = new Blob([generateLPHTML(lpData, { inlineCss: true })], { type: "text/html;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onDownloadCSS() {
    var blob = new Blob([generateLPCSS(lpData)], { type: "text/css;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "style.css";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyFormChange(path, value, isCheckbox) {
    if (isCheckbox) {
      value = !!value;
    } else if (
      path.indexOf("design.") === 0 &&
      (path.indexOf("borderRadius") >= 0 || path.indexOf("sectionPadding") >= 0)
    ) {
      value = value === "" ? 0 : (typeof value === "number" ? value : parseInt(value, 10) || 0);
    }
    setByPath(lpData, path, value);
    renderPreview();
    syncImageSourceStatus();
    renderPublishCheckSummary();
    scheduleAutosave();
  }

  function buildDynamicFormFields() {
    var d = lpData || createDefaultData();

    var highlightsEl = document.getElementById("highlights-fields");
    if (highlightsEl) {
      var highlightsList = getCollectionArray(d, "highlights");
      highlightsEl.innerHTML = highlightsList.map(function (_, i) {
        var removeButton = highlightsList.length > COLLECTION_CONFIG.highlights.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"highlights\" data-remove-index=\"" + i + "\">この項目を削除</button></div>"
          : "";
        return "<div class=\"highlight-item\"><div class=\"form-group\"><label>見どころ " + (i + 1) + " タイトル</label><input type=\"text\" data-bind=\"highlights[" + i + "].title\"></div><div class=\"form-group\"><label>本文</label><textarea rows=\"2\" data-bind=\"highlights[" + i + "].text\"></textarea></div>" + removeButton + "</div>";
      }).join("");
    }

    var castEl = document.getElementById("cast-fields");
    if (castEl) {
      var castList = getCollectionArray(d, "cast");
      castEl.innerHTML = castList.map(function (castItem, i) {
        var removeButton = castList.length > COLLECTION_CONFIG.cast.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"cast\" data-remove-index=\"" + i + "\">このキャストを削除</button></div>"
          : "";
        return "<div class=\"cast-item\"><div class=\"form-group\"><label>キャスト " + (i + 1) + " 名前</label><input type=\"text\" data-bind=\"cast[" + i + "].name\"></div><div class=\"form-group\"><label>役職・役名</label><input type=\"text\" data-bind=\"cast[" + i + "].role\"></div><div class=\"form-group\"><label>プロフィール</label><textarea rows=\"3\" data-bind=\"cast[" + i + "].profile\"></textarea></div><div class=\"form-group\"><label>画像URL</label><input type=\"url\" data-bind=\"cast[" + i + "].imageUrl\" data-image-url-input=\"true\"><p class=\"form-help\">画像を別タブで開いたときのURLを貼り付けます。URLがない場合は、下のファイル選択からローカル画像も使えます。</p><p class=\"form-help\">推奨サイズは正方形で1000px x 1000px以上です。ファイルサイズは1MB以下を目安にしてください。</p><input type=\"file\" class=\"image-file-input\" data-image-target=\"cast[" + i + "].imageUrl\" accept=\"image/*\"><div class=\"inline-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-clear-image-target=\"cast[" + i + "].imageUrl\">画像をクリア</button><span class=\"field-status\" data-image-status-target=\"cast[" + i + "].imageUrl\">" + escapeHtml(getImageSourceLabel(castItem && castItem.imageUrl)) + "</span></div><p class=\"form-help\">ローカル画像は完成HTMLに埋め込まれます。画像が大きいと保存データも重くなります。</p></div>" + removeButton + "</div>";
      }).join("");
    }

    var staffEl = document.getElementById("staff-fields");
    if (staffEl) {
      var staffList = getCollectionArray(d, "staff");
      staffEl.innerHTML = staffList.map(function (_, i) {
        var removeButton = staffList.length > COLLECTION_CONFIG.staff.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"staff\" data-remove-index=\"" + i + "\">このスタッフを削除</button></div>"
          : "";
        return "<div class=\"staff-item\"><div class=\"form-group\"><label>スタッフ " + (i + 1) + " 役職</label><input type=\"text\" data-bind=\"staff[" + i + "].role\"></div><div class=\"form-group\"><label>名前</label><input type=\"text\" data-bind=\"staff[" + i + "].name\"></div>" + removeButton + "</div>";
      }).join("");
    }

    var scheduleEl = document.getElementById("schedule-rows");
    if (scheduleEl) {
      var rows = getCollectionArray(d, "scheduleRows");
      scheduleEl.innerHTML = rows.map(function (_, i) {
        var removeButton = rows.length > COLLECTION_CONFIG.scheduleRows.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"scheduleRows\" data-remove-index=\"" + i + "\">この日程を削除</button></div>"
          : "";
        return "<div class=\"schedule-row-fields\"><div class=\"form-group\"><label>日付 " + (i + 1) + "</label><input type=\"text\" data-bind=\"schedule.rows[" + i + "].date\" placeholder=\"例: 3/20\"></div><div class=\"form-group\"><label>曜日</label><input type=\"text\" data-bind=\"schedule.rows[" + i + "].weekday\" placeholder=\"例: 土\"></div><div class=\"form-group\"><label>開演</label><input type=\"text\" data-bind=\"schedule.rows[" + i + "].time\" placeholder=\"例: 14:00\"></div><div class=\"form-group\"><label>ステータス</label><input type=\"text\" data-bind=\"schedule.rows[" + i + "].status\" placeholder=\"例: 販売中\"></div>" + removeButton + "</div>";
      }).join("");
    }

    var pricesEl = document.getElementById("prices-fields");
    if (pricesEl) {
      var prices = getCollectionArray(d, "prices");
      pricesEl.innerHTML = prices.map(function (_, i) {
        var removeButton = prices.length > COLLECTION_CONFIG.prices.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"prices\" data-remove-index=\"" + i + "\">この料金を削除</button></div>"
          : "";
        return "<div class=\"price-item\"><div class=\"form-group\"><label>料金 " + (i + 1) + " ラベル</label><input type=\"text\" data-bind=\"ticket.prices[" + i + "].label\" placeholder=\"一般\"></div><div class=\"form-group\"><label>金額</label><input type=\"text\" data-bind=\"ticket.prices[" + i + "].amount\" placeholder=\"3,500円\"></div><div class=\"form-group\"><label>備考</label><input type=\"text\" data-bind=\"ticket.prices[" + i + "].note\"></div>" + removeButton + "</div>";
      }).join("");
    }

    var faqEl = document.getElementById("faq-fields");
    if (faqEl) {
      var faqList = getCollectionArray(d, "faq");
      faqEl.innerHTML = faqList.map(function (_, i) {
        var removeButton = faqList.length > COLLECTION_CONFIG.faq.min
          ? "<div class=\"item-actions\"><button type=\"button\" class=\"btn btn-secondary btn-sm\" data-remove-collection=\"faq\" data-remove-index=\"" + i + "\">このFAQを削除</button></div>"
          : "";
        return "<div class=\"faq-item\"><div class=\"form-group\"><label>質問</label><input type=\"text\" data-bind=\"faq[" + i + "].question\"></div><div class=\"form-group\"><label>回答</label><textarea rows=\"2\" data-bind=\"faq[" + i + "].answer\"></textarea></div>" + removeButton + "</div>";
      }).join("");
    }

    updateFormFromData();
  }

  function addCollectionItem(collectionKey) {
    var list = getCollectionArray(lpData, collectionKey).slice();
    list.push(createCollectionItem(collectionKey, list.length));
    setCollectionArray(lpData, collectionKey, list);
    buildDynamicFormFields();
    renderPreview();
    renderPublishCheckSummary();
    scheduleAutosave();
  }

  function removeCollectionItem(collectionKey, index) {
    var config = COLLECTION_CONFIG[collectionKey];
    var list = getCollectionArray(lpData, collectionKey).slice();
    if (!config || list.length <= config.min) return;
    list.splice(index, 1);
    setCollectionArray(lpData, collectionKey, list);
    buildDynamicFormFields();
    renderPreview();
    renderPublishCheckSummary();
    scheduleAutosave();
  }

  function applyImageValue(path, value) {
    setByPath(lpData, path, value);
    buildDynamicFormFields();
    renderPreview();
    renderPublishCheckSummary();
    scheduleAutosave();
  }

  function onImageFileSelected(path, fileInput) {
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/i.test(file.type || "")) {
      alert("PNG、JPEG、GIF、WebP、AVIF、BMP、ICOの画像を選択してください。");
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      alert("画像サイズが大きすぎます。1MB以下の画像を選んでください。");
      fileInput.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      applyImageValue(path, reader.result);
      fileInput.value = "";
    };
    reader.onerror = function () {
      alert("画像の読み込みに失敗しました。");
      fileInput.value = "";
    };
    reader.readAsDataURL(file);
  }

  function setPreviewMode(mode) {
    previewMode = mode;
    var frame = document.getElementById("preview-frame");
    var label = document.getElementById("preview-size-label");
    if (frame) {
      frame.classList.remove("preview-frame-mobile", "preview-frame-desktop");
      frame.classList.add(mode === "desktop" ? "preview-frame-desktop" : "preview-frame-mobile");
    }
    if (label) label.textContent = mode === "desktop" ? "1280px" : "390px";
  }

  function init() {
    lpData = createDefaultData();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        lpData = deepMerge(deepClone(createDefaultData()), JSON.parse(raw));
        normalizeDynamicCollections();
        setSaveStatus("保存済みの下書きを読み込みました。");
      } else {
        setSaveStatus("未保存の変更は自動で下書き保存されます。");
      }
    } catch (e) {
      setSaveStatus("下書きの読込に失敗しました。");
    }
    normalizeDynamicCollections();

    initAccordions();
    buildDynamicFormFields();

    var formColumn = document.querySelector(".form-column");
    formColumn.addEventListener("input", function (e) {
      var el = e.target;
      if (!el || !el.getAttribute("data-bind")) return;
      var path = el.getAttribute("data-bind");
      var isCheckbox = (el.type || "").toLowerCase() === "checkbox";
      var val = isCheckbox ? el.checked : (el.type === "number" ? (el.value === "" ? 0 : parseInt(el.value, 10)) : el.value);
      applyFormChange(path, val, isCheckbox);
    });

    formColumn.addEventListener("change", function (e) {
      var el = e.target;
      if (el && el.classList && el.classList.contains("image-file-input")) {
        onImageFileSelected(el.getAttribute("data-image-target"), el);
        return;
      }
      if (!el || !el.getAttribute("data-bind")) return;
      var path = el.getAttribute("data-bind");
      var isCheckbox = (el.type || "").toLowerCase() === "checkbox";
      var val = isCheckbox ? el.checked : el.value;
      applyFormChange(path, val, isCheckbox);
    });

    formColumn.addEventListener("click", function (e) {
      var addButton = e.target.closest("[data-add-collection]");
      if (addButton) {
        addCollectionItem(addButton.getAttribute("data-add-collection"));
        return;
      }

      var removeButton = e.target.closest("[data-remove-collection]");
      if (removeButton) {
        removeCollectionItem(
          removeButton.getAttribute("data-remove-collection"),
          parseInt(removeButton.getAttribute("data-remove-index"), 10) || 0
        );
        return;
      }

      var clearImageButton = e.target.closest("[data-clear-image-target]");
      if (clearImageButton) {
        applyImageValue(clearImageButton.getAttribute("data-clear-image-target"), "");
      }
    });

    document.getElementById("btn-preview-mobile").addEventListener("click", function () { setPreviewMode("mobile"); });
    document.getElementById("btn-preview-desktop").addEventListener("click", function () { setPreviewMode("desktop"); });
    document.getElementById("btn-save-local").addEventListener("click", saveToLocal);
    document.getElementById("btn-load-local").addEventListener("click", loadFromLocal);
    document.getElementById("btn-reset-project").addEventListener("click", resetProject);
    document.getElementById("btn-download-json").addEventListener("click", onDownloadJSON);
    document.getElementById("input-upload-json").addEventListener("change", function (e) {
      var f = e.target && e.target.files && e.target.files[0];
      if (f) onUploadJSON(f);
      e.target.value = "";
    });
    document.getElementById("btn-download-html").addEventListener("click", onDownloadHTML);
    document.getElementById("btn-download-css").addEventListener("click", onDownloadCSS);

    setPreviewMode("mobile");
    renderPreview();
    renderPublishCheckSummary();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
