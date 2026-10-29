import { node, icon, button, selectField, options } from './demo-dom.js';
import { METRIC_PERIODS } from './assets/admin/metricPeriods.js';
import { SERVICE_METRIC_VIEWS, METRIC_BYTE_UNITS } from './assets/admin/serviceMetricsConstants.js';
import { inventorySyncState } from './assets/admin/inventorySyncState.js';
import { formatBytes } from './assets/admin/formatBytes.js';
import { validateTagKeys } from './assets/admin/tagKeys.js';

const copy = {
  es: {
    demo: 'Demo local · datos ficticios. Las acciones no consultan ni modifican Azure.',
    scenario: 'Escenario del ejemplo',
    healthy: 'Todo sincronizado',
    newer: 'Inventario pendiente de importar',
    unavailable: 'Servicios sin datos',
    collecting: 'Generación en curso',
    refresh: 'Consultar ejemplo',
    refreshing: 'Consultando ejemplo…',
    periodEnd: 'Período de ejemplo terminado el',
    sample: 'Muestra UTC',
    chartHelp: 'Pasa el puntero o usa las flechas izquierda y derecha para consultar muestras.',
    saved: 'Programación guardada solo en esta demo. No se ha programado ningún trabajo en Azure.',
    tagsSaved:
      'Etiquetas guardadas en la demo. Puedes ver las columnas en la vista Etiquetas del inventario.',
    restart:
      'En el producto, este cambio reinicia la Function. Aquí solo modifica el ejemplo en memoria.',
    busy: 'La generación está en curso en este escenario; espera o cambia de escenario para editar.',
    portal: 'El recurso es ficticio: no tiene un enlace al portal de Azure.',
    fixedData: 'Las métricas son muestras sintéticas. Los huecos no se convierten en cero.',
  },
  en: {
    demo: 'Local demo · fictional data. Actions do not query or modify Azure.',
    scenario: 'Example scenario',
    healthy: 'Everything synchronized',
    newer: 'Inventory awaiting import',
    unavailable: 'Service data unavailable',
    collecting: 'Generation in progress',
    refresh: 'Query example',
    refreshing: 'Querying example…',
    periodEnd: 'Example period ending at',
    sample: 'UTC sample',
    chartHelp: 'Hover or use the left and right arrow keys to inspect samples.',
    saved: 'Schedule saved in this demo only. No Azure job was scheduled.',
    tagsSaved: 'Tags saved in the demo. See the columns in the inventory Tags view.',
    restart:
      'In the product, this change restarts the Function. Here it only edits the in-memory example.',
    busy: 'Generation is running in this scenario; wait or switch scenarios before editing.',
    portal: 'This resource is fictional and has no Azure portal link.',
    fixedData: 'Metrics are synthetic samples. Gaps are not converted to zero.',
  },
};
const colors = ['#0078d4', '#16324f'];
const NS = 'http://www.w3.org/2000/svg';

function svgNode(tag, attributes) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function createAdminDemo(container, { data, onInventory, onTags }) {
  const state = {
    language: document.documentElement.lang,
    hours: 24,
    scenario: 'healthy',
    loading: false,
    checkedAt: data.checkedAt,
    notice: '',
    schedule: { ...data.schedule },
    draft: { ...data.schedule },
    savedTags: [...data.tags],
    selectedTags: [...data.tags],
    automatic: !data.tags.length,
    query: '',
    tagError: '',
    tagPage: 0,
    views: { database: 'load', storage: 'requests' },
  };
  const t = (key, values = {}) => {
    const text = data.labels[state.language][`admin.${key}`];
    if (typeof text !== 'string') throw new Error(`Missing demo translation: admin.${key}`);
    return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
  };
  const d = (key) => copy[state.language][key];
  const number = (value, digits = 1) =>
    new Intl.NumberFormat(state.language, { maximumFractionDigits: digits }).format(value);
  const date = (value) =>
    new Intl.DateTimeFormat(state.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(value));
  const time = (value) =>
    new Intl.DateTimeFormat(state.language, {
      ...(state.hours > 24 ? { day: '2-digit', month: 'short' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(value));
  const busy = () => state.loading || state.scenario === 'collecting';
  const serviceAvailable = () => state.scenario !== 'unavailable';

  function card(titleKey, symbol, descriptionKey) {
    const root = node('section', '', 'admin-demo-card');
    const header = node('div', '', 'admin-demo-card-header');
    const title = node('h3');
    const badge = node('span', '', 'tag green');
    badge.hidden = true;
    const row = node('div', '', 'admin-demo-card-heading');
    row.append(icon(symbol), title, badge);
    const description = node('p', '', 'admin-demo-help');
    header.append(row, description);
    const body = node('div', '', 'admin-demo-card-body');
    root.append(header, body);
    return { root, title, badge, body, description, titleKey, descriptionKey };
  }

  function labelCard(part) {
    part.title.textContent = t(part.titleKey);
    part.description.textContent = part.descriptionKey ? t(part.descriptionKey) : '';
    part.description.hidden = !part.descriptionKey;
  }

  function details(entries) {
    const list = node('dl', '', 'admin-demo-specs');
    for (const [label, value] of entries) {
      const entry = node('div');
      entry.append(node('dt', label), node('dd', String(value)));
      list.append(entry);
    }
    return list;
  }

  function periodField(key) {
    return selectField(key, (value) => {
      state.hours = Number(value);
      render(state.language);
    });
  }

  function updatePeriod(field) {
    options(
      field,
      METRIC_PERIODS.map((hours) => [
        String(hours),
        t(hours === 168 ? 'periodWeek' : 'periodHours', { count: hours }),
      ]),
      String(state.hours),
      t('periodSelector'),
    );
    field.select.disabled = state.loading;
  }

  function metricsInPeriod(metrics, available = true) {
    return metrics.map((metric) => {
      const points = metric.data.slice(-state.hours);
      const values = points.map(({ value }) => value).filter(Number.isFinite);
      const sum = values.reduce((total, value) => total + value, 0);
      const aggregate = metric.aggregation === 'Total' ? sum : sum / Math.max(1, values.length);
      return {
        ...metric,
        data: points,
        available: available && values.length > 0,
        value: values.length ? aggregate : null,
      };
    });
  }

  function chart(metrics, label, { bar = false, fixedMax } = {}) {
    const root = node('div', '', 'admin-demo-chart');
    root.dataset.chart = metrics.map(({ id }) => id).join('-');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `${label}. ${d('chartHelp')}`);
    root.tabIndex = 0;
    const rawMax = Math.max(
      0,
      ...metrics.flatMap(({ data }) => data.map(({ value }) => value).filter(Number.isFinite)),
    );
    const unit = metrics[0].unit;
    const scale =
      unit === 'bytes'
        ? METRIC_BYTE_UNITS.find(({ divisor }) => rawMax >= divisor) || METRIC_BYTE_UNITS.at(-1)
        : { divisor: 1, label: '' };
    const suffix = { percent: '%', milliseconds: 'ms' }[unit] || scale.label;
    const maximum = fixedMax || Math.max(1, Math.ceil((rawMax / scale.divisor) * 1.1));
    const length = metrics[0].data.length;
    const x = (index) => (length === 1 ? 50 : (index / (length - 1)) * 100);
    const y = (value) => 100 - (value / scale.divisor / maximum) * 100;
    const svg = svgNode('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    });
    for (const line of [0, 50, 100])
      svg.append(
        svgNode('line', {
          x1: 0,
          y1: line,
          x2: 100,
          y2: line,
          stroke: '#dae6f0',
          'stroke-dasharray': '3 4',
          'vector-effect': 'non-scaling-stroke',
        }),
      );
    for (const [seriesIndex, metric] of metrics.entries()) {
      const segments = [[]];
      for (const [index, point] of metric.data.entries()) {
        if (!Number.isFinite(point.value)) {
          segments.push([]);
          continue;
        }
        if (bar)
          svg.append(
            svgNode('rect', {
              x: Math.max(0, x(index) - (0.3 * 100) / length),
              y: y(point.value),
              width: (0.6 * 100) / length,
              height: 100 - y(point.value),
              fill: colors[seriesIndex],
            }),
          );
        else segments.at(-1).push(`${x(index)},${y(point.value)}`);
      }
      if (!bar)
        for (const segment of segments.filter((points) => points.length)) {
          if (segment.length === 1) {
            const [cx, cy] = segment[0].split(',');
            svg.append(svgNode('circle', { cx, cy, r: 1.2, fill: colors[seriesIndex] }));
          } else
            svg.append(
              svgNode('polyline', {
                points: segment.join(' '),
                fill: 'none',
                stroke: colors[seriesIndex],
                'stroke-width': 2,
                'vector-effect': 'non-scaling-stroke',
              }),
            );
        }
    }
    const cursor = svgNode('line', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100,
      stroke: '#8197ad',
      'vector-effect': 'non-scaling-stroke',
    });
    cursor.style.display = 'none';
    svg.append(cursor);
    const yAxis = node('div', '', 'admin-demo-y');
    for (const value of [maximum, maximum / 2, 0]) yAxis.append(node('span', number(value)));
    const xAxis = node('div', '', 'admin-demo-x');
    for (const index of [...new Set([0, Math.floor((length - 1) / 2), length - 1])])
      xAxis.append(node('span', time(metrics[0].data[index].time)));
    const tooltip = node('div', '', 'admin-demo-tooltip');
    tooltip.hidden = true;
    const live = node('span', '', 'demo-sr-only');
    live.setAttribute('aria-live', 'polite');
    const selection = { index: length - 1 };
    function inspect(index, announce = false) {
      selection.index = Math.max(0, Math.min(index, length - 1));
      const timestamp = metrics[0].data[selection.index].time;
      const descriptions = metrics.map((metric) => {
        const point = metric.data[selection.index];
        const value = Number.isFinite(point.value)
          ? `${number(point.value / scale.divisor)} ${suffix}`
          : '—';
        return `${metric.label}: ${value}`;
      });
      tooltip.replaceChildren(
        node('strong', `${time(timestamp)} UTC`),
        ...descriptions.map((value) => node('span', value)),
      );
      tooltip.hidden = false;
      cursor.style.display = '';
      cursor.setAttribute('x1', x(selection.index));
      cursor.setAttribute('x2', x(selection.index));
      if (announce) live.textContent = `${time(timestamp)} UTC. ${descriptions.join('. ')}`;
    }
    root.addEventListener('pointermove', (event) => {
      const bounds = svg.getBoundingClientRect();
      inspect(Math.round(((event.clientX - bounds.left) / bounds.width) * (length - 1)));
    });
    root.addEventListener('pointerleave', () => {
      if (document.activeElement !== root) {
        tooltip.hidden = true;
        cursor.style.display = 'none';
      }
    });
    root.addEventListener('focus', () => inspect(selection.index, true));
    root.addEventListener('blur', () => {
      tooltip.hidden = true;
      cursor.style.display = 'none';
    });
    root.addEventListener('keydown', (event) => {
      const targets = {
        ArrowLeft: selection.index - 1,
        ArrowRight: selection.index + 1,
        Home: 0,
        End: length - 1,
      };
      if (!Object.hasOwn(targets, event.key)) return;
      event.preventDefault();
      inspect(targets[event.key], true);
    });
    root.append(svg, yAxis, xAxis, tooltip, live);
    return root;
  }

  function metricCard(metric) {
    const part = card(`metric.${metric.id}`, metric.id === 'executions' ? 'activity' : metric.id);
    labelCard(part);
    part.root.dataset.metric = metric.id;
    const divisor = metric.unit === 'bytes' ? 1048576 : 1;
    const suffix = { bytes: ' MiB', percent: ' %' }[metric.unit] || '';
    const value = node(
      'strong',
      metric.available
        ? `${number(metric.value / divisor, metric.unit === 'count' ? 0 : 1)}${suffix}`
        : '—',
      'admin-demo-value',
    );
    part.description.hidden = false;
    part.description.textContent = t(
      metric.aggregation === 'Total' ? 'totalPeriod' : 'averagePeriod',
      { count: state.hours },
    );
    part.root.querySelector('.admin-demo-card-header').insertBefore(value, part.description);
    part.body.append(
      metric.available
        ? chart([{ ...metric, label: t(`metric.${metric.id}`) }], t(`metric.${metric.id}`))
        : node('p', t('noMetrics'), 'admin-demo-unavailable'),
    );
    return part.root;
  }

  const banner = node('p', '', 'admin-demo-banner');
  const scenario = selectField('admin-scenario', (value) => {
    state.scenario = value;
    state.notice = '';
    render(state.language);
  });
  const demoTools = node('div', '', 'admin-demo-toolbar');
  demoTools.append(banner, scenario.label);
  const heading = node('header', '', 'admin-demo-heading');
  const headingCopy = node('div');
  const eyebrow = node('span', '', 'eyebrow');
  const title = node('h2');
  const description = node('p', '', 'admin-demo-help');
  headingCopy.append(eyebrow, title, description);
  const query = node('div', '', 'admin-demo-query');
  const checked = node('p', '', 'admin-demo-help');
  const refresh = button('', async () => {
    state.loading = true;
    render(state.language);
    await new Promise((resolve) => setTimeout(resolve, 450));
    state.checkedAt = new Date().toISOString();
    state.loading = false;
    render(state.language);
  });
  refresh.dataset.adminRefresh = '';
  query.append(refresh, checked);
  heading.append(headingCopy, query);
  const notice = node('p', '', 'demo-notice');
  notice.setAttribute('role', 'status');
  const activityTitle = node('h3');
  const period = periodField('metric-period');
  const activityHeading = node('div', '', 'admin-demo-section-heading');
  activityHeading.append(activityTitle, period.label);
  const metrics = node('div', '', 'admin-demo-metrics');
  const metricsNote = node('details', '', 'admin-demo-explanation');
  const metricsSummary = node('summary');
  const metricsHelp = node('p');
  metricsNote.append(metricsSummary, metricsHelp);
  const functionCard = card('functionTitle', 'server', 'functionDescription');
  const schedule = card('scheduleTitle', 'clock', 'scheduleHelp');
  const firstRow = node('div', '', 'admin-demo-columns admin-demo-configuration');
  firstRow.append(functionCard.root, schedule.root);
  const inventory = card('inventoryTitle', 'layers', 'inventoryHelp');
  const tagsCard = card('tagsTitle', 'tag', 'tagsHelp');
  const dataRow = node('div', '', 'admin-demo-columns admin-demo-data');
  const services = Object.fromEntries(
    ['database', 'storage'].map((service) => {
      const part = card(
        `${service}Title`,
        service === 'database' ? 'database' : 'box',
        `${service}Help`,
      );
      part.root.dataset.adminService = service;
      const controls = node('div', '', 'admin-demo-service-controls');
      controls.setAttribute('role', 'group');
      const period = periodField(`${service}-period`);
      const chartHost = node('div');
      const info = node('details', '', 'admin-demo-details');
      const infoTitle = node('summary');
      const infoBody = node('div');
      info.append(infoTitle, infoBody);
      const top = node('div');
      part.body.append(top, period.label, controls, chartHost, info);
      dataRow.append(part.root);
      return [service, { ...part, top, period, controls, chartHost, info, infoTitle, infoBody }];
    }),
  );

  const form = node('form', '', 'demo-schedule admin-demo-form');
  const timerLabel = node('label', '', 'demo-timer');
  const timerText = node('span');
  const timer = node('input');
  timer.type = 'checkbox';
  timer.dataset.control = 'timer';
  timer.setAttribute('role', 'switch');
  timerLabel.append(timerText, timer);
  function editSchedule(key, value) {
    state.draft[key] = value;
    state.notice = '';
    renderSchedule();
    updateNotice();
  }
  timer.addEventListener('change', () => editSchedule('enabled', timer.checked));
  const frequency = selectField('frequency', (value) => editSchedule('mode', value));
  const interval = selectField('interval', (value) => editSchedule('hours', Number(value)));
  const timeLabel = node('label', '', 'demo-field');
  const timeCaption = node('span');
  const timeInput = node('input');
  timeInput.type = 'time';
  timeInput.dataset.control = 'time';
  timeInput.addEventListener('input', () => editSchedule('time', timeInput.value));
  timeLabel.append(timeCaption, timeInput);
  const scheduleFields = node('div', '', 'demo-controls');
  scheduleFields.append(frequency.label, timeLabel, interval.label);
  const timeHelp = node('p', '', 'admin-demo-help');
  const current = node('p', '', 'demo-current-schedule');
  current.dataset.scheduleSummary = '';
  const cronDetails = node('details', '', 'admin-demo-details');
  const cronSummary = node('summary');
  const cron = node('code');
  cron.dataset.scheduleCron = '';
  cronDetails.append(cronSummary, cron);
  const scheduleWarning = node('p', '', 'admin-demo-warning');
  const scheduleSave = node('button', '', 'demo-button demo-button-primary');
  scheduleSave.type = 'submit';
  scheduleSave.dataset.saveSchedule = '';
  const scheduleDiscard = button('', () => {
    state.draft = { ...state.schedule };
    state.notice = '';
    renderSchedule();
    updateNotice();
  });
  scheduleDiscard.dataset.discardSchedule = '';
  const scheduleActions = node('div', '', 'demo-controls');
  scheduleActions.append(scheduleSave, scheduleDiscard);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (busy()) {
      state.notice = 'busy';
      updateNotice();
      return;
    }
    state.schedule = { ...state.draft };
    state.notice = 'saved';
    renderSchedule();
    updateNotice();
  });
  form.append(
    timerLabel,
    scheduleFields,
    timeHelp,
    current,
    cronDetails,
    scheduleWarning,
    scheduleActions,
  );
  schedule.body.append(form);

  const tagsForm = node('form', '', 'admin-demo-form');
  const automaticLabel = node('label', '', 'demo-timer');
  const automaticText = node('span');
  const automatic = node('input');
  automatic.type = 'checkbox';
  automatic.setAttribute('role', 'switch');
  automatic.dataset.control = 'tags-automatic';
  automatic.addEventListener('change', () => {
    state.automatic = automatic.checked;
    if (!state.automatic && !state.selectedTags.length)
      state.selectedTags = [...data.availableTags];
    state.tagError = '';
    state.notice = '';
    renderTags();
    updateNotice();
  });
  automaticLabel.append(automaticText, automatic);
  const tagSearchLabel = node('label', '', 'demo-field');
  const tagSearchCaption = node('span');
  const tagSearch = node('input');
  tagSearch.type = 'search';
  tagSearch.dataset.control = 'admin-tags-search';
  tagSearch.addEventListener('input', () => {
    state.query = tagSearch.value;
    state.tagPage = 0;
    renderTags();
  });
  tagSearchLabel.append(tagSearchCaption, tagSearch);
  const tagCount = node('span', '', 'admin-demo-help');
  tagCount.setAttribute('role', 'status');
  const selectAll = button('', () => {
    state.selectedTags = [...data.availableTags];
    state.tagError = '';
    state.notice = '';
    renderTags();
    updateNotice();
  });
  const deselectAll = button('', () => {
    state.selectedTags = [];
    state.tagError = '';
    state.notice = '';
    renderTags();
    updateNotice();
  });
  deselectAll.dataset.clearTags = '';
  const tagToolbar = node('div', '', 'demo-controls');
  tagToolbar.append(tagSearchLabel, tagCount, selectAll, deselectAll);
  const tagOptions = node('fieldset', '', 'admin-demo-tag-options');
  const tagError = node('p', '', 'admin-demo-warning');
  tagError.setAttribute('role', 'status');
  const tagPrevious = button('', () => {
    state.tagPage--;
    renderTags();
  });
  const tagNext = button('', () => {
    state.tagPage++;
    renderTags();
  });
  const tagRange = node('span', '', 'admin-demo-help');
  const tagPaging = node('div', '', 'admin-demo-tag-paging');
  tagPaging.append(tagPrevious, tagRange, tagNext);
  const tagSave = node('button', '', 'demo-button demo-button-primary');
  tagSave.type = 'submit';
  tagSave.dataset.saveTags = '';
  const tagDiscard = button('', () => {
    state.selectedTags = [...state.savedTags];
    state.automatic = !state.savedTags.length;
    state.tagError = '';
    state.notice = '';
    renderTags();
    updateNotice();
  });
  tagDiscard.dataset.discardTags = '';
  const tagActions = node('div', '', 'demo-controls');
  tagActions.append(tagSave, tagDiscard);
  tagsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      validateTagKeys(state.automatic ? [] : state.selectedTags, { allowEmpty: state.automatic });
    } catch {
      state.tagError = 'tagsInvalidSelection';
      renderTags();
      return;
    }
    if (busy()) {
      state.notice = 'busy';
      updateNotice();
      return;
    }
    state.savedTags = state.automatic ? [] : [...state.selectedTags];
    onTags(state.automatic ? [...data.availableTags] : [...state.selectedTags]);
    state.notice = 'tagsSaved';
    state.tagError = '';
    renderTags();
    updateNotice();
  });
  tagsForm.append(automaticLabel, tagToolbar, tagOptions, tagPaging, tagError, tagActions);
  tagsCard.body.append(tagsForm);
  container.replaceChildren(
    demoTools,
    heading,
    notice,
    activityHeading,
    metrics,
    metricsNote,
    firstRow,
    inventory.root,
    tagsCard.root,
    dataRow,
  );

  function updateNotice() {
    notice.hidden = !state.notice;
    notice.textContent = state.notice ? d(state.notice) : '';
  }

  function renderSchedule() {
    const draft = state.draft;
    const changed =
      draft.enabled !== state.schedule.enabled ||
      draft.mode !== state.schedule.mode ||
      (draft.mode === 'daily' && draft.time !== state.schedule.time) ||
      (draft.mode === 'hourly' && draft.hours !== state.schedule.hours);
    timerText.textContent = t('timerLabel');
    timer.checked = draft.enabled;
    timer.disabled = busy();
    options(
      frequency,
      [
        ['daily', t('daily')],
        ['hourly', t('hourly')],
      ],
      draft.mode,
      t('frequency'),
    );
    frequency.select.disabled = busy();
    options(
      interval,
      [1, 2, 3, 4, 6, 8, 12].map((hours) => [String(hours), t('everyHours', { count: hours })]),
      String(draft.hours),
      t('interval'),
    );
    interval.label.hidden = draft.mode !== 'hourly';
    interval.select.disabled = busy();
    timeCaption.textContent = t('timeUTC');
    if (timeInput.value !== draft.time) timeInput.value = draft.time;
    timeLabel.hidden = draft.mode !== 'daily';
    timeInput.required = draft.mode === 'daily';
    timeInput.disabled = busy() || draft.mode !== 'daily';
    timeHelp.textContent = t('timeHelp');
    const saved = state.schedule;
    const summary =
      saved.mode === 'daily'
        ? t('dailyAt', { time: saved.time })
        : t('everyHours', { count: saved.hours });
    current.textContent = `${t('currentSchedule')}: ${saved.enabled ? summary : t('paused')}`;
    const [hour, minute] = saved.time.split(':').map(Number);
    cron.textContent =
      saved.mode === 'daily' ? `0 ${minute} ${hour} * * *` : `0 0 */${saved.hours} * * *`;
    cronSummary.textContent = t('viewCron');
    scheduleWarning.hidden = !changed && !busy();
    scheduleWarning.textContent = d(busy() ? 'busy' : 'restart');
    scheduleSave.textContent = t('save');
    scheduleSave.disabled = busy() || !changed;
    scheduleDiscard.textContent = t('discard');
    scheduleDiscard.disabled = busy();
    scheduleDiscard.hidden = !changed;
  }

  function renderTags() {
    const focusKey = tagOptions.contains(document.activeElement)
      ? document.activeElement.dataset.tagKey
      : null;
    const visible = data.availableTags.filter((key) =>
      key.toLowerCase().includes(state.query.toLowerCase()),
    );
    const pages = Math.max(1, Math.ceil(visible.length / 10));
    state.tagPage = Math.max(0, Math.min(state.tagPage, pages - 1));
    const start = state.tagPage * 10;
    const selected = state.automatic ? data.availableTags.length : state.selectedTags.length;
    const changed =
      state.automatic !== !state.savedTags.length ||
      (!state.automatic &&
        JSON.stringify([...state.selectedTags].sort()) !==
          JSON.stringify([...state.savedTags].sort()));
    automaticText.textContent = t('tagsAutomatic');
    automatic.checked = state.automatic;
    automatic.disabled = busy();
    tagSearchCaption.textContent = t('tagsSearch');
    tagSearch.placeholder = t('tagsSearch');
    tagSearch.disabled = busy();
    tagCount.textContent = t(selected === 1 ? 'tagsCountOne' : 'tagsCount', {
      count: number(selected, 0),
    });
    selectAll.textContent = t('tagsSelectAll');
    deselectAll.textContent = t('tagsDeselectAll');
    selectAll.disabled = busy() || state.automatic;
    deselectAll.disabled = busy() || state.automatic || !state.selectedTags.length;
    const legend = node('legend', t('tagsChoose'), 'demo-sr-only');
    tagOptions.replaceChildren(
      legend,
      ...visible.slice(start, start + 10).map((key) => {
        const label = node('label');
        const input = node('input');
        input.type = 'checkbox';
        input.dataset.tagKey = key;
        input.checked = state.automatic || state.selectedTags.includes(key);
        input.addEventListener('change', () => {
          state.selectedTags = input.checked
            ? [...state.selectedTags, key]
            : state.selectedTags.filter((item) => item !== key);
          state.tagError = '';
          state.notice = '';
          renderTags();
          updateNotice();
        });
        label.append(input, node('span', key));
        return label;
      }),
    );
    tagOptions.disabled = busy() || state.automatic;
    if (focusKey)
      [...tagOptions.querySelectorAll('input')]
        .find((input) => input.dataset.tagKey === focusKey)
        ?.focus({ preventScroll: true });
    const error = state.tagError || (!state.automatic && !selected ? 'tagsChooseOne' : '');
    tagError.hidden = !error && visible.length > 0;
    tagError.textContent = error ? t(error) : t('tagsNoMatch');
    tagPrevious.textContent = '‹';
    tagPrevious.setAttribute(
      'aria-label',
      state.language === 'es' ? 'Página anterior de etiquetas' : 'Previous tag page',
    );
    tagNext.textContent = '›';
    tagNext.setAttribute(
      'aria-label',
      state.language === 'es' ? 'Página siguiente de etiquetas' : 'Next tag page',
    );
    tagPrevious.disabled = state.tagPage === 0;
    tagNext.disabled = state.tagPage >= pages - 1;
    tagRange.textContent = `${visible.length ? start + 1 : 0}–${Math.min(start + 10, visible.length)} / ${visible.length}`;
    tagSave.textContent = t('tagsSave');
    tagDiscard.textContent = t('discard');
    tagSave.disabled = busy() || !changed || (!state.automatic && !selected);
    tagDiscard.disabled = busy() || !changed;
  }

  function renderService(service) {
    const part = services[service];
    const available = serviceAvailable();
    part.badge.hidden = false;
    const connected = service === 'database' ? 'databaseConnected' : 'blobAccessible';
    part.badge.textContent = t(available ? connected : 'serviceUnavailable');
    part.badge.classList.toggle('green', available);
    const size = service === 'database' ? data.database.bytes : data.publication.bytes;
    part.top.replaceChildren(
      node(
        'p',
        service === 'database' ? data.database.name : data.publication.storage.blob,
        'admin-demo-resource-name',
      ),
      node('span', t(service === 'database' ? 'databaseSize' : 'blobSize'), 'admin-demo-help'),
      node('strong', available ? formatBytes(size, state.language) : '—', 'admin-demo-size'),
    );
    updatePeriod(part.period);
    const views = SERVICE_METRIC_VIEWS[service];
    const view = views.find(({ id }) => id === state.views[service]);
    const metrics = metricsInPeriod(
      service === 'database' ? data.databaseMetrics : data.storageMetrics,
      available,
    )
      .filter(({ id }) => view.metrics.includes(id))
      .map((metric) => ({ ...metric, label: t(`serviceMetric.${metric.id}`) }));
    const focusedView = part.controls.contains(document.activeElement)
      ? document.activeElement.dataset.metricView
      : null;
    part.controls.setAttribute('aria-label', t('metricSelector'));
    part.controls.replaceChildren(
      ...views.map(({ id }) => {
        const control = button(t(`metricView.${id}`), () => {
          state.views[service] = id;
          renderService(service);
        });
        control.dataset.metricView = id;
        control.setAttribute('aria-pressed', String(view.id === id));
        return control;
      }),
    );
    if (focusedView)
      part.controls
        .querySelector(`[data-metric-view="${focusedView}"]`)
        ?.focus({ preventScroll: true });
    const summaries = details(
      metrics.map((metric) => {
        if (!metric.available) return [metric.label, '—'];
        if (metric.unit === 'bytes')
          return [metric.label, formatBytes(metric.value, state.language)];
        const suffix = { percent: ' %', milliseconds: ' ms' }[metric.unit] || '';
        return [metric.label, `${number(metric.value)}${suffix}`];
      }),
    );
    for (const [index, label] of [...summaries.querySelectorAll('dt')].entries()) {
      const dot = node('span', '', 'admin-demo-series-dot');
      dot.style.background = colors[index];
      dot.setAttribute('aria-hidden', 'true');
      label.prepend(dot);
    }
    part.chartHost.replaceChildren(
      summaries,
      available
        ? chart(metrics, t(`metricView.${view.id}`), {
            bar: view.chart === 'bar',
            fixedMax: view.unit === 'percent' ? 100 : undefined,
          })
        : node('p', t(`metricStatus.unavailable`), 'admin-demo-unavailable'),
    );
    part.info.hidden = !available;
    part.infoTitle.textContent = t(`${service}Details`);
    part.infoBody.replaceChildren(
      details(
        service === 'database'
          ? [
              [t('databaseVersion'), data.database.version],
              [t('connectionSecurity'), t('tlsEnabled')],
              [t('storedReports'), number(data.publication.reports, 0)],
              [t('storedRows'), number(data.publication.rows, 0)],
              [t('endpoint'), `${data.database.host}:${data.database.port}`],
            ]
          : [
              [t('storageContainer'), data.publication.storage.container],
              [t('storageTier'), data.publication.storage.tier],
              [t('blobModified'), date(data.publication.generatedAt)],
              [t('storageEncryption'), t('encryptionEnabled')],
              [t('storageEndpoint'), data.publication.storage.endpoint],
            ],
      ),
    );
  }

  function render(language) {
    state.language = language;
    banner.textContent = d('demo');
    options(
      scenario,
      ['healthy', 'newer', 'unavailable', 'collecting'].map((value) => [value, d(value)]),
      state.scenario,
      d('scenario'),
    );
    eyebrow.textContent = t('eyebrow');
    title.textContent = t('title');
    description.textContent = t('description');
    const refreshIcon = icon('refresh');
    refreshIcon.classList.toggle('admin-demo-spin', state.loading);
    refresh.replaceChildren(refreshIcon, node('span', d(state.loading ? 'refreshing' : 'refresh')));
    refresh.disabled = state.loading;
    refresh.setAttribute('aria-busy', String(state.loading));
    checked.textContent = `${t('checkedAt')}: ${date(state.checkedAt)} UTC`;
    updateNotice();
    activityTitle.textContent = t('activityTitle');
    updatePeriod(period);
    metrics.replaceChildren(...metricsInPeriod(data.metrics).map(metricCard));
    metricsSummary.textContent = t('metricsSource');
    metricsHelp.textContent = `${d('fixedData')} ${d('periodEnd')} ${date(data.checkedAt)} UTC.`;
    for (const part of [functionCard, schedule, inventory, tagsCard, ...Object.values(services)])
      labelCard(part);
    functionCard.badge.hidden = false;
    functionCard.badge.textContent = t('running');
    functionCard.body.replaceChildren(
      node('p', data.function.name, 'admin-demo-resource-name'),
      details([
        [t('region'), data.function.location],
        [t('runtime'), data.function.runtime],
        [t('memoryLimit'), `${data.function.memoryMB} MiB`],
        [t('instances'), data.function.maximumInstances],
        [t('endpoint'), data.function.hostName],
      ]),
      node('p', d('portal'), 'admin-demo-help'),
    );
    const source = data.publication;
    const newer = state.scenario === 'newer';
    const publishedAt = newer
      ? new Date(Date.parse(source.generatedAt) + 3600000).toISOString()
      : source.generatedAt;
    const publishedEtag = newer ? '"demo-snapshot-v2"' : source.etag;
    const sync = inventorySyncState(source.generatedAt, serviceAvailable() ? publishedAt : null, {
      importedEtag: source.etag,
      publishedEtag: serviceAvailable() ? publishedEtag : null,
    });
    const syncBox = node('div', '', `admin-demo-sync admin-demo-sync-${sync}`);
    syncBox.dataset.inventorySync = sync;
    syncBox.setAttribute('role', 'status');
    const syncText = node('div');
    syncText.append(node('strong', t(`sync.${sync}`)), node('p', t(`sync.${sync}Help`)));
    syncBox.append(icon(sync === 'synced' ? 'check' : 'layers'), syncText);
    if (newer) syncBox.append(button(t('openInventory'), onInventory));
    const counts = details([
      [t('generatedAt'), date(source.generatedAt)],
      [t('publishedAt'), serviceAvailable() ? date(publishedAt) : '—'],
      [t('resources'), serviceAvailable() ? number(source.resources, 0) : '—'],
      [t('views'), number(source.reports, 0)],
      [t('errors'), '0'],
    ]);
    const operation = node('p', '', 'admin-demo-operation');
    operation.append(
      node('span', `${t('operation')}: `),
      node(
        'span',
        t(`operation.${state.scenario === 'collecting' ? 'running' : 'succeeded'}`),
        'tag',
      ),
    );
    inventory.body.replaceChildren(syncBox, counts, operation);
    renderSchedule();
    renderTags();
    renderService('database');
    renderService('storage');
  }
  return { render };
}
