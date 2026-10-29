import { pageWindow } from './assets/pageWindow.js';
import { pageItems } from './assets/pagination/utils/pageItems.js';
import { sumBy } from './assets/sumBy.js';
import { node, icon, button, selectField, options } from './demo-dom.js';
import { createAdminDemo } from './admin-demo.js';

const messages = {
  en: {
    overview: 'Overview',
    inventory: 'Inventory',
    services: 'Services',
    subscriptions: 'Subscriptions',
    resources: 'All resources',
    view: 'View',
    scope: 'Subscription',
    all: 'All subscriptions',
    title: 'Inventory overview',
    description: 'Explore the repository’s fictional inventory. No Azure connection.',
    demo: 'Interactive demo · fictional data',
    loading: 'Loading demo inventory…',
    failed: 'The demo data could not be loaded. Please try again.',
    retry: 'Try again',
    total: 'Total resources',
    providers: 'Resource providers',
    active: 'Subscriptions with resources',
    coverage: 'Tag coverage',
    selected: 'In the selected view',
    tagged: 'resources with tags',
    byProvider: 'Resources by provider',
    byLocation: 'Resources by location',
    other: 'Other',
    name: 'Name',
    type: 'Type',
    location: 'Location',
    group: 'Resource group',
    state: 'State',
    enabled: 'Enabled',
    disabled: 'Disabled',
    count: 'Resources',
    search: 'Search demo data',
    searchHint: 'Name, ID, subscription or tag…',
    previous: 'Previous page',
    next: 'Next page',
    pageSize: 'Per page',
    page: 'Page',
    pagination: 'Pagination',
    noPages: 'No pages',
    results: 'results',
    of: 'of',
    empty: 'No matching resources.',
    emptyHelp: 'Try another search, view or subscription.',
    clear: 'Clear filters',
    tags: 'Tags',
    withTags: 'With tags',
    withoutTags: 'Without tags',
    unknownTags: 'Unknown tags',
    allTags: 'All resources',
    tagFilter: 'Tag coverage',
    tagCount: 'Tag count',
    unknown: 'Unknown',
    noTags: 'This resource has no tags.',
    details: 'Resource details',
    close: 'Close',
    period: 'Period',
    basis: 'Cost type',
    actual: 'Actual cost (simulated)',
    amortized: 'Amortized cost (simulated)',
    costs: 'Demo costs',
    costsHelp: 'Generated sample amounts linked to demo resources, not Azure billing or prices.',
    totalCost: 'Simulated spend',
    costProviders: 'Providers with costs',
    cost: 'Demo cost',
    byCost: 'Simulated cost by provider',
    bySubscription: 'Share by subscription',
    noCosts: 'No simulated charges in this selection.',
    source: 'Source: repository demo seed',
    users: 'Goliat users',
    usersHelp:
      'Fictional directory. Changes only affect this browser demo; the real product requires administrator access.',
    accounts: 'Accounts',
    administrators: 'Administrators',
    enabledAccounts: 'Enabled accounts',
    directory: 'Example directory',
    tenant: 'Example tenant',
    role: 'Goliat role',
    allRoles: 'All roles',
    administrator: 'Administrator',
    member: 'Member',
    actions: 'Actions',
    you: 'You',
    protected: 'Protected account',
    disabledAccount: 'Disabled account',
    userEnabled: 'Enabled',
    userDisabled: 'Disabled',
    identity: 'Identity',
    usersSearch: 'Search users',
    usersSearchHint: 'Name, email or object ID…',
    usersEmpty: 'No matching users.',
    usersEmptyHelp: 'Try another name or role.',
    grant: 'Make administrator',
    revoke: 'Remove administrator role',
    roleHelp:
      'This changes only the sample Goliat role. It does not modify Microsoft Entra ID or Azure permissions.',
    simulateRole: 'Simulate role change',
    cancel: 'Cancel',
    roleSaved: 'Demo role updated locally. Reload the page to restore the example.',
    roleBlocked: 'This example account cannot be changed.',
    example: 'Illustrative data',
  },
  es: {
    overview: 'Resumen',
    inventory: 'Inventario',
    services: 'Servicios',
    subscriptions: 'Suscripciones',
    resources: 'Todos los recursos',
    view: 'Vista',
    scope: 'Suscripción',
    all: 'Todas las suscripciones',
    title: 'Resumen del inventario',
    description: 'Explora el inventario ficticio del repositorio. Sin conexión a Azure.',
    demo: 'Demo interactiva · datos ficticios',
    loading: 'Cargando inventario de demostración…',
    failed: 'No se han podido cargar los datos de la demo. Vuelve a intentarlo.',
    retry: 'Reintentar',
    total: 'Recursos totales',
    providers: 'Proveedores de recursos',
    active: 'Suscripciones con recursos',
    coverage: 'Cobertura de etiquetas',
    selected: 'En la vista seleccionada',
    tagged: 'recursos con etiquetas',
    byProvider: 'Recursos por proveedor',
    byLocation: 'Recursos por ubicación',
    other: 'Otros',
    name: 'Nombre',
    type: 'Tipo',
    location: 'Ubicación',
    group: 'Grupo de recursos',
    state: 'Estado',
    enabled: 'Habilitada',
    disabled: 'Deshabilitada',
    count: 'Recursos',
    search: 'Buscar en la demo',
    searchHint: 'Nombre, ID, suscripción o etiqueta…',
    previous: 'Página anterior',
    next: 'Página siguiente',
    pageSize: 'Por página',
    page: 'Página',
    pagination: 'Paginación',
    noPages: 'Sin páginas',
    results: 'resultados',
    of: 'de',
    empty: 'No hay recursos que coincidan.',
    emptyHelp: 'Prueba otra búsqueda, vista o suscripción.',
    clear: 'Limpiar filtros',
    tags: 'Etiquetas',
    withTags: 'Con etiquetas',
    withoutTags: 'Sin etiquetas',
    unknownTags: 'Etiquetas desconocidas',
    allTags: 'Todos los recursos',
    tagFilter: 'Cobertura de etiquetas',
    tagCount: 'Número de etiquetas',
    unknown: 'Desconocido',
    noTags: 'Este recurso no tiene etiquetas.',
    details: 'Detalle del recurso',
    close: 'Cerrar',
    period: 'Período',
    basis: 'Tipo de coste',
    actual: 'Coste real (simulado)',
    amortized: 'Coste amortizado (simulado)',
    costs: 'Costes de demostración',
    costsHelp:
      'Importes ficticios vinculados a los recursos de la demo; no son facturas ni precios de Azure.',
    totalCost: 'Gasto simulado',
    costProviders: 'Proveedores con costes',
    cost: 'Coste ficticio',
    byCost: 'Coste simulado por proveedor',
    bySubscription: 'Distribución por suscripción',
    noCosts: 'No hay cargos simulados en esta selección.',
    source: 'Origen: semilla de demostración del repositorio',
    users: 'Usuarios de Goliat',
    usersHelp:
      'Directorio ficticio. Los cambios solo afectan a esta demo; el producto real requiere acceso de administrador.',
    accounts: 'Cuentas',
    administrators: 'Administradores',
    enabledAccounts: 'Cuentas habilitadas',
    directory: 'Directorio de ejemplo',
    tenant: 'Tenant de ejemplo',
    role: 'Rol en Goliat',
    allRoles: 'Todos los roles',
    administrator: 'Administrador',
    member: 'Miembro',
    actions: 'Acciones',
    you: 'Tú',
    protected: 'Cuenta protegida',
    disabledAccount: 'Cuenta deshabilitada',
    userEnabled: 'Habilitada',
    userDisabled: 'Deshabilitada',
    identity: 'Identidad',
    usersSearch: 'Buscar usuarios',
    usersSearchHint: 'Nombre, correo o ID de objeto…',
    usersEmpty: 'No hay usuarios que coincidan.',
    usersEmptyHelp: 'Prueba otro nombre o rol.',
    grant: 'Hacer administrador',
    revoke: 'Retirar rol de administrador',
    roleHelp:
      'Solo cambia el rol de Goliat del ejemplo. No modifica Microsoft Entra ID ni los permisos de Azure.',
    simulateRole: 'Simular cambio de rol',
    cancel: 'Cancelar',
    roleSaved:
      'Rol de demostración actualizado localmente. Recarga la página para restaurar el ejemplo.',
    roleBlocked: 'No se puede modificar esta cuenta de ejemplo.',
    example: 'Datos ilustrativos',
  },
};
const icons = {
  overview: 'grid',
  subscriptions: 'layers',
  resources: 'box',
  compute: 'server',
  containers: 'box',
  web: 'code',
  network: 'network',
  databases: 'database',
  security: 'shield',
  tags: 'tag',
};
const colors = ['#0078d4', '#16324f', '#50b4f2', '#7b96c7'];
const months = ['2026-10', '2026-09', '2026-08'];

function tagsText(resource) {
  return JSON.stringify(resource.tags);
}

export function createDemo(root) {
  const state = {
    data: null,
    language: document.documentElement.lang,
    view: 'overview',
    scope: '',
    query: '',
    page: 0,
    pageSize: 5,
    tagFilter: '',
    tab: 'inventory',
    month: months[0],
    basis: 'actual',
    failed: false,
    role: 'all',
    usersNotice: '',
    demoTagKeys: ['environment', 'product', 'cost_center'],
  };
  const ui = { panels: {} };
  const t = (key) => messages[state.language][key];
  const format = (value) => new Intl.NumberFormat(state.language).format(value);
  const money = (cents) =>
    new Intl.NumberFormat(state.language, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(cents / 100);
  const status = node('div', '', 'demo-status');
  status.setAttribute('role', 'status');
  root.querySelector('.app-body').before(status);

  function viewLabel(id) {
    return (
      state.data.categories.find((category) => category.id === id)?.labels[state.language] || t(id)
    );
  }

  function scopeRows() {
    return state.data.resources.filter(
      (resource) => !state.scope || resource.subscriptionId === state.scope,
    );
  }

  function viewRows() {
    const resources = scopeRows();
    const category = state.data.categories.find(({ id }) => id === state.view);
    if (!category) return resources;
    const ids = new Set(category.resourceIds);
    return resources.filter(({ id }) => ids.has(id));
  }

  function matches(value) {
    return value
      .toLocaleLowerCase(state.language)
      .includes(state.query.trim().toLocaleLowerCase(state.language));
  }

  function resourceMatches(resource) {
    const tagged = resource.tags === null ? null : Object.keys(resource.tags).length > 0;
    if (state.view === 'tags' && state.tab === 'inventory') {
      if (state.tagFilter === 'with' && tagged !== true) return false;
      if (state.tagFilter === 'without' && tagged !== false) return false;
      if (state.tagFilter === 'unknown' && tagged !== null) return false;
    }
    return matches(
      [
        resource.name,
        resource.id,
        resource.type,
        resource.subscriptionName,
        resource.resourceGroup,
        resource.location,
        tagsText(resource),
      ].join(' '),
    );
  }

  function chooseView(value) {
    state.view = value;
    state.query = '';
    state.tagFilter = '';
    state.page = 0;
    render();
  }

  function metric(label, value, note, name, accent = false) {
    const item = node('div', '', `metric${accent ? ' accent' : ''}`);
    item.dataset.metric = name;
    const heading = node('div', '', 'metric-label');
    heading.append(node('span', label), icon(name === 'resources' ? 'box' : 'grid'));
    item.append(heading, node('strong', value), node('small', note));
    return item;
  }

  function statistics(rows) {
    const known = rows.every(({ tags }) => tags !== null);
    const tagged = rows.filter(({ tags }) => tags && Object.keys(tags).length).length;
    const coverage = rows.length && known ? `${Math.round((tagged / rows.length) * 100)}%` : '—';
    const grid = node('div', '', 'metrics');
    grid.append(
      metric(t('total'), format(rows.length), t('selected'), 'resources', true),
      metric(
        t('providers'),
        format(new Set(rows.map(({ provider }) => provider)).size),
        'Azure Resource Manager',
        'providers',
      ),
      metric(
        t('active'),
        format(new Set(rows.map(({ subscriptionId }) => subscriptionId)).size),
        t('selected'),
        'subscriptions',
      ),
      metric(t('coverage'), coverage, `${format(tagged)} ${t('tagged')}`, 'coverage'),
    );
    return grid;
  }

  function bars(entries, title, formatter = format) {
    const panel = node('div', '', 'panel');
    panel.append(
      node('h3', title),
      node('p', `${Math.min(5, entries.length)} / ${entries.length}`, 'panel-description'),
    );
    const list = node('div', '', 'bars');
    const maximum = Math.max(0, ...entries.map(([, value]) => value));
    for (const [key, value] of entries.slice(0, 5)) {
      const row = node('div', '', 'bar-row');
      const label = node('span', String(key).replace(/^microsoft\./i, ''));
      label.title = key;
      const track = node('div', '', 'bar-track');
      const fill = node('i');
      fill.style.setProperty('--value', `${maximum ? (value / maximum) * 100 : 0}%`);
      track.append(fill);
      row.append(label, track, node('b', formatter(value)));
      list.append(row);
    }
    if (!entries.length) list.append(node('p', t('empty'), 'panel-description'));
    panel.append(list);
    return panel;
  }

  function distribution(entries, title, formatter = format) {
    const panel = node('div', '', 'panel');
    panel.append(node('h3', title));
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (!total) {
      panel.append(node('p', t('empty'), 'demo-empty'));
      return panel;
    }
    const visible = entries.slice(0, 3);
    if (entries.length > 3)
      visible.push([t('other'), entries.slice(3).reduce((sum, [, value]) => sum + value, 0)]);
    const layout = node('div', '', 'distribution');
    const donut = node('div', '', 'donut');
    donut.setAttribute('aria-hidden', 'true');
    const angle = { value: 0 };
    const segments = visible.map(([, value], index) => {
      const start = angle.value;
      angle.value += (value / total) * 100;
      return `${colors[index]} ${start}% ${angle.value}%`;
    });
    donut.style.background = `conic-gradient(${segments.join(',')})`;
    const center = node('div', '', 'donut-center');
    center.append(node('strong', formatter(total)));
    donut.append(center);
    const legend = node('div', '', 'legend');
    for (const [index, [label, value]] of visible.entries()) {
      const entry = node('div');
      const color = node('i');
      color.style.background = colors[index];
      entry.append(color, node('span', label || t('unknown')), node('b', formatter(value)));
      legend.append(entry);
    }
    layout.append(donut, legend);
    panel.append(layout);
    return panel;
  }

  function tagValue(resource, key) {
    if (resource.tags === null) return t('unknown');
    return String(
      Object.entries(resource.tags).find(([name]) => name.toLowerCase() === key)?.[1] ?? '—',
    );
  }

  function openResource(resource) {
    const dialog = ui.dialog;
    dialog.classList.remove('demo-role-dialog');
    dialog.setAttribute('aria-labelledby', 'demo-resource-title');
    dialog.replaceChildren();
    const heading = node('h2', resource.name);
    heading.id = 'demo-resource-title';
    const close = button(t('close'), () => dialog.close());
    const header = node('div', '', 'demo-detail-heading');
    header.append(heading, close);
    const fields = [
      ['ID', resource.id],
      [t('type'), resource.type],
      [t('scope'), resource.subscriptionName],
      [t('group'), resource.resourceGroup],
      [t('location'), resource.location],
    ];
    const details = node('dl');
    for (const [name, value] of fields) details.append(node('dt', name), node('dd', value || '—'));
    dialog.append(
      header,
      node('p', t('source'), 'panel-description'),
      details,
      node('h3', t('tags')),
    );
    const tags = node('dl');
    for (const [name, value] of Object.entries(resource.tags || {}))
      tags.append(node('dt', name), node('dd', String(value)));
    dialog.append(
      tags.childElementCount
        ? tags
        : node('p', resource.tags === null ? t('unknownTags') : t('noTags')),
    );
    dialog.showModal();
    close.focus();
  }

  function resourceColumns(costs = false) {
    const name = {
      label: t('name'),
      cell: (row) => button(row.name, () => openResource(row), 'demo-resource-name'),
    };
    if (costs)
      return [
        name,
        { label: t('scope'), cell: (row) => row.subscriptionName },
        { label: t('cost'), cell: (row) => money(row.costCents) },
      ];
    if (state.view === 'tags')
      return [
        name,
        {
          label: t('tagCount'),
          cell: (row) => (row.tags === null ? '—' : format(Object.keys(row.tags).length)),
        },
        ...state.demoTagKeys.map((key) => ({
          label: key,
          cell: (row) => tagValue(row, key.toLowerCase()),
        })),
      ];
    return [
      name,
      { label: t('type'), cell: (row) => row.type.split('/').slice(1).join('/') },
      { label: t('location'), cell: (row) => row.location },
      { label: t('scope'), cell: (row) => row.subscriptionName },
    ];
  }

  function clearFilters() {
    state.query = '';
    state.page = 0;
    if (state.tab === 'users') state.role = 'all';
    else {
      state.scope = '';
      state.tagFilter = '';
    }
    render();
  }

  function table(panel, rows, columns) {
    const window = pageWindow(rows.length, state.page, state.pageSize);
    state.page = window.currentPage;
    const element = node('table');
    const head = node('thead');
    const heading = node('tr');
    for (const column of columns) {
      const cell = node('th', column.label);
      cell.scope = 'col';
      heading.append(cell);
    }
    head.append(heading);
    const body = node('tbody');
    for (const row of rows.slice(window.offset, window.end)) {
      const line = node('tr');
      for (const column of columns) {
        const cell = node('td');
        cell.dataset.label = column.label;
        const content = column.cell(row);
        if (content instanceof Node) cell.append(content);
        else cell.textContent = content;
        line.append(cell);
      }
      body.append(line);
    }
    element.append(head, body);
    panel.table.replaceChildren(element);
    panel.table.setAttribute('aria-label', panel.title.textContent);
    if (!rows.length) {
      const empty = node('div', '', 'demo-empty');
      empty.append(
        node('strong', t(state.tab === 'users' ? 'usersEmpty' : 'empty')),
        node('p', t(state.tab === 'users' ? 'usersEmptyHelp' : 'emptyHelp')),
        button(t('clear'), clearFilters),
      );
      panel.table.append(empty);
    }
    panel.result.textContent = `${format(window.start)}–${format(window.end)} ${t('of')} ${format(rows.length)} ${t('results')}`;
    const pages = rows.length ? window.pages : 0;
    panel.pagination.setAttribute('aria-label', `${t('pagination')}: ${panel.title.textContent}`);
    panel.previous.disabled = !pages || state.page === 0;
    panel.next.disabled = !pages || state.page >= pages - 1;
    for (const [control, label] of [
      [panel.previous, t('previous')],
      [panel.next, t('next')],
    ]) {
      control.setAttribute('aria-label', label);
      control.title = label;
    }
    const focusedPage = panel.pageNumbers.contains(document.activeElement)
      ? document.activeElement.dataset.pageNumber
      : null;
    panel.pageNumbers.replaceChildren(
      ...pageItems(pages, state.page).map((item) => {
        if (item.type === 'ellipsis') {
          const ellipsis = node('span', '…', 'demo-page-ellipsis');
          ellipsis.setAttribute('aria-hidden', 'true');
          return ellipsis;
        }
        const control = button(
          format(item.page + 1),
          () => {
            state.page = item.page;
            render();
          },
          'demo-page-button',
        );
        control.dataset.pageNumber = String(item.page + 1);
        control.dataset.context = String(
          item.page !== state.page && item.page !== 0 && item.page !== pages - 1,
        );
        control.setAttribute('aria-label', `${t('page')} ${format(item.page + 1)}`);
        if (item.page === state.page) control.setAttribute('aria-current', 'page');
        return control;
      }),
    );
    if (focusedPage) {
      const target =
        panel.pageNumbers.querySelector(`[data-page-number="${focusedPage}"]`) ||
        panel.pageNumbers.querySelector('[aria-current="page"]');
      target?.focus({ preventScroll: true });
    }
    panel.page.classList.toggle('demo-sr-only', pages > 0);
    panel.page.textContent = pages ? `${t('page')} ${state.page + 1} / ${pages}` : t('noPages');
    options(
      panel.pageSize,
      [5, 10, 20].map((size) => [String(size), String(size)]),
      String(state.pageSize),
      t('pageSize'),
    );
  }

  function updateFields(panel) {
    const views = [
      'overview',
      'subscriptions',
      'resources',
      ...state.data.categories.map(({ id }) => id),
    ];
    options(
      panel.view,
      views.map((id) => [id, viewLabel(id)]),
      state.view,
      t('view'),
    );
    options(
      panel.scope,
      [['', t('all')], ...state.data.subscriptions.map(({ id, name }) => [id, name])],
      state.scope,
      t('scope'),
    );
    panel.searchLabel.textContent = t('search');
    panel.search.placeholder = t('searchHint');
    panel.search.value = state.query;
    panel.search.setAttribute('aria-label', t('search'));
    panel.clear.textContent = t('clear');
    panel.clear.hidden = !state.query && !state.scope && !state.tagFilter;
    options(
      panel.tags,
      [
        ['', t('allTags')],
        ['with', t('withTags')],
        ['without', t('withoutTags')],
        ['unknown', t('unknownTags')],
      ],
      state.tagFilter,
      t('tagFilter'),
    );
    panel.tags.label.hidden = state.view !== 'tags' || state.tab === 'finops';
  }

  function renderInventory() {
    const panel = ui.panels.inventory;
    updateFields(panel);
    const rows = viewRows();
    panel.title.textContent = state.view === 'overview' ? t('title') : viewLabel(state.view);
    panel.description.textContent = t('description');
    panel.summary.replaceChildren(statistics(rows));
    if (state.view === 'overview') {
      const charts = node('div', '', 'charts');
      const counts = rows.map((row) => ({ ...row, resources: 1 }));
      charts.append(
        bars(sumBy(counts, 'provider'), t('byProvider')),
        distribution(sumBy(counts, 'location'), t('byLocation')),
      );
      panel.summary.append(charts);
    }
    if (state.view === 'subscriptions') {
      const subscriptions = state.data.subscriptions.filter(
        (row) =>
          (!state.scope || row.id === state.scope) && matches(`${row.name} ${row.id} ${row.state}`),
      );
      table(panel, subscriptions, [
        {
          label: t('name'),
          cell: (row) =>
            button(
              row.name,
              () => {
                state.scope = row.id;
                chooseView('resources');
              },
              'demo-resource-name',
            ),
        },
        {
          label: t('count'),
          cell: (row) =>
            format(
              state.data.resources.filter(({ subscriptionId }) => subscriptionId === row.id).length,
            ),
        },
        {
          label: t('state'),
          cell: (row) => (row.state === 'Disabled' ? t('disabled') : t('enabled')),
        },
      ]);
    } else table(panel, rows.filter(resourceMatches), resourceColumns());
  }

  function renderFinops() {
    const panel = ui.panels.finops;
    updateFields(panel);
    panel.title.textContent = t('costs');
    panel.description.textContent = t('costsHelp');
    options(
      panel.month,
      months.map((month) => [
        month,
        new Intl.DateTimeFormat(state.language, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${month}-01T00:00:00Z`)),
      ]),
      state.month,
      t('period'),
    );
    options(
      panel.basis,
      [
        ['actual', t('actual')],
        ['amortized', t('amortized')],
      ],
      state.basis,
      t('basis'),
    );
    const factor =
      (1 + months.indexOf(state.month) * 0.1) * (state.basis === 'amortized' ? 0.8 : 1);
    const rows = scopeRows()
      .filter(resourceMatches)
      .map((resource) => ({ ...resource, costCents: Math.round(resource.demoCostCents * factor) }));
    const grid = node('div', '', 'metrics demo-cost-metrics');
    grid.append(
      metric(
        t('totalCost'),
        money(rows.reduce((sum, row) => sum + row.costCents, 0)),
        'EUR · demo',
        'spend',
        true,
      ),
      metric(t('total'), format(rows.length), t('selected'), 'resources'),
      metric(
        t('costProviders'),
        format(new Set(rows.map(({ provider }) => provider)).size),
        t('selected'),
        'providers',
      ),
    );
    const charts = node('div', '', 'charts');
    charts.append(
      bars(sumBy(rows, 'provider', 'costCents'), t('byCost'), money),
      distribution(sumBy(rows, 'subscriptionName', 'costCents'), t('bySubscription'), money),
    );
    panel.summary.replaceChildren(grid, charts);
    table(panel, rows, resourceColumns(true));
  }

  function roleAction(member) {
    if (member.self || member.protectedAdministrator || !member.enabled) {
      return node('span', t(member.enabled ? 'protected' : 'disabledAccount'), 'demo-action-note');
    }
    const action = button(t(member.role === 'administrator' ? 'revoke' : 'grant'), () =>
      openRole(member),
    );
    action.dataset.memberAction = member.objectId;
    return action;
  }

  function openRole(member) {
    if (member.self || member.protectedAdministrator || !member.enabled) {
      state.usersNotice = 'roleBlocked';
      render();
      return;
    }
    const dialog = ui.dialog;
    dialog.classList.add('demo-role-dialog');
    dialog.setAttribute('aria-labelledby', 'demo-role-title');
    const title = node('h2', t(member.role === 'administrator' ? 'revoke' : 'grant'));
    title.id = 'demo-role-title';
    const selected = node('div', '', 'demo-selected-member');
    selected.append(
      node('strong', member.name),
      node('span', member.email),
      node('code', member.objectId),
    );
    const actions = node('div', '', 'demo-controls');
    const confirm = button(
      t('simulateRole'),
      () => {
        member.role = member.role === 'administrator' ? 'member' : 'administrator';
        state.usersNotice = 'roleSaved';
        dialog.close();
        render();
        const target =
          ui.panels.users.table.querySelector(`[data-member-action="${member.objectId}"]`) ||
          ui.panels.users.role.select;
        target.focus({ preventScroll: true });
      },
      'demo-button demo-button-primary',
    );
    confirm.dataset.confirmRole = '';
    actions.append(
      confirm,
      button(t('cancel'), () => dialog.close()),
    );
    dialog.replaceChildren(title, node('p', t('roleHelp')), selected, actions);
    dialog.showModal();
    confirm.focus();
  }

  function memberIdentity(member) {
    const identity = node('div', '', 'demo-member');
    const avatar = node(
      'span',
      member.name
        .split(' ')
        .map((part) => part[0])
        .join(''),
      'demo-member-avatar',
    );
    avatar.setAttribute('aria-hidden', 'true');
    const text = node('div');
    const name = node('strong', member.name);
    if (member.self) name.append(node('span', ` · ${t('you')}`, 'demo-action-note'));
    const details = node('details', '', 'demo-member-identity');
    details.append(node('summary', t('identity')), node('code', member.objectId));
    text.append(name, node('span', member.email, 'demo-member-email'), details);
    identity.append(avatar, text);
    return identity;
  }

  function renderUsers() {
    const panel = ui.panels.users;
    const members = state.members;
    panel.title.textContent = t('users');
    panel.description.textContent = t('usersHelp');
    panel.notice.textContent = state.usersNotice ? t(state.usersNotice) : '';
    panel.notice.hidden = !state.usersNotice;
    panel.notice.classList.toggle('demo-notice-error', state.usersNotice === 'roleBlocked');
    options(
      panel.role,
      [
        ['all', t('allRoles')],
        ['member', t('member')],
        ['administrator', t('administrator')],
      ],
      state.role,
      t('role'),
    );
    panel.searchLabel.textContent = t('usersSearch');
    panel.search.placeholder = t('usersSearchHint');
    panel.search.setAttribute('aria-label', t('usersSearch'));
    panel.search.value = state.query;
    panel.clear.textContent = t('clear');
    panel.clear.hidden = !state.query && state.role === 'all';
    const metrics = node('div', '', 'metrics demo-management-metrics');
    metrics.append(
      metric(t('accounts'), format(members.length), t('directory'), 'accounts', true),
      metric(
        t('administrators'),
        format(members.filter(({ role }) => role === 'administrator').length),
        t('role'),
        'administrators',
      ),
      metric(
        t('enabledAccounts'),
        format(members.filter(({ enabled }) => enabled).length),
        t('example'),
        'enabled',
      ),
    );
    const tenant = node('p', '', 'demo-tenant');
    tenant.append(node('span', `${t('tenant')}: `), node('code', state.data.management.tenantId));
    panel.summary.replaceChildren(metrics, tenant);
    const filtered = members.filter(
      (member) =>
        (state.role === 'all' || member.role === state.role) &&
        matches(`${member.name} ${member.email} ${member.objectId}`),
    );
    table(panel, filtered, [
      { label: t('name'), cell: memberIdentity },
      {
        label: t('role'),
        cell: (member) =>
          node(
            'span',
            t(member.role),
            `tag ${member.role === 'administrator' ? 'demo-role-badge' : ''}`,
          ),
      },
      {
        label: t('state'),
        cell: (member) =>
          node(
            'span',
            t(member.enabled ? 'userEnabled' : 'userDisabled'),
            `tag ${member.enabled ? 'green' : ''}`,
          ),
      },
      { label: t('actions'), cell: roleAction },
    ]);
  }

  function renderAdministration() {
    ui.admin.render(state.language);
  }

  function render() {
    root.querySelector('.app-body').hidden = !state.data;
    status.hidden = Boolean(state.data);
    if (!state.data) {
      status.replaceChildren(node('span', t(state.failed ? 'failed' : 'loading')));
      if (state.failed) status.append(button(t('retry'), load));
      return;
    }
    root.querySelector('.app-demo-label').textContent = t('demo');
    for (const item of ui.navigation) {
      item.label.textContent = viewLabel(item.id);
      const selected = item.id === state.view;
      item.button.classList.toggle('active', selected);
      if (selected) item.button.setAttribute('aria-current', 'page');
      else item.button.removeAttribute('aria-current');
      if (item.count)
        item.count.textContent = format(
          item.id === 'subscriptions' ? state.data.subscriptions.length : scopeRows().length,
        );
    }
    ui.inventoryLabel.textContent = t('inventory');
    ui.servicesLabel.textContent = t('services');
    const renderers = {
      inventory: renderInventory,
      finops: renderFinops,
      users: renderUsers,
      admin: renderAdministration,
    };
    renderers[state.tab]();
  }

  function shell(id) {
    const container = root.querySelector(`#${id}-panel`);
    container.replaceChildren();
    const title = node('h2');
    const description = node('p');
    const heading = node('div', '', 'app-heading');
    const intro = node('div');
    intro.append(title, description);
    heading.append(intro);
    const notice = node('p', '', 'demo-notice');
    notice.setAttribute('role', 'status');
    notice.hidden = true;
    const controls = node('div', '', 'demo-controls');
    const scope = selectField('scope', (value) => {
      state.scope = value;
      state.page = 0;
      render();
    });
    const view = selectField('view', chooseView);
    view.label.classList.add('demo-mobile-view');
    if (id === 'inventory') controls.append(view.label);
    if (id !== 'users') controls.append(scope.label);
    const role = selectField('role', (value) => {
      state.role = value;
      state.page = 0;
      render();
    });
    if (id === 'users') controls.append(role.label);
    const month = selectField('month', (value) => {
      state.month = value;
      state.page = 0;
      render();
    });
    const basis = selectField('basis', (value) => {
      state.basis = value;
      state.page = 0;
      render();
    });
    if (id === 'finops') controls.append(month.label, basis.label);
    const summary = node('div', '', 'demo-summary');
    const resourcePanel = node('div', '', 'panel resource-panel');
    const tools = node('div', '', 'demo-controls');
    const searchField = node('label', '', 'demo-field demo-search');
    const searchLabel = node('span');
    const search = node('input');
    search.type = 'search';
    search.dataset.control = 'search';
    search.addEventListener('input', () => {
      state.query = search.value;
      state.page = 0;
      render();
    });
    searchField.append(searchLabel, search);
    const tags = selectField('tags', (value) => {
      state.tagFilter = value;
      state.page = 0;
      render();
    });
    const clear = button('', clearFilters);
    tools.append(searchField);
    if (id !== 'users') tools.append(tags.label);
    tools.append(clear);
    const table = node('div', '', 'table-scroll');
    if (id === 'users') table.classList.add('demo-user-table');
    table.tabIndex = 0;
    table.setAttribute('role', 'region');
    const pagination = node('nav', '', 'demo-pagination');
    const result = node('span');
    result.dataset.demoResults = '';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    result.setAttribute('aria-atomic', 'true');
    const previous = button(
      '',
      () => {
        state.page -= 1;
        render();
      },
      'demo-page-button',
    );
    const next = button(
      '',
      () => {
        state.page += 1;
        render();
      },
      'demo-page-button',
    );
    previous.dataset.page = 'previous';
    next.dataset.page = 'next';
    previous.append(icon('chevron'));
    next.append(icon('chevron'));
    const navigation = node('div', '', 'demo-page-navigation');
    const actions = node('div', '', 'demo-page-controls');
    const pageNumbers = node('div', '', 'demo-page-numbers');
    actions.append(previous, pageNumbers, next);
    const page = node('span', '', 'demo-page demo-sr-only');
    navigation.append(actions, page);
    const pageSize = selectField('page-size', (value) => {
      state.pageSize = Number(value);
      state.page = 0;
      render();
    });
    pagination.append(result, navigation, pageSize.label);
    resourcePanel.append(tools, table, pagination);
    container.append(heading, notice, controls, summary, resourcePanel);
    return {
      title,
      description,
      notice,
      role,
      scope,
      view,
      month,
      basis,
      summary,
      searchLabel,
      search,
      tags,
      clear,
      table,
      result,
      pagination,
      pageNumbers,
      previous,
      next,
      page,
      pageSize,
    };
  }

  function mount() {
    const sidebar = root.querySelector('.app-sidebar');
    const provider = sidebar.querySelector('.sidebar-provider').cloneNode(true);
    provider.setAttribute('aria-hidden', 'true');
    sidebar.removeAttribute('aria-hidden');
    sidebar.replaceChildren(provider);
    const navigation = node('nav');
    navigation.setAttribute('aria-label', 'Demo inventory / Inventario demo');
    ui.navigation = [];
    ui.inventoryLabel = node('div', '', 'sidebar-caption');
    ui.servicesLabel = node('div', '', 'sidebar-caption');
    for (const id of [
      'overview',
      'subscriptions',
      'resources',
      ...state.data.categories.map((category) => category.id),
    ]) {
      if (id === 'subscriptions') navigation.append(ui.inventoryLabel);
      if (id === 'compute') navigation.append(ui.servicesLabel);
      const item = button('', () => chooseView(id), 'side-item');
      item.dataset.view = id;
      const label = node('span');
      item.append(icon(icons[id]), label);
      const count = ['subscriptions', 'resources'].includes(id)
        ? node('span', '', 'side-count')
        : null;
      if (count) item.append(count);
      ui.navigation.push({ id, button: item, label, count });
      navigation.append(item);
    }
    sidebar.append(navigation);
    ui.panels.inventory = shell('inventory');
    ui.panels.finops = shell('finops');
    state.members = state.data.management.members.map((member) => ({ ...member }));
    ui.panels.users = shell('users');
    ui.admin = createAdminDemo(root.querySelector('#admin-panel'), {
      data: state.data.management.administration,
      onInventory: () => document.getElementById('inventory-tab').click(),
      onTags: (keys) => {
        state.demoTagKeys = keys;
      },
    });
    ui.dialog = node('dialog', '', 'demo-detail');
    ui.dialog.setAttribute('aria-labelledby', 'demo-resource-title');
    root.append(ui.dialog);
    root.dataset.demoReady = 'true';
  }

  async function load() {
    state.failed = false;
    status.setAttribute('role', 'status');
    render();
    try {
      const response = await fetch(new URL('./assets/demo-data.json', import.meta.url));
      if (!response.ok) throw new Error(`Demo data: HTTP ${response.status}`);
      const data = await response.json();
      if (
        data.source !== 'repository-demo-seed' ||
        !Array.isArray(data.resources) ||
        !Array.isArray(data.subscriptions) ||
        !Array.isArray(data.categories) ||
        data.management?.source !== 'synthetic-management-example' ||
        !Array.isArray(data.management.members) ||
        !data.management.administration
      )
        throw new Error('Invalid demo data');
      state.data = data;
      mount();
      render();
    } catch (error) {
      console.error('Goliat demo could not be loaded.', error);
      state.data = null;
      state.failed = true;
      status.setAttribute('role', 'alert');
      render();
    }
  }
  void load();
  return {
    setLanguage(language) {
      state.language = language;
      render();
    },
    setTab(tab) {
      state.tab = tab;
      state.query = '';
      state.page = 0;
      render();
    },
  };
}
