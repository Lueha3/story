(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CATS = [['top', '상의'], ['bottom', '하의'], ['outer', '아우터'], ['shoes', '신발'], ['acc', 'ACC'], ['etc', '기타']];
  const CAT_LABEL = {};
  CATS.forEach((c) => { CAT_LABEL[c[0]] = c[1]; });
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const KST = 9 * 3600 * 1000;
  const MIN = 60 * 1000;
  const DAY = 24 * 3600 * 1000;
  const CHEV_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- data ----
  let STORIES = [];
  let handle = '';
  const byId = {};

  // Dates are shown in Korea time whatever the visitor's phone is set to.
  function decorate(s) {
    const t = Date.parse(s.takenAt);
    const k = new Date(t + KST);
    const y = k.getUTCFullYear();
    const mo = k.getUTCMonth() + 1;
    const da = k.getUTCDate();
    const h = k.getUTCHours();
    const mm = k.getUTCMinutes();
    const now = new Date(Date.now() + KST);
    const today0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const di = Math.round((today0 - Date.UTC(y, mo - 1, da)) / DAY);
    const hhmm = pad(h) + ':' + pad(mm);
    s.t = t;
    s.dayKey = '' + y + pad(mo) + pad(da);
    s.md = mo + '월 ' + da + '일';
    s.full = s.md + ' ' + WEEK[k.getUTCDay()] + '요일';
    s.clock = (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + pad(mm);
    s.rel = di <= 0 ? '오늘 ' + hhmm : (di === 1 ? '어제 ' + hhmm : mo + '.' + da + ' ' + WEEK[k.getUTCDay()]);
    s.isNew = Date.now() - t <= 60 * MIN;
    return s;
  }
  const listOf = (cat) => STORIES.filter((s) => s.cat === cat);

  async function load() {
    const res = await fetch('/api/stories', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    handle = data.instagram || '';
    STORIES = data.stories.map((s) => decorate({ ...s, cat: s.category }));
    STORIES.forEach((s) => { byId[s.id] = s; });
  }

  // ---- toast ----
  const toast = $('toast');
  let toastTimer = 0;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
  }

  // ---- tabs and feed ----
  const feed = $('feed');
  const tabsEl = document.querySelector('.tabs');
  const tabsList = $('tabsList');
  const startTab = (location.hash.match(/^#(top|bottom|outer|shoes|acc|etc)$/) || [])[1];
  let tab = startTab || 'all';

  function renderTabs() {
    let html = '<button type="button" class="pill chip" data-tab="all" aria-pressed="' + (tab === 'all') + '"><span>전체<small>' + STORIES.length + '</small></span></button>';
    CATS.forEach((c) => {
      html += '<button type="button" class="pill chip" data-tab="' + c[0] + '" aria-pressed="' + (tab === c[0]) + '"><span>' + c[1] + '<small>' + listOf(c[0]).length + '</small></span></button>';
    });
    tabsList.innerHTML = html;
  }
  function tileHTML(s) {
    const label = CAT_LABEL[s.cat] + (s.itemName ? ', ' + s.itemName : '') + ', ' + s.md + ' ' + s.clock + ' 스토리 열기';
    return '<button type="button" class="tile" data-id="' + esc(s.id) + '" aria-label="' + esc(label) + '">' +
      '<div class="card"><img src="' + esc(s.imageUrl) + '" alt="" loading="lazy" decoding="async"></div>' +
      '<span class="tile-t"><span>' + s.rel + '</span>' + (s.isNew ? '<span class="new">NEW</span>' : '') + '</span></button>';
  }
  function renderFeed() {
    let html = '';
    if (!STORIES.length) {
      feed.innerHTML = '<p class="empty gut">아직 올라온 스토리가 없어요.</p>';
      return;
    }
    if (tab === 'all') {
      CATS.forEach((c) => {
        const list = listOf(c[0]);
        if (!list.length) return;
        html += '<section><div class="sec-h gut"><div class="sec-t"><h2>' + c[1] + '</h2><span>' + list.length + '개</span></div>' +
          '<button type="button" class="pill more-btn" data-tab="' + c[0] + '" aria-label="' + c[1] + ' 전체 보기"><span>전체 보기' + CHEV_ICON + '</span></button></div>' +
          '<div class="grid">' + list.slice(0, 6).map(tileHTML).join('') + '</div></section>';
      });
    } else {
      const list = listOf(tab);
      html = '<section><div class="sec-h gut"><div class="sec-t"><h2>' + CAT_LABEL[tab] + '</h2><span>' + list.length + '개</span></div><span class="sort">최신순</span></div>' +
        (list.length ? '<div class="grid">' + list.map(tileHTML).join('') + '</div>' : '<p class="empty gut">아직 이 카테고리에 올라온 스토리가 없어요.</p>') +
        '</section>';
    }
    feed.innerHTML = html;
  }
  function setTab(next, keepScroll) {
    tab = next;
    renderTabs();
    renderFeed();
    try { history.replaceState(null, '', next === 'all' ? location.pathname : '#' + next); } catch (e) { /* not allowed in some frames */ }
    if (!keepScroll) {
      const y = $('tabsAnchor').getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(tabsEl).top) || 0);
      if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    }
    const chip = tabsList.querySelector('[aria-pressed="true"]');
    if (chip) tabsList.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: reduce ? 'auto' : 'smooth' });
  }
  function updateHeader() {
    $('handle').textContent = handle ? '@' + handle : '';
    $('vHandle').textContent = handle ? '@' + handle : '';
    if (!STORIES.length) {
      $('statusText').textContent = '첫 스토리를 기다리는 중이에요';
      return;
    }
    const diff = Math.max(0, Math.round((Date.now() - STORIES[0].t) / MIN));
    const ago = diff < 1 ? '방금 전' : (diff < 60 ? diff + '분 전' : (diff < 1440 ? Math.floor(diff / 60) + '시간 전' : Math.floor(diff / 1440) + '일 전'));
    $('statusText').textContent = ago + ' 업데이트 · 지난 꿀템도 전부 볼 수 있어요';
  }

  tabsList.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) setTab(chip.dataset.tab);
  });

  // ---- viewer: plays one category, newest first ----
  const viewer = $('viewer');
  const vCard = $('vCard');
  const vImg = $('vImg');
  const vSegs = $('vSegs');
  const vFlag = $('vFlag');
  const vClose = $('vClose');
  const vCta = $('vCta');
  const DUR = 5000;
  let seq = [];
  let pos = 0;
  let fill = null;
  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let lastFocus = null;
  let hideTimer = 0;

  function runOf(i) {
    let a = i;
    let b = i;
    while (a > 0 && seq[a - 1].dayKey === seq[i].dayKey) a -= 1;
    while (b < seq.length - 1 && seq[b + 1].dayKey === seq[i].dayKey) b += 1;
    return [a, b];
  }
  function show(flag) {
    const s = seq[pos];
    const run = runOf(pos);
    const at = pos - run[0];
    const len = run[1] - run[0] + 1;
    vImg.src = s.imageUrl;
    vImg.alt = s.itemName ? s.itemName + ' 스토리' : '스토리';
    let segs = '';
    for (let i = 0; i < len; i += 1) {
      segs += '<span class="v-seg"><i style="transform:scaleX(' + (i < at || (reduce && i === at) ? 1 : 0) + ')"></i></span>';
    }
    vSegs.innerHTML = segs;
    fill = vSegs.children[at] ? vSegs.children[at].firstChild : null;
    $('vTime').textContent = s.md + ' ' + s.clock;
    $('vWhen').textContent = CAT_LABEL[s.cat] + ' · ' + s.full;
    $('vPos').textContent = (at + 1) + ' / ' + len;
    vCta.hidden = !s.link;
    $('vNoLink').hidden = !!s.link;
    if (s.link) vCta.href = s.link;
    // load the next picture early so tapping on feels instant
    if (seq[pos + 1]) { const pre = new Image(); pre.src = seq[pos + 1].imageUrl; }
    elapsed = 0;
    if (flag) {
      vFlag.textContent = s.full;
      vFlag.classList.remove('go');
      void vFlag.offsetWidth;
      vFlag.classList.add('go');
    }
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(ts - last, 100) : 0;
    last = ts;
    if (paused || document.hidden || reduce || !vImg.complete) return;
    elapsed += dt;
    const p = Math.min(1, elapsed / DUR);
    if (fill) fill.style.transform = 'scaleX(' + p + ')';
    if (p >= 1) step(1);
  }
  function startLoop() {
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function openViewer(list, index, opener) {
    if (!list.length) return;
    seq = list;
    pos = Math.max(0, index);
    paused = false;
    lastFocus = opener || document.activeElement;
    clearTimeout(hideTimer);
    toast.hidden = true;
    viewer.hidden = false;
    viewer.style.removeProperty('--va');
    vCard.style.transform = '';
    toast.classList.add('on-view');
    document.documentElement.style.overflow = 'hidden';
    show(false);
    requestAnimationFrame(() => { viewer.classList.add('is-in'); });
    vClose.focus({ preventScroll: true });
    startLoop();
  }
  function closeViewer() {
    cancelAnimationFrame(raf);
    toast.hidden = true;
    viewer.classList.remove('is-in');
    toast.classList.remove('on-view');
    document.documentElement.style.overflow = '';
    clearTimeout(hideTimer);
    if (reduce) viewer.hidden = true;
    else hideTimer = setTimeout(() => { viewer.hidden = true; viewer.style.removeProperty('--va'); vCard.style.transform = ''; }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function step(dir) {
    const next = pos + dir;
    if (next < 0) return;
    if (next >= seq.length) { closeViewer(); return; }
    const flag = seq[next].dayKey !== seq[pos].dayKey;
    pos = next;
    show(flag);
  }
  function jump(dir) {
    const run = runOf(pos);
    if (dir > 0) {
      if (run[1] + 1 >= seq.length) { closeViewer(); return; }
      pos = run[1] + 1;
    } else {
      if (run[0] === 0) return;
      pos = runOf(run[0] - 1)[0];
    }
    show(true);
  }

  feed.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (tile) {
      const s = byId[tile.dataset.id];
      const list = listOf(s.cat);
      openViewer(list, list.indexOf(s), tile);
      return;
    }
    const more = e.target.closest('.more-btn');
    if (more) setTab(more.dataset.tab);
  });

  // Touch and mouse: tap left/right, hold to pause, swipe sideways for another day, drag down to close.
  let ptr = null;
  function onMove(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (!ptr.drag && dy > 12 && Math.abs(dy) > Math.abs(dx)) { ptr.drag = true; vCard.classList.add('is-drag'); }
    if (ptr.drag) {
      const d = Math.max(0, dy);
      vCard.style.transform = 'translateY(' + d + 'px) scale(' + (1 - Math.min(d, 400) / 2600) + ')';
      viewer.style.setProperty('--va', String(Math.max(0.35, 1 - d / 500)));
    }
  }
  function onEnd(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr;
    ptr = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dt = performance.now() - p.t;
    paused = false;
    vCard.classList.remove('is-drag');
    if (e.type === 'pointercancel') { vCard.style.transform = ''; viewer.style.removeProperty('--va'); return; }
    if (p.drag && dy > 90) { closeViewer(); return; }
    vCard.style.transform = '';
    viewer.style.removeProperty('--va');
    if (p.drag) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { jump(dx < 0 ? 1 : -1); return; }
    if (dt > 350 || Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    const r = vCard.getBoundingClientRect();
    step((e.clientX - r.left) / r.width < 0.32 ? -1 : 1);
  }
  vCard.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || ptr || e.target.closest('[data-notap]')) return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), drag: false };
    paused = true;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  });
  $('vPrev').addEventListener('click', (e) => { if (e.detail === 0) step(-1); });
  $('vNext').addEventListener('click', (e) => { if (e.detail === 0) step(1); });
  vClose.addEventListener('click', closeViewer);
  vCta.addEventListener('click', () => { paused = true; setTimeout(() => { paused = false; }, 1500); });
  $('vShare').addEventListener('click', async () => {
    const url = location.origin + '/#s-' + seq[pos].id;
    try {
      await navigator.clipboard.writeText(url);
      say('이 스토리 주소를 복사했어요');
    } catch (e) {
      say(url);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });

  // ---- start, then refresh quietly every minute ----
  function openFromHash() {
    const m = location.hash.match(/^#s-([a-z0-9]+)$/);
    const s = m && byId[m[1]];
    if (!s) return;
    const list = listOf(s.cat);
    openViewer(list, list.indexOf(s), null);
  }
  async function refresh(first) {
    try {
      await load();
    } catch (e) {
      if (first) feed.innerHTML = '<p class="empty gut">스토리를 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>';
      return;
    }
    updateHeader();
    if (viewer.hidden || first) {
      renderTabs();
      renderFeed();
    }
    if (first) openFromHash();
  }
  refresh(true);
  setInterval(() => { if (!document.hidden) refresh(false); }, 60 * 1000);
})();
