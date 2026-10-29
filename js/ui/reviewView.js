/**
 * Renders the questions answered incorrectly on the result screen.
 */

import { byId, clearChildren, el } from '../dom.js';
import { BOOSTER_IDS } from '../constants.js';
import { BOOSTER_DEFINITIONS } from '../core/boosters.js';

/**
 * Renders only incorrect answers, including questions that timed out.
 * @param {AnswerRecord[]} answers
 */
export function renderReview(answers) {
  const list = byId('review-list');
  const title = byId('review-title');
  const emptyMessage = byId('review-empty');

  if (!list || !title || !emptyMessage) return;

  const misses = Array.isArray(answers)
    ? answers.filter((answer) => answer && answer.isCorrect === false)
    : [];

  if (misses.length === 0) {
    list.hidden = true;
    title.hidden = true;
    emptyMessage.textContent = 'No misses. Every answer was right.';
    emptyMessage.hidden = false;
    return;
  }

  list.hidden = false;
  title.hidden = false;
  title.textContent = `Review your misses (${misses.length})`;
  emptyMessage.hidden = true;

  for (const record of misses) {
    const question = record.question;
    if (!question) continue;

    const selectedIndex = record.selectedIndex;
    const selectedOption =
      selectedIndex === null ||
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= question.options.length
        ? 'No answer (time ran out)'
        : String(question.options[selectedIndex]);

    const correctOption = Number.isInteger(question.correctIndex)
      ? String(question.options[question.correctIndex] ?? 'Unavailable')
      : 'Unavailable';

    const questionHeading = el('h4', {
      className: 'review-item__question',
      text: String(question.text || '')
    });

    const yourLabel = el('span', {
      className: 'review-item__label',
      text: 'Your answer'
    });

    const yourValue = el('span', {
      className: 'review-item__value',
      text: selectedOption
    });

    const yourAnswer = el(
      'p',
      { className: 'review-item__answer review-item__answer--yours' },
      yourLabel,
      yourValue
    );

    const correctLabel = el('span', {
      className: 'review-item__label',
      text: 'Correct answer'
    });

    const correctValue = el('span', {
      className: 'review-item__value',
      text: correctOption
    });

    const correctAnswer = el(
      'p',
      { className: 'review-item__answer review-item__answer--correct' },
      correctLabel,
      correctValue
    );

    const children = [
      questionHeading,
      yourAnswer,
      correctAnswer
    ];

    // Booster info - use human-readable name from definitions
    const boosterId = record.boosterUsed;
    const boosterInfo = document.createElement('div');
    boosterInfo.className = 'review-item__booster';
    if (boosterId === 'pass') {
      boosterInfo.textContent = 'Skipped with Pass';
    } else if (boosterId) {
      const def = BOOSTER_DEFINITIONS[boosterId];
      boosterInfo.textContent = def ? `Boost: ${def.name}` : `Boost: ${boosterId}`;
    } else {
      boosterInfo.textContent = 'No booster';
    }

    if (record.timedOut) {
      children.push(
        el('p', {
          className: 'review-item__meta',
          text: 'Time ran out'
        })
      );
    }

    children.push(boosterInfo);

    list.append(
      el('article', { className: 'review-item' }, ...children)
    );
  }

  if (list.childElementCount === 0) {
    list.hidden = true;
    title.hidden = true;
    emptyMessage.textContent = 'No misses. Every answer was right.';
    emptyMessage.hidden = false;
  }
}