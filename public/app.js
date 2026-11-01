const app = document.querySelector('#app');
const lock = document.querySelector('#lock');
const lockError = document.querySelector('#lock-error');
const tab = document.querySelector('#tab');
let me = null;
let idle;
let viewMonth = new Date();

const focusText = {
  lunch: 'Change at lunch.',
  night: 'Keep a night pad by the bed.',
  leave: 'Is the pouch in the bag?',
  heat: 'Hot water bottle.',
  laundry: 'Wash clothes and sheets.',
  heavy: 'Put an extra in the bag.',
  change: 'Time to change.',
  period: 'Today needs a check.',
  eve: 'Pack the pouch tonight.',
  pack: 'Pack the bag checklist.',
  pms: 'Take it easy tomorrow.',
  late: 'This month is late. A doctor can help if you want.',
  move: 'Move pads into the bag tonight.',
  low: 'Bag is low.',
  trip: 'Pack extra pads for the trip.',
  follow: 'Bag is still low.',
};

const dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function localISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function api(path, options = {}) {
  const headers = { 'x-padzyra': '1' };
  const init = { method: options.method || 'GET', credentials: 'include', headers };
  if (options.body) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(`/api/v1${path}`, init);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    me = null;
    location.hash = '#/login';
    throw new Error(json.error ? json.error.message : 'Login required');
  }
  if (res.status === 403 && json.error && json.error.message === 'PIN required') {
    showLock();
    throw new Error('PIN required');
  }
  if (!res.ok) throw new Error(json.error ? json.error.message : 'Request failed');
  return json.data;
}

function showLock() {
  lock.hidden = false;
  app.hidden = true;
  tab.hidden = true;
}

function hideLock() {
  lock.hidden = true;
  app.hidden = false;
  lockError.textContent = '';
}

function bumpIdle() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (!me || me.role !== 'girl') return;
    api('/auth/lock', { method: 'POST' }).catch(() => {});
    showLock();
  }, 60000);
}

document.addEventListener('click', bumpIdle);
document.addEventListener('keydown', bumpIdle);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && me && me.role === 'girl') {
    api('/auth/lock', { method: 'POST' }).catch(() => {});
    showLock();
  }
});

document.querySelector('#lock-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  lockError.textContent = '';
  try {
    await api('/auth/pin', { method: 'POST', body: { pin: event.target.pin.value } });
    event.target.reset();
    hideLock();
    route();
  } catch (error) {
    lockError.textContent = error.message;
  }
});

function setTab() {
  const onLogin = document.body.classList.contains('login-page') || lock.hidden === false && app.hidden;
  if (!me || onLogin) {
    tab.hidden = true;
    return;
  }
  const links = me.role === 'shop'
    ? [['#/shop', 'Shop'], ['#/shop-orders', 'Orders'], ['#/settings', 'Settings']]
    : [['#/home', 'Home'], ['#/calendar', 'Dates'], ['#/now', 'Now'], ['#/settings', 'You']];
  tab.hidden = false;
  tab.innerHTML = links.map(([href, label]) => {
    const on = location.hash === href ? ' class="on"' : '';
    return `<a href="${href}"${on}>${label}</a>`;
  }).join('');
}

function draw(html) {
  app.innerHTML = html;
  setTab();
}

function head(title) {
  return `<header class="top"><img src="/logo.png" alt=""><div><p class="brand">Padzyra</p><h1>${title}</h1></div></header>`;
}

function qtyOf(supplies, place, kind) {
  const row = supplies.find((item) => item.place === place && item.kind === kind);
  return row ? row.qty : 0;
}

function tile(label, count, low) {
  return `<div class="tile${low ? ' low' : ''}"><span>${label}</span><b>${count}</b></div>`;
}

function chips(field, values, current) {
  return `<div class="chips">${values.map((value) => {
    const on = current === value ? ' on' : '';
    const label = value[0].toUpperCase() + value.slice(1);
    return `<button type="button" class="${on}" data-act="feel" data-field="${field}" data-value="${value}">${label}</button>`;
  }).join('')}</div>`;
}

function homeHero(data) {
  if (data.day) {
    return `<p class="kicker">This time</p><p class="big">Day ${data.day} <span>of ${data.of}</span></p><p class="muted">Until ${esc(data.until)}</p>`;
  }
  if (data.inDays == null) return '<p class="kicker">Today</p><p class="big">Hello</p>';
  if (data.inDays < 0) return '<p class="kicker">Estimate</p><p class="big">Late</p><p class="muted">A doctor can help if you want. Not a diagnosis.</p>';
  if (data.inDays === 0) return '<p class="kicker">Estimate</p><p class="big">Today</p><p class="muted">Estimate only.</p>';
  return `<p class="kicker">Estimate</p><p class="big">${data.inDays} <span>days</span></p><p class="muted">Estimate only.</p>`;
}

async function screenHome() {
  const [data, supplies, list, orders] = await Promise.all([
    api('/dashboard'),
    api('/supplies'),
    api('/checklist'),
    api('/orders'),
  ]);
  let feel = {};
  try {
    feel = (await api(`/days/${localISO()}`)) || {};
  } catch (error) {
    if (error.message === 'PIN required' || error.message === 'Login required') throw error;
  }
  const bagDay = qtyOf(supplies, 'bag', 'day');
  const bagNight = qtyOf(supplies, 'bag', 'night');
  const checks = list.length
    ? `<div class="card"><p class="kicker">Pack</p><ul class="checks">${list.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>`
    : '';
  const ready = orders.filter((order) => order.status === 'ready' || order.status === 'accepted').map((order) => (
    `<div class="shop"><p><strong>${esc(order.shop || 'Shop')} · ${esc(order.orderNumber || '')}</strong></p><p class="muted">${esc(order.kind)} × ${order.qty} · <span class="pill ${order.status === 'ready' ? 'open' : ''}">${esc(order.status)}</span></p><button data-act="pickup" data-id="${order.id}">Picked up</button></div>`
  )).join('');
  const focus = data.focus && focusText[data.focus] ? `<p class="focus">${focusText[data.focus]}</p>` : '';
  const move = data.move ? `<p class="muted">Move ${data.move} into the bag tonight.</p>` : '';
  draw(`${head('Home')}
    <section class="hero">${homeHero(data)}</section>
    ${focus}
    <div class="actions">
      <button data-act="start" type="button">Started</button>
      ${data.day ? '<button data-act="end" type="button">Ended</button>' : '<button data-act="use" type="button">Used 1</button>'}
      ${data.day ? '<button class="wide" data-act="use" type="button">Used 1</button>' : ''}
      <a class="go wide" href="#/now">Need one now</a>
    </div>
    <div class="card">
      <p class="kicker">Pads</p>
      ${move}
      <div class="tiles">
        ${tile('Bag · day', bagDay, bagDay < 2)}
        ${tile('Bag · night', bagNight, bagNight < 2)}
        ${tile('Home · day', qtyOf(supplies, 'home', 'day'))}
        ${tile('Home · night', qtyOf(supplies, 'home', 'night'))}
      </div>
      <form id="stock-form">
        <label>Place<select name="place"><option>bag</option><option>home</option></select></label>
        <label>Kind<select name="kind"><option>day</option><option>night</option></select></label>
        <label>Count<input name="qty" type="number" min="0" value="0"></label>
        <button type="submit">Save count</button>
      </form>
    </div>
    <div class="card">
      <p class="kicker">How today feels</p>
      <p class="muted">Cramps</p>
      ${chips('cramps', ['none', 'mild', 'strong'], feel.cramps)}
      <p class="muted">Mood</p>
      ${chips('mood', ['calm', 'okay', 'low', 'irritable'], feel.mood)}
      <p id="feel-error" class="error"></p>
    </div>
    ${checks}
    ${ready ? `<div class="card"><p class="kicker">Ready to pick up</p>${ready}</div>` : ''}
    <button class="ghost" data-act="ics" type="button">Add Reminder to calendar</button>`);
  document.querySelector('#stock-form').onsubmit = async (event) => {
    event.preventDefault();
    await api('/supplies', {
      method: 'PATCH',
      body: {
        place: event.target.place.value,
        kind: event.target.kind.value,
        qty: Number(event.target.qty.value),
      },
    });
    screenHome();
  };
}

function inRange(iso, start, end) {
  return iso >= start && iso <= end;
}

async function screenCalendar() {
  const [cycles, trips] = await Promise.all([api('/cycles'), api('/trips')]);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const title = viewMonth.toLocaleString('en', { month: 'long', year: 'numeric' });
  let cells = dow.map((name) => `<span class="dow">${name}</span>`).join('');
  for (let i = 0; i < first; i += 1) cells += '<span></span>';
  for (let day = 1; day <= days; day += 1) {
    const iso = localISO(new Date(year, month, day));
    let cls = '';
    cycles.forEach((cycle) => {
      if (!cycle.start) return;
      const end = cycle.end || cycle.start;
      const pms = localISO(new Date(new Date(`${cycle.start}T00:00:00`).getTime() - 5 * 86400000));
      if (inRange(iso, cycle.start, end)) cls = 'on';
      else if (!cls && iso >= pms && iso < cycle.start) cls = 'pms';
    });
    cells += `<button type="button" class="${cls}">${day}</button>`;
  }
  const rows = cycles.map((cycle) => (
    `<div class="shop"><p><strong>${esc(cycle.start)}${cycle.end ? ` – ${esc(cycle.end)}` : ' · open'}</strong></p><p class="muted">${esc(cycle.flow || 'flow not set')}${cycle.note ? ` · ${esc(cycle.note)}` : ''}</p><button class="ghost" data-act="drop-cycle" data-id="${cycle.id}" type="button">Remove</button></div>`
  )).join('');
  const tripRows = trips.map((trip) => (
    `<div class="shop"><p>${esc(trip.start)} – ${esc(trip.end)}</p><button class="ghost" data-act="drop-trip" data-id="${trip.id}" type="button">Remove</button></div>`
  )).join('');
  draw(`${head('Dates')}
    <div class="card">
      <div class="month"><button type="button" data-act="month" data-dir="-1" aria-label="Previous month">‹</button><strong>${title}</strong><button type="button" data-act="month" data-dir="1" aria-label="Next month">›</button></div>
      <div class="cal">${cells}</div>
      <p class="muted">Filled days are logged. Soft days are the few days before.</p>
    </div>
    <form id="cycle-form" class="card">
      <p class="kicker">Log dates</p>
      <label>Start<input name="start" type="date" required></label>
      <label>End<input name="end" type="date"></label>
      <label>Flow<select name="flow"><option value="">—</option><option>light</option><option>medium</option><option>heavy</option></select></label>
      <label>Note<input name="note" maxlength="200"></label>
      <button type="submit">Save</button>
    </form>
    <div class="card">${rows || '<p class="muted">No dates yet</p>'}</div>
    <form id="trip-form" class="card">
      <p class="kicker">Trip</p>
      <label>Start<input name="start" type="date" required></label>
      <label>End<input name="end" type="date" required></label>
      <button type="submit">Save trip</button>
    </form>
    ${tripRows ? `<div class="card">${tripRows}</div>` : ''}`);
  document.querySelector('#cycle-form').onsubmit = async (event) => {
    event.preventDefault();
    const body = { start: event.target.start.value };
    if (event.target.end.value) body.end = event.target.end.value;
    if (event.target.flow.value) body.flow = event.target.flow.value;
    if (event.target.note.value) body.note = event.target.note.value;
    await api('/cycles', { method: 'POST', body });
    screenCalendar();
  };
  document.querySelector('#trip-form').onsubmit = async (event) => {
    event.preventDefault();
    await api('/trips', { method: 'POST', body: { start: event.target.start.value, end: event.target.end.value } });
    screenCalendar();
  };
}

function mapsLink(shop) {
  return `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
}

function shopCard(shop) {
  let hours = 'Hours not set';
  let pill = 'pill';
  if (shop.open === true) {
    hours = `Closes ${shop.closes}`;
    pill = 'pill open';
  } else if (shop.open === false) {
    hours = `Opens ${shop.opens}`;
    pill = 'pill shut';
  }
  const state = shop.open == null ? 'Hours not set' : (shop.open ? 'Open' : 'Closed');
  const km = shop.km == null ? '' : `${shop.km} km · `;
  const saved = shop.saved ? '<span class="pill">Saved</span> ' : '';
  return `<div class="shop">${saved}<p class="${pill}">${state}</p><p><strong>${esc(shop.name)}</strong></p><p class="muted">${km}${esc(hours)}</p><p>${esc(shop.address)}</p>
    <div class="row"><a class="ghost" href="${mapsLink(shop)}" target="_blank" rel="noopener">Go</a>
    <button data-act="order" data-id="${esc(shop.id)}" type="button">Order</button>
    ${shop.saved ? `<button class="ghost" data-act="unsave" data-id="${esc(shop.id)}" type="button">Remove</button>` : ''}</div></div>`;
}

function paintShops(shops) {
  const box = document.querySelector('#shops');
  if (!box) return;
  box.innerHTML = shops.length ? shops.map(shopCard).join('') : '<p class="muted">No shops nearby.</p>';
}

async function screenNow() {
  draw(`${head('Need one now')}
    <p class="muted">Distance is used once and not saved.</p>
    <button data-act="locate" type="button">Use my location</button>
    <form id="area-form">
      <label>Area<input name="area" placeholder="Area name"></label>
      <button type="submit">Search</button>
    </form>
    <form id="code-form">
      <label>Shop code<input name="code" maxlength="12" autocomplete="off"></label>
      <button type="submit">Save shop</button>
      <p id="code-error" class="error"></p>
    </form>
    <div class="card" id="shops"></div>`);
  document.querySelector('#area-form').onsubmit = async (event) => {
    event.preventDefault();
    const shops = await api('/shops/nearby', { method: 'POST', body: { area: event.target.area.value } });
    paintShops(shops);
  };
  document.querySelector('#code-form').onsubmit = async (event) => {
    event.preventDefault();
    const error = document.querySelector('#code-error');
    error.textContent = '';
    try {
      await api('/shops/saved', { method: 'POST', body: { code: event.target.code.value } });
      event.target.reset();
      error.textContent = 'Saved. It will show first when you search.';
    } catch (err) {
      error.textContent = err.message;
    }
  };
  const cached = sessionStorage.getItem('shops');
  if (cached) {
    sessionStorage.removeItem('shops');
    paintShops(JSON.parse(cached));
  }
}

async function screenSettings() {
  const expense = me.role === 'girl' && me.pin ? await api('/expense').catch((error) => {
    if (error.message === 'PIN required' || error.message === 'Login required') throw error;
    return null;
  }) : null;
  const money = expense
    ? `<div class="card"><p class="kicker">This month</p><div class="tiles">${tile('Used', expense.used)}${tile('Picked up', expense.bought)}${tile('Amount', expense.amount)}</div></div>`
    : '';
  const current = me.pin ? '<label>Current PIN<input name="current" inputmode="numeric" maxlength="4" required></label>' : '';
  const girlFields = me.role === 'girl' ? `
      <label>Usual cycle length<input name="cycleLength" type="number" min="15" max="60" value="${me.cycleLength}"></label>
      <label>Usual length<input name="periodLength" type="number" min="1" max="10" value="${me.periodLength}"></label>
      <label class="check"><input name="discreet" type="checkbox" ${me.discreet ? 'checked' : ''}> Keep reminders discreet</label>` : '';
  draw(`${head('You')}
    ${money}
    <form id="pin-form">
      <p class="kicker">PIN</p>
      ${current}
      <label>New PIN<input name="pin" inputmode="numeric" maxlength="4" required></label>
      <button type="submit">Save PIN</button>
      <p id="pin-error" class="error"></p>
    </form>
    <form id="hours-form">
      <p class="kicker">Quiet hours</p>
      <p class="muted">School hours stay quiet, except one lunch reminder.</p>
      <label>Quiet start<input name="quietStart" type="time" value="${me.quietStart || ''}"></label>
      <label>Quiet end<input name="quietEnd" type="time" value="${me.quietEnd || ''}"></label>
      <label>Leave home<input name="leaveHome" type="time" value="${me.leaveHome || '08:00'}"></label>
      <label>Lunch<input name="lunch" type="time" value="${me.lunch || '13:00'}"></label>
      <label>Heat reminder<input name="heat" type="time" value="${me.heat || ''}"></label>
      <label>Pad size<select name="padSize">
        <option ${me.padSize === 'regular' ? 'selected' : ''}>regular</option>
        <option ${me.padSize === 'xl' ? 'selected' : ''}>xl</option>
        <option ${me.padSize === 'night' ? 'selected' : ''}>night</option>
      </select></label>
      <label>Price per pad<input name="price" type="number" min="0" step="0.01" value="${me.price}"></label>
      ${girlFields}
      <button type="submit">Save</button>
      <p id="save-error" class="error"></p>
    </form>
    <div class="row">
      <button class="ghost" data-act="logout" type="button">Log out</button>
      <button class="ghost" data-act="logout-all" type="button">Log out all</button>
      <button class="danger" data-act="delete" type="button">Delete account</button>
    </div>`);
  document.querySelector('#pin-form').onsubmit = async (event) => {
    event.preventDefault();
    const error = document.querySelector('#pin-error');
    error.textContent = '';
    const body = { pin: event.target.pin.value };
    if (me.pin) body.current = event.target.current.value;
    try {
      me = await api('/me', { method: 'PATCH', body });
      await api('/auth/pin', { method: 'POST', body: { pin: event.target.pin.value } });
      event.target.reset();
      screenSettings();
    } catch (err) {
      error.textContent = err.message;
    }
  };
  document.querySelector('#hours-form').onsubmit = async (event) => {
    event.preventDefault();
    const error = document.querySelector('#save-error');
    error.textContent = '';
    const body = {
      leaveHome: event.target.leaveHome.value,
      lunch: event.target.lunch.value,
      padSize: event.target.padSize.value,
      price: Number(event.target.price.value),
      quietStart: event.target.quietStart.value || null,
      quietEnd: event.target.quietEnd.value || null,
      heat: event.target.heat.value || null,
    };
    if (me.role === 'girl') {
      body.cycleLength = Number(event.target.cycleLength.value);
      body.periodLength = Number(event.target.periodLength.value);
      body.discreet = event.target.discreet.checked;
    }
    try {
      me = await api('/me', { method: 'PATCH', body });
      error.textContent = 'Saved.';
    } catch (err) {
      error.textContent = err.message;
    }
  };
}

function screenLogin() {
  document.body.classList.add('login-page');
  draw(`<section class="login">
    <img src="/logo.png" alt="">
    <h1>Padzyra</h1>
    <p class="hello">A quiet reminder, just for you.</p>
    <form id="email-form">
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label class="check"><input name="shop" type="checkbox"> I have a medical shop</label>
      <button type="submit">Continue</button>
      <p id="form-error" class="error"></p>
    </form>
  </section>`);
  document.querySelector('#email-form').onsubmit = async (event) => {
    event.preventDefault();
    sessionStorage.setItem('email', event.target.email.value.trim().toLowerCase());
    sessionStorage.setItem('role', event.target.shop.checked ? 'shop' : 'girl');
    try {
      await api('/auth/otp', { method: 'POST', body: { email: sessionStorage.getItem('email') } });
      location.hash = '#/otp';
    } catch (error) {
      document.querySelector('#form-error').textContent = error.message;
    }
  };
}

function screenOtp() {
  document.body.classList.add('login-page');
  draw(`<section class="login">
    <img src="/logo.png" alt="">
    <h1>Padzyra</h1>
    <p class="hello">Enter the 6-digit code.</p>
    <form id="otp-form">
      <label>Code<input name="code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label>
      <button type="submit">Continue</button>
      <p id="form-error" class="error"></p>
    </form>
    <a class="back" href="#/login">Use another email</a>
  </section>`);
  document.querySelector('#otp-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const body = { email: sessionStorage.getItem('email'), code: event.target.code.value };
      if (sessionStorage.getItem('role') === 'shop') body.role = 'shop';
      await api('/auth/verify', { method: 'POST', body });
      me = await api('/me');
      if (me.role === 'shop') location.hash = '#/shop';
      else if (!me.pin) location.hash = '#/settings';
      else {
        showLock();
        location.hash = '#/home';
      }
    } catch (error) {
      document.querySelector('#form-error').textContent = error.message;
    }
  };
}

async function screenShop() {
  let shop = null;
  try { shop = await api('/shops/me'); } catch (error) {
    if (error.message === 'Login required') throw error;
    shop = null;
  }
  if (!shop) {
    draw(`${head('Your shop')}
      <form id="shop-form">
        <label>Name<input name="name" required></label>
        <label>Area<input name="area"></label>
        <label>Address<input name="address" required></label>
        <label>Phone<input name="phone" required></label>
        <label>Lat<input name="lat" required></label>
        <label>Lng<input name="lng" required></label>
        <label>Opens<input name="opensAt" type="time"></label>
        <label>Closes<input name="closesAt" type="time"></label>
        <button type="submit">Create</button>
        <p id="form-error" class="error"></p>
      </form>`);
    document.querySelector('#shop-form').onsubmit = async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.target).entries());
      body.lat = Number(body.lat);
      body.lng = Number(body.lng);
      if (!body.opensAt) delete body.opensAt;
      if (!body.closesAt) delete body.closesAt;
      if (!body.area) delete body.area;
      try {
        await api('/shops', { method: 'POST', body });
        screenShop();
      } catch (error) {
        document.querySelector('#form-error').textContent = error.message;
      }
    };
    return;
  }
  draw(`${head(esc(shop.name))}
    <section class="hero"><p class="kicker">Shop code</p><p class="big">${esc(shop.code)}</p><p class="muted">Share this code. It is how someone saves your shop.</p></section>
    <div class="card"><p>${esc(shop.address)}</p><p class="muted">${esc(shop.phone)}${shop.opensAt ? ` · ${esc(shop.opensAt)} – ${esc(shop.closesAt || '')}` : ''}</p></div>`);
}

function orderActions(order) {
  const steps = {
    pending: [['accepted', 'Accept'], ['cancelled', 'Cancel']],
    accepted: [['ready', 'Ready'], ['cancelled', 'Cancel']],
    ready: [['cancelled', 'Cancel']],
  }[order.status] || [];
  return steps.map(([status, label]) => {
    const ghost = status === 'cancelled' ? ' class="ghost"' : '';
    return `<button${ghost} data-act="status" data-id="${order.id}" data-status="${status}" type="button">${label}</button>`;
  }).join('');
}

function screenAct(token) {
  tab.hidden = true;
  draw(`<section class="login">
    <img src="/logo.png" alt="">
    <h1>Reminder</h1>
    <p class="hello">A quiet reminder, just for you.</p>
    <div class="actions" style="margin-top:20px;">
      <button data-act="quick-act" data-token="${esc(token || '')}" data-action="started" type="button" class="wide">Started</button>
      <button data-act="quick-act" data-token="${esc(token || '')}" data-action="used" type="button" class="wide">Used 1</button>
      <button data-act="quick-act" data-token="${esc(token || '')}" data-action="done" type="button" class="ghost wide">Done</button>
    </div>
    <div id="act-msg" style="margin-top:16px;"></div>
  </section>`);
}

async function screenShopOrders() {
  const orders = await api('/shops/orders');
  const rows = orders.map((order) => `<div class="shop"><p><strong>${esc(order.orderNumber || '')} · ${esc(order.kind)} · ${esc(order.size)} × ${order.qty}</strong></p><p class="pill">${esc(order.status)}</p><p class="muted">${order.phone ? esc(order.phone) : ''}${order.address ? ` · ${esc(order.address)}` : ''}</p><div class="row">${orderActions(order)}</div></div>`).join('');
  draw(`${head('Orders')}<div class="card">${rows || '<p class="muted">No orders</p>'}</div>`);
}

async function loadMe() {
  try {
    me = await api('/me');
  } catch (error) {
    me = null;
  }
}

async function route() {
  const urlSearch = new URLSearchParams(location.search);
  const hashSearch = location.hash.includes('?') ? new URLSearchParams(location.hash.split('?')[1]) : null;
  const actToken = urlSearch.get('token') || (hashSearch && hashSearch.get('token'));
  if (location.hash.startsWith('#/act') || urlSearch.has('token')) {
    hideLock();
    screenAct(actToken);
    return;
  }

  const hash = location.hash || '#/login';
  try {
    if (!me && hash !== '#/login' && hash !== '#/otp') await loadMe();
    if (!me && hash !== '#/login' && hash !== '#/otp') {
      screenLogin();
      return;
    }
    document.body.classList.toggle('login-page', hash === '#/login' || hash === '#/otp' || hash === '');
    if (hash === '#/login') { hideLock(); screenLogin(); return; }
    if (hash === '#/otp') { hideLock(); screenOtp(); return; }
    document.body.classList.remove('login-page');
    if (me.role === 'girl' && !me.pin && hash !== '#/settings') {
      location.hash = '#/settings';
      return;
    }
    if (hash === '#/home') await screenHome();
    else if (hash === '#/calendar') await screenCalendar();
    else if (hash === '#/now') await screenNow();
    else if (hash === '#/settings') await screenSettings();
    else if (hash === '#/shop') await screenShop();
    else if (hash === '#/shop-orders') await screenShopOrders();
    else screenLogin();
    if (me && me.role === 'girl' && me.pin && !app.hidden) bumpIdle();
  } catch (error) {
    if (error.message !== 'PIN required' && error.message !== 'Login required') {
      draw(`<p class="error">${esc(error.message)}</p>`);
    }
  }
}

app.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const act = button.dataset.act;
  try {
    if (act === 'quick-act') {
      const token = button.dataset.token;
      const action = button.dataset.action;
      const box = document.querySelector('#act-msg');
      if (!token) {
        if (box) box.innerHTML = '<p class="error">Token missing</p>';
        return;
      }
      const point = await locate().catch(() => ({}));
      try {
        const data = await api('/notifications/act', { method: 'POST', body: { token, action, ...point } });
        if (data && (data.needNow || data.shops)) {
          sessionStorage.setItem('shops', JSON.stringify(data.shops || []));
          location.hash = '#/now';
        } else {
          draw(`<section class="note">${head('Reminder')}<img src="/logo.png" alt=""><p class="big">Saved</p><p class="muted">You can close this page now.</p><a class="go wide" href="#/home">Open Padzyra</a></section>`);
        }
      } catch (err) {
        if (box) box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      }
    } else if (act === 'start') {
      const point = await locate().catch(() => ({}));
      const data = await api('/notifications/started', { method: 'POST', body: point });
      if (data.shops) {
        sessionStorage.setItem('shops', JSON.stringify(data.shops));
        location.hash = '#/now';
      } else if (data.needNow) location.hash = '#/now';
      else screenHome();
    } else if (act === 'use') {
      const point = await locate().catch(() => ({}));
      const data = await api('/notifications/used', { method: 'POST', body: { place: 'bag', kind: 'day', ...point } });
      if (data.shops || data.needNow) {
        sessionStorage.setItem('shops', JSON.stringify(data.shops || []));
        location.hash = '#/now';
      } else screenHome();
    } else if (act === 'end') {
      await api('/cycles/end', { method: 'POST' });
      screenHome();
    } else if (act === 'feel') {
      const body = { [button.dataset.field]: button.dataset.value };
      await api(`/days/${localISO()}`, { method: 'PUT', body });
      button.parentElement.querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === button));
      const feelError = document.querySelector('#feel-error');
      if (feelError) feelError.textContent = '';
    } else if (act === 'month') {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(button.dataset.dir), 1);
      screenCalendar();
    } else if (act === 'drop-cycle') {
      await api(`/cycles/${button.dataset.id}`, { method: 'DELETE' });
      screenCalendar();
    } else if (act === 'drop-trip') {
      await api(`/trips/${button.dataset.id}`, { method: 'DELETE' });
      screenCalendar();
    } else if (act === 'locate') {
      const point = await locate();
      paintShops(await api('/shops/nearby', { method: 'POST', body: point }));
    } else if (act === 'order') {
      const result = await api('/orders', { method: 'POST', body: { shopId: button.dataset.id, qty: 2 } });
      const orderNum = result && result.orderNumber ? `<p class="big">${esc(result.orderNumber)}</p>` : '';
      draw(`<section class="note">${head('Order sent')}<img src="/logo.png" alt="">${orderNum}<p class="muted">Pay at the counter. Pickup adds the pads to your bag.</p><a class="go" href="#/home">Back home</a></section>`);
    } else if (act === 'unsave') {
      await api(`/shops/saved/${button.dataset.id}`, { method: 'DELETE' });
      button.closest('.shop').remove();
    } else if (act === 'status') {
      await api(`/shops/orders/${button.dataset.id}`, { method: 'PATCH', body: { status: button.dataset.status } });
      screenShopOrders();
    } else if (act === 'pickup') {
      await api(`/orders/${button.dataset.id}/picked-up`, { method: 'POST' });
      screenHome();
    } else if (act === 'ics') {
      const data = await api('/dashboard');
      const start = new Date();
      if (data.inDays != null) start.setDate(start.getDate() + Math.max(data.inDays, 0));
      const stamp = start.toISOString().slice(0, 10).replace(/-/g, '');
      const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Reminder\nDTSTART;VALUE=DATE:${stamp}\nEND:VEVENT\nEND:VCALENDAR\n`], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reminder.ics';
      link.click();
      URL.revokeObjectURL(url);
    } else if (act === 'logout') {
      await api('/auth/logout', { method: 'POST' });
      me = null;
      location.hash = '#/login';
    } else if (act === 'logout-all' || act === 'delete') {
      const purpose = act === 'delete' ? 'delete' : 'logout';
      await api('/auth/otp', { method: 'POST', body: { email: me.email, purpose } });
      const code = window.prompt('Code');
      if (!code) return;
      if (act === 'delete') await api('/me', { method: 'DELETE', body: { code } });
      else await api('/auth/logout-all', { method: 'POST', body: { code } });
      me = null;
      location.hash = '#/login';
    }
  } catch (error) {
    if (act === 'feel') {
      const feelError = document.querySelector('#feel-error');
      if (feelError) {
        feelError.textContent = error.message;
        return;
      }
    }
    if (error.message !== 'PIN required') draw(`<p class="error">${esc(error.message)}</p>`);
  }
});

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Location unavailable')),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 }
    );
  });
}

async function watchReminders() {
  if (!me || me.role !== 'girl' || !('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const key = await api('/push/key');
    if (key && key.publicKey) {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key.publicKey),
      });
      const json = sub.toJSON();
      await api('/push', { method: 'POST', body: { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } });
    }
  } catch (error) {
    /* Push stays on the site if the browser blocks it. */
  }
  const alert = await api('/notifications/today').catch(() => null);
  if (alert && alert.title && Notification.permission === 'granted') {
    new Notification(alert.title, { body: 'Reminder' });
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

window.addEventListener('hashchange', () => { route(); });
loadMe().then(() => {
  route();
  watchReminders();
});
