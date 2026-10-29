export function node(tag, text = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function button(text, action, className = 'demo-button') {
  const element = node('button', text, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

export function selectField(key, onChange) {
  const label = node('label', '', 'demo-field');
  const caption = node('span');
  const select = node('select');
  select.dataset.control = key;
  select.addEventListener('change', () => onChange(select.value));
  label.append(caption, select);
  return { label, caption, select };
}

export function options(field, entries, value, label) {
  field.caption.textContent = label;
  field.select.replaceChildren(
    ...entries.map(([id, text]) => {
      const option = node('option', text);
      option.value = id;
      return option;
    }),
  );
  field.select.value = value;
}
