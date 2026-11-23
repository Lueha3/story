(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CATS = [['top', '상의'], ['bottom', '하의'], ['outer', '아우터'], ['shoes', '신발'], ['acc', 'ACC'], ['etc', '기타']];
  const LABEL = {};
  CATS.forEach((c) => { LABEL[c[0]] = c[1]; });
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const KEY = 'honey-admin-token';

  let token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) { /* storage blocked */ }
  let stories = [];
  // the list opens on every story; the other tabs narrow it down
  let filter = 'all';
  // category and order for the list; upload order (oldest first) is the default, as link pairing needs it
  let catFilter = 'all';
  let newestFirst = false;
  let armedDelete = null;
  let selecting = false;
  const sel = new Set();
  let armedBulk = false;

  const toast = $('toast');
  let toastTimer = 0;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
  }

  async function api(path, opts) {
    const o = opts || {};
    const headers = Object.assign({ Authorization: 'Bearer ' + encodeURIComponent(token) }, o.headers || {});
    const res = await fetch(path, Object.assign({}, o, { headers: headers }));
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error((data && data.error) || '요청이 실패했어요 (' + res.status + ')');
    return data;
  }

  function when(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function byStatus() {
    if (filter === 'check') return stories.filter((s) => !s.hidden && (!s.sure || s.status === 'failed'));
    if (filter === 'nolink') return stories.filter((s) => !s.hidden && !s.link && s.status !== 'pending');
    if (filter === 'hidden') return stories.filter((s) => s.hidden);
    return stories;
  }
  function visible() {
    const l = byStatus().filter((s) => catFilter === 'all' || s.category === catFilter);
    return newestFirst ? l.slice().reverse() : l;
  }
  function drawCats() {
    const base = byStatus();
    $('catRow').innerHTML = [['all', '전체']].concat(CATS).map((c) => {
      const n = c[0] === 'all' ? base.length : base.filter((s) => s.category === c[0]).length;
      return '<button type="button" class="pill chip" data-cf="' + c[0] + '" aria-pressed="' + (catFilter === c[0]) + '"><span>' + c[1] + '<small>' + n + '</small></span></button>';
    }).join('');
    $('admOrderLabel').textContent = newestFirst ? '최신순' : '올린 순서';
  }

  // the same stickers the site draws, small, on the admin thumbnail
  function thumbMarks(s) {
    let h = '';
    if (s.saleState === 'soldout' || s.saleState === 'expired') {
      const sold = s.saleState === 'soldout';
      h += '<div class="mk-over ' + (sold ? 'is-sold' : 'is-exp') + '"><div class="mk-stamp"><b>' + (sold ? 'SOLD OUT' : '기간 만료') + '</b><span>' + (sold ? '품절' : 'EXPIRED') + '</span></div></div>';
    }
    if (s.timeSale) h += '<div class="mk-sale"><i class="mk-dot"></i><b>TIME SALE</b></div>';
    return h;
  }

  function render() {
    $('cntCheck').textContent = stories.filter((s) => !s.hidden && (!s.sure || s.status === 'failed')).length;
    $('cntNolink').textContent = stories.filter((s) => !s.hidden && !s.link && s.status !== 'pending').length;
    $('cntAll').textContent = stories.length;
    $('cntHidden').textContent = stories.filter((s) => s.hidden).length;
    document.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
    drawCats();
    drawSelBar();
    const rows = visible();
    if (!rows.length) {
      $('list').innerHTML = '<p class="empty">여기에 해당하는 스토리가 없어요.</p>';
      return;
    }
    $('list').innerHTML = rows.map((s) => {
      let badge = '<span class="badge">' + (s.checked ? '확인함' : '자동') + '</span>';
      if (s.status === 'pending') badge = '<span class="badge">분류 중</span>';
      else if (s.status === 'failed') badge = '<span class="badge warn">분류 실패</span>';
      else if (!s.sure) badge = '<span class="badge warn">확인 필요</span>';
      const note = !s.sure || s.status === 'failed' ? (s.reason || '') + (s.altCategory ? ' (' + LABEL[s.altCategory] + '일 수도 있어요)' : '') : '';
      return '<div class="reg-row' + (s.hidden ? ' is-hidden' : '') + (sel.has(s.id) ? ' is-sel' : '') + '" data-id="' + esc(s.id) + '">' +
        (selecting ? '<div class="reg-sel"><label><input type="checkbox" data-sel' + (sel.has(s.id) ? ' checked' : '') + ' aria-label="' + esc((s.itemName || '이름 없음') + ' 선택') + '"></label></div>' : '') +
        '<div class="reg-thumb"><a class="card" href="' + esc(s.imageUrl) + '" target="_blank" rel="noopener"><img src="' + esc(s.imageUrl) + '" alt="스토리 이미지" loading="lazy">' + thumbMarks(s) + '</a></div>' +
        '<div class="reg-b"><div class="reg-n"><b>' + esc(s.itemName || '이름 없음') + '</b>' + badge + '</div>' +
        '<span class="reg-m">' + when(s.takenAt) + (s.priceText ? ' · ' + esc(s.priceText) : '') + '</span>' +
        (note ? '<span class="rule">' + esc(note) + '</span>' : '') +
        '<div class="reg-c" role="group" aria-label="카테고리">' +
        CATS.map((c) => '<button type="button" data-cat="' + c[0] + '" aria-pressed="' + (s.category === c[0]) + '"><span>' + c[1] + '</span></button>').join('') +
        '</div>' +
        '<div class="reg-mk" role="group" aria-label="사진 위 표시">' +
        '<button type="button" class="mk-btn" data-mk="sale" aria-pressed="' + Boolean(s.timeSale) + '"><span>타임세일</span></button>' +
        '<button type="button" class="mk-btn" data-mk="soldout" aria-pressed="' + (s.saleState === 'soldout') + '"><span>품절</span></button>' +
        '<button type="button" class="mk-btn" data-mk="expired" aria-pressed="' + (s.saleState === 'expired') + '"><span>기간 만료</span></button>' +
        '</div>' +
        '<div class="reg-l"><input type="url" value="' + esc(s.link || '') + '" placeholder="상품링크 붙여넣기" aria-label="상품링크">' +
        '<button type="button" class="pill" data-act="link"><span>저장</span></button></div>' +
        '<div class="row">' +
        '<button type="button" class="pill" data-act="hide"><span>' + (s.hidden ? '다시 보이기' : '숨기기') + '</span></button>' +
        '<button type="button" class="pill danger" data-act="delete"><span>' + (armedDelete === s.id ? '한 번 더 누르면 삭제' : '삭제') + '</span></button>' +
        '</div></div></div>';
    }).join('');
  }

  function drawSelBar() {
    // only stories in the current tab can stay selected
    const ids = new Set(visible().map((s) => s.id));
    sel.forEach((id) => { if (!ids.has(id)) sel.delete(id); });
    $('selToggle').querySelector('span').textContent = selecting ? '선택 끝' : '선택';
    $('selTools').hidden = !selecting;
    $('selAll').querySelector('span').textContent = sel.size && sel.size === ids.size ? '전체 해제' : '전체 선택 (' + ids.size + ')';
    $('selDelete').disabled = !sel.size;
    $('selDelete').querySelector('span').textContent = !sel.size ? '선택 삭제' : (armedBulk ? '한 번 더 누르면 ' + sel.size + '개 삭제' : '선택 삭제 (' + sel.size + ')');
  }
  $('selToggle').addEventListener('click', () => {
    selecting = !selecting;
    sel.clear();
    armedBulk = false;
    render();
  });
  $('selAll').addEventListener('click', () => {
    const ids = visible().map((s) => s.id);
    if (sel.size === ids.length) sel.clear();
    else ids.forEach((id) => sel.add(id));
    armedBulk = false;
    render();
  });
  $('selDelete').addEventListener('click', async () => {
    if (!sel.size) return;
    if (!armedBulk) { armedBulk = true; drawSelBar(); return; }
    const ids = Array.from(sel);
    $('selDelete').disabled = true;
    try {
      const d = await api('/api/admin/stories/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids }),
      });
      const gone = new Set(d.deleted);
      stories = stories.filter((s) => !gone.has(s.id));
      say(d.deleted.length + '개 삭제했어요');
    } catch (err) {
      say(err.message);
    }
    sel.clear();
    armedBulk = false;
    render();
  });

  async function reload() {
    const data = await api('/api/admin/stories');
    // oldest first: the list reads top to bottom in the order the stories were uploaded
    stories = data.stories.slice().reverse();
    const todo = stories.filter((s) => !s.linkBox && !s.stickerChecked).length;
    $('locateRow').hidden = !todo;
    $('locate').querySelector('span').textContent = '지난 스토리 버튼 위치 찾기 (' + todo + '개)';
    render();
  }

  async function checkHealth() {
    const h = await api('/api/admin/health');
    const items = [
      ['데이터베이스', h.database],
      ['이미지 저장소', h.imageStorage],
      ['AI 키', h.ai],
      ['인스타 아이디', h.instagram],
    ];
    $('health').innerHTML = items.map((it) => '<li><span>' + it[0] + '</span><span class="' + (it[1] ? 'ok">연결됨' : 'bad">연결 안 됨') + '</span></li>').join('') +
      '<li><span>분류 모델</span><span class="ok">' + esc(h.model) + ' · ' + esc(h.effort) + '</span></li>';
    const fixes = [];
    if (!h.database) fixes.push(h.databaseError || '데이터베이스를 연결해 주세요.');
    if (!h.imageStorage) fixes.push('이미지 저장소가 연결되지 않았어요. Vercel › Storage에서 Blob을 이 프로젝트에 연결하고 다시 배포해 주세요.');
    if (!h.ai) fixes.push('AI 키가 없어요. Vercel 환경변수에 ANTHROPIC_API_KEY를 넣고 다시 배포해 주세요.');
    $('healthMsg').textContent = fixes.join('\n');
    return h;
  }

  async function login() {
    $('loginMsg').textContent = '';
    try {
      await checkHealth();
    } catch (e) {
      $('loginMsg').textContent = e.message;
      return;
    }
    try { localStorage.setItem(KEY, token); } catch (e) { /* storage blocked */ }
    $('loginBox').hidden = true;
    $('work').hidden = false;
    reload().catch((e) => { $('list').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  $('showToken').addEventListener('click', () => {
    const f = $('token');
    const show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    $('showToken').setAttribute('aria-pressed', String(show));
    $('showToken').querySelector('span').textContent = show ? '가리기' : '보기';
  });
  $('saveToken').addEventListener('click', () => {
    token = $('token').value.trim();
    login();
  });
  $('token').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { token = $('token').value.trim(); login(); }
  });

  document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
  $('catRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cf]');
    if (!b) return;
    catFilter = b.dataset.cf;
    render();
  });
  $('admOrder').addEventListener('click', () => {
    newestFirst = !newestFirst;
    render();
    say(newestFirst ? '최신순으로 바꿨어요' : '올린 순서(오래된 것부터)로 바꿨어요');
  });

  // ---- many links at once ----
  // Reads every link from pasted text in order, each with the line of text above it as a hint,
  // and pairs them with the stories in the list as shown (top to bottom).
  let bulkPairs = [];
  let bulkFlipped = false;
  function readLinks(text) {
    const out = [];
    let hint = '';
    text.split(/\r?\n/).forEach((line) => {
      const urls = line.match(/https?:\/\/[^\s<>"']+/g);
      if (!urls) {
        const t = line.trim().replace(/^[—–-]+$/, '');
        if (t) hint = t;
        return;
      }
      const before = line.slice(0, line.indexOf(urls[0])).trim();
      urls.forEach((u) => { out.push({ url: u, hint: before || hint }); });
      hint = '';
    });
    return out;
  }
  // pairs: [{ story, link: { url, hint }, include, sure, why }]
  function renderBulk(msg) {
    $('bulkMsg').textContent = msg;
    $('bulkList').innerHTML = bulkPairs.map((p, i) => {
      const st = p.story;
      return '<li class="' + (p.sure ? '' : 'unsure') + '" data-i="' + i + '">' +
        '<label class="bc"><input type="checkbox" data-inc' + (p.include ? ' checked' : '') + (st ? '' : ' disabled') + ' aria-label="' + (i + 1) + '번 넣기"></label>' +
        '<span class="bn">' + (i + 1) + '</span>' +
        (st ? '<img src="' + esc(st.imageUrl) + '" alt="" loading="lazy">' : '<span class="noimg">짝 없음</span>') +
        '<span class="bt"><b>' + (st ? esc(st.itemName || '이름 없음') : '맞는 스토리를 못 찾았어요') + (p.sure ? '' : ' <em class="flag">확인 필요</em>') + '</b>' +
        '<span>' + (p.link.hint ? esc(p.link.hint) : '<em class="none">설명 없음</em>') + '</span>' +
        (p.why ? '<span class="why">AI: ' + esc(p.why) + '</span>' : '') +
        '<small>' + esc(p.link.url) + (st && st.link ? ' · 지금 링크를 바꿔요' : '') + '</small></span></li>';
    }).join('');
    $('bulkList').hidden = !bulkPairs.length;
    drawApply();
  }
  function drawApply() {
    const n = bulkPairs.filter((p) => p.include && p.story).length;
    $('bulkApply').hidden = !bulkPairs.length;
    $('bulkApply').disabled = !n;
    $('bulkApply').querySelector('span').textContent = n + '개 넣기';
  }
  $('bulkList').addEventListener('change', (e) => {
    const box = e.target.closest('input[data-inc]');
    if (!box) return;
    bulkPairs[Number(box.closest('li').dataset.i)].include = box.checked;
    drawApply();
  });

  // in order: the nth link goes to the nth story in the list
  function drawBulk() {
    const links = readLinks($('bulkText').value);
    if (bulkFlipped) links.reverse();
    const targets = visible();
    const n = Math.min(links.length, targets.length);
    bulkPairs = [];
    for (let i = 0; i < n; i += 1) bulkPairs.push({ story: targets[i], link: links[i], include: true, sure: true, why: '' });
    let msg = '순서대로 짝지었어요. 링크 ' + links.length + '개, 목록의 스토리 ' + targets.length + '개' + (bulkFlipped ? ' · 링크 순서를 뒤집었어요' : '') + '.';
    if (links.length !== targets.length) msg += ' 개수가 달라요. 앞에서부터 ' + n + '개만 짝지어요.';
    $('bulkFlip').hidden = !links.length;
    renderBulk(links.length ? msg : '글에서 링크를 찾지 못했어요.');
  }

  // by the AI: it reads each story picture and the line above each link
  async function aiMatch() {
    const links = readLinks($('bulkText').value);
    if (!links.length) { renderBulk('글에서 링크를 찾지 못했어요.'); return; }
    const targets = visible();
    if (!targets.length) { renderBulk('짝지을 스토리가 목록에 없어요.'); return; }
    $('bulkAi').disabled = true;
    $('bulkFlip').hidden = true;
    bulkPairs = [];
    renderBulk('AI가 스토리 ' + targets.length + '개와 링크 ' + links.length + '개를 비교하는 중이에요. 1~2분 걸릴 수 있어요.');
    try {
      const d = await api('/api/admin/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: links, storyIds: targets.map((s) => s.id) }),
      });
      const byId = {};
      targets.forEach((s) => { byId[s.id] = s; });
      bulkPairs = d.matches.map((m) => {
        const story = m.storyId ? byId[m.storyId] || null : null;
        return { story: story, link: links[m.link], include: Boolean(story) && m.sure, sure: Boolean(story) && m.sure, why: m.why };
      });
      const sure = bulkPairs.filter((p) => p.sure).length;
      const unsure = bulkPairs.filter((p) => p.story && !p.sure).length;
      const none = bulkPairs.filter((p) => !p.story).length;
      renderBulk('AI가 짝을 찾았어요. 확실 ' + sure + '개' + (unsure ? ', 확인 필요 ' + unsure + '개(체크해야 들어가요)' : '') + (none ? ', 짝 없음 ' + none + '개' : '') + '.');
    } catch (err) {
      renderBulk(err.message);
    }
    $('bulkAi').disabled = false;
  }
  $('bulkAi').addEventListener('click', aiMatch);
  $('bulkCheck').addEventListener('click', () => { bulkFlipped = false; drawBulk(); });
  $('bulkFlip').addEventListener('click', () => { bulkFlipped = !bulkFlipped; drawBulk(); });
  $('bulkApply').addEventListener('click', async () => {
    if (!bulkPairs.length) return;
    $('bulkApply').disabled = true;
    try {
      const d = await api('/api/admin/stories/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: bulkPairs.filter((p) => p.include && p.story).map((p) => ({ id: p.story.id, link: p.link.url })) }),
      });
      $('bulkMsg').textContent = d.saved + '개 스토리에 링크를 넣었어요.';
      $('bulkList').hidden = true;
      $('bulkApply').hidden = true;
      $('bulkFlip').hidden = true;
      bulkPairs = [];
      await reload();
    } catch (err) {
      $('bulkMsg').textContent = err.message;
    }
    $('bulkApply').disabled = false;
  });

  function update(s, patch) {
    return api('/api/admin/stories/' + encodeURIComponent(s.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((d) => {
      Object.assign(s, d.story);
      return d.story;
    });
  }

  $('list').addEventListener('change', (e) => {
    const box = e.target.closest('input[data-sel]');
    if (!box) return;
    const id = box.closest('.reg-row').dataset.id;
    if (box.checked) sel.add(id);
    else sel.delete(id);
    box.closest('.reg-row').classList.toggle('is-sel', box.checked);
    armedBulk = false;
    drawSelBar();
  });

  $('list').addEventListener('click', async (e) => {
    const row = e.target.closest('.reg-row');
    if (!row || e.target.closest('.reg-sel')) return;
    const s = stories.find((x) => x.id === row.dataset.id);
    if (!s) return;
    try {
      const mk = e.target.closest('button[data-mk]');
      if (mk) {
        // time sale switches on and off; sold out and expired replace each other, a second tap clears
        let patch;
        if (mk.dataset.mk === 'sale') patch = { timeSale: !s.timeSale };
        else patch = { saleState: s.saleState === mk.dataset.mk ? null : mk.dataset.mk };
        await update(s, patch);
        render();
        const names = { sale: '타임세일', soldout: '품절', expired: '기간 만료' };
        const on = mk.dataset.mk === 'sale' ? s.timeSale : s.saleState === mk.dataset.mk;
        say(names[mk.dataset.mk] + (on ? ' 표시를 붙였어요' : ' 표시를 뗐어요'));
        return;
      }
      const catBtn = e.target.closest('button[data-cat]');
      if (catBtn) {
        const moved = s.category !== catBtn.dataset.cat;
        await update(s, { category: catBtn.dataset.cat });
        render();
        say(moved ? LABEL[s.category] + '로 옮겼어요' : LABEL[s.category] + '가 맞다고 확인했어요');
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'link') {
        await update(s, { link: row.querySelector('input').value.trim() || null });
        render();
        say(s.link ? '링크를 저장했어요' : '링크를 지웠어요');
      } else if (act.dataset.act === 'hide') {
        await update(s, { hidden: !s.hidden });
        render();
        say(s.hidden ? '사이트에서 숨겼어요' : '다시 보이게 했어요');
      } else if (act.dataset.act === 'delete') {
        if (armedDelete !== s.id) {
          armedDelete = s.id;
          render();
          return;
        }
        await api('/api/admin/stories/' + encodeURIComponent(s.id), { method: 'DELETE' });
        armedDelete = null;
        stories = stories.filter((x) => x.id !== s.id);
        render();
        say('삭제했어요');
      }
    } catch (err) {
      say(err.message);
    }
  });

  // Screenshots are large PNGs: shrink to a 1920px-tall JPEG before sending (server limit is about 4MB).
  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
      return blob || file;
    } catch (e) {
      return file;
    }
  }

  // The button opens the photo picker; choosing photos starts the upload right away.
  function showAvatar(url) {
    $('avatarNow').innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : '';
  }
  fetch('/api/stories', { cache: 'no-store' }).then((r) => r.json()).then((d) => showAvatar(d.avatar)).catch(() => {});
  $('avatarBtn').addEventListener('click', () => { $('avatarFile').click(); });
  $('avatarFile').addEventListener('change', async () => {
    const f = $('avatarFile').files && $('avatarFile').files[0];
    if (!f) return;
    $('avatarBtn').disabled = true;
    $('avatarMsg').textContent = '올리는 중이에요.';
    try {
      const fd = new FormData();
      fd.append('file', await shrink(f), 'avatar.jpg');
      const d = await api('/api/admin/avatar', { method: 'POST', body: fd });
      showAvatar(d.avatar);
      $('avatarMsg').textContent = '프로필 사진을 바꿨어요. 사이트에는 1분 안에 반영돼요.';
    } catch (err) {
      $('avatarMsg').textContent = err.message;
    }
    $('avatarFile').value = '';
    $('avatarBtn').disabled = false;
  });

  $('upload').addEventListener('click', () => { $('files').click(); });
  // After the phone's picker, the picked photos open in our own sheet. Tapping them numbers them
  // 1, 2, 3… in the order they should be posted; they upload in that order, the last number newest.
  let picked = [];
  let order = [];
  function closePicker() {
    picked.forEach((p) => URL.revokeObjectURL(p.url));
    picked = [];
    order = [];
    $('pick').hidden = true;
    document.documentElement.style.overflow = '';
    $('files').value = '';
  }
  // Tiles are built once per pick and then only re-marked: rebuilding them under a moving finger
  // would detach the touched element and end the drag.
  function drawPicker() {
    const tiles = $('pickGrid').children;
    if (tiles.length === picked.length) {
      for (let i = 0; i < tiles.length; i += 1) {
        const n = order.indexOf(i);
        tiles[i].classList.toggle('on', n >= 0);
        tiles[i].setAttribute('aria-pressed', String(n >= 0));
        tiles[i].setAttribute('aria-label', '사진 ' + (i + 1) + (n >= 0 ? ', ' + (n + 1) + '번' : ', 선택 안 됨'));
        tiles[i].lastChild.textContent = n >= 0 ? String(n + 1) : '';
      }
      drawStrip();
      return;
    }
    $('pickGrid').innerHTML = picked.map((p, i) => {
      const n = order.indexOf(i);
      return '<button type="button" class="pk' + (n >= 0 ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + (n >= 0) + '" aria-label="사진 ' + (i + 1) + (n >= 0 ? ', ' + (n + 1) + '번' : ', 선택 안 됨') + '">' +
        '<img src="' + p.url + '" alt="">' + '<span class="pk-n">' + (n >= 0 ? n + 1 : '') + '</span></button>';
    }).join('');
    drawStrip();
  }
  function drawStrip() {
    $('pickStrip').innerHTML = order.map((i, n) => '<button type="button" class="ps" data-i="' + i + '" aria-label="' + (n + 1) + '번 빼기">' +
      '<img src="' + picked[i].url + '" alt=""><span class="ps-n">' + (n + 1) + '</span><span class="ps-x" aria-hidden="true">×</span></button>').join('');
    // the strip keeps its height when empty, so the photos never jump under a moving finger
    if (!order.length) $('pickStrip').innerHTML = '<span class="ps-empty">누른 순서대로 여기에 쌓여요</span>';
    $('pickGo').disabled = !order.length;
    $('pickGo').querySelector('span').textContent = order.length ? order.length + '장 올리기' : '올리기';
    $('pickAll').querySelector('span').textContent = order.length === picked.length ? '모두 해제' : '고른 순서로 모두 선택';
  }
  function toggle(i) {
    const n = order.indexOf(i);
    if (n >= 0) order.splice(n, 1);
    else order.push(i);
    drawPicker();
  }
  $('files').addEventListener('change', () => {
    const files = Array.from($('files').files || []);
    if (!files.length) return;
    picked = files.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    order = [];
    $('pickGrid').innerHTML = '';
    drawPicker();
    $('pick').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    $('pickGrid').scrollTop = 0;
  });
  $('pickGrid').addEventListener('click', (e) => {
    if (dragJustEnded) { dragJustEnded = false; return; }
    const b = e.target.closest('.pk');
    if (b) toggle(Number(b.dataset.i));
  });

  // Drag across photos to number many at once, like the Photos app: start the drag sideways,
  // then move in any direction. Starting on an empty photo numbers what you pass over (in the order
  // you pass it); starting on a numbered one takes the numbers off. A straight up-down swipe still scrolls.
  const grid = $('pickGrid');
  let drag = null;
  let dragJustEnded = false;
  let autoTimer = 0;
  function tileAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const b = el && el.closest ? el.closest('.pk') : null;
    return b && grid.contains(b) ? Number(b.dataset.i) : null;
  }
  function paint(i) {
    if (i === null || drag.seen.has(i)) return;
    drag.seen.add(i);
    const n = order.indexOf(i);
    if (drag.adding && n < 0) order.push(i);
    if (!drag.adding && n >= 0) order.splice(n, 1);
    drawPicker();
  }
  // near the top or bottom edge the grid keeps scrolling so a long run can be selected in one drag
  function autoScroll() {
    if (!drag || !drag.active) return;
    const r = grid.getBoundingClientRect();
    const edge = 60;
    let dy = 0;
    if (drag.y < r.top + edge) dy = -Math.ceil((r.top + edge - drag.y) / 4);
    else if (drag.y > r.bottom - edge) dy = Math.ceil((drag.y - (r.bottom - edge)) / 4);
    if (dy) {
      grid.scrollTop += dy;
      paint(tileAt(drag.x, drag.y));
    }
    autoTimer = requestAnimationFrame(autoScroll);
  }
  function dragStart(x, y) {
    const i = tileAt(x, y);
    drag = i === null ? null : { x0: x, y0: y, x: x, y: y, first: i, active: false, adding: order.indexOf(i) < 0, seen: new Set() };
  }
  // returns true once the gesture has become a selection drag
  function dragMove(x, y) {
    if (!drag) return false;
    drag.x = x;
    drag.y = y;
    if (!drag.active) {
      const dx = Math.abs(x - drag.x0);
      const dy = Math.abs(y - drag.y0);
      if (dx < 10 && dy < 10) return false;
      if (dy >= dx) { drag = null; return false; }
      drag.active = true;
      paint(drag.first);
      autoTimer = requestAnimationFrame(autoScroll);
    }
    paint(tileAt(x, y));
    return true;
  }
  function dragEnd() {
    if (drag && drag.active) dragJustEnded = true;
    cancelAnimationFrame(autoTimer);
    drag = null;
    setTimeout(() => { dragJustEnded = false; }, 350);
  }
  grid.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { drag = null; return; }
    dragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  grid.addEventListener('touchmove', (e) => {
    if (!drag) return;
    if (dragMove(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
  }, { passive: false });
  grid.addEventListener('touchend', dragEnd);
  grid.addEventListener('touchcancel', dragEnd);
  // mouse, for a computer
  grid.addEventListener('mousedown', (e) => { if (e.button === 0) { dragStart(e.clientX, e.clientY); e.preventDefault(); } });
  window.addEventListener('mousemove', (e) => { if (drag) dragMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (drag) dragEnd(); });
  $('pickStrip').addEventListener('click', (e) => {
    const b = e.target.closest('.ps');
    if (b) toggle(Number(b.dataset.i));
  });
  $('pickAll').addEventListener('click', () => {
    order = order.length === picked.length ? [] : picked.map((p, i) => i);
    drawPicker();
  });
  $('pickClose').addEventListener('click', closePicker);
  $('pickGo').addEventListener('click', () => {
    const files = order.map((i) => picked[i].file);
    closePicker();
    uploadInOrder(files);
  });

  async function uploadInOrder(files) {
    const btn = $('upload');
    btn.disabled = true;
    const lines = [];
    // one by one, in number order: the server keeps the order it receives them in
    for (let i = 0; i < files.length; i += 1) {
      $('uploadMsg').textContent = (i + 1) + ' / ' + files.length + ' 올리는 중이에요. 자동 분류까지 몇 초씩 걸려요.';
      const label = (i + 1) + '번';
      const fd = new FormData();
      fd.append('file', await shrink(files[i]), files[i].name.replace(/\.[^.]+$/, '') + '.jpg');
      fd.append('takenAt', new Date().toISOString());
      try {
        const body = fd.get('file');
        if (body && body.size > 4.3 * 1024 * 1024) {
          lines.push(label + ': 이 브라우저에서 사진을 줄이지 못했어요. 아이폰 Safari에서 올려주세요.');
          continue;
        }
        const d = await api('/api/ingest', { method: 'POST', body: fd });
        const r = d.results[0];
        if (r.error) lines.push(label + ': ' + r.error);
        else if (r.result === 'duplicate') lines.push(label + ': 이미 올라와 있어요');
        else lines.push(label + ': ' + LABEL[r.category] + (r.sure ? '' : ' (확인 필요)') + (r.itemName ? ' · ' + r.itemName : ''));
      } catch (err) {
        lines.push(label + ': ' + err.message);
      }
    }
    $('uploadMsg').textContent = lines.join('\n');
    btn.disabled = false;
    reload().catch((err) => say(err.message));
  }

  // Older stories have no saved sticker position: ask a few at a time until none are left.
  $('locate').addEventListener('click', async () => {
    const btn = $('locate');
    btn.disabled = true;
    let found = 0;
    try {
      for (let i = 0; i < 60; i += 1) {
        const d = await api('/api/admin/locate', { method: 'POST' });
        found += d.found;
        $('uploadMsg').textContent = '스티커 위치를 찾는 중이에요. 남은 스토리 ' + d.left + '개';
        if (!d.left || !d.done) break;
      }
      $('uploadMsg').textContent = '끝났어요. 상품링크 스티커를 ' + found + '개 스토리에서 찾았어요.';
    } catch (err) {
      $('uploadMsg').textContent = err.message;
    }
    btn.disabled = false;
    reload().catch(() => {});
  });

  $('addLink').addEventListener('click', async () => {
    const url = $('linkUrl').value.trim();
    if (!url) return;
    try {
      const d = await api('/api/links', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: url });
      $('linkMsg').textContent = d.message + (d.attachedTo && d.attachedTo.itemName ? ' (' + d.attachedTo.itemName + ')' : '');
      $('linkUrl').value = '';
      reload().catch(() => {});
    } catch (err) {
      $('linkMsg').textContent = err.message;
    }
  });

  if (token) login();
})();
