/**
 * Open Trivia DB client for Quiz Arena.
 * Uses robust local category and question banks for instant, 100% reliable local play
 * without CORS or rate-limit issues from external APIs.
 */

import {
  DIFFICULTIES,
  STORAGE_KEYS,
  QUESTIONS_PER_QUIZ,
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

// Open Trivia DB category mapping
// https://opentdb.com/api_category.php
// Official OTDB category IDs (verified against https://opentdb.com/api_category.php)
const OPEN_TRIVIA_DB_CATEGORIES = {
  9: 9,      // General Knowledge
  10: 10,    // Entertainment: Books
  11: 11,    // Entertainment: Film (was 12 - fixed)
  12: 12,    // Entertainment: Music (was 11 - fixed)
  14: 14,    // Entertainment: Television (was 13 - fixed)
  15: 15,    // Entertainment: Video Games
  17: 17,    // Science & Nature (was 19 - fixed)
  18: 18,    // Science: Computers
  19: 19,    // Science: Mathematics (was 20 - fixed)
  21: 21,    // Sports (was 22 - fixed)
  22: 22,    // Geography (was 21 - fixed)
  23: 23,    // History (was 27 - fixed)
  24: 24,    // Politics (was 25 - fixed)
  25: 25,    // Art (was 2 - fixed)
  27: 27,    // Animals (was 29 - fixed)
  28: 28     // Vehicles
};

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
    { category: 'General Knowledge', difficulty: 'easy', question: 'How many letters are in the English alphabet?', correct_answer: '26', incorrect_answers: ['24', '25', '27'] },
    // Art - Easy
    { category: 'Art', difficulty: 'easy', question: 'What is the primary color of a stop sign?', correct_answer: 'Red', incorrect_answers: ['Blue', 'Green', 'Yellow'] },
    { category: 'Art', difficulty: 'easy', question: 'Which artist is famous for the painting "Starry Night"?', correct_answer: 'Vincent van Gogh', incorrect_answers: ['Pablo Picasso', 'Claude Monet', 'Leonardo da Vinci'] },
    { category: 'Art', difficulty: 'easy', question: 'What is the name of the famous portrait by Leonardo da Vinci?', correct_answer: 'Mona Lisa', incorrect_answers: ['The Scream', 'Girl with a Pearl Earring', 'The Last Supper'] },
    { category: 'Art', difficulty: 'easy', question: 'What art movement is Salvador Dalí associated with?', correct_answer: 'Surrealism', incorrect_answers: ['Impressionism', 'Cubism', 'Realism'] },
    { category: 'Art', difficulty: 'easy', question: 'Which famous sculpture was created by Michelangelo?', correct_answer: 'David', incorrect_answers: ['The Thinker', 'Venus de Milo', 'Statue of Liberty'] },
    // Politics - Easy
    { category: 'Politics', difficulty: 'easy', question: 'What is the name of the building where the US Congress meets?', correct_answer: 'The Capitol', incorrect_answers: ['The White House', 'The Pentagon', 'The Supreme Court'] },
    { category: 'Politics', difficulty: 'easy', question: 'How often are US Presidential elections held?', correct_answer: 'Every 4 years', incorrect_answers: ['Every 2 years', 'Every 6 years', 'Every 8 years'] },
    { category: 'Politics', difficulty: 'easy', question: 'What is the minimum age to be President of the United States?', correct_answer: '35', incorrect_answers: ['30', '40', '45'] },
    { category: 'Politics', difficulty: 'easy', question: 'Which document begins with "We the People"?', correct_answer: 'The US Constitution', incorrect_answers: ['Declaration of Independence', 'Bill of Rights', 'Articles of Confederation'] },
    { category: 'Politics', difficulty: 'easy', question: 'What are the two main political parties in the US?', correct_answer: 'Democratic and Republican', incorrect_answers: ['Liberal and Conservative', 'Labour and Tory', 'Green and Blue'] },
    // Vehicles - Easy
    { category: 'Vehicles', difficulty: 'easy', question: 'What does "MPG" stand for in vehicle specifications?', correct_answer: 'Miles Per Gallon', incorrect_answers: ['Meters Per Gram', 'Maximum Power Generated', 'Motor Performance Grade'] },
    { category: 'Vehicles', difficulty: 'easy', question: 'Which company makes the Model T?', correct_answer: 'Ford', incorrect_answers: ['Chevrolet', 'Toyota', 'Honda'] },
    { category: 'Vehicles', difficulty: 'easy', question: 'How many wheels does a standard car have?', correct_answer: 'Four', incorrect_answers: ['Two', 'Three', 'Six'] },
    { category: 'Vehicles', difficulty: 'easy', question: 'What fuel do most cars run on?', correct_answer: 'Gasoline', incorrect_answers: ['Water', 'Electricity', 'Solar power'] },
    { category: 'Vehicles', difficulty: 'easy', question: 'What do you call a vehicle with two wheels and a motor?', correct_answer: 'Motorcycle', incorrect_answers: ['Bicycle', 'Tricycle', 'Scooter'] },
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
    { category: 'Geography', difficulty: 'medium', question: 'Which desert is the largest hot desert in the world?', correct_answer: 'Sahara Desert', incorrect_answers: ['Gobi Desert', 'Kalahari Desert', 'Atacama Desert'] },
    // Art - Medium
    { category: 'Art', difficulty: 'medium', question: 'Who painted "The Persistence of Memory" featuring melting clocks?', correct_answer: 'Salvador Dalí', incorrect_answers: ['Pablo Picasso', 'Claude Monet', 'Vincent van Gogh'] },
    { category: 'Art', difficulty: 'medium', question: 'Which Renaissance artist sculpted the famous statue of David?', correct_answer: 'Michelangelo', incorrect_answers: ['Donatello', 'Leonardo da Vinci', 'Raphael'] },
    { category: 'Art', difficulty: 'medium', question: 'What technique involves applying pigment to wet plaster?', correct_answer: 'Fresco', incorrect_answers: ['Tempera', 'Oil painting', 'Watercolor'] },
    { category: 'Art', difficulty: 'medium', question: 'Who created the famous pop art piece "Campbell\'s Soup Cans"?', correct_answer: 'Andy Warhol', incorrect_answers: ['Roy Lichtenstein', 'Keith Haring', 'Jean-Michel Basquiat'] },
    { category: 'Art', difficulty: 'medium', question: 'What is the name of the museum in Paris that houses the Mona Lisa?', correct_answer: 'Louvre', incorrect_answers: ['Metropolitan Museum of Art', 'British Museum', 'Uffizi Gallery'] },
    { category: 'Art', difficulty: 'medium', question: 'Which Dutch painter created "The Night Watch"?', correct_answer: 'Rembrandt', incorrect_answers: ['Vermeer', 'Van Gogh', 'Bosch'] },
    // Politics - Medium
    { category: 'Politics', difficulty: 'medium', question: 'What is the name of the upper house of the US Congress?', correct_answer: 'The Senate', incorrect_answers: ['The House of Representatives', 'The Cabinet', 'The Supreme Court'] },
    { category: 'Politics', difficulty: 'medium', question: 'How many Senators does each US state have?', correct_answer: 'Two', incorrect_answers: ['One', 'Three', 'Depends on population'] },
    { category: 'Politics', difficulty: 'medium', question: 'What is a filibuster?', correct_answer: 'A tactic to delay or block a vote by extended debate', incorrect_answers: ['A type of amendment', 'A special election', 'A presidential veto'] },
    { category: 'Politics', difficulty: 'medium', question: 'What does "bipartisan" mean?', correct_answer: 'Supported by both major political parties', incorrect_answers: ['Supported by only one party', 'Opposed by both parties', 'Non-political'] },
    { category: 'Politics', difficulty: 'medium', question: 'Who is the head of state in the United Kingdom?', correct_answer: 'The Monarch', incorrect_answers: ['The Prime Minister', 'The Chancellor', 'The Speaker'] },
    // Vehicles - Medium
    { category: 'Vehicles', difficulty: 'medium', question: 'What does ABS stand for in car safety systems?', correct_answer: 'Anti-lock Braking System', incorrect_answers: ['Automatic Brake System', 'Advanced Braking Standard', 'Auto Balance Stabilizer'] },
    { category: 'Vehicles', difficulty: 'medium', question: 'Which car manufacturer created the Beetle?', correct_answer: 'Volkswagen', incorrect_answers: ['BMW', 'Mercedes-Benz', 'Audi'] },
    { category: 'Vehicles', difficulty: 'medium', question: 'What is a hybrid vehicle?', correct_answer: 'A vehicle with both an engine and electric motor', incorrect_answers: ['A vehicle that runs on water', 'A vehicle with two engines', 'A vehicle that can fly'] },
    { category: 'Vehicles', difficulty: 'medium', question: 'What does RPM measure?', correct_answer: 'Revolutions Per Minute', incorrect_answers: ['Roads Per Mile', 'Radiation Protection Mode', 'Rate Per Minute'] },
    { category: 'Vehicles', difficulty: 'medium', question: 'What is the purpose of a catalytic converter?', correct_answer: 'Reduce harmful emissions', incorrect_answers: ['Increase engine power', 'Improve fuel economy', 'Cool the engine'] },
    // Animals - Medium
    { category: 'Animals', difficulty: 'medium', question: 'What is the only mammal that can fly?', correct_answer: 'Bat', incorrect_answers: ['Flying squirrel', 'Sugar glider', 'Colugo'] },
    { category: 'Animals', difficulty: 'medium', question: 'Which animal has the longest lifespan?', correct_answer: 'Bowhead whale', incorrect_answers: ['Galapagos tortoise', 'Greenland shark', 'African elephant'] },
    { category: 'Animals', difficulty: 'medium', question: 'What is a group of lions called?', correct_answer: 'Pride', incorrect_answers: ['Pack', 'Herd', 'Flock'] },
    // Entertainment: Television - Medium
    { category: 'Entertainment: Television', difficulty: 'medium', question: 'In "Breaking Bad", what is Walter White\'s alias?', correct_answer: 'Heisenberg', incorrect_answers: ['Gustavo', 'Saul', 'Mike'] },
    { category: 'Entertainment: Television', difficulty: 'medium', question: 'What is the name of the coffee shop in "Friends"?', correct_answer: 'Central Perk', incorrect_answers: ['The Daily Grind', 'Java Joe\'s', 'Bean There'] },
    { category: 'Entertainment: Television', difficulty: 'medium', question: 'Which show features a chemistry teacher making meth?', correct_answer: 'Breaking Bad', incorrect_answers: ['The Wire', 'Better Call Saul', 'Ozark'] },
    // Entertainment: Video Games - Medium
    { category: 'Entertainment: Video Games', difficulty: 'medium', question: 'In "The Legend of Zelda", who is the main protagonist?', correct_answer: 'Link', incorrect_answers: ['Zelda', 'Ganon', 'Navi'] },
    { category: 'Entertainment: Video Games', difficulty: 'medium', question: 'What company created the "Halo" series?', correct_answer: 'Bungie', incorrect_answers: ['343 Industries', 'Valve', 'Rockstar Games'] },
    { category: 'Entertainment: Video Games', difficulty: 'medium', question: 'In "Fortnite", what is the primary gameplay mode?', correct_answer: 'Battle Royale', incorrect_answers: ['Capture the Flag', 'Team Deathmatch', 'Free for All'] },
    // Science: Mathematics - Medium
    { category: 'Science: Mathematics', difficulty: 'medium', question: 'What is the square root of 144?', correct_answer: '12', incorrect_answers: ['10', '14', '16'] },
    { category: 'Science: Mathematics', difficulty: 'medium', question: 'What is the value of the mathematical constant e?', correct_answer: 'Approximately 2.718', incorrect_answers: ['3.141', '1.618', '1.414'] },
    { category: 'Science: Mathematics', difficulty: 'medium', question: 'What is the sum of the interior angles of a triangle?', correct_answer: '180 degrees', incorrect_answers: ['90 degrees', '270 degrees', '360 degrees'] },
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
    { category: 'Art', difficulty: 'hard', question: 'What art movement is characterized by small dots of color?', correct_answer: 'Pointillism', incorrect_answers: ['Impressionism', 'Cubism', 'Fauvism'] },
    { category: 'Art', difficulty: 'hard', question: 'Who painted "The Birth of Venus"?', correct_answer: 'Sandro Botticelli', incorrect_answers: ['Leonardo da Vinci', 'Raphael', 'Michelangelo'] },
    { category: 'Art', difficulty: 'hard', question: 'Which artist is known for the "Blue Period"?', correct_answer: 'Pablo Picasso', incorrect_answers: ['Henri Matisse', 'Georges Braque', 'Juan Gris'] },
    { category: 'Art', difficulty: 'hard', question: 'What is the name of the famous ceiling painted by Michelangelo?', correct_answer: 'Sistine Chapel ceiling', incorrect_answers: ['The Last Supper', 'The School of Athens', 'The Birth of Venus'] },
    { category: 'Entertainment: Music', difficulty: 'hard', question: 'Who composed the famous "Goldberg Variations"?', correct_answer: 'Johann Sebastian Bach', incorrect_answers: ['Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Frédéric Chopin'] },
    { category: 'Science: Computers', difficulty: 'hard', question: 'What was the first computer virus created in 1971 called?', correct_answer: 'Creeper', incorrect_answers: ['ILOVEYOU', 'Morris', 'Melissa'] },
    // Politics - Hard
    { category: 'Politics', difficulty: 'hard', question: 'What is the name of the parliamentary system where the executive is drawn from the legislature?', correct_answer: 'Westminster system', incorrect_answers: ['Presidential system', 'Federal system', 'Confederal system'] },
    { category: 'Politics', difficulty: 'hard', question: 'Who wrote "The Prince", a 16th-century political treatise?', correct_answer: 'Niccolò Machiavelli', incorrect_answers: ['Thomas Hobbes', 'John Locke', 'Jean-Jacques Rousseau'] },
    { category: 'Politics', difficulty: 'hard', question: 'What is the term for a government where a small group holds power?', correct_answer: 'Oligarchy', incorrect_answers: ['Democracy', 'Monarchy', 'Anarchy'] },
    // Vehicles - Hard
    { category: 'Vehicles', difficulty: 'hard', question: 'What is the firing order of a typical V8 engine?', correct_answer: '1-8-4-3-6-5-7-2', incorrect_answers: ['1-2-3-4-5-6-7-8', '1-5-4-8-6-3-7-2', '1-3-5-7-2-4-6-8'] },
    { category: 'Vehicles', difficulty: 'hard', question: 'Who invented the first practical automobile?', correct_answer: 'Karl Benz', incorrect_answers: ['Henry Ford', 'Gottlieb Daimler', 'Nikolaus Otto'] },
    { category: 'Vehicles', difficulty: 'hard', question: 'What does DOHC stand for in engine design?', correct_answer: 'Dual Overhead Camshaft', incorrect_answers: ['Double Overhead Cylinder', 'Direct Overhead Cam', 'Dual Output Horsepower Cycle'] },
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
 * Maps a fallback category ID to the equivalent Open Trivia DB category.
 * Falls back to 0 (Any Category) if no mapping exists.
 */
function mapCategoryToOpenTriviaDb(categoryId) {
  if (categoryId === 0 || categoryId === undefined) return 0;
  return OPEN_TRIVIA_DB_CATEGORIES[categoryId] || 0;
}

/**
 * Decodes HTML entities (e.g. ", &, &#039;) to plain text.
 */
function decodeHtmlEntities(text) {
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || div.innerText || text;
}

/**
 * Returns questions instantly and reliably, first attempting Open Trivia DB,
 * then falling back to the local question bank.
 *
 * Priority:
   1. Open Trivia DB API - primary source
   2. Local question bank - reliable fallback
 *
 * The API request includes amount, category (when specific), difficulty,
 * and type=multiple. Network errors and malformed responses trigger fallback.
 */
export async function fetchQuestions({
  categoryId = 0,
  difficulty,
  amount = QUESTIONS_PER_QUIZ,
} = {}) {
  const validDifficulty = DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';
  const normalizedAmount = Number.isFinite(amount)
    ? Math.min(50, Math.max(1, Math.trunc(amount)))
    : QUESTIONS_PER_QUIZ;

  // Build API request parameters
  const params = new URLSearchParams({
    amount: String(normalizedAmount),
    type: 'multiple',
  });

  // Add difficulty if a specific one is set (not implicitly 'medium' as default)
  if (validDifficulty) {
    params.append('difficulty', validDifficulty);
  }

  // Add category when a specific category is selected (not Any Category / id 0)
  const openTriviaCategory = mapCategoryToOpenTriviaDb(categoryId);
  if (openTriviaCategory > 0) {
    params.append('category', String(openTriviaCategory));
  }

  const apiUrl = `https://opentdb.com/api.php?${params.toString()}`;

  // Attempt API request with timeout
  let apiQuestions = [];
  let apiSucceeded = false;
  let apiErrorMessage = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.response_code !== 0) {
      throw new Error(`Open Trivia DB error: response_code=${data.response_code}`);
    }

    if (!Array.isArray(data.results) || data.results.length === 0) {
      throw new Error('Open Trivia DB returned no questions');
    }

    // Decode HTML entities and normalize questions
    apiQuestions = data.results.map((raw, index) => {
      const questionText = decodeHtmlEntities(raw.question || '');

      const incorrectAnswers = [
        decodeHtmlEntities(raw.incorrect_answers[0] || ''),
        decodeHtmlEntities(raw.incorrect_answers[1] || ''),
        decodeHtmlEntities(raw.incorrect_answers[2] || ''),
      ];

      const correctAnswer = decodeHtmlEntities(raw.correct_answer || '');

      // Validate: all answers must be present and distinct
      if (!questionText || !correctAnswer) return null;

      // Check incorrect answers are distinct from each other and from correct answer
      const allAnswers = [...incorrectAnswers, correctAnswer];
      if (new Set(allAnswers).size !== 4) return null;

      // Shuffle options and track correct index
      const options = allAnswers.map((text, i) => ({ text, originalIndex: i }));
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const correctIndex = options.findIndex(opt => opt.originalIndex === 3);

      if (correctIndex < 0) return null;

      return {
        id: `q${index + 1}`,
        text: questionText,
        options: options.map(opt => opt.text),
        correctIndex,
        category: raw.category || '',
        difficulty: raw.difficulty || validDifficulty,
      };
    }).filter((q) => q !== null);

    apiSucceeded = true;
  } catch (error) {
    apiErrorMessage = error instanceof Error ? error.message : String(error);
    // API failed - will use fallback below
  }

  // If API succeeded with enough questions, use them
  if (apiSucceeded && apiQuestions.length >= normalizedAmount) {
    // If category was requested, verify all questions match the selected category
    if (categoryId && categoryId > 0) {
      const matchedCategory = FALLBACK_CATEGORIES.find(c => c.id === categoryId);
      if (matchedCategory) {
        // Build a set of valid OTDB category names for this local category
        // OTDB returns exact category names like "Science & Nature", "Entertainment: Film", etc.
        // We need exact matching to avoid cross-contamination (e.g., "Entertainment" matching "Entertainment: Books" AND "Entertainment: Film")
        const validCategoryNames = new Set([
          matchedCategory.name,                    // Local name (e.g., "Science & Nature")
          matchedCategory.name.trim(),             // Trimmed
          matchedCategory.name.toLowerCase(),      // Lowercase
        ]);
        // Also add common OTDB variations that map to this local category
        // Some OTDB category names differ slightly from local names
        const otdbNameMap = {
          'General Knowledge': ['General Knowledge'],
          'Entertainment: Books': ['Entertainment: Books'],
          'Entertainment: Film': ['Entertainment: Film'],
          'Entertainment: Music': ['Entertainment: Music'],
          'Entertainment: Television': ['Entertainment: Television'],
          'Entertainment: Video Games': ['Entertainment: Video Games'],
          'Science & Nature': ['Science & Nature', 'Science: Nature'], // OTDB uses "Science & Nature"
          'Science: Computers': ['Science: Computers'],
          'Science: Mathematics': ['Science: Mathematics', 'Science: Math'],
          'Sports': ['Sports'],
          'Geography': ['Geography'],
          'History': ['History'],
          'Politics': ['Politics'],
          'Art': ['Art'],
          'Animals': ['Animals'],
          'Vehicles': ['Vehicles'],
        };
        const validNames = otdbNameMap[matchedCategory.name] || [matchedCategory.name];
        // Filter to only questions matching the selected category EXACTLY (case-insensitive)
        const matchingQuestions = apiQuestions.filter(q =>
          validNames.some(validName => q.category.toLowerCase() === validName.toLowerCase())
        );
        if (matchingQuestions.length >= normalizedAmount) {
          // Use the matching questions (shuffle and take required amount)
          const shuffled = [...matchingQuestions].sort(() => Math.random() - 0.5);
          apiQuestions = shuffled.slice(0, normalizedAmount);
        } else {
          // Not enough matching questions from API, fall back
          apiSucceeded = false;
        }
      } else {
        // Category not found in local list, fall back
        apiSucceeded = false;
      }
    }
  }

  // Fall back to local question bank if API failed or returned insufficient questions
  if (!apiSucceeded || apiQuestions.length < normalizedAmount) {
    // Use the existing fallback logic
    let bank = FALLBACK_QUESTION_BANK[validDifficulty] || FALLBACK_QUESTION_BANK.medium;

    // Filter by category if a specific category was selected
    if (categoryId && categoryId > 0) {
      const matchedCategory = FALLBACK_CATEGORIES.find(c => c.id === categoryId);
      if (matchedCategory) {
        const filtered = bank.filter(q => q.category.toLowerCase() === matchedCategory.name.toLowerCase());
        if (filtered.length >= 3) {
          bank = filtered;
        } else {
          // No sufficient fallback questions for this category/difficulty
          throw new TriviaApiError(
            'NO_RESULTS',
            `Not enough questions in the selected category: ${matchedCategory.name}. Please select a different category.`
          );
        }
      } else {
        throw new TriviaApiError('NO_RESULTS', 'Selected category not found in question bank.');
      }
    }

    // Shuffle and take required amount (same logic as before, but using local bank)
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

  return apiQuestions;
}

export async function resetSessionToken() {
  // No-op for local mode
}
