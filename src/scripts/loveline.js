const JSZip = window.JSZip;

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
  playMoments: [],
  zoomPreset: null,
  suppressNextClick: false
};

const els = {
  app: document.getElementById('app'),
  canvas: document.getElementById('timelineCanvas'),
  intro: document.getElementById('introOverlay'),
  peopleBtn: document.getElementById('peopleBtn'),
  peopleDropdown: document.getElementById('peopleDropdown'),
  zoomControls: document.getElementById('zoomControls'),
  homeBtn: document.getElementById('homeBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  playBtn: document.getElementById('playBtn'),
  panel: document.getElementById('sidePanel'),
  panelContent: document.getElementById('panelContent'),
  toast: document.getElementById('toast')
};

const ctx = els.canvas.getContext('2d');
let rafId = 0;
let itemLayouts = new Map();
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

  els.zoomControls?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-zoom-preset]');
    if (!button) return;
    startEditing();
    stopPlayback();
    setZoomPreset(button.dataset.zoomPreset);
  });

  els.canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  els.canvas.addEventListener('pointermove', handleCanvasPointerMove);
  els.canvas.addEventListener('pointerup', handleCanvasPointerUp);
  els.canvas.addEventListener('pointerleave', handleCanvasPointerLeave);
  els.canvas.addEventListener('wheel', handleWheel, { passive: false });

  document.addEventListener('pointermove', handleGlobalPointerMove);
  document.addEventListener('pointerup', handleGlobalPointerUp);

  document.addEventListener('click', (event) => {
    if (!state.suppressNextClick) return;
    event.preventDefault();
    event.stopPropagation();
    state.suppressNextClick = false;
  }, true);

  document.addEventListener('click', (event) => {
    if (state.dragPerson) return;
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
  ctx.moveTo(x, lineY + 8);
  ctx.lineTo(x, lineY + 8 + size);
  ctx.stroke();
}

function drawLabel(x, y, text) {
  ctx.fillStyle = '#b58a9c';
  ctx.fillText(text, x, y);
}

function drawItems(lineY) {
  itemLayouts = computeItemLayouts(lineY);
  const sorted = [...state.items].sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  for (const item of sorted) {
    if (item.type === 'period') drawPeriod(item, lineY, itemLayouts.get(item.id));
  }
  for (const item of sorted) {
    if (item.type === 'event') drawEvent(item, lineY, itemLayouts.get(item.id));
  }
}

function computeItemLayouts(lineY = getLineY()) {
  const layouts = new Map();
  const periods = state.items
    .filter((item) => item.type === 'period')
    .sort((a, b) => Math.min(a.startMs, a.endMs || a.startMs) - Math.min(b.startMs, b.endMs || b.startMs));
  const laneEnds = [];

  for (const item of periods) {
    const rawX1 = dateToScreen(item.startMs);
    const rawX2 = dateToScreen(item.endMs || item.startMs);
    const centerX = (rawX1 + rawX2) / 2;
    const visualWidth = Math.max(42, Math.abs(rawX2 - rawX1));
    const left = centerX - visualWidth / 2;
    const right = centerX + visualWidth / 2;
    const start = Math.min(item.startMs, item.endMs || item.startMs);
    const end = Math.max(item.startMs, item.endMs || item.startMs);
    let lane = 0;
    while (laneEnds[lane] != null && laneEnds[lane] >= start - DAY * 0.25) lane += 1;
    laneEnds[lane] = Math.max(laneEnds[lane] || -Infinity, end);
    const y = lineY - 84 - lane * 34;
    const height = 24;
    layouts.set(item.id, {
      type: 'period',
      lane,
      x1: rawX1,
      x2: rawX2,
      left,
      right,
      y,
      height,
      top: y - 16,
      bottom: lineY + 12
    });
  }

  const eventSlots = [];
  const events = state.items
    .filter((item) => item.type === 'event')
    .sort((a, b) => a.startMs - b.startMs);

  for (const item of events) {
    const x = dateToScreen(item.startMs);
    const containingPeriodLanes = [];
    for (const period of periods) {
      const start = Math.min(period.startMs, period.endMs || period.startMs);
      const end = Math.max(period.startMs, period.endMs || period.startMs);
      if (item.startMs >= start && item.startMs <= end) {
        const layout = layouts.get(period.id);
        if (layout) containingPeriodLanes.push(layout.lane);
      }
    }

    let lane = containingPeriodLanes.length ? Math.max(...containingPeriodLanes) + 1 : 0;
    while (eventSlots.some((slot) => slot.lane === lane && Math.abs(slot.x - x) < 48)) lane += 1;
    eventSlots.push({ lane, x });

    const insidePeriod = containingPeriodLanes.length > 0;
    const y = lineY - (insidePeriod ? 124 : 88) - lane * 30;
    const r = isHighlighted(item.id) ? 21 : 16;
    layouts.set(item.id, {
      type: 'event',
      lane,
      x,
      y,
      r,
      insidePeriod,
      left: x - r - 12,
      right: x + r + 12,
      top: y - r - 28,
      bottom: lineY + 12
    });
  }

  return layouts;
}

function drawPeriod(item, lineY, layout) {
  if (!layout) return;
  if (layout.left > canvasRect.width + 140 || layout.right < -140) return;

  const person = getPerson(item.personId);
  const colors = person ? person.colors : ['#b5b5b5', '#dddddd'];
  const isHot = state.hoverItemId === item.id || isHighlighted(item.id);
  const y = layout.y - (isHot ? 3 : 0);
  const height = isHot ? layout.height + 4 : layout.height;
  const left = layout.left;
  const right = layout.right;
  const width = Math.max(42, right - left);
  const midY = y + height / 2;
  const gradient = ctx.createLinearGradient(left, y, right, y + height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = person ? `${colors[0]}aa` : 'rgba(160,160,160,0.62)';
  ctx.lineWidth = isHot ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(layout.x1, lineY - 2);
  ctx.lineTo(layout.x1, midY);
  ctx.moveTo(layout.x2, lineY - 2);
  ctx.lineTo(layout.x2, midY);
  ctx.stroke();

  ctx.shadowColor = person ? `${colors[0]}55` : 'rgba(130,130,130,0.20)';
  ctx.shadowBlur = isHot ? 26 : 14;
  ctx.fillStyle = gradient;
  roundRect(ctx, left, y, width, height, 999);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.90)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const knobX of [layout.x1, layout.x2]) {
    ctx.beginPath();
    ctx.arc(knobX, midY, isHot ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (item.title) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clipText(item.title, Math.max(34, width - 18)), left + width / 2, midY);
  }
  ctx.restore();
}

function drawEvent(item, lineY, layout) {
  if (!layout) return;
  const x = layout.x;
  if (x < -90 || x > canvasRect.width + 90) return;
  const person = getPerson(item.personId);
  const colors = person ? person.colors : ['#a7a7a7', '#d8d8d8'];
  const isHot = state.hoverItemId === item.id || isHighlighted(item.id);
  const r = isHot ? 22 : layout.r;
  const y = layout.y - (isHot ? 6 : 0);
  const gradient = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = person ? `${colors[0]}aa` : 'rgba(165,165,165,0.70)';
  ctx.lineWidth = isHot ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(x, lineY - 2);
  ctx.lineTo(x, y + r - 1);
  ctx.stroke();

  ctx.shadowColor = person ? `${colors[0]}66` : 'rgba(130,130,130,0.20)';
  ctx.shadowBlur = isHot ? 28 : 14;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.94)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const icon = getAsset(item.iconImageId);
  if (icon) {
    drawImageInCircle(icon.dataUrl, x, y, r - 3);
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${isHot ? 20 : 16}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♡', x, y + 1);
  }

  if (item.title) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6f4d5d';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(clipText(item.title, 126), x, y - r - 8);
  }
  ctx.restore();
}

function drawDraftPeriod(lineY) {
  if (!state.pointer || state.pointer.mode !== 'create' || !state.pointer.hasMoved) return;
  const x1 = state.pointer.startX;
  const x2 = state.pointer.x;
  const left = Math.min(x1, x2);
  const width = Math.max(12, Math.abs(x2 - x1));
  const y = lineY - 84;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, lineY - 2);
  ctx.lineTo(x1, y + 12);
  ctx.moveTo(x2, lineY - 2);
  ctx.lineTo(x2, y + 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(170, 170, 170, 0.22)';
  roundRect(ctx, left, y, width, 24, 999);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlaybackLabel(lineY) {
  if (!state.highlighted) return;

  if (state.highlighted.kind === 'person') {
    drawPlaybackPersonCard(state.highlighted, lineY);
    return;
  }

  const { itemId, label, ms } = state.highlighted;
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const layout = itemLayouts.get(itemId) || computeItemLayouts(lineY).get(itemId);
  const x = dateToScreen(ms);
  const y = Math.max(82, (layout?.top || lineY - 120) - 76);
  const title = item.title || (item.type === 'period' ? 'Período' : 'Evento');
  const person = getPerson(item.personId);
  const subtitle = `${label} • ${formatDate(ms)}${person ? ` • ${personLabel(person)}` : ''}`;
  ctx.save();
  ctx.font = '800 15px Inter, system-ui, sans-serif';
  const width = Math.min(360, Math.max(190, ctx.measureText(title).width + 72));
  const left = clamp(x - width / 2, 20, canvasRect.width - width - 20);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = 'rgba(255, 169, 202, 0.68)';
  ctx.shadowColor = 'rgba(255, 120, 176, 0.24)';
  ctx.shadowBlur = 22;
  roundRect(ctx, left, y, width, 64, 22);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3f2631';
  ctx.fillText(clipText(title, width - 28), left + width / 2, y + 23);
  ctx.fillStyle = '#9b7888';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(clipText(subtitle, width - 28), left + width / 2, y + 45);
  ctx.restore();
}

function drawPlaybackPersonCard(moment, lineY) {
  const person = getPerson(moment.personId);
  if (!person) return;
  const x = clamp(dateToScreen(moment.ms), 150, canvasRect.width - 150);
  const y = Math.max(78, lineY - 250);
  const width = 300;
  const height = 98;
  const left = clamp(x - width / 2, 20, canvasRect.width - width - 20);
  const profile = getAsset(person.profileImageId);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = `${person.colors?.[0] || '#ff82b2'}70`;
  ctx.shadowColor = `${person.colors?.[0] || '#ff82b2'}40`;
  ctx.shadowBlur = 26;
  roundRect(ctx, left, y, width, height, 28);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  const avatarX = left + 50;
  const avatarY = y + 49;
  const avatarR = 31;
  const colors = person.colors || ['#ff82b2', '#ffc9df'];
  const gradientFill = ctx.createLinearGradient(avatarX - avatarR, avatarY - avatarR, avatarX + avatarR, avatarY + avatarR);
  gradientFill.addColorStop(0, colors[0]);
  gradientFill.addColorStop(1, colors[1]);
  ctx.fillStyle = gradientFill;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (profile) drawImageInCircle(profile.dataUrl, avatarX, avatarY, avatarR - 3);
  else {
    ctx.fillStyle = '#fff';
    ctx.font = '850 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(personLabel(person)), avatarX, avatarY + 1);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#3f2631';
  ctx.font = '850 17px Inter, system-ui, sans-serif';
  ctx.fillText(clipText(personLabel(person), width - 112), left + 94, y + 24);
  ctx.fillStyle = '#9b7888';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  const details = [person.instagram, person.birthDate ? formatBirthDate(person.birthDate) : 'nova pessoa na linha'].filter(Boolean).join(' • ');
  ctx.fillText(clipText(details || 'apareceu pela primeira vez na LoveLine', width - 112), left + 94, y + 49);
  ctx.fillStyle = colors[0];
  ctx.font = '800 11px Inter, system-ui, sans-serif';
  ctx.fillText('primeira aparição', left + 94, y + 69);
  ctx.restore();
}

function drawHelp(lineY) {
  if (state.items.length > 0 || !state.opened) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b58a9c';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('clique na linha para criar um ponto • segure e arraste na linha para criar um período • botão direito arrasta a câmera', canvasRect.width / 2, lineY + 92);
  ctx.fillText('para ligar pessoa: clique na bolinha da pessoa e depois clique em um evento ou período', canvasRect.width / 2, lineY + 116);
  ctx.restore();
}

function handleCanvasPointerDown(event) {
  if (!state.opened) return;
  if (state.dragPerson) return;
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
  state.zoomPreset = null;
  updateZoomPresetButtons();
  state.camera.pixelsPerDay = clamp(state.camera.pixelsPerDay * zoomFactor, 0.04, 80);
  const afterMs = screenToDate(pos.x);
  state.camera.centerMs += beforeMs - afterMs;
  requestDraw();
}

function setZoomPreset(preset) {
  const presets = {
    day: 56,
    week: 12,
    month: 1.9,
    year: 0.18
  };
  if (!presets[preset]) return;
  state.zoomPreset = preset;
  state.camera.pixelsPerDay = presets[preset];
  updateZoomPresetButtons();
  requestDraw();
}

function updateZoomPresetButtons() {
  els.zoomControls?.querySelectorAll('[data-zoom-preset]').forEach((button) => {
    button.classList.toggle('active', button.dataset.zoomPreset === state.zoomPreset);
  });
}

function handleGlobalPointerMove(event) {
  if (!state.dragPerson) return;
  event.preventDefault();
  canvasRect = els.canvas.getBoundingClientRect();
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
  event.preventDefault();
  canvasRect = els.canvas.getBoundingClientRect();
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
  state.suppressNextClick = true;
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

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startHoldingPerson(person.id, event.clientX, event.clientY);
    });

    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPersonDetailsPanel(person.id);
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

function startHoldingPerson(personId, clientX, clientY) {
  const person = getPerson(personId);
  if (!person) return;
  if (state.dragPerson?.ghost) state.dragPerson.ghost.remove();
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost held';
  ghost.style.background = gradient(person.colors);
  ghost.style.left = `${clientX - 26}px`;
  ghost.style.top = `${clientY - 26}px`;
  const photoAsset = getAsset(person.profileImageId);
  if (photoAsset) {
    ghost.style.backgroundImage = `url(${photoAsset.dataUrl})`;
    ghost.style.backgroundSize = 'cover';
    ghost.style.backgroundPosition = 'center';
  } else {
    ghost.textContent = initials(personLabel(person));
  }
  els.app.appendChild(ghost);
  state.dragPerson = { personId: person.id, ghost, x: clientX, y: clientY };
  state.hoverItemId = null;
  closePeopleDropdown();
  toast(`Clique em um evento ou período para ligar ${personLabel(person)}.`);
  requestDraw();
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
  person.metrics ||= [];
  person.galleryIds ||= [];
  person.colors ||= [...COLOR_PAIRS[0]];
  const profile = getAsset(person.profileImageId);
  els.panelContent.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title">${editing ? 'Editar pessoa' : 'Adicionar pessoa'}</h2>
        <p class="panel-subtitle">Monte a ficha da pessoa e use a bolinha dela para ligar eventos e períodos.</p>
      </div>
      <button class="icon-close" type="button" data-action="close">×</button>
    </div>

    <div class="form-grid person-form">
      <div class="person-editor-hero">
        <div class="preview-avatar big" id="personAvatarPreview" style="background:${gradient(person.colors)}">${profile ? `<img src="${profile.dataUrl}" alt="Foto de perfil" />` : initials(personLabel(person))}</div>
        <div class="field">
          <label>Nome com ícone</label>
          <input id="personFullName" value="${escapeAttr(person.fullName)}" placeholder="Ex: Ana Clara Souza" />
          <input id="personProfile" class="native-file-input" type="file" accept="image/*" />
          <label class="file-picker-btn compact" for="personProfile">Trocar ícone/foto</label>
        </div>
      </div>

      <div class="field">
        <label>Apelido</label>
        <input id="personNickname" value="${escapeAttr(person.nickname)}" placeholder="Ex: Aninha" />
      </div>

      <div class="field">
        <label>Instagram</label>
        <input id="personInstagram" value="${escapeAttr(person.instagram)}" placeholder="@usuario" />
      </div>

      <div class="field">
        <label>Data de nascimento</label>
        <input id="personBirthDate" type="date" value="${escapeAttr(person.birthDate)}" />
      </div>

      <div class="panel-section">
        <div class="metric-head">
          <strong>Cores da pessoa</strong>
          <button class="secondary-btn small" type="button" data-action="shuffle-colors">Sugestão</button>
        </div>
        <div class="color-pair-row clean">
          <input id="personColorA" type="color" value="${person.colors[0]}" />
          <input id="personColorB" type="color" value="${person.colors[1]}" />
        </div>
        <div class="color-suggestions">
          ${COLOR_PAIRS.map((pair, index) => `<button class="color-chip" type="button" data-color-index="${index}" style="background:${gradient(pair)}" title="Usar combinação"></button>`).join('')}
        </div>
      </div>

      <div class="panel-section">
        <div class="metric-head">
          <strong>Campos adicionais</strong>
        </div>
        <div class="field inline metric-add-row">
          <select id="defaultMetricSelect">
            ${DEFAULT_METRICS.map((metric) => `<option value="${escapeAttr(metric)}">${escapeHtml(metric)}</option>`).join('')}
          </select>
          <button class="secondary-btn" type="button" data-action="add-default-metric">Adicionar campo</button>
        </div>
        <div id="metricsList" class="form-grid metric-list">${metricsHtml(person.metrics)}</div>
      </div>

      <div class="panel-section">
        <div class="metric-head">
          <strong>Campo personalizado</strong>
        </div>
        <div class="field inline metric-add-row">
          <input id="customMetricName" placeholder="Texto do campo" />
          <input id="customMetricValue" type="number" placeholder="Valor" />
        </div>
        <button class="secondary-btn" type="button" data-action="add-custom-metric" style="margin-top:10px;">Criar personalizado</button>
      </div>

      <div class="panel-section">
        <div class="metric-head">
          <strong>Banco de imagens</strong>
          <input id="personGalleryInput" class="native-file-input" type="file" accept="image/*" multiple />
          <label class="file-picker-btn small" for="personGalleryInput">Adicionar imagens</label>
        </div>
        <div id="personGallery" class="gallery-grid roomy">${galleryHtml(person.galleryIds)}</div>
      </div>

      <div class="help-note">Clique na bolinha da pessoa para pegá-la; depois clique em um evento ou período para ligar a pessoa nele. Botão direito na bolinha abre a análise.</div>

      <div class="action-row">
        <button class="primary-btn" type="button" data-action="save-person">${editing ? 'Salvar edição' : 'Criar pessoa'}</button>
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

function openPersonDetailsPanel(personId) {
  closePeopleDropdown();
  const person = getPerson(personId);
  if (!person) return;
  state.activePanel = { type: 'person-details', id: personId };
  els.panel.classList.add('open');
  renderPersonDetailsPanel(person);
}

function renderPersonDetailsPanel(person) {
  const profile = getAsset(person.profileImageId);
  els.panelContent.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Analisar pessoa</h2>
        <p class="panel-subtitle">Ficha rápida da pessoa selecionada.</p>
      </div>
      <button class="icon-close" type="button" data-action="close">×</button>
    </div>

    <div class="person-detail-card">
      <div class="person-detail-hero">
        <div class="preview-avatar big" style="background:${gradient(person.colors || COLOR_PAIRS[0])}">${profile ? `<img src="${profile.dataUrl}" alt="Foto de perfil" />` : initials(personLabel(person))}</div>
        <div>
          <h3>${escapeHtml(person.fullName || person.nickname || 'Pessoa sem nome')}</h3>
          ${person.nickname ? `<p>${escapeHtml(person.nickname)}</p>` : ''}
        </div>
      </div>

      <div class="detail-list">
        <div><span>Apelido</span><strong>${escapeHtml(person.nickname || '—')}</strong></div>
        <div><span>Instagram</span><strong>${escapeHtml(person.instagram || '—')}</strong></div>
        <div><span>Data de nascimento</span><strong>${person.birthDate ? formatBirthDate(person.birthDate) : '—'}</strong></div>
      </div>
    </div>

    <div class="panel-section">
      <div class="metric-head"><strong>Campos + valores</strong></div>
      <div class="metric-view-list">${metricsViewHtml(person.metrics)}</div>
    </div>

    <div class="panel-section">
      <div class="metric-head"><strong>Banco de imagens</strong></div>
      <div class="gallery-grid roomy readonly">${galleryViewHtml(person.galleryIds)}</div>
    </div>

    <div class="action-row">
      <button class="primary-btn" type="button" data-action="edit-person">Editar pessoa</button>
      <button class="secondary-btn" type="button" data-action="close">Fechar</button>
    </div>
  `;

  bindPanelAction('close', closePanel);
  bindPanelAction('edit-person', () => openPersonPanel(person.id));
}

function metricsViewHtml(metrics = []) {
  if (!metrics.length) return '<div class="help-note">Nenhum campo adicional cadastrado.</div>';
  return metrics.map((metric) => `
    <div class="metric-view-row">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value ?? 0)}</strong>
    </div>
  `).join('');
}

function galleryViewHtml(ids = []) {
  if (!ids.length) return '<div class="help-note">Nenhuma imagem no banco ainda.</div>';
  return ids.map((id) => {
    const asset = getAsset(id);
    if (!asset) return '';
    return `<div class="gallery-item"><img src="${asset.dataUrl}" alt="Foto" /></div>`;
  }).join('');
}

function formatBirthDate(input) {
  if (!input) return '';
  const [year, month, day] = input.split('-').map(Number);
  if (!year || !month || !day) return escapeHtml(input);
  return `${pad(day)}/${pad(month)}/${year}`;
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
        <div class="file-box horizontal">
          <div class="event-icon-preview" id="itemIconPreview">${icon ? `<img src="${icon.dataUrl}" alt="Ícone do item" />` : '♡'}</div>
          <input id="itemIconInput" class="native-file-input" type="file" accept="image/*" />
          <label class="file-picker-btn" for="itemIconInput">Escolher ícone</label>
        </div>
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea id="itemDescription" placeholder="Escreva uma descrição desse ${item.type === 'period' ? 'período' : 'evento'}...">${escapeHtml(item.description)}</textarea>
      </div>

      <div class="field">
        <label>Banco de imagens próprio</label>
        <div class="file-box">
          <input id="itemGalleryInput" class="native-file-input" type="file" accept="image/*" multiple />
          <label class="file-picker-btn" for="itemGalleryInput">Adicionar imagens</label>
          <div id="itemGallery" class="gallery-grid roomy">${galleryHtml(item.galleryIds)}</div>
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
  els.panelContent.querySelectorAll(`[data-action="${action}"]`).forEach((el) => {
    el.addEventListener('click', fn);
  });
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
  state.playTimer = window.setInterval(playNextMoment, 1750);
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
  const seenPeople = new Set();
  const sortedItems = [...state.items].sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  let order = 0;

  for (const item of sortedItems) {
    if (item.personId && !seenPeople.has(item.personId)) {
      seenPeople.add(item.personId);
      moments.push({ kind: 'person', personId: item.personId, itemId: item.id, ms: item.startMs, label: 'primeira aparição', order: order++ });
    }
    if (item.type === 'event') moments.push({ kind: 'item', itemId: item.id, ms: item.startMs, label: 'evento', order: order++ });
    if (item.type === 'period') {
      moments.push({ kind: 'item', itemId: item.id, ms: item.startMs, label: 'início do período', order: order++ });
      moments.push({ kind: 'item', itemId: item.id, ms: item.endMs || item.startMs, label: 'fim do período', order: order++ });
    }
  }
  return moments.sort((a, b) => a.ms - b.ms || a.order - b.order);
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
  const layouts = computeItemLayouts(getLineY());
  const sorted = [...state.items].reverse();
  for (const item of sorted) {
    const layout = layouts.get(item.id);
    if (!layout) continue;
    if (layout.type === 'event') {
      const radius = (layout.r || 16) + padding;
      const nearBall = Math.hypot(x - layout.x, y - layout.y) <= radius;
      const nearCable = Math.abs(x - layout.x) <= 8 + padding / 3 && y >= layout.y && y <= getLineY();
      if (nearBall || nearCable) return item;
    } else {
      const left = Math.min(layout.x1, layout.x2, layout.left) - padding;
      const right = Math.max(layout.x1, layout.x2, layout.right) + padding;
      const top = layout.y - padding;
      const bottom = getLineY() + padding * 0.4;
      if (x >= left && x <= right && y >= top && y <= bottom) return item;
    }
  }
  return null;
}

function getTickMode(scale) {
  if (scale >= 48) return { kind: 'day', every: 1 };
  if (scale >= 24) return { kind: 'day', every: 2 };
  if (scale >= 10) return { kind: 'week', every: 1 };
  if (scale >= 4.2) return { kind: 'week', every: 2 };
  if (scale >= 1.1) return { kind: 'month', every: 1 };
  if (scale >= 0.36) return { kind: 'month', every: 3 };
  if (scale >= 0.11) return { kind: 'year', every: 1 };
  if (scale >= 0.04) return { kind: 'year', every: 5 };
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
  if (!canvasRect.height) return 360;
  return clamp(canvasRect.height * 0.64, Math.min(300, canvasRect.height * 0.58), Math.max(220, canvasRect.height - 150));
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
