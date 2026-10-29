/**
 * Open Trivia DB client for Quiz Arena.
 * Uses robust local category and question banks for instant, 100% reliable local play
 * without CORS or rate-limit issues from external APIs.
 */

import {
  DIFFICULTIES,
  STORAGE_KEYS,
} from '../constants.js';

/** @typedef {{ id: number, name: string }} Category */
/** @typedef {'easy'|'medium'|'hard'} Difficulty */
/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} text
 * @property {string[]} options
 * @property {number} correctIndex
 * @property {string} category
 * @property {Difficulty} difficulty
 */

const FALLBACK_CATEGORIES = [
  { id: 9, name: 'General Knowledge' },
  { id: 10, name: 'Entertainment: Books' },
  { id: 11, name: 'Entertainment: Film' },
  { id: 12, name: 'Entertainment: Music' },
  { id: 14, name: 'Entertainment: Television' },
  { id: 15, name: 'Entertainment: Video Games' },
  { id: 17, name: 'Science & Nature' },
  { id: 18, name: 'Science: Computers' },
  { id: 19, name: 'Science: Mathematics' },
  { id: 21, name: 'Sports' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 24, name: 'Politics' },
  { id: 25, name: 'Art' },
  { id: 27, name: 'Animals' },
  { id: 28, name: 'Vehicles' }
];

const FALLBACK_QUESTION_BANK = {
  easy: [
    { category: 'General Knowledge', difficulty: 'easy', question: 'What is the capital of France?', correct_answer: 'Paris', incorrect_answers: ['London', 'Berlin', 'Madrid'] },
    { category: 'General Knowledge', difficulty: 'easy', question: 'Which planet is known as the Red Planet?', correct_answer: 'Mars', incorrect_answers: ['Venus', 'Jupiter', 'Saturn'] },
    { category: 'General Knowledge', difficulty: 'easy', question: 'How many colors are in a rainbow?', correct_answer: '7', incorrect_answers: ['5', '6', '8'] },
    { category: 'Geography', difficulty: 'easy', question: 'What is the largest ocean on Earth?', correct_answer: 'Pacific Ocean', incorrect_answers: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'] },
    { category: 'Science & Nature', difficulty: 'easy', question: 'What gas do plants absorb from the atmosphere?', correct_answer: 'Carbon Dioxide', incorrect_answers: ['Oxygen', 'Nitrogen', 'Hydrogen'] },
    { category: 'Entertainment: Film', difficulty: 'easy', question: 'In the movie Finding Nemo, what kind of fish is Nemo?', correct_answer: 'Clownfish', incorrect_answers: ['Blue Tang', 'Goldfish', 'Shark'] },
    { category: 'History', difficulty: 'easy', question: 'Who was the first President of the United States?', correct_answer: 'George Washington', incorrect_answers: ['Abraham Lincoln', 'Thomas Jefferson', 'John Adams'] },
    { category: 'Sports', difficulty: 'easy', question: 'How many players are on a standard soccer team on the field?', correct_answer: '11', incorrect_answers: ['9', '10', '12'] },
    { category: 'Entertainment: Video Games', difficulty: 'easy', question: 'What plumber is the mascot of Nintendo?', correct_answer: 'Mario', incorrect_answers: ['Luigi', 'Sonic', 'Link'] },
    { category: 'Animals', difficulty: 'easy', question: 'What is the fastest land animal in the world?', correct_answer: 'Cheetah', incorrect_answers: ['Lion', 'Pronghorn', 'Leopard'] },
    { category: 'Geography', difficulty: 'easy', question: 'Which country is known as the Land of the Rising Sun?', correct_answer: 'Japan', incorrect_answers: ['China', 'South Korea', 'Thailand'] },
    { category: 'Science & Nature', difficulty: 'easy', question: 'At what temperature does water freeze in Celsius?', correct_answer: '0 degrees', incorrect_answers: ['32 degrees', '100 degrees', '-10 degrees'] },
    { category: 'Entertainment: Music', difficulty: 'easy', question: 'Which pop star is known as the "King of Pop"?', correct_answer: 'Michael Jackson', incorrect_answers: ['Elvis Presley', 'Prince', 'Justin Timberlake'] },
    { category: 'Entertainment: Books', difficulty: 'easy', question: 'Who wrote the Harry Potter series?', correct_answer: 'J.K. Rowling', incorrect_answers: ['J.R.R. Tolkien', 'George R.R. Martin', 'Stephen King'] },
    { category: 'General Knowledge', difficulty: 'easy', question: 'How many days are in a leap year?', correct_answer: '366', incorrect_answers: ['365', '364', '367'] },
    { category: 'Geography', difficulty: 'easy', question: 'What is the capital of Italy?', correct_answer: 'Rome', incorrect_answers: ['Milan', 'Venice', 'Florence'] },
    { category: 'Animals', difficulty: 'easy', question: 'What is the largest mammal in the world?', correct_answer: 'Blue Whale', incorrect_answers: ['African Elephant', 'Giraffe', 'Colossal Squid'] },
    { category: 'Entertainment: Film', difficulty: 'easy', question: 'Which animated movie features a snowman named Olaf who wants to experience summer?', correct_answer: 'Frozen', incorrect_answers: ['Moana', 'Tangled', 'Shrek'] },
    { category: 'Science & Nature', difficulty: 'easy', question: 'What is the center of our solar system?', correct_answer: 'The Sun', incorrect_answers: ['The Earth', 'Jupiter', 'The Moon'] },
    { category: 'General Knowledge', difficulty: 'easy', question: 'How many letters are in the English alphabet?', correct_answer: '26', incorrect_answers: ['24', '25', '27'] }
  ],
  medium: [
    { category: 'General Knowledge', difficulty: 'medium', question: 'What is the chemical symbol for gold?', correct_answer: 'Au', incorrect_answers: ['Ag', 'Fe', 'Cu'] },
    { category: 'Science: Computers', difficulty: 'medium', question: 'What does CPU stand for?', correct_answer: 'Central Processing Unit', incorrect_answers: ['Computer Personal Unit', 'Central Process Utility', 'Central Processor Unit'] },
    { category: 'History', difficulty: 'medium', question: 'In what year did the Titanic sink?', correct_answer: '1912', incorrect_answers: ['1905', '1915', '1923'] },
    { category: 'Geography', difficulty: 'medium', question: 'Which country has the most natural lakes?', correct_answer: 'Canada', incorrect_answers: ['USA', 'Russia', 'Australia'] },
    { category: 'Entertainment: Books', difficulty: 'medium', question: 'Who wrote the novel "1984"?', correct_answer: 'George Orwell', incorrect_answers: ['Aldous Huxley', 'Ray Bradbury', 'J.R.R. Tolkien'] },
    { category: 'Entertainment: Music', difficulty: 'medium', question: 'Which band released the album "Abbey Road"?', correct_answer: 'The Beatles', incorrect_answers: ['The Rolling Stones', 'Led Zeppelin', 'Pink Floyd'] },
    { category: 'Science & Nature', difficulty: 'medium', question: 'What is the hardest natural substance on Earth?', correct_answer: 'Diamond', incorrect_answers: ['Gold', 'Iron', 'Platinum'] },
    { category: 'Entertainment: Film', difficulty: 'medium', question: 'Which director helmed the movie "Jurassic Park" (1993)?', correct_answer: 'Steven Spielberg', incorrect_answers: ['George Lucas', 'James Cameron', 'Ridley Scott'] },
    { category: 'Sports', difficulty: 'medium', question: 'How many gold medals did Michael Phelps win at the 2008 Beijing Olympics?', correct_answer: '8', incorrect_answers: ['6', '7', '5'] },
    { category: 'General Knowledge', difficulty: 'medium', question: 'What currency is used in Japan?', correct_answer: 'Yen', incorrect_answers: ['Yuan', 'Won', 'Ringgit'] },
    { category: 'Science & Nature', difficulty: 'medium', question: 'What is the chemical symbol for iron?', correct_answer: 'Fe', incorrect_answers: ['Ir', 'In', 'I'] },
    { category: 'History', difficulty: 'medium', question: 'Who was the second President of the United States?', correct_answer: 'John Adams', incorrect_answers: ['Thomas Jefferson', 'James Madison', 'Benjamin Franklin'] },
    { category: 'Geography', difficulty: 'medium', question: 'What is the capital of New Zealand?', correct_answer: 'Wellington', incorrect_answers: ['Auckland', 'Christchurch', 'Hamilton'] },
    { category: 'Entertainment: Television', difficulty: 'medium', question: 'In the TV show "Friends", what is the name of Ross and Monica\'s dog when they were kids?', correct_answer: 'Chi-Chi', incorrect_answers: ['Rover', 'Spot', 'Buster'] },
    { category: 'Science: Computers', difficulty: 'medium', question: 'What does HTML stand for?', correct_answer: 'HyperText Markup Language', incorrect_answers: ['Hyperlink and Text Markup Language', 'Home Tool Markup Language', 'HyperText Machine Language'] },
    { category: 'General Knowledge', difficulty: 'medium', question: 'Which artist painted the "Mona Lisa"?', correct_answer: 'Leonardo da Vinci', incorrect_answers: ['Michelangelo', 'Raphael', 'Donatello'] },
    { category: 'Science & Nature', difficulty: 'medium', question: 'What planet in our solar system has the most moons?', correct_answer: 'Saturn', incorrect_answers: ['Jupiter', 'Uranus', 'Neptune'] },
    { category: 'History', difficulty: 'medium', question: 'The Berlin Wall fell in which year?', correct_answer: '1989', incorrect_answers: ['1987', '1991', '1985'] },
    { category: 'Entertainment: Video Games', difficulty: 'medium', question: 'In the game Minecraft, what material is required to mine obsidian?', correct_answer: 'Diamond pickaxe', incorrect_answers: ['Iron pickaxe', 'Stone pickaxe', 'Gold pickaxe'] },
    { category: 'Geography', difficulty: 'medium', question: 'Which desert is the largest hot desert in the world?', correct_answer: 'Sahara Desert', incorrect_answers: ['Gobi Desert', 'Kalahari Desert', 'Atacama Desert'] }
  ],
  hard: [
    { category: 'Science: Mathematics', difficulty: 'hard', question: 'What is the value of pi to two decimal places?', correct_answer: '3.14', incorrect_answers: ['3.12', '3.16', '3.18'] },
    { category: 'History', difficulty: 'hard', question: 'During which war did the Battle of Gettysburg take place?', correct_answer: 'American Civil War', incorrect_answers: ['World War I', 'Revolutionary War', 'War of 1812'] },
    { category: 'Geography', difficulty: 'hard', question: 'What is the capital of Australia?', correct_answer: 'Canberra', incorrect_answers: ['Sydney', 'Melbourne', 'Brisbane'] },
    { category: 'Science & Nature', difficulty: 'hard', question: 'What is the powerhouse of the cell?', correct_answer: 'Mitochondria', incorrect_answers: ['Nucleus', 'Ribosome', 'Endoplasmic Reticulum'] },
    { category: 'Entertainment: Film', difficulty: 'hard', question: 'Which 1941 film is widely considered one of the greatest movies ever made?', correct_answer: 'Citizen Kane', incorrect_answers: ['Casablanca', 'The Maltese Falcon', 'Gone with the Wind'] },
    { category: 'General Knowledge', difficulty: 'hard', question: 'What is the rarest blood type in humans?', correct_answer: 'AB negative', incorrect_answers: ['O negative', 'B negative', 'A negative'] },
    { category: 'Science: Computers', difficulty: 'hard', question: 'In what year was JavaScript created?', correct_answer: '1995', incorrect_answers: ['1991', '1998', '2000'] },
    { category: 'Art', difficulty: 'hard', question: 'Who painted "The Persistence of Memory" featuring melting clocks?', correct_answer: 'Salvador Dalí', incorrect_answers: ['Pablo Picasso', 'Claude Monet', 'Vincent van Gogh'] },
    { category: 'Entertainment: Books', difficulty: 'hard', question: 'In Greek mythology, who was the mother of Persephone?', correct_answer: 'Demeter', incorrect_answers: ['Hera', 'Athena', 'Aphrodite'] },
    { category: 'Sports', difficulty: 'hard', question: 'Which country won the first ever FIFA World Cup in 1930?', correct_answer: 'Uruguay', incorrect_answers: ['Argentina', 'Brazil', 'Italy'] },
    { category: 'Science & Nature', difficulty: 'hard', question: 'What is the half-life of Carbon-14 approximately?', correct_answer: '5,730 years', incorrect_answers: ['1,000 years', '10,500 years', '50,000 years'] },
    { category: 'History', difficulty: 'hard', question: 'Who was the last Emperor of Russia?', correct_answer: 'Nicholas II', incorrect_answers: ['Alexander III', 'Peter the Great', 'Ivan the Terrible'] },
    { category: 'Geography', difficulty: 'hard', question: 'What is the deepest oceanic trench in the world?', correct_answer: 'Mariana Trench', incorrect_answers: ['Puerto Rico Trench', 'Java Trench', 'Philippine Trench'] },
    { category: 'Science: Mathematics', difficulty: 'hard', question: 'Who is credited with inventing calculus independently of Isaac Newton?', correct_answer: 'Gottfried Wilhelm Leibniz', incorrect_answers: ['René Descartes', 'Leonhard Euler', 'Carl Friedrich Gauss'] },
    { category: 'General Knowledge', difficulty: 'hard', question: 'What is the national animal of Scotland?', correct_answer: 'Unicorn', incorrect_answers: ['Red Deer', 'Golden Eagle', 'Highland Cow'] },
    { category: 'Science & Nature', difficulty: 'hard', question: 'What element has the highest melting point of all pure elements?', correct_answer: 'Tungsten', incorrect_answers: ['Carbon', 'Platinum', 'Titanium'] },
    { category: 'History', difficulty: 'hard', question: 'The Magna Carta was signed in which year?', correct_answer: '1215', incorrect_answers: ['1066', '1492', '1314'] },
    { category: 'Art', difficulty: 'hard', question: 'Which Renaissance artist sculpted the famous statue of David?', correct_answer: 'Michelangelo', incorrect_answers: ['Donatello', 'Leonardo da Vinci', 'Raphael'] },
    { category: 'Entertainment: Music', difficulty: 'hard', question: 'Who composed the famous "Goldberg Variations"?', correct_answer: 'Johann Sebastian Bach', incorrect_answers: ['Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Frédéric Chopin'] },
    { category: 'Science: Computers', difficulty: 'hard', question: 'What was the first computer virus created in 1971 called?', correct_answer: 'Creeper', incorrect_answers: ['ILOVEYOU', 'Morris', 'Melissa'] }
  ]
};

export class TriviaApiError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage);
    this.name = 'TriviaApiError';
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function shuffle(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function normalizeQuestion(raw, index = 0) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = /** @type {Record<string, unknown>} */ (raw);

  if (
    typeof item.question !== 'string' ||
    typeof item.correct_answer !== 'string' ||
    typeof item.category !== 'string' ||
    typeof item.difficulty !== 'string' ||
    !Array.isArray(item.incorrect_answers) ||
    item.incorrect_answers.length !== 3 ||
    !item.incorrect_answers.every((answer) => typeof answer === 'string') ||
    !DIFFICULTIES.includes(/** @type {any} */ (item.difficulty))
  ) {
    return null;
  }

  const options = [
    ...item.incorrect_answers,
    item.correct_answer,
  ];

  const correctOriginalIndex = 3;
  const shuffledOptions = options.map((text, originalIndex) => ({
    text,
    originalIndex,
  }));

  for (let current = shuffledOptions.length - 1; current > 0; current -= 1) {
    const swapIndex = Math.floor(Math.random() * (current + 1));
    [shuffledOptions[current], shuffledOptions[swapIndex]] = [
      shuffledOptions[swapIndex],
      shuffledOptions[current],
    ];
  }

  const correctIndex = shuffledOptions.findIndex(
    (option) => option.originalIndex === correctOriginalIndex,
  );

  if (correctIndex < 0) {
    return null;
  }

  return {
    id: `q${index + 1}`,
    text: item.question,
    options: shuffledOptions.map((option) => option.text),
    correctIndex,
    category: item.category,
    difficulty: /** @type {Difficulty} */ (item.difficulty),
  };
}

/**
 * Returns categories instantly and reliably.
 */
export async function fetchCategories() {
  return FALLBACK_CATEGORIES.map((category) => ({ ...category }));
}

/**
 * Returns questions instantly and reliably from the local question bank.
 */
export async function fetchQuestions({
  categoryId = 0,
  difficulty,
  amount = 10,
} = {}) {
  const validDifficulty = DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';
  const normalizedAmount = Number.isFinite(amount)
    ? Math.min(50, Math.max(1, Math.trunc(amount)))
    : 10;

  let bank = FALLBACK_QUESTION_BANK[validDifficulty] || FALLBACK_QUESTION_BANK.medium;

  if (categoryId && categoryId > 0) {
    const matchedCategory = FALLBACK_CATEGORIES.find(c => c.id === categoryId);
    if (matchedCategory) {
      const filtered = bank.filter(q => q.category.toLowerCase() === matchedCategory.name.toLowerCase());
      if (filtered.length >= 3) {
        bank = filtered;
      }
    }
  }

  const shuffledBank = [...bank].sort(() => Math.random() - 0.5);
  let items = [...shuffledBank];
  while (items.length < normalizedAmount) {
    items = items.concat(shuffledBank);
  }
  items = items.slice(0, normalizedAmount);

  const questions = items.map((item, index) => normalizeQuestion(item, index)).filter((q) => q !== null);

  if (questions.length === 0) {
    throw new TriviaApiError('NO_RESULTS', 'Not enough questions for that mix.');
  }

  return questions;
}

export async function resetSessionToken() {
  // No-op for local mode
}
