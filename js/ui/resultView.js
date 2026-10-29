/**
 * Displays quiz results, save status, and booster information.
 */

import { EVENTS } from '../constants.js';
import { byId, formatDuration, formatNumber, capitalize } from '../dom.js';
import { renderReview } from './reviewView.js';

/** @param {{ bus: EventBus }} deps */
function initResultView({ bus }) {
  const playAgainButton = byId('play-again-button');
  const leaderboardButton = byId('view-leaderboard-button');
  const highscoreBadge = byId('result-highscore-badge');
  const saveStatus = byId('result-save-status');

  let animationFrameId = null;

  /**
   * Animates the score from zero to its final value.
   * Reduced-motion preferences and missing elements skip animation.
   * @param {number} finalScore
   */
  function animateScore(finalScore) {
    const scoreElement = byId('result-score');
    if (!scoreElement) return;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    const score = Math.max(0, Number(finalScore) || 0);
    scoreElement.textContent = formatNumber(score);

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return;
    }

    const duration = 650;
    const startTime = performance.now();

    scoreElement.textContent = '0';

    function updateScore(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;
      const currentScore = Math.round(score * easedProgress);

      scoreElement.textContent = formatNumber(currentScore);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateScore);
      } else {
        animationFrameId = null;
      }
    }

    animationFrameId = requestAnimationFrame(updateScore);
  }

  /**
   * Updates the result screen from the completed quiz.
   * @param {{ result: QuizResult }} payload
   */
  function handleQuizFinished({ result } = {}) {
    if (!result || !Array.isArray(result.answers)) return;

    const accuracy = Math.max(
      0,
      Math.min(1, Number(result.accuracy) || 0)
    );

    const headline =
      accuracy === 1
        ? 'Perfect run'
        : accuracy >= 0.8
          ? 'Great run'
          : accuracy >= 0.5
            ? 'Solid effort'
            : 'Good try, go again';

    const headlineElement = byId('result-headline');
    if (headlineElement) headlineElement.textContent = headline;

    const config = result.config || {};
    const categoryName = String(config.categoryName || 'Any category');
    const difficulty = String(config.difficulty || 'medium');

    const subline = byId('result-subline');
    if (subline) {
      subline.textContent = `${categoryName} · ${capitalize(difficulty)}`;
    }

    animateScore(result.score);

    const correctCount = Number(result.correctCount) || 0;
    const total = Number(result.total) || result.answers.length;

    const correctElement = byId('result-correct');
    if (correctElement) {
      correctElement.textContent = `${correctCount} / ${total}`;
    }

    const accuracyElement = byId('result-accuracy');
    if (accuracyElement) {
      accuracyElement.textContent = `${Math.round(accuracy * 100)}%`;
    }

    const streakElement = byId('result-best-streak');
    if (streakElement) {
      streakElement.textContent = formatNumber(result.bestStreak);
    }

    const timeElement = byId('result-time');
    if (timeElement) {
      timeElement.textContent = formatDuration(result.totalTimeMs);
    }

    // --- Boosters Section ---
    const boosterSection = byId('result-booster-section');
    const boosterNetPoints = result.boosterNetPoints || 0;
    const boostersUsed = result.boostersUsed || [];

    if (boosterSection) {
      boosterSection.hidden = false;
      // Display net points
      const boosterNetElement = byId('result-booster-net-points');
      if (boosterNetElement) {
        boosterNetElement.textContent = formatNumber(boosterNetPoints);
      }
      // Display list of used boosters
      const boosterList = byId('result-booster-list');
      if (boosterList) {
        clearChildren(boosterList);
        if (boostersUsed.length > 0) {
          boostersUsed.forEach((b) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${b.boosterId}: +${b.pointsDelta || 0} points`;
            boosterList.append(listItem);
          });
        } else {
          boosterList.textContent = 'No boosters used';
        }
      }
    } else {
      // Create booster section if it doesn't exist
      const resultHero = byId('result-hero');
      if (resultHero) {
        const section = document.createElement('div');
        section.id = 'result-booster-section';
        section.hidden = boostersUsed.length === 0;
        section.className = 'result-booster-section';
        section.innerHTML = `
          <h3 class="result-booster__title">Boosters</h3>
          <p class="result-booster__subtitle" data-status="saving">${boostersUsed.length === 0 ? "You didn't use any boosters this time" : ''}</p>
          <ul class="result-booster__list" id="result-booster-list"></ul>
          <p class="result-booster__net-points">
            Net points: <span id="result-booster-net-points">${formatNumber(boosterNetPoints)}</span>
          </p>
        `;
        resultHero.append(section);
      }
    }

    showPersonalBest(false);
    setSaveStatus('saving');
    renderReview(result.answers);
  }

  /**
   * Sets the score-saving message and matching CSS state.
   * @param {'saving'|'saved'|'local-only'|'failed'} status
   */
  function setSaveStatus(status) {
    if (!saveStatus) return;

    const messages = {
      saving: 'Saving your score…',
      saved: 'Saved to the global leaderboard',
      'local-only': 'Saved on this device',
      failed:
        "Couldn't reach the global leaderboard. Your score is saved on this device."
    };

    const validStatus = Object.hasOwn(messages, status) ? status : 'failed';

    saveStatus.textContent = messages[validStatus];
    saveStatus.dataset.status = validStatus;
  }

  /**
   * Shows or hides the personal-best badge.
   * @param {boolean} isBest
   */
  function showPersonalBest(isBest) {
    if (highscoreBadge) {
      highscoreBadge.hidden = !isBest;
    }
  }

  if (playAgainButton) {
    playAgainButton.addEventListener('click', () => {
      bus.emit(EVENTS.UI_PLAY_AGAIN);
    });
  }

  if (leaderboardButton) {
    leaderboardButton.addEventListener('click', () => {
      bus.emit(EVENTS.UI_VIEW_LEADERBOARD);
    });
  }

  bus.on(EVENTS.QUIZ_FINISHED, handleQuizFinished);

  return { setSaveStatus, showPersonalBest };
}

export { initResultView };
