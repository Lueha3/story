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
  let filter = 'check';
  let armedDelete = null;

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

  function visible() {
    if (filter === 'check') return stories.filter((s) => !s.hidden && (!s.sure || s.status === 'failed'));
    if (filter === 'nolink') return stories.filter((s) => !s.hidden && !s.link && s.status !== 'pending');
    if (filter === 'hidden') return stories.filter((s) => s.hidden);
    return stories;
  }

  function render() {
    $('cntCheck').textContent = stories.filter((s) => !s.hidden && (!s.sure || s.status === 'failed')).length;
    $('cntNolink').textContent = stories.filter((s) => !s.hidden && !s.link && s.status !== 'pending').length;
    $('cntAll').textContent = stories.length;
    $('cntHidden').textContent = stories.filter((s) => s.hidden).length;
    document.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
    const rows = visible().slice(0, 200);
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
      return '<div class="reg-row' + (s.hidden ? ' is-hidden' : '') + '" data-id="' + esc(s.id) + '">' +
        '<div class="reg-thumb"><a class="card" href="' + esc(s.imageUrl) + '" target="_blank" rel="noopener"><img src="' + esc(s.imageUrl) + '" alt="스토리 이미지" loading="lazy"></a></div>' +
        '<div class="reg-b"><div class="reg-n"><b>' + esc(s.itemName || '이름 없음') + '</b>' + badge + '</div>' +
        '<span class="reg-m">' + when(s.takenAt) + (s.priceText ? ' · ' + esc(s.priceText) : '') + '</span>' +
        (note ? '<span class="rule">' + esc(note) + '</span>' : '') +
        '<div class="reg-c" role="group" aria-label="카테고리">' +
        CATS.map((c) => '<button type="button" data-cat="' + c[0] + '" aria-pressed="' + (s.category === c[0]) + '"><span>' + c[1] + '</span></button>').join('') +
        '</div>' +
        '<div class="reg-l"><input type="url" value="' + esc(s.link || '') + '" placeholder="상품링크 붙여넣기" aria-label="상품링크">' +
        '<button type="button" class="pill" data-act="link"><span>저장</span></button></div>' +
        '<div class="row">' +
        '<button type="button" class="pill" data-act="hide"><span>' + (s.hidden ? '다시 보이기' : '숨기기') + '</span></button>' +
        '<button type="button" class="pill danger" data-act="delete"><span>' + (armedDelete === s.id ? '한 번 더 누르면 삭제' : '삭제') + '</span></button>' +
        '</div></div></div>';
    }).join('');
  }

  async function reload() {
    const data = await api('/api/admin/stories');
    stories = data.stories;
    render();
  }

  async function login() {
    $('loginMsg').textContent = '';
    try {
      await reload();
      try { localStorage.setItem(KEY, token); } catch (e) { /* storage blocked */ }
      $('loginBox').hidden = true;
      $('work').hidden = false;
    } catch (e) {
      $('loginMsg').textContent = e.message;
    }
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

  $('list').addEventListener('click', async (e) => {
    const row = e.target.closest('.reg-row');
    if (!row) return;
    const s = stories.find((x) => x.id === row.dataset.id);
    if (!s) return;
    try {
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

  $('upload').addEventListener('click', async () => {
    const files = Array.from($('files').files || []);
    if (!files.length) { $('uploadMsg').textContent = '이미지를 먼저 골라주세요.'; return; }
    const btn = $('upload');
    btn.disabled = true;
    const lines = [];
    // one by one, so each request stays well under the server's time limit
    for (let i = 0; i < files.length; i += 1) {
      $('uploadMsg').textContent = (i + 1) + ' / ' + files.length + ' 올리는 중이에요. 자동 분류까지 몇 초씩 걸려요.';
      const fd = new FormData();
      fd.append('file', await shrink(files[i]), files[i].name.replace(/\.[^.]+$/, '') + '.jpg');
      fd.append('takenAt', new Date(files[i].lastModified || Date.now()).toISOString());
      try {
        const d = await api('/api/ingest', { method: 'POST', body: fd });
        const r = d.results[0];
        if (r.error) lines.push(files[i].name + ': ' + r.error);
        else if (r.result === 'duplicate') lines.push(files[i].name + ': 이미 올라와 있어요');
        else lines.push(files[i].name + ': ' + LABEL[r.category] + (r.sure ? '' : ' (확인 필요)') + (r.itemName ? ' · ' + r.itemName : ''));
      } catch (err) {
        lines.push(files[i].name + ': ' + err.message);
      }
    }
    $('uploadMsg').textContent = lines.join('\n');
    $('files').value = '';
    btn.disabled = false;
    reload().catch((err) => say(err.message));
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
