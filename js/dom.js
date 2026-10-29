/**
 * Small DOM helpers shared by all views.
 * Owned by the coordinator.
 * Rule for everyone: put text into the page with textContent, never innerHTML.
 */

/** querySelector shortcut. */
export const $ = (selector, root = document) => root.querySelector(selector);

/** querySelectorAll that returns a real array. */
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** getElementById that warns in the console when the id is missing. */
export function byId(id) {
  const node = document.getElementById(id);
  if (!node) console.warn(`Missing element #${id}`);
  return node;
}

/** Set textContent on the element with this id. */
export function setText(id, text) {
  const node = byId(id);
  if (node) node.textContent = String(text);
}

/** Remove every child of a node. */
export function clearChildren(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Create an element without touching innerHTML.
 * @param {string} tag
 * @param {{className?: string, text?: string, attrs?: Record<string,string|boolean>, dataset?: Record<string,string>}} [options]
 * @param {...(Node|string)} children
 */
export function el(tag, options = {}, ...children) {
  const { className, text, attrs = {}, dataset = {} } = options;
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    // Skip boolean attributes when false (e.g., disabled="false" renders as disabled)
    if (value === false) continue;
    // For true boolean attributes, set without value
    if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value;
  node.append(...children);
  return node;
}

/**
 * Show one screen and hide the others. Moves focus to the screen heading
 * so keyboard and screen reader users land in the right place.
 * @param {'start'|'loading'|'quiz'|'result'|'leaderboard'} name
 */
export function showScreen(name) {
  let target = null;
  for (const screen of $$('.screen')) {
    const isTarget = screen.dataset.screen === name;
    screen.hidden = !isTarget;
    if (isTarget) target = screen;
  }
  if (!target) {
    console.warn(`No screen named "${name}"`);
    return;
  }
  document.body.dataset.screen = name;
  const heading = target.querySelector('[id^="heading-"]');
  if (heading) heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

/** Name of the screen that is visible right now. */
export function getCurrentScreen() {
  return document.body.dataset.screen || 'start';
}

/** 84000 -> "1m 24s", 42000 -> "42s" */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** 1240 -> "1,240" */
export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

/** "medium" -> "Medium" */
export function capitalize(text) {
  const value = String(text || '');
  return value.charAt(0).toUpperCase() + value.slice(1);
}
