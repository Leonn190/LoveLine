import JSZip from 'jszip';

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_METRICS = [
  'Dias Juntos',
  'Quantidade de Beijos',
  'Quantidade de Transas',
  'Dias Relacionando',
  'Dias Ficando Serio',
  'Dias Namorando',
  'Dias Morando Juntos',
  'Dias Casados',
  'Viagens Juntos',
  'Dinheiro Gasto',
  'Presentes Recebidos',
  'Presentes Enviados',
  'Encontros',
  'Qualidade Geral'
];

const COLOR_PAIRS = [
  ['#ff82b2', '#ffc9df'],
  ['#ff9aa2', '#ffd1dc'],
  ['#c77dff', '#e0aaff'],
  ['#80ed99', '#c7f9cc'],
  ['#48cae4', '#ade8f4'],
  ['#f9c74f', '#ffe8a3'],
  ['#f28482', '#f6bdc0'],
  ['#90dbf4', '#b9fbc0'],
  ['#b8c0ff', '#ffd6ff'],
  ['#f15bb5', '#fee440'],
  ['#00bbf9', '#00f5d4'],
  ['#adb5bd', '#dee2e6']
];

const state = {
  version: 1,
  camera: {
    centerMs: startOfDay(Date.now()),
    pixelsPerDay: 14
  },
  people: [],
  items: [],
  assets: {},
  opened: false,
  peopleOpen: false,
  activePanel: null,
  pointer: null,
  dragPerson: null,
  hoverItemId: null,
  highlighted: null,
  playTimer: null,
  playIndex: 0,
  playMoments: []
};

const els = {
  app: document.getElementById('app'),
  canvas: document.getElementById('timelineCanvas'),
  intro: document.getElementById('introOverlay'),
  peopleBtn: document.getElementById('peopleBtn'),
  peopleDropdown: document.getElementById('peopleDropdown'),
  homeBtn: document.getElementById('homeBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  playBtn: document.getElementById('playBtn'),
  panel: document.getElementById('sidePanel'),
  panelContent: document.getElementById('panelContent'),
  toast: document.getElementById('toast')
};

const ctx = els.canvas.getContext('2d');
let rafId = 0;
let canvasRect = els.canvas.getBoundingClientRect();

boot();

function boot() {
  resizeCanvas();
  renderPeopleDropdown();
  bindEvents();
  requestDraw();
}

function bindEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    requestDraw();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel();
      closePeopleDropdown();
      stopPlayback();
    }
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());

  els.intro.addEventListener('click', () => startEditing());
  els.intro.addEventListener('dragover', allowDrop);
  els.intro.addEventListener('drop', handleLovelineDrop);
  els.app.addEventListener('dragover', allowDrop);
  els.app.addEventListener('drop', handleLovelineDrop);

  els.homeBtn.addEventListener('click', () => {
    stopPlayback();
    closePanel();
    closePeopleDropdown();
    state.opened = false;
    els.app.classList.add('blurred');
  });

  els.peopleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    state.peopleOpen = !state.peopleOpen;
    renderPeopleDropdown();
  });

  els.downloadBtn.addEventListener('click', exportLoveline);
  els.playBtn.addEventListener('click', playTimeline);

  els.canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  els.canvas.addEventListener('pointermove', handleCanvasPointerMove);
  els.canvas.addEventListener('pointerup', handleCanvasPointerUp);
  els.canvas.addEventListener('pointerleave', handleCanvasPointerLeave);
  els.canvas.addEventListener('wheel', handleWheel, { passive: false });

  document.addEventListener('pointermove', handleGlobalPointerMove);
  document.addEventListener('pointerup', handleGlobalPointerUp);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.people-menu')) closePeopleDropdown();
  });
}

function resizeCanvas() {
  canvasRect = els.canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  els.canvas.width = Math.floor(canvasRect.width * ratio);
  els.canvas.height = Math.floor(canvasRect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function requestDraw() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(drawTimeline);
}

function drawTimeline() {
  const w = canvasRect.width;
  const h = canvasRect.height;
  const lineY = getLineY();
  ctx.clearRect(0, 0, w, h);

  drawBackground(w, h);
  drawTicks(w, h, lineY);
  drawBaseLine(w, lineY);
  drawDraftPeriod(lineY);
  drawItems(lineY);
  drawPlaybackLabel(lineY);
  drawHelp(lineY);
}

function drawBackground(w, h) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#fff8fc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffc9df';
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.22, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ff82b2';
  ctx.beginPath();
  ctx.arc(w * 0.88, h * 0.82, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBaseLine(w, lineY) {
  ctx.save();
  ctx.strokeStyle = '#f0c3d5';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(40, lineY);
  ctx.lineTo(w - 40, lineY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(42, lineY - 2);
  ctx.lineTo(w - 42, lineY - 2);
  ctx.stroke();
  ctx.restore();
}

function drawTicks(w, h, lineY) {
  const scale = state.camera.pixelsPerDay;
  const startMs = screenToDate(0) - DAY * 20;
  const endMs = screenToDate(w) + DAY * 20;
  const mode = getTickMode(scale);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '12px Inter, system-ui, sans-serif';

  if (mode.kind === 'day') drawDayTicks(startMs, endMs, lineY, mode.every);
  if (mode.kind === 'week') drawWeekTicks(startMs, endMs, lineY, mode.every);
  if (mode.kind === 'month') drawMonthTicks(startMs, endMs, lineY, mode.every);
  if (mode.kind === 'year') drawYearTicks(startMs, endMs, lineY, mode.every);

  ctx.restore();
}

function drawDayTicks(startMs, endMs, lineY, every) {
  let cursor = startOfDay(startMs);
  const end = startOfDay(endMs);
  while (cursor <= end) {
    const date = new Date(cursor);
    const dayIndex = Math.floor(cursor / DAY);
    if (dayIndex % every === 0) {
      const x = dateToScreen(cursor);
      const isMonthStart = date.getDate() === 1;
      const isWeekStart = date.getDay() === 1;
      drawTick(x, lineY, isMonthStart ? 34 : isWeekStart ? 23 : 12, isMonthStart ? '#ee9fbe' : '#f4d0dd');
      if (isMonthStart) drawLabel(x, lineY + 40, monthShort(date) + ' ' + date.getFullYear());
      else if (every === 1 && isWeekStart) drawLabel(x, lineY + 28, `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`);
    }
    cursor += DAY;
  }
}

function drawWeekTicks(startMs, endMs, lineY, every) {
  let cursor = startOfWeek(startMs);
  const end = startOfWeek(endMs + DAY * 8);
  let count = 0;
  while (cursor <= end) {
    if (count % every === 0) {
      const date = new Date(cursor);
      const x = dateToScreen(cursor);
      const isMonthStart = date.getDate() <= 7;
      drawTick(x, lineY, isMonthStart ? 32 : 18, isMonthStart ? '#ee9fbe' : '#f4d0dd');
      drawLabel(x, lineY + 30, isMonthStart ? `${monthShort(date)} ${date.getFullYear()}` : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`);
    }
    cursor += DAY * 7;
    count += 1;
  }
}

function drawMonthTicks(startMs, endMs, lineY, every) {
  const start = new Date(startMs);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
  const end = new Date(endMs);
  const endCursor = new Date(end.getFullYear(), end.getMonth() + 1, 1).getTime();
  while (cursor <= endCursor) {
    const date = new Date(cursor);
    const monthIndex = date.getFullYear() * 12 + date.getMonth();
    if (monthIndex % every === 0) {
      const x = dateToScreen(cursor);
      const isYear = date.getMonth() === 0;
      drawTick(x, lineY, isYear ? 36 : 22, isYear ? '#ee9fbe' : '#f4d0dd');
      drawLabel(x, lineY + 32, isYear ? String(date.getFullYear()) : monthShort(date));
    }
    cursor = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  }
}

function drawYearTicks(startMs, endMs, lineY, every) {
  const start = new Date(startMs);
  const end = new Date(endMs);
  let year = start.getFullYear() - 1;
  while (year <= end.getFullYear() + 1) {
    if (year % every === 0) {
      const x = dateToScreen(new Date(year, 0, 1).getTime());
      drawTick(x, lineY, 38, '#ee9fbe');
      drawLabel(x, lineY + 34, String(year));
    }
    year += 1;
  }
}

function drawTick(x, lineY, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size > 30 ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(x, lineY - size);
  ctx.lineTo(x, lineY + size);
  ctx.stroke();
}

function drawLabel(x, y, text) {
  ctx.fillStyle = '#b58a9c';
  ctx.fillText(text, x, y);
}

function drawItems(lineY) {
  const sorted = [...state.items].sort((a, b) => (a.endMs || a.startMs) - (b.endMs || b.startMs));
  for (const item of sorted) {
    if (item.type === 'period') drawPeriod(item, lineY);
  }
  for (const item of sorted) {
    if (item.type === 'event') drawEvent(item, lineY);
  }
}

function drawPeriod(item, lineY) {
  const x1 = dateToScreen(item.startMs);
  const x2 = dateToScreen(item.endMs || item.startMs);
  const left = Math.min(x1, x2);
  const width = Math.max(26, Math.abs(x2 - x1));
  if (left > canvasRect.width + 120 || left + width < -120) return;

  const person = getPerson(item.personId);
  const colors = person ? person.colors : ['#a7a7a7', '#d8d8d8'];
  const isHot = state.hoverItemId === item.id || isHighlighted(item.id);
  const y = lineY - (isHot ? 20 : 16);
  const height = isHot ? 40 : 32;
  const gradient = ctx.createLinearGradient(left, y, left + width, y + height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.save();
  ctx.shadowColor = person ? `${colors[0]}55` : 'rgba(130,130,130,0.20)';
  ctx.shadowBlur = isHot ? 24 : 13;
  ctx.fillStyle = gradient;
  roundRect(ctx, left, y, width, height, 999);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (item.title) {
    ctx.fillStyle = person ? '#ffffff' : '#fff';
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clipText(item.title, Math.max(40, width - 18)), left + width / 2, y + height / 2);
  }
  ctx.restore();
}

function drawEvent(item, lineY) {
  const x = dateToScreen(item.startMs);
  if (x < -80 || x > canvasRect.width + 80) return;
  const person = getPerson(item.personId);
  const colors = person ? person.colors : ['#a7a7a7', '#d8d8d8'];
  const isHot = state.hoverItemId === item.id || isHighlighted(item.id);
  const r = isHot ? 18 : 14;
  const gradient = ctx.createLinearGradient(x - r, lineY - r, x + r, lineY + r);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.save();
  ctx.shadowColor = person ? `${colors[0]}55` : 'rgba(130,130,130,0.20)';
  ctx.shadowBlur = isHot ? 24 : 13;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, lineY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const icon = getAsset(item.iconImageId);
  if (icon) drawImageInCircle(icon.dataUrl, x, lineY, r - 2);

  if (item.title) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#876172';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(clipText(item.title, 120), x, lineY + r + 8);
  }
  ctx.restore();
}

function drawDraftPeriod(lineY) {
  if (!state.pointer || state.pointer.mode !== 'create' || !state.pointer.hasMoved) return;
  const x1 = state.pointer.startX;
  const x2 = state.pointer.x;
  const left = Math.min(x1, x2);
  const width = Math.max(12, Math.abs(x2 - x1));
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.fillStyle = 'rgba(170, 170, 170, 0.22)';
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.75)';
  roundRect(ctx, left, lineY - 17, width, 34, 999);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlaybackLabel(lineY) {
  if (!state.highlighted) return;
  const { itemId, label, ms } = state.highlighted;
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const x = dateToScreen(ms);
  const y = lineY - 92;
  const text = item.title || (item.type === 'period' ? 'Período' : 'Evento');
  const subtitle = `${label} • ${formatDate(ms)}`;
  const width = Math.min(320, Math.max(170, ctx.measureText(text).width + 58));
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(255, 169, 202, 0.62)';
  ctx.shadowColor = 'rgba(255, 120, 176, 0.20)';
  ctx.shadowBlur = 20;
  roundRect(ctx, clamp(x - width / 2, 20, canvasRect.width - width - 20), y, width, 60, 22);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3f2631';
  ctx.font = '800 15px Inter, system-ui, sans-serif';
  ctx.fillText(clipText(text, width - 28), clamp(x, 20 + width / 2, canvasRect.width - width / 2 - 20), y + 16);
  ctx.fillStyle = '#9b7888';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(subtitle, clamp(x, 20 + width / 2, canvasRect.width - width / 2 - 20), y + 36);
  ctx.restore();
}

function drawHelp(lineY) {
  if (state.items.length > 0 || !state.opened) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b58a9c';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('clique na linha para criar um ponto • segure e arraste para criar um período • botão direito arrasta a câmera • scroll controla o zoom', canvasRect.width / 2, lineY + 84);
  ctx.restore();
}

function handleCanvasPointerDown(event) {
  if (!state.opened) return;
  canvasRect = els.canvas.getBoundingClientRect();
  const pos = pointerPos(event);
  const hit = hitTestItem(pos.x, pos.y);
  stopPlayback();

  if (event.button === 2) {
    els.canvas.setPointerCapture(event.pointerId);
    state.pointer = {
      mode: 'pan',
      id: event.pointerId,
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y,
      startCenterMs: state.camera.centerMs
    };
    els.canvas.style.cursor = 'grabbing';
    return;
  }

  if (event.button !== 0) return;
  els.canvas.setPointerCapture(event.pointerId);
  state.pointer = {
    mode: 'create',
    id: event.pointerId,
    startX: pos.x,
    startY: pos.y,
    x: pos.x,
    y: pos.y,
    startMs: screenToDate(pos.x),
    hitItemId: hit?.id || null,
    lineStarted: isNearLine(pos.y),
    hasMoved: false
  };
}

function handleCanvasPointerMove(event) {
  if (!state.opened) return;
  const pos = pointerPos(event);

  if (state.pointer?.id === event.pointerId) {
    if (state.pointer.mode === 'pan') {
      const dx = pos.x - state.pointer.startX;
      state.camera.centerMs = state.pointer.startCenterMs - (dx / state.camera.pixelsPerDay) * DAY;
      state.pointer.x = pos.x;
      state.pointer.y = pos.y;
      requestDraw();
      return;
    }

    if (state.pointer.mode === 'create') {
      const dx = pos.x - state.pointer.startX;
      const dy = pos.y - state.pointer.startY;
      state.pointer.hasMoved = Math.hypot(dx, dy) > 8;
      state.pointer.x = pos.x;
      state.pointer.y = pos.y;
      requestDraw();
      return;
    }
  }

  const hit = hitTestItem(pos.x, pos.y);
  state.hoverItemId = hit?.id || null;
  els.canvas.style.cursor = hit ? 'pointer' : isNearLine(pos.y) ? 'crosshair' : 'grab';
  requestDraw();
}

function handleCanvasPointerUp(event) {
  if (!state.pointer || state.pointer.id !== event.pointerId) return;
  const pointer = state.pointer;
  const pos = pointerPos(event);
  state.pointer = null;
  els.canvas.releasePointerCapture(event.pointerId);
  els.canvas.style.cursor = 'crosshair';

  if (pointer.mode === 'pan') return;
  if (pointer.hitItemId && !pointer.hasMoved) {
    openItemPanel(pointer.hitItemId);
    return;
  }

  if (!pointer.lineStarted || !isNearLine(pos.y, 70)) return;

  const endMs = screenToDate(pos.x);
  if (pointer.hasMoved && Math.abs(pos.x - pointer.startX) > 18) {
    const item = createItem('period', Math.min(pointer.startMs, endMs), Math.max(pointer.startMs, endMs));
    openItemPanel(item.id);
  } else {
    const item = createItem('event', screenToDate(pos.x), null);
    openItemPanel(item.id);
  }
  requestDraw();
}

function handleCanvasPointerLeave() {
  state.hoverItemId = null;
  requestDraw();
}

function handleWheel(event) {
  if (!state.opened) return;
  event.preventDefault();
  stopPlayback();
  const pos = pointerPos(event);
  const beforeMs = screenToDate(pos.x);
  const zoomFactor = event.deltaY < 0 ? 1.13 : 0.88;
  state.camera.pixelsPerDay = clamp(state.camera.pixelsPerDay * zoomFactor, 0.025, 80);
  const afterMs = screenToDate(pos.x);
  state.camera.centerMs += beforeMs - afterMs;
  requestDraw();
}

function handleGlobalPointerMove(event) {
  if (!state.dragPerson) return;
  event.preventDefault();
  state.dragPerson.x = event.clientX;
  state.dragPerson.y = event.clientY;
  state.dragPerson.ghost.style.left = `${event.clientX - 26}px`;
  state.dragPerson.ghost.style.top = `${event.clientY - 26}px`;
  const localX = event.clientX - canvasRect.left;
  const localY = event.clientY - canvasRect.top;
  const hit = hitTestItem(localX, localY, 34);
  state.hoverItemId = hit?.id || null;
  requestDraw();
}

function handleGlobalPointerUp(event) {
  if (!state.dragPerson) return;
  const drag = state.dragPerson;
  drag.ghost.remove();
  const localX = event.clientX - canvasRect.left;
  const localY = event.clientY - canvasRect.top;
  const hit = hitTestItem(localX, localY, 42);
  if (hit) {
    hit.personId = drag.personId;
    toast('Pessoa ligada ao item da timeline.');
    if (state.activePanel?.type === 'item' && state.activePanel.id === hit.id) openItemPanel(hit.id);
  }
  state.dragPerson = null;
  state.hoverItemId = null;
  requestDraw();
}

function createItem(type, startMs, endMs) {
  const item = {
    id: uid('item'),
    type,
    startMs: startOfDay(startMs),
    endMs: type === 'period' ? startOfDay(endMs || startMs + DAY) : null,
    title: '',
    description: '',
    personId: null,
    iconImageId: null,
    galleryIds: []
  };
  state.items.push(item);
  return item;
}

function renderPeopleDropdown() {
  els.peopleDropdown.classList.toggle('open', state.peopleOpen);
  els.peopleDropdown.innerHTML = '';

  for (const person of state.people) {
    const button = document.createElement('button');
    button.className = 'person-bubble';
    button.type = 'button';
    button.title = personLabel(person);
    button.style.background = gradient(person.colors);

    const photo = getAsset(person.profileImageId);
    if (photo) {
      const img = document.createElement('img');
      img.src = photo.dataUrl;
      img.alt = personLabel(person);
      button.appendChild(img);
    } else {
      button.textContent = initials(personLabel(person));
    }

    let startX = 0;
    let startY = 0;
    let moved = false;

    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener('pointermove', (event) => {
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (distance < 8 || state.dragPerson) return;
      moved = true;
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.style.background = gradient(person.colors);
      ghost.style.left = `${event.clientX - 26}px`;
      ghost.style.top = `${event.clientY - 26}px`;
      const photoAsset = getAsset(person.profileImageId);
      if (photoAsset) {
        ghost.style.backgroundImage = `url(${photoAsset.dataUrl})`;
        ghost.style.backgroundSize = 'cover';
        ghost.style.backgroundPosition = 'center';
      }
      els.app.appendChild(ghost);
      state.dragPerson = { personId: person.id, ghost, x: event.clientX, y: event.clientY };
    });

    button.addEventListener('pointerup', (event) => {
      event.stopPropagation();
      if (!moved && !state.dragPerson) openPersonPanel(person.id);
    });

    els.peopleDropdown.appendChild(button);
  }

  const add = document.createElement('button');
  add.className = 'person-bubble add-person';
  add.type = 'button';
  add.title = 'Adicionar pessoa';
  add.innerHTML = '<span>+</span>';
  add.addEventListener('click', (event) => {
    event.stopPropagation();
    openPersonPanel(null);
  });
  els.peopleDropdown.appendChild(add);
}

function openPersonPanel(personId) {
  closePeopleDropdown();
  const original = personId ? getPerson(personId) : null;
  const person = clone(original || makeEmptyPerson());
  state.activePanel = { type: 'person', id: personId };
  els.panel.classList.add('open');
  renderPersonPanel(person, Boolean(original));
}

function renderPersonPanel(person, editing) {
  const profile = getAsset(person.profileImageId);
  els.panelContent.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title">${editing ? 'Editar pessoa' : 'Adicionar pessoa'}</h2>
        <p class="panel-subtitle">Crie a pessoa que poderá ser arrastada para eventos e períodos.</p>
      </div>
      <button class="icon-close" type="button" data-action="close">×</button>
    </div>

    <div class="form-grid">
      <div class="field">
        <label>Foto de perfil</label>
        <div class="file-box">
          <div class="preview-avatar" id="personAvatarPreview" style="background:${gradient(person.colors)}">${profile ? `<img src="${profile.dataUrl}" alt="Foto de perfil" />` : initials(personLabel(person))}</div>
          <input id="personProfile" type="file" accept="image/*" />
        </div>
      </div>

      <div class="field">
        <label>Nome completo</label>
        <input id="personFullName" value="${escapeAttr(person.fullName)}" placeholder="Ex: Ana Clara Souza" />
      </div>

      <div class="field inline">
        <div>
          <label>Apelido</label>
          <input id="personNickname" value="${escapeAttr(person.nickname)}" placeholder="Ex: Aninha" />
        </div>
        <div>
          <label>Data de nascimento</label>
          <input id="personBirthDate" type="date" value="${escapeAttr(person.birthDate)}" />
        </div>
      </div>

      <div class="field inline">
        <div>
          <label>Idade automática</label>
          <input id="personAge" value="${person.birthDate ? ageFromDate(person.birthDate) + ' anos' : ''}" disabled placeholder="Calculada pela data" />
        </div>
        <div>
          <label>Instagram</label>
          <input id="personInstagram" value="${escapeAttr(person.instagram)}" placeholder="@usuario" />
        </div>
      </div>

      <div class="field">
        <label>Cores da pessoa</label>
        <div class="color-pair-row">
          <input id="personColorA" type="color" value="${person.colors[0]}" />
          <input id="personColorB" type="color" value="${person.colors[1]}" />
          <button class="secondary-btn" type="button" data-action="shuffle-colors">Sugestão</button>
        </div>
        <div class="color-suggestions">
          ${COLOR_PAIRS.map((pair, index) => `<button class="color-chip" type="button" data-color-index="${index}" style="background:${gradient(pair)}" title="Usar combinação"></button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label>Banco de fotos com a pessoa</label>
        <div class="file-box">
          <input id="personGalleryInput" type="file" accept="image/*" multiple />
          <div id="personGallery" class="gallery-grid">${galleryHtml(person.galleryIds)}</div>
        </div>
      </div>

      <div class="metric-block">
        <div class="metric-head">
          <strong>Campos adicionais</strong>
        </div>
        <div class="field inline">
          <select id="defaultMetricSelect">
            ${DEFAULT_METRICS.map((metric) => `<option value="${escapeAttr(metric)}">${escapeHtml(metric)}</option>`).join('')}
          </select>
          <button class="secondary-btn" type="button" data-action="add-default-metric">Adicionar campo</button>
        </div>
        <div id="metricsList" class="form-grid" style="margin-top:12px;">${metricsHtml(person.metrics)}</div>
      </div>

      <div class="metric-block">
        <div class="metric-head">
          <strong>Campo personalizado</strong>
        </div>
        <div class="field inline">
          <input id="customMetricName" placeholder="Texto do campo" />
          <input id="customMetricValue" type="number" placeholder="Valor numérico" />
        </div>
        <button class="secondary-btn" type="button" data-action="add-custom-metric" style="margin-top:10px;">Criar personalizado</button>
      </div>

      <div class="help-note">Depois de criar a pessoa, abra o botão de pessoas no canto superior direito e arraste a bolinha dela para cima de qualquer ponto ou período.</div>

      <div class="action-row">
        <button class="primary-btn" type="button" data-action="save-person">Salvar pessoa</button>
        ${editing ? '<button class="danger-btn" type="button" data-action="delete-person">Apagar pessoa</button>' : ''}
      </div>
    </div>
  `;

  const syncPersonFromForm = () => {
    person.fullName = value('personFullName');
    person.nickname = value('personNickname');
    person.birthDate = value('personBirthDate');
    person.instagram = value('personInstagram');
    person.colors = [value('personColorA') || '#ff82b2', value('personColorB') || '#ffc9df'];
    const age = document.getElementById('personAge');
    if (age) age.value = person.birthDate ? `${ageFromDate(person.birthDate)} anos` : '';
    const avatar = document.getElementById('personAvatarPreview');
    if (avatar) {
      const asset = getAsset(person.profileImageId);
      avatar.style.background = gradient(person.colors);
      avatar.innerHTML = asset ? `<img src="${asset.dataUrl}" alt="Foto de perfil" />` : initials(personLabel(person));
    }
  };

  bindPanelAction('close', closePanel);
  bindPanelAction('shuffle-colors', () => {
    const pair = COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
    document.getElementById('personColorA').value = pair[0];
    document.getElementById('personColorB').value = pair[1];
    syncPersonFromForm();
  });

  els.panelContent.querySelectorAll('[data-color-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const pair = COLOR_PAIRS[Number(button.dataset.colorIndex)];
      document.getElementById('personColorA').value = pair[0];
      document.getElementById('personColorB').value = pair[1];
      syncPersonFromForm();
    });
  });

  ['personFullName', 'personNickname', 'personBirthDate', 'personInstagram', 'personColorA', 'personColorB'].forEach((id) => {
    document.getElementById(id).addEventListener('input', syncPersonFromForm);
  });

  document.getElementById('personProfile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const asset = await addAsset(file);
    person.profileImageId = asset.id;
    syncPersonFromForm();
  });

  document.getElementById('personGalleryInput').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const asset = await addAsset(file);
      person.galleryIds.push(asset.id);
    }
    document.getElementById('personGallery').innerHTML = galleryHtml(person.galleryIds);
    bindGalleryRemove('personGallery', person.galleryIds);
  });

  bindGalleryRemove('personGallery', person.galleryIds);

  bindPanelAction('add-default-metric', () => {
    const label = value('defaultMetricSelect');
    person.metrics.push({ id: uid('metric'), label, value: 0, custom: false });
    document.getElementById('metricsList').innerHTML = metricsHtml(person.metrics);
    bindMetrics(person);
  });

  bindPanelAction('add-custom-metric', () => {
    const label = value('customMetricName').trim();
    const metricValue = Number(value('customMetricValue') || 0);
    if (!label) return toast('Coloque o texto do campo personalizado.');
    person.metrics.push({ id: uid('metric'), label, value: metricValue, custom: true });
    document.getElementById('customMetricName').value = '';
    document.getElementById('customMetricValue').value = '';
    document.getElementById('metricsList').innerHTML = metricsHtml(person.metrics);
    bindMetrics(person);
  });

  bindMetrics(person);

  bindPanelAction('save-person', () => {
    syncPersonFromForm();
    syncMetricsFromDom(person);
    if (!person.fullName.trim() && !person.nickname.trim()) return toast('Coloque pelo menos nome ou apelido.');
    if (editing) {
      const index = state.people.findIndex((entry) => entry.id === person.id);
      state.people[index] = person;
    } else {
      state.people.push(person);
    }
    renderPeopleDropdown();
    requestDraw();
    closePanel();
    toast(editing ? 'Pessoa atualizada.' : 'Pessoa adicionada.');
  });

  bindPanelAction('delete-person', () => {
    if (!confirm('Tem certeza que deseja apagar essa pessoa? Essa ação remove a ligação dela dos eventos e períodos.')) return;
    state.people = state.people.filter((entry) => entry.id !== person.id);
    for (const item of state.items) {
      if (item.personId === person.id) item.personId = null;
    }
    renderPeopleDropdown();
    requestDraw();
    closePanel();
    toast('Pessoa apagada.');
  });
}

function makeEmptyPerson() {
  const pair = COLOR_PAIRS[state.people.length % COLOR_PAIRS.length];
  return {
    id: uid('person'),
    fullName: '',
    nickname: '',
    birthDate: '',
    instagram: '',
    colors: [...pair],
    profileImageId: null,
    galleryIds: [],
    metrics: []
  };
}

function openItemPanel(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  state.activePanel = { type: 'item', id: itemId };
  els.panel.classList.add('open');
  renderItemPanel(item);
}

function renderItemPanel(item) {
  const icon = getAsset(item.iconImageId);
  els.panelContent.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title">${item.type === 'period' ? 'Editar período' : 'Editar evento'}</h2>
        <p class="panel-subtitle">${item.type === 'period' ? 'Períodos representam começo e fim na animação.' : 'Eventos são pontos únicos na LoveLine.'}</p>
      </div>
      <button class="icon-close" type="button" data-action="close">×</button>
    </div>

    <div class="form-grid">
      <div class="field">
        <label>Nome</label>
        <input id="itemTitle" value="${escapeAttr(item.title)}" placeholder="Ex: Primeiro encontro" />
      </div>

      <div class="field ${item.type === 'period' ? 'inline' : ''}">
        <div>
          <label>${item.type === 'period' ? 'Data de início' : 'Data'}</label>
          <input id="itemStart" type="date" value="${dateInput(item.startMs)}" />
        </div>
        ${item.type === 'period' ? `<div><label>Data de fim</label><input id="itemEnd" type="date" value="${dateInput(item.endMs)}" /></div>` : ''}
      </div>

      <div class="field">
        <label>Pessoa relacionada</label>
        <select id="itemPerson">
          <option value="">Sem pessoa / cinza</option>
          ${state.people.map((person) => `<option value="${person.id}" ${person.id === item.personId ? 'selected' : ''}>${escapeHtml(personLabel(person))}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>Imagem ícone</label>
        <div class="file-box">
          <div class="event-icon-preview" id="itemIconPreview">${icon ? `<img src="${icon.dataUrl}" alt="Ícone do item" />` : '♡'}</div>
          <input id="itemIconInput" type="file" accept="image/*" />
        </div>
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea id="itemDescription" placeholder="Escreva uma descrição desse ${item.type === 'period' ? 'período' : 'evento'}...">${escapeHtml(item.description)}</textarea>
      </div>

      <div class="field">
        <label>Banco de imagens próprio</label>
        <div class="file-box">
          <input id="itemGalleryInput" type="file" accept="image/*" multiple />
          <div id="itemGallery" class="gallery-grid">${galleryHtml(item.galleryIds)}</div>
        </div>
      </div>

      <div class="help-note">Também dá para arrastar uma bolinha de pessoa do canto superior direito para cima desse ponto/período na linha.</div>

      <div class="action-row">
        <button class="primary-btn" type="button" data-action="save-item">Salvar</button>
        <button class="danger-btn" type="button" data-action="delete-item">Apagar</button>
      </div>
    </div>
  `;

  bindPanelAction('close', closePanel);

  document.getElementById('itemIconInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const asset = await addAsset(file);
    item.iconImageId = asset.id;
    document.getElementById('itemIconPreview').innerHTML = `<img src="${asset.dataUrl}" alt="Ícone do item" />`;
    requestDraw();
  });

  document.getElementById('itemGalleryInput').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const asset = await addAsset(file);
      item.galleryIds.push(asset.id);
    }
    document.getElementById('itemGallery').innerHTML = galleryHtml(item.galleryIds);
    bindGalleryRemove('itemGallery', item.galleryIds);
  });

  bindGalleryRemove('itemGallery', item.galleryIds);

  bindPanelAction('save-item', () => {
    item.title = value('itemTitle');
    item.startMs = dateValueMs('itemStart') || item.startMs;
    item.description = value('itemDescription');
    item.personId = value('itemPerson') || null;
    if (item.type === 'period') {
      item.endMs = dateValueMs('itemEnd') || item.endMs || item.startMs + DAY;
      if (item.endMs < item.startMs) [item.startMs, item.endMs] = [item.endMs, item.startMs];
    }
    requestDraw();
    closePanel();
    toast('Item atualizado.');
  });

  bindPanelAction('delete-item', () => {
    if (!confirm('Tem certeza que deseja apagar esse item da linha do tempo?')) return;
    state.items = state.items.filter((entry) => entry.id !== item.id);
    requestDraw();
    closePanel();
    toast('Item apagado.');
  });
}

function closePanel() {
  els.panel.classList.remove('open');
  state.activePanel = null;
}

function closePeopleDropdown() {
  state.peopleOpen = false;
  els.peopleDropdown.classList.remove('open');
}

function bindPanelAction(action, fn) {
  const el = els.panelContent.querySelector(`[data-action="${action}"]`);
  if (el) el.addEventListener('click', fn);
}

function bindMetrics(person) {
  els.panelContent.querySelectorAll('[data-remove-metric]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.removeMetric;
      syncMetricsFromDom(person);
      person.metrics = person.metrics.filter((metric) => metric.id !== id);
      document.getElementById('metricsList').innerHTML = metricsHtml(person.metrics);
      bindMetrics(person);
    });
  });
}

function syncMetricsFromDom(person) {
  for (const metric of person.metrics) {
    const input = els.panelContent.querySelector(`[data-metric-value="${metric.id}"]`);
    if (input) metric.value = Number(input.value || 0);
  }
}

function metricsHtml(metrics) {
  if (!metrics.length) return '<div class="help-note">Nenhum campo adicional ainda.</div>';
  return metrics.map((metric) => `
    <div class="field">
      <div class="metric-head">
        <strong>${escapeHtml(metric.label)}</strong>
        <button class="metric-remove" type="button" data-remove-metric="${metric.id}">×</button>
      </div>
      <input type="number" data-metric-value="${metric.id}" value="${Number(metric.value || 0)}" />
    </div>
  `).join('');
}

function galleryHtml(ids) {
  if (!ids?.length) return '';
  return ids.map((id) => {
    const asset = getAsset(id);
    if (!asset) return '';
    return `<div class="gallery-item"><img src="${asset.dataUrl}" alt="Foto" /><button class="gallery-remove" type="button" data-gallery-remove="${id}">×</button></div>`;
  }).join('');
}

function bindGalleryRemove(containerId, ids) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('[data-gallery-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.galleryRemove;
      const index = ids.indexOf(id);
      if (index >= 0) ids.splice(index, 1);
      container.innerHTML = galleryHtml(ids);
      bindGalleryRemove(containerId, ids);
    });
  });
}

async function addAsset(file) {
  const dataUrl = await fileToDataUrl(file);
  const asset = {
    id: uid('asset'),
    name: safeFileName(file.name || 'imagem.png'),
    type: file.type || 'application/octet-stream',
    dataUrl
  };
  state.assets[asset.id] = asset;
  return asset;
}

async function exportLoveline() {
  startEditing();
  const name = prompt('Nome do arquivo .ll:', 'Minha LoveLine');
  if (!name) return;
  const zip = new JSZip();
  const exportData = {
    version: state.version,
    exportedAt: new Date().toISOString(),
    camera: state.camera,
    people: state.people,
    items: state.items,
    assets: {}
  };

  for (const asset of Object.values(state.assets)) {
    const ext = extensionFromAsset(asset);
    const path = `images/${asset.id}${ext}`;
    exportData.assets[asset.id] = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      path
    };
    const { base64 } = splitDataUrl(asset.dataUrl);
    zip.file(path, base64, { base64: true });
  }

  zip.file('data/loveline.json', JSON.stringify(exportData, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(name).replace(/\.ll$/i, '')}.ll`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('Arquivo .ll baixado.');
}

function allowDrop(event) {
  event.preventDefault();
}

async function handleLovelineDrop(event) {
  event.preventDefault();
  const file = Array.from(event.dataTransfer?.files || []).find((entry) => entry.name.toLowerCase().endsWith('.ll') || entry.type === 'application/zip');
  if (!file) return toast('Arraste um arquivo .ll válido.');
  await importLoveline(file);
}

async function importLoveline(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = zip.file('data/loveline.json') || zip.file('loveline.json');
    if (!jsonFile) throw new Error('Arquivo data/loveline.json não encontrado.');
    const data = JSON.parse(await jsonFile.async('string'));
    const assets = {};

    for (const [id, assetInfo] of Object.entries(data.assets || {})) {
      if (!assetInfo?.path) continue;
      const entry = zip.file(assetInfo.path);
      if (!entry) continue;
      const base64 = await entry.async('base64');
      assets[id] = {
        id,
        name: assetInfo.name || `${id}.png`,
        type: assetInfo.type || mimeFromPath(assetInfo.path),
        dataUrl: `data:${assetInfo.type || mimeFromPath(assetInfo.path)};base64,${base64}`
      };
    }

    state.version = data.version || 1;
    state.camera = data.camera || { centerMs: startOfDay(Date.now()), pixelsPerDay: 14 };
    state.people = Array.isArray(data.people) ? data.people : [];
    state.items = Array.isArray(data.items) ? data.items : [];
    state.assets = assets;
    startEditing();
    closePanel();
    renderPeopleDropdown();
    requestDraw();
    toast('LoveLine importada.');
  } catch (error) {
    console.error(error);
    toast('Não consegui abrir esse .ll. Verifique se ele foi exportado pelo LoveLine.');
  }
}

function playTimeline() {
  startEditing();
  closePanel();
  closePeopleDropdown();
  if (state.playTimer) {
    stopPlayback();
    return;
  }
  const moments = buildPlaybackMoments();
  if (!moments.length) return toast('Crie eventos ou períodos antes de reproduzir.');
  state.playMoments = moments;
  state.playIndex = 0;
  playNextMoment();
  state.playTimer = window.setInterval(playNextMoment, 1500);
}

function playNextMoment() {
  const moment = state.playMoments[state.playIndex];
  if (!moment) {
    stopPlayback();
    toast('Animação finalizada.');
    return;
  }
  state.highlighted = moment;
  animateCameraTo(moment.ms, 520);
  state.playIndex += 1;
  requestDraw();
}

function stopPlayback() {
  if (state.playTimer) window.clearInterval(state.playTimer);
  state.playTimer = null;
  state.highlighted = null;
  state.playMoments = [];
  state.playIndex = 0;
  requestDraw();
}

function buildPlaybackMoments() {
  const moments = [];
  for (const item of state.items) {
    if (item.type === 'event') moments.push({ itemId: item.id, ms: item.startMs, label: 'evento' });
    if (item.type === 'period') {
      moments.push({ itemId: item.id, ms: item.startMs, label: 'início' });
      moments.push({ itemId: item.id, ms: item.endMs || item.startMs, label: 'fim' });
    }
  }
  return moments.sort((a, b) => a.ms - b.ms);
}

function animateCameraTo(targetMs, duration) {
  const start = state.camera.centerMs;
  const begin = performance.now();
  const animate = (now) => {
    if (!state.highlighted) return;
    const t = clamp((now - begin) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    state.camera.centerMs = start + (targetMs - start) * eased;
    requestDraw();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function hitTestItem(x, y, padding = 20) {
  const lineY = getLineY();
  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    if (item.type === 'event') {
      const itemX = dateToScreen(item.startMs);
      if (Math.hypot(x - itemX, y - lineY) <= 22 + padding) return item;
    } else {
      const x1 = dateToScreen(item.startMs);
      const x2 = dateToScreen(item.endMs || item.startMs);
      const left = Math.min(x1, x2) - padding;
      const right = Math.max(x1, x2) + padding;
      const top = lineY - 24 - padding;
      const bottom = lineY + 24 + padding;
      if (x >= left && x <= right && y >= top && y <= bottom) return item;
    }
  }
  return null;
}

function getTickMode(scale) {
  if (scale >= 34) return { kind: 'day', every: 1 };
  if (scale >= 18) return { kind: 'day', every: 2 };
  if (scale >= 6) return { kind: 'week', every: 1 };
  if (scale >= 2.2) return { kind: 'week', every: 2 };
  if (scale >= 0.45) return { kind: 'month', every: 1 };
  if (scale >= 0.16) return { kind: 'month', every: 3 };
  if (scale >= 0.055) return { kind: 'year', every: 1 };
  if (scale >= 0.025) return { kind: 'year', every: 5 };
  return { kind: 'year', every: 10 };
}

function startEditing() {
  state.opened = true;
  els.app.classList.remove('blurred');
  requestDraw();
}

function isNearLine(y, distance = 48) {
  return Math.abs(y - getLineY()) <= distance;
}

function getLineY() {
  return canvasRect.height / 2;
}

function dateToScreen(ms) {
  const dayDelta = (ms - state.camera.centerMs) / DAY;
  return canvasRect.width / 2 + dayDelta * state.camera.pixelsPerDay;
}

function screenToDate(x) {
  const dayDelta = (x - canvasRect.width / 2) / state.camera.pixelsPerDay;
  return state.camera.centerMs + dayDelta * DAY;
}

function getPerson(id) {
  return state.people.find((person) => person.id === id) || null;
}

function getAsset(id) {
  if (!id) return null;
  return state.assets[id] || null;
}

function isHighlighted(itemId) {
  return state.highlighted?.itemId === itemId;
}

function pointerPos(event) {
  canvasRect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top
  };
}

function value(id) {
  return document.getElementById(id)?.value || '';
}

function dateValueMs(id) {
  const input = value(id);
  if (!input) return null;
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function dateInput(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(ms) {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function startOfDay(ms) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfWeek(ms) {
  const date = new Date(startOfDay(ms));
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.getTime();
}

function monthShort(date) {
  return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][date.getMonth()];
}

function pad(valueNumber) {
  return String(valueNumber).padStart(2, '0');
}

function ageFromDate(input) {
  const birth = new Date(`${input}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}

function gradient(colors) {
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
}

function personLabel(person) {
  return person.nickname || person.fullName || 'Pessoa';
}

function initials(text) {
  return (text || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'P';
}

function uid(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function clipText(text, maxWidth) {
  const valueText = String(text);
  if (ctx.measureText(valueText).width <= maxWidth) return valueText;
  let output = valueText;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return `${output}…`;
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawImageInCircle(src, x, y, radius) {
  const image = new Image();
  image.src = src;
  if (!image.complete) {
    image.onload = requestDraw;
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl) {
  const [header, base64] = String(dataUrl).split(',');
  const type = header.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
  return { type, base64 };
}

function extensionFromAsset(asset) {
  const type = asset.type || splitDataUrl(asset.dataUrl).type;
  if (type.includes('jpeg')) return '.jpg';
  if (type.includes('png')) return '.png';
  if (type.includes('gif')) return '.gif';
  if (type.includes('webp')) return '.webp';
  const original = asset.name?.match(/\.[a-z0-9]+$/i)?.[0];
  return original || '.bin';
}

function mimeFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function safeFileName(name) {
  return String(name || 'loveline')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'loveline';
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
}
