const events = [
  { title: 'Board Game Social at Maven Café', img: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80', time: 'Fri, Nov 15 · 7:00 – 9:00 PM', place: 'Maven Café · 0.8 mi', cost: '$10–20', category: 'games', tags: ['Connection', 'Low-key', 'Indoor'], desc: 'A relaxed evening of modern board games. Great for meeting new people or coming with friends.', score: 92 },
  { title: 'Sunset Run Club', img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=500&q=80', time: 'Fri, Nov 15 · 4:00 – 5:30 PM', place: 'Riverside Park · 1.2 mi', cost: 'Free', category: 'sports', tags: ['Movement', 'Outdoors', 'Social'], desc: 'A friendly, all-levels running group with a scenic route and good views.', score: 88 },
  { title: 'Friday Night at the Modern Art Museum', img: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=500&q=80', time: 'Fri, Nov 15 · 7:00 – 10:00 PM', place: 'City Art Museum · 2.1 mi', cost: '$15', category: 'arts_culture', tags: ['Novelty', 'Low-key', 'Indoor'], desc: 'Explore new exhibits, with live music and extended hours every Friday.', score: 81 }
];

const defaultPlans = [
  { id: 'curated-1', title: 'Easy Social Evening', theme: 'Connection', summary: 'A warm, low-pressure way to be around people without overloading the evening.', score: 92, events: [events[0]] },
  { id: 'curated-2', title: 'Move & Reset', theme: 'Movement', summary: 'Fresh air and an energy lift, with plenty of room to wind down afterward.', score: 88, events: [events[1]] },
  { id: 'curated-3', title: 'A Little Wonder', theme: 'Novelty', summary: 'A calm cultural outing for an evening that feels different from the usual.', score: 81, events: [events[2]] }
];

const categoryImages = {
  music: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=500&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=500&q=80',
  dance: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=500&q=80',
  learning: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=80',
  food_drink: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=500&q=80',
  games: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=500&q=80',
  arts_culture: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=500&q=80',
  wellness: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80',
  default: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=500&q=80'
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const categoryKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const fallbackImage = (event) => categoryImages[categoryKey(event.category)] || categoryImages.default;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

let currentPlans = clone(defaultPlans);
let selectedPlan = clone(defaultPlans[0]);
let editingIndex = null;
let editingSelected = false;
let timer;

function renderPlans(plans = currentPlans) {
  currentPlans = plans;
  document.getElementById('planOptions').innerHTML = plans.map((plan, index) => `
    <article class="plan-card ${index === 0 ? 'best' : ''}">
      <div class="plan-card-head">
        <span class="plan-theme">${esc(plan.theme || 'Personal')}</span>
        <span class="plan-score">${Math.max(1, Math.min(99, Number(plan.score) || 80))}% fit</span>
        <h3>${esc(plan.title || `Plan ${index + 1}`)}</h3>
        <div class="plan-summary">${esc(plan.summary || 'A plan shaped around your time and energy.')}</div>
      </div>
      <div class="plan-events">${(plan.events || []).map((event) => {
        const fallback = fallbackImage(event);
        const url = String(event.sourceUrl || '').startsWith('https://onhuddle.co/event/')
          ? `<a href="${esc(event.sourceUrl)}" target="_blank" rel="noopener">View event ↗</a>` : '';
        return `<div class="plan-event"><img src="${esc(event.img || fallback)}" data-fallback="${esc(fallback)}" alt=""><div><b>${esc(event.title)}</b><span>${esc(event.time || 'Time flexible')}</span><br>${url}</div></div>`;
      }).join('')}</div>
      <div class="plan-actions"><button class="customize-plan" data-action="customize-plan" data-index="${index}">Customize</button><button class="choose-plan" data-action="choose-plan" data-index="${index}">Use this plan</button></div>
    </article>`).join('');
}

function preferences() {
  return Object.fromEntries([...document.querySelectorAll('.mood')].map((mood) => [mood.dataset.k, {
    want: Math.round(parseFloat(mood.style.left) || 50),
    capacity: Math.round(100 - (parseFloat(mood.style.top) || 50))
  }]));
}

async function loadRecommendations() {
  const started = Date.now();
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ location: document.getElementById('location').value, preferences: preferences() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed');
    renderPlans(data.plans?.length ? data.plans : clone(defaultPlans));
  } catch (error) {
    renderPlans(clone(defaultPlans));
    toast('Using curated plans while live planning is unavailable.');
  }
  timer = setTimeout(() => show('results'), Math.max(0, 1500 - (Date.now() - started)));
}

function addEditorRow(activity = {}) {
  const row = document.createElement('div');
  row.className = 'editor-row';
  row._activity = clone(activity);
  row.innerHTML = `<label class="field">Activity<input class="activity-title" maxlength="120" value="${esc(activity.title || '')}" placeholder="What would you like to do?"></label><label class="field">Time<input class="activity-time" maxlength="80" value="${esc(activity.time || '')}" placeholder="e.g. 7:00 – 8:30 PM"></label><label class="field">Place<input class="activity-place" maxlength="100" value="${esc(activity.place || '')}" placeholder="Where?"></label><button class="remove-activity" data-action="remove-activity" aria-label="Remove activity">×</button>`;
  document.getElementById('editorActivities').appendChild(row);
}

function openEditor(index = null, { selected = false } = {}) {
  editingIndex = Number.isInteger(index) ? index : null;
  editingSelected = selected;
  const seed = selected ? selectedPlan : (editingIndex !== null ? currentPlans[editingIndex] : { title: 'My own plan', events: [] });
  document.getElementById('editorHeading').textContent = editingIndex === null && !selected ? 'Create a new plan' : 'Customize this plan';
  document.getElementById('planName').value = seed?.title || '';
  document.getElementById('editorActivities').innerHTML = '';
  (seed?.events?.length ? seed.events : [{}]).forEach(addEditorRow);
  show('editor');
}

function collectEditedPlan() {
  const source = editingSelected ? selectedPlan : (editingIndex !== null ? currentPlans[editingIndex] : {});
  const activities = [...document.querySelectorAll('.editor-row')].flatMap((row) => {
    const title = row.querySelector('.activity-title').value.trim();
    if (!title) return [];
    return [{ ...row._activity, title, time: row.querySelector('.activity-time').value.trim() || 'Time flexible', place: row.querySelector('.activity-place').value.trim() || 'Place flexible' }];
  });
  return { ...clone(source || {}), id: source?.id || `custom-${Date.now()}`, title: document.getElementById('planName').value.trim() || 'My plan', theme: editingIndex !== null ? source.theme : (source.theme || 'Personal'), summary: editingIndex !== null ? source.summary : (source.summary || 'A plan made entirely by you.'), score: editingIndex !== null ? source.score : (source.score || 100), events: activities };
}

function saveEditedPlan() {
  const plan = collectEditedPlan();
  if (!plan.events.length) return toast('Add at least one activity to use this plan.');
  if (editingIndex !== null) {
    currentPlans[editingIndex] = clone(plan);
    renderPlans(currentPlans);
  }
  selectedPlan = plan;
  renderAgenda();
  show('agenda');
  toast('Your plan is ready.');
}

function choosePlan(index) {
  selectedPlan = clone(currentPlans[index]);
  renderAgenda();
  show('agenda');
}

function renderAgenda() {
  document.getElementById('agendaTitle').textContent = selectedPlan?.title || 'Your plan';
  document.getElementById('agendaTheme').textContent = selectedPlan?.theme || 'Personal';
  const activities = selectedPlan?.events || [];
  document.getElementById('planList').innerHTML = activities.length ? activities.map((event, index) => {
    const image = event.img ? `<img src="${esc(event.img)}" data-fallback="${esc(fallbackImage(event))}" alt="">` : '✦';
    return `<article class="item"><div class="picon">${image}</div><div class="copy">${esc(event.time || 'Time flexible')}<strong>${esc(event.title)}</strong><span class="sub" style="font-size:11px">${esc(event.place || 'Place flexible')}</span></div><button class="remove-agenda" data-action="remove-agenda" data-index="${index}" aria-label="Remove activity">×</button></article>`;
  }).join('') : '<div class="empty-agenda">This plan is empty. <button class="soft" data-action="edit-selected">Add an activity</button></div>';
}

const screens = [...document.querySelectorAll('.screen')];
const nav = [...document.querySelectorAll('.nav button[data-go]')];
function show(id) {
  clearTimeout(timer);
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
  nav.forEach((button) => button.classList.toggle('active', button.dataset.go === (['planner', 'availability', 'matching', 'results', 'editor'].includes(id) ? 'planner' : id)));
  document.querySelector('.stage').scrollTop = 0;
  if (id === 'matching') loadRecommendations();
  if (id === 'agenda') renderAgenda();
}

function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 1700);
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const index = Number(action.dataset.index);
    if (action.dataset.action === 'choose-plan') choosePlan(index);
    if (action.dataset.action === 'customize-plan') openEditor(index);
    if (action.dataset.action === 'blank-plan') openEditor();
    if (action.dataset.action === 'add-activity') addEditorRow();
    if (action.dataset.action === 'remove-activity') {
      action.closest('.editor-row').remove();
      if (!document.querySelector('.editor-row')) addEditorRow();
    }
    if (action.dataset.action === 'save-plan') saveEditedPlan();
    if (action.dataset.action === 'edit-selected') openEditor(null, { selected: true });
    if (action.dataset.action === 'remove-agenda') {
      selectedPlan.events.splice(index, 1);
      renderAgenda();
    }
  }
  const go = event.target.closest('[data-go]');
  if (go) show(go.dataset.go);
  const notice = event.target.closest('[data-toast]');
  if (notice) toast(notice.dataset.toast);
});

document.addEventListener('error', (event) => {
  if (event.target.matches?.('img[data-fallback]') && event.target.src !== event.target.dataset.fallback) event.target.src = event.target.dataset.fallback;
}, true);

document.querySelectorAll('.connect').forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll('.connect').forEach((item) => item.classList.remove('on'));
    button.classList.add('on');
    button.textContent = '✓  Connected';
    toast('Calendar connected for this prototype.');
  };
});
document.getElementById('freeBtn').onclick = (event) => {
  event.target.textContent = event.target.textContent === 'Free anyway' ? 'Marked free ✓' : 'Free anyway';
};

const feelings = {
  focus: ['😐', 'Focus', 'You have room for a little focus, as long as it stays manageable.', '“One clear thing is enough.”'],
  movement: ['🙂', 'Movement', 'You’re ready for something active and uplifting.', '“A little motion could shift the whole evening.”'],
  novelty: ['😌', 'Novelty', 'Familiar and low-pressure feels best right now.', '“New can arrive gently.”'],
  connection: ['😍', 'Connection', 'You want more connection right now, but may prefer a smaller social setting.', '“It’s okay to want connection in a gentle way.”']
};

function select(mood) {
  document.querySelectorAll('.mood').forEach((item) => item.classList.remove('sel'));
  mood.classList.add('sel');
  const data = feelings[mood.dataset.k];
  ['ff', 'fn', 'fc', 'fq'].forEach((id, index) => { document.getElementById(id).textContent = data[index]; });
  document.getElementById('wc').textContent = parseFloat(mood.style.left) > 55 ? 'High want' : 'Low want';
  document.getElementById('cc').textContent = parseFloat(mood.style.top) < 50 ? 'High capacity' : 'Low capacity';
}

document.querySelectorAll('.mood').forEach((mood) => {
  mood.onpointerdown = (event) => { select(mood); mood.setPointerCapture(event.pointerId); };
  mood.onpointermove = (event) => {
    if (!mood.hasPointerCapture(event.pointerId)) return;
    const bounds = document.getElementById('grid').getBoundingClientRect();
    mood.style.left = `${Math.max(10, Math.min(90, (event.clientX - bounds.left) / bounds.width * 100))}%`;
    mood.style.top = `${Math.max(10, Math.min(90, (event.clientY - bounds.top) / bounds.height * 100))}%`;
    select(mood);
  };
});

renderPlans();
renderAgenda();
document.getElementById('date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
fetch('/api/status').then((response) => response.json()).then((status) => {
  const state = document.getElementById('apiState');
  state.classList.toggle('ready', status.configured);
  state.querySelector('span').textContent = status.configured ? 'Live plans ready' : 'Curated plans';
}).catch(() => { document.querySelector('#apiState span').textContent = 'Curated plans'; });
fetch('/api/cities').then((response) => response.json()).then((data) => {
  const select = document.getElementById('location');
  const current = select.value;
  const cities = data.cities || [];
  if (!cities.length) return;
  select.innerHTML = cities.map((city) => `<option value="${esc(city.display_name)}">${esc(city.display_name)} (${Number(city.event_count).toLocaleString()})</option>`).join('');
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}).catch(() => {});

const demoMode = new URLSearchParams(location.search).has('demo');
if (demoMode) {
  loadRecommendations = async () => { renderPlans(clone(defaultPlans)); timer = setTimeout(() => show('results'), 7000); };
  const mood = (key, left, top) => {
    const element = document.querySelector(`.mood[data-k="${key}"]`);
    select(element); element.style.left = `${left}%`; element.style.top = `${top}%`;
  };
  setTimeout(() => show('planner'), 5000);
  setTimeout(() => mood('focus', 42, 31), 8000);
  setTimeout(() => mood('novelty', 47, 61), 11200);
  setTimeout(() => mood('connection', 80, 56), 14400);
  setTimeout(() => mood('movement', 76, 19), 17600);
  setTimeout(() => show('availability'), 22000);
  setTimeout(() => show('matching'), 31000);
  setTimeout(() => show('results'), 38000);
  setTimeout(() => choosePlan(0), 51000);
}
