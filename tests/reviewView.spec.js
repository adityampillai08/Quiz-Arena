/**
 * Review View Tests for Quiz Arena.
 * Tests the renderReview() function from reviewView.js.
 */
const { test, expect } = require('@playwright/test');
const { JSDOM } = require('jsdom');

// Set up global JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;

// Minimal DOM mocks for testing renderReview
function setupDOMMocks() {
  const list = document.createElement('div');
  const title = document.createElement('h3');
  const emptyMessage = document.createElement('p');

  list.id = 'review-list';
  title.id = 'review-title';
  emptyMessage.id = 'review-empty';

  list.hidden = true;
  title.hidden = true;
  emptyMessage.hidden = true;

  return { list, title, emptyMessage };
}

let renderReview;
let BOOSTER_DEFINITIONS;

test.beforeAll(async () => {
  // Import the reviewView module
  const reviewViewModule = await import('../js/ui/reviewView.js');
  renderReview = reviewViewModule.renderReview;

  // Import booster definitions
  const boostersModule = await import('../js/core/boosters.js');
  BOOSTER_DEFINITIONS = boostersModule.BOOSTER_DEFINITIONS;
});

test.describe('Review - renderReview', () => {
  test.beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('renders nothing when answers is empty', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    renderReview([]);

    expect(list.hidden).toBe(true);
    expect(title.hidden).toBe(true);
    expect(emptyMessage.hidden).toBe(false);
    expect(emptyMessage.textContent).toBe('No misses. Every answer was right.');
  });

  test('shows misses with answer and correct answer', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'What is the capital of France?',
        options: ['London', 'Paris', 'Berlin', 'Madrid'],
        correctIndex: 1,
      },
      isCorrect: false,
      selectedIndex: 0,
      boosterUsed: undefined,
      timedOut: false,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);
    expect(emptyMessage.hidden).toBe(true);

    // Check that the review item is rendered
    const items = list.querySelectorAll('.review-item');
    expect(items.length).toBe(1);

    // Check question text
    const question = items[0].querySelector('.review-item__question');
    expect(question).toBeTruthy();
    expect(question.textContent).toContain('What is the capital of France?');

    // Check "Your answer" and the selected option
    const yourValue = items[0].querySelector('.review-item__value');
    expect(yourValue.textContent).toBe('London'); // selected index 0 = London
  });

  test('shows time ran out when timedOut is true', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'What is 2 + 2?',
        options: ['2', '3', '4', '5'],
        correctIndex: 0,
      },
      isCorrect: false,
      selectedIndex: null, // No answer selected (time ran out)
      boosterUsed: undefined,
      timedOut: true,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);

    // Check for time ran out meta
    const metaElements = list.querySelectorAll('.review-item__meta');
    expect(metaElements.length).toBe(1);
    expect(metaElements[0].textContent).toBe('Time ran out');
  });

  test('shows Pass booster info', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'Who wrote "1984"?',
        options: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'J.R.R. Tolkien'],
        correctIndex: 0,
      },
      isCorrect: false,
      selectedIndex: 1,
      boosterUsed: 'pass',
      timedOut: false,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);

    // Check booster info text
    const boosterElements = list.querySelectorAll('.review-item__booster');
    expect(boosterElements.length).toBe(1);
    expect(boosterElements[0].textContent).toBe('Skipped with Pass');
  });

  test('shows generic booster info when boosterId exists in definitions', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'Who wrote "Pride and Prejudice"?',
        options: ['Jane Austen', 'Emily Bronte', 'Charlotte Bronte', 'Mary Shelley'],
        correctIndex: 0,
      },
      isCorrect: false,
      selectedIndex: 0,
      boosterUsed: 'eraser',
      timedOut: false,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);

    // Check booster info text - should be "Boost: Eraser"
    const boosterElements = list.querySelectorAll('.review-item__booster');
    expect(boosterElements.length).toBe(1);
    expect(boosterElements[0].textContent).toContain('Boost: Eraser');
  });

  test('shows correct answer when question has correctIndex', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'What is the capital of France?',
        options: ['London', 'Paris', 'Berlin', 'Madrid'],
        correctIndex: 1,
      },
      isCorrect: false,
      selectedIndex: 0,
      boosterUsed: undefined,
      timedOut: false,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);

    // Check correct answer text (second .review-item__value)
    const valueElements = list.querySelectorAll('.review-item__value');
    expect(valueElements.length).toBe(2);
    expect(valueElements[1].textContent).toBe('Paris'); // correctIndex 1 = Paris
  });

  test('handles unknown booster showing Boost: unknown-booster', () => {
    const { list, title, emptyMessage } = setupDOMMocks();
    document.body.appendChild(list);
    document.body.appendChild(title);
    document.body.appendChild(emptyMessage);

    const testAnswer = {
      question: {
        text: 'Question text',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
      },
      isCorrect: false,
      selectedIndex: 1,
      boosterUsed: 'unknown-booster',
      timedOut: false,
    };

    renderReview([testAnswer]);

    expect(list.hidden).toBe(false);
    expect(title.hidden).toBe(false);

    // Check booster info shows "Boost: unknown-booster" for unknown booster
    const boosterElements = list.querySelectorAll('.review-item__booster');
    expect(boosterElements.length).toBe(1);
    expect(boosterElements[0].textContent).toBe('Boost: unknown-booster');
  });
});