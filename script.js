// --- ИНИЦИАЛИЗАЦИЯ VK BRIDGE И ЗАГРУЗКА ДАННЫХ ---
if (typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppInit').then(() => {
        console.log('VK Bridge успешно запущен!');
        
        // Скачиваем сохранения из облака ВКонтакте
        return vkBridge.send('VKWebAppStorageGet', { keys: ['magical_vk_save'] });
    }).then((data) => {
        if (data.keys && data.keys[0].value !== '') {
            // Распаковываем данные облака в память телефона
            let cloudData = JSON.parse(data.keys[0].value);
            for (let key in cloudData) {
                localStorage.setItem(key, cloudData[key]);
            }
        }
        
        // Заставляем игру перечитать обновленные данные
        loadEconomy();
        let storedLevels = localStorage.getItem('magicalLevels');
        if (storedLevels) savedLevels = JSON.parse(storedLevels);
        initTheme();
        
    }).catch(console.error);
} else {
    console.warn('Локальный тест: VK Bridge не загружен.');
}

// --- УМНЫЙ МОСТ ДЛЯ ОБЛАЧНЫХ СОХРАНЕНИЙ ---
let cloudSaveTimer;



// --- НАСТРОЙКИ СЛОЖНОСТИ ---

// --- НАСТРОЙКИ СЛОЖНОСТИ ---
const difficulties = {
    easy: { name: 'Простой', size: 10, bombs: 12 },
    medium: { name: 'Средний', size: 20, bombs: 60 },
    hard: { name: 'Сложный', size: 40, bombs: 250 }
};

// --- ИГРОВЫЕ ДАННЫЕ В ПАМЯТИ ---
let savedLevels = { easy: 1, medium: 1, hard: 1 };
let currentDiff = 'easy';
let settings = { vibro: true, sound: true, music: true, longFlag: true };

let playerEconomy = { 
    diamonds: 0, 
    hints: 3, 
    sparks: 0,
    inventory: ['hat_none', 'staff_none', 'flag_basic'], // Начинаем без шапки и посоха
    equipped: { hat: 'hat_none', staff: 'staff_none', flag: 'flag_basic' },
    unlockedArts: [], 
    readMails: [],      
    claimedMails: [], 
    deletedMails: [],
    usedPromos: [],
    unlockedCust: ['bg_default', 'block_default'],
    equippedCust: { backgrounds: 'bg_default', blocks: 'block_default' }
};

let playerStats = {
    totalCells: 0,
    totalFlags: 0,
    winsEasy: 0,
    winsMedium: 0,
    winsHard: 0,
    adsWatched: 0
};

function loadEconomy() {
    let saved = localStorage.getItem('magicalEconomy');
    if (saved) {
        let parsed = JSON.parse(saved);
        playerEconomy.diamonds = parsed.diamonds || 0;
        playerEconomy.hints = parsed.hints || 0;
        playerEconomy.sparks = parsed.sparks || 0;
        playerEconomy.inventory = parsed.inventory || ['set_basic'];
        playerEconomy.equipped = parsed.equipped || 'set_basic';
        playerEconomy.unlockedArts = parsed.unlockedArts || [];
        playerEconomy.unlockedCust = parsed.unlockedCust || ['bg_default', 'block_default'];
        playerEconomy.equippedCust = parsed.equippedCust || { backgrounds: 'bg_default', blocks: 'block_default' };
        
   // --- ЗАГРУЖАЕМ ПОЧТУ ИЗ ПАМЯТИ ---
        playerEconomy.readMails = parsed.readMails || [];
        playerEconomy.claimedMails = parsed.claimedMails || [];
        
        // ВОТ ЭТА СТРОЧКА ЗАКРОЕТ ДЫРУ В ЭКОНОМИКЕ:
        playerEconomy.usedPromos = parsed.usedPromos || [];
        
        
        // --- ВОТ ЭТА СТРОЧКА ВСЁ ЧИНИТ ---
        // Теперь игра вспомнит, на какой ступени ачивки ты находишься
        playerEconomy.achTiers = parsed.achTiers || {}; 
    }
    
    let savedStats = localStorage.getItem('magicalStats');
    if (savedStats) {
        let parsedStats = JSON.parse(savedStats);
        playerStats = Object.assign(playerStats, parsedStats);
    }
}

// Сразу вызываем загрузку
loadEconomy();
let storedLevels = localStorage.getItem('magicalLevels');
if (storedLevels) savedLevels = JSON.parse(storedLevels);

let storedSettings = localStorage.getItem('magicalSettings');
if (storedSettings) settings = Object.assign(settings, JSON.parse(storedSettings));

// --- ПЕРЕМЕННЫЕ УРОВНЯ ---
let bombs = [];
let cells = [];
let isGameOver = false;
let cellsOpened = 0;
let isFirstClick = true; 
let flagsCount = 0;

let pressTimer;
let isLongPress = false;
let isScrolling = false; 
const LONG_PRESS_TIME = 250; 

// --- БАЗА ПРОМОКОДОВ (ТАЙНЫЕ РУНЫ) ---
const promoCodes = {
    'WITCH2026': { sparks: 100, diamonds: 10 }, 
    'FROG_HUG': { sparks: 50, diamonds: 0 },    
    'DEV_TEST': { sparks: 1500, diamonds: 100 }, 
    'MAGIC50': { sparks: 50, diamonds: 0 }, 
    'FROG10': { sparks: 0, diamonds: 10 }   
};



// Открыть окно промокодов
function openPromoModal() {
    let modal = document.getElementById('promo-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Очищаем поле ввода и старые сообщения при каждом открытии
        document.getElementById('promo-input').value = '';
        document.getElementById('promo-message').innerText = '';
        document.getElementById('promo-message').style.color = '#5c4033';
    }
}

// Закрыть окно промокодов
function closePromoModal() {
    let modal = document.getElementById('promo-modal');
    if (modal) modal.style.display = 'none';
}

// Применить код
function submitPromoCode() {
    let inputField = document.getElementById('promo-input');
    let messageField = document.getElementById('promo-message');
    let rawCode = inputField.value;
    
    if (!rawCode) {
        messageField.innerHTML = 'Поле пустое!';
        messageField.style.color = '#D16D6D';
        return;
    }
    
    let code = rawCode.trim().toUpperCase(); 
    
    if (!promoCodes[code]) {
        messageField.innerHTML = 'Такой руны не существует!';
        messageField.style.color = '#D16D6D';
        return;
    }
    
    if (!playerEconomy.usedPromos) playerEconomy.usedPromos = [];
    
    if (playerEconomy.usedPromos.includes(code)) {
        messageField.innerHTML = 'Эти чары уже были использованы!';
        messageField.style.color = '#D16D6D';
        return;
    }
    
    let reward = promoCodes[code];
    let rewardText = [];
    
    if (reward.sparks) {
        playerEconomy.sparks += reward.sparks;
        rewardText.push(`${reward.sparks} <img src="img/icons/spark.png" class="inline-icon">`);
    }
    if (reward.diamonds) { 
        if(!playerEconomy.diamonds) playerEconomy.diamonds = 0; 
        playerEconomy.diamonds += reward.diamonds;
        rewardText.push(`${reward.diamonds} <img src="img/icons/diamond.png" class="inline-icon">`);
    }
    
    playerEconomy.usedPromos.push(code);
    saveEconomy();
    
    messageField.innerHTML = 'Успех! Награда: ' + rewardText.join(' и ');
    messageField.style.color = '#6BA374'; 
    inputField.value = ''; 
}

// --- ЭТАП 2: КАТАЛОГИ И КОНФИГИ МЕТА-ИГРЫ ---
// --- КАТАЛОГ ГАРДЕРОБА ---
const cosmeticsCatalog = {
    hats: {
        'hat_none': { name: 'Без шляпы', price: 0, image: '' }, 
        'hat_basic': { name: 'Уютная шляпа', price: 50, image: 'img/hat_1.png' }, 
        'hat_neon': { name: 'Неоновый гриб', price: 50, image: 'img/hat_neon.png' },
        'hat_stars': { name: 'Звездный шелк', price: 50, image: 'img/hat_stars.png' }
    },
    staffs: {
        'staff_none': { name: 'Без посоха', price: 0, image: '' }, 
        'staff_basic': { name: 'Посох-веточка', price: 50, image: 'img/staff_1.png' }, 
        'staff_neon': { name: 'Ловец душ', price: 50, image: 'img/staff_neon.png' },
        'staff_stars': { name: 'Лунный серп', price: 50, image: 'img/staff_stars.png' }
    },
    flags: {
       'flag_basic': { name: 'Обычный флажок', price: 0, image: '', emoji: '🚩' },
        'flag_rune': { name: 'Флажок-руна', price: 50, image: 'img/flag_1.png' }, 
        'flag_neon': { name: 'Мухомор-маяк', price: 50, image: 'img/flag_neon.png' },
        'flag_stars': { name: 'Осколок звезды', price: 50, image: 'img/flag_stars.png' }
    }
};





// --- БАЗА ПИСЕМ (НОВЫЙ ЛОР) ---
const mailDB = [
    {
        id: 'mail_day1',
        reqDay: 1,
        title: 'Ква-партнерство!',
        text: 'Ква! Однажды ведьма чуть не сварила из меня зелье. Но я вовремя выпрыгнула из котла и предложила ей сделку: она меня не ест, а я открываю лавку и поставляю ей ингредиенты с минных полей! Теперь ты — мой главный добытчик. Введи руну <b>MAGIC50</b> и купи себе первый флажок!',
        reward: null
    },
    {
        id: 'mail_day3',
        reqDay: 3,
        title: 'Секрет из котла 🪄',
        text: 'Пока я сидела в котле, я наглоталась чистой магии. Теперь я очень умная! Лови секрет: если вокруг цифры уже стоят правильные флажки, нажми на саму цифру — и все безопасные клетки откроются разом. Держи пару подсказок, чтобы работа шла быстрее!',
        reward: { hints: 2, text: '2 <img src="img/icons/hint.png" class="inline-icon">' }
    },
    {
        id: 'mail_day7',
        reqDay: 7,
        title: 'Моя прееелесть... ✨',
        text: 'Обожаю всё блестящее! Пока ты расчищаешь поля от зелий-ловушек, я нашла в траве сверкающие алмазики. Мы же партнеры, так что делюсь честно. Вводи код <b>FROG10</b> — это твоя доля!',
        reward: null
    },
    {
        id: 'mail_day10',
        reqDay: 10,
        title: 'Время наряжаться! 🍄',
        text: 'Ква! В моем магазинчике под мухомором свежий завоз. На улице холодает, так что я привезла уютные шапочки. Высылаю тебе Искры из личных запасов — купи мне что-нибудь красивое. Хочу быть самой модной жабкой на болоте!',
        reward: { sparks: 30, text: '30 <img src="img/icons/spark.png" class="inline-icon">' }
    },
    {
        id: 'mail_day14',
        reqDay: 14,
        title: 'Две недели бизнеса! 🎂',
        text: 'Мы ведем бизнес уже целых 14 дней! С таким компаньоном никакие взрывы не страшны. Я припрятала немного кристаллов к нашему маленькому юбилею — беги крутить Колесо Фортуны за мой счет! Пусть выпадет джекпот!',
        reward: { diamonds: 30, text: '30 <img src="img/icons/diamond.png" class="inline-icon">' }
    }
];

// --- ДОСТИЖЕНИЯ (С НОВОЙ АЧИВКОЙ ЗА РЕКЛАМУ) ---
const achievementsList = [
    { id: 'cells', title: 'Следопыт', desc: 'Открой пустых клеток', step: 1000, reward: 10, statKey: 'totalCells' },
    { id: 'flags', title: 'Гроза ловушек', desc: 'Поставь правильных флажков', step: 500, reward: 10, statKey: 'totalFlags' },
    { id: 'win_e', title: 'Осторожный шаг', desc: 'Побед на Простом', step: 20, reward: 10, statKey: 'winsEasy' },
    { id: 'win_m', title: 'Ловкие ручки', desc: 'Побед на Среднем', step: 10, reward: 10, statKey: 'winsMedium' },
    { id: 'win_h', title: 'Сапёр-виртуоз', desc: 'Побед на Сложном', step: 5, reward: 15, statKey: 'winsHard' },
    { id: 'ads', title: 'Взгляд в кристалл', desc: 'Посмотри рекламу', step: 20, reward: 20, statKey: 'adsWatched' }
];

// --- КВЕСТЫ (НЕЙТРАЛЬНЫЕ) ---
const questPool = [
    { id: 'win_easy', title: 'Легкая прогулка', desc: 'Выиграй 1 игру на Простом уровне', goal: 1 },
    { id: 'win_medium', title: 'Золотая середина', desc: 'Выиграй 1 игру на Среднем уровне', goal: 1 },
    { id: 'win_any', title: 'Магия в действии', desc: 'Выиграй 3 игры (любая сложность)', goal: 3 },
    { id: 'play_any', title: 'Неутомимый добытчик', desc: 'Сыграй 5 партий до конца', goal: 5 },
    { id: 'flawless', title: 'Идеальная точность', desc: 'Выиграй 1 игру без взрывов и воскрешений', goal: 1 },
    { id: 'open_cells', title: 'Безопасная тропа', desc: 'Открой 100 пустых клеток', goal: 100 },
    { id: 'flags', title: 'Мастер зелий', desc: 'Поставь 50 правильных флажков', goal: 50 },
    { id: 'play_hard', title: 'Смелый эксперимент', desc: 'Сыграй 1 игру на Сложном уровне', goal: 1 },
    { id: 'use_hint', title: 'Шестое чувство', desc: 'Используй 2 подсказки', goal: 2 },
    { id: 'revive', title: 'Магия спасения', desc: 'Воскресись после взрыва 1 раз', goal: 1 },
    { id: 'spend_diamonds', title: 'Удачная покупка', desc: 'Потрать 50 алмазов за день', goal: 50 }
];
// --- ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ---
const gridElement = document.getElementById('grid');
const levelTitle = document.getElementById('level-title');
const counterText = document.getElementById('mines-counter');
const hintBtn = document.getElementById('hint-btn');
const scrollContainer = document.getElementById('board-scroll');
const vibroCheckbox = document.getElementById('set-vibro');
const controlsCheckbox = document.getElementById('set-controls');
const soundCheckbox = document.getElementById('set-sound');
const musicCheckbox = document.getElementById('set-music');
// --- АУДИО-ДВИЖОК ---
const audioSystem = {
    click: new Audio('music/click.wav'),
    open: new Audio('music/open.wav'),     // Открытие ячейки
    flag: new Audio('music/flag.wav'),     // Установка флажка
    unflag: new Audio('music/unflag.wav'), // Снятие флажка
    win: new Audio('music/win.mp3'),       // Победа в игре
    lose: new Audio('music/lose.wav'),     // Взрыв
    wheel: new Audio('music/wheel.mp3'),
    reward: new Audio('music/reward.wav'), // Получение награды (колесо, письма, квесты)
    bgm: new Audio('music/bgm.mp3')        // Фоновая музыка
};

audioSystem.bgm.loop = true;
audioSystem.bgm.volume = 0.3; 

function playSound(type) {
    if (settings.sound && audioSystem[type]) {
        audioSystem[type].currentTime = 0;
        audioSystem[type].play().catch(() => {}); 
    }
}

function updateBGM() {
    if (settings.music) {
        audioSystem.bgm.play().catch(() => {});
    } else {
        audioSystem.bgm.pause();
    }
}


// Браузеры и телефоны блокируют автовоспроизведение музыки до первого клика игрока.
// Этот код запустит музыку сразу, как только игрок тапнет куда-нибудь по экрану.
document.body.addEventListener('click', function initBGM() {
    updateBGM();
    // Удаляем слушатель после первого клика, он больше не нужен
    document.body.removeEventListener('click', initBGM);
}, { once: true });

// --- ИНИЦИАЛИЗАЦИЯ НАСТРОЕК ---
if (vibroCheckbox) vibroCheckbox.checked = settings.vibro;
if (controlsCheckbox) controlsCheckbox.checked = settings.longFlag;
if (soundCheckbox) soundCheckbox.checked = settings.sound;
if (musicCheckbox) musicCheckbox.checked = settings.music;

function saveSettings() {
    localStorage.setItem('magicalSettings', JSON.stringify(settings));
}
if (vibroCheckbox) vibroCheckbox.addEventListener('change', (e) => { settings.vibro = e.target.checked; saveSettings(); });
if (controlsCheckbox) controlsCheckbox.addEventListener('change', (e) => { settings.longFlag = e.target.checked; saveSettings(); });
if (soundCheckbox) soundCheckbox.addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });
if (musicCheckbox) musicCheckbox.addEventListener('change', e => { 
    settings.music = e.target.checked; 
    saveSettings(); 
    updateBGM(); // Мгновенно включаем или выключаем музыку
});

// --- ЭКОНОМИКА (АЛМАЗЫ И ПОДСКАЗКИ) ---
function saveEconomy() {
    // Сохраняем данные в память телефона
    localStorage.setItem('magicalEconomy', JSON.stringify(playerEconomy));
    localStorage.setItem('magicalStats', JSON.stringify(playerStats));
    
    // Обновляем интерфейс (старые окна)
    let md = document.getElementById('menu-diamonds'); if (md) md.innerText = playerEconomy.diamonds;
    let mh = document.getElementById('menu-hints'); if (mh) mh.innerText = playerEconomy.hints;
    let gd = document.getElementById('game-diamonds'); if (gd) gd.innerText = playerEconomy.diamonds;
    let gh = document.getElementById('game-hints'); if (gh) gh.innerText = playerEconomy.hints;
    
 // Обновляем интерфейс (новые окна меты)
    let ss = document.getElementById('shop-sparks'); if (ss) ss.innerText = playerEconomy.sparks;
    let ps = document.getElementById('player-sparks'); if (ps) ps.innerText = playerEconomy.sparks;
    let gs = document.getElementById('gallery-sparks'); if (gs) gs.innerText = playerEconomy.sparks;
    let ms = document.getElementById('menu-sparks'); 
    if (ms) ms.innerText = playerEconomy.sparks;
    updateBadges();
    syncToCloud();
}
 

// --- ЭКРАНЫ ---

function showScreen(screenId) {
    if (screenId === 'difficulty-menu') {
        let elEasy = document.getElementById('lvl-easy'); if (elEasy) elEasy.innerText = 'Ур. ' + savedLevels.easy;
        let elMed = document.getElementById('lvl-medium'); if (elMed) elMed.innerText = 'Ур. ' + savedLevels.medium;
        let elHard = document.getElementById('lvl-hard'); if (elHard) elHard.innerText = 'Ур. ' + savedLevels.hard;
    }
    
    // --- Прячем или показываем жабку ---
    let frog = document.getElementById('frog-container');
    if (frog) {
        frog.style.display = (screenId === 'main-menu') ? 'block' : 'none';
    }
    
    // --- Прячем или показываем конверт ---
    let mailFab = document.getElementById('mail-fab');
    if (mailFab) {
        mailFab.style.display = (screenId === 'main-menu') ? 'flex' : 'none';
    }

    // --- ИСПРАВЛЕНИЕ БАГА С АЧИВКАМИ ---
    // Сохраняем прогресс и обновляем красные точки при выходе в меню
    if (screenId === 'main-menu') {
        saveEconomy(); 
    }
    // -----------------------------------
    
    playSound('click'); 
    document.querySelectorAll('.screen').forEach(s => {
        s.style.opacity = '0';
        setTimeout(() => s.classList.remove('active'), 300);
    });
    
    setTimeout(() => {
        const nextScreen = document.getElementById(screenId);
        if (nextScreen) {
            nextScreen.classList.add('active');
            setTimeout(() => nextScreen.style.opacity = '1', 50);
        }
    }, 300);
}

   

function startGame(difficulty) {
showFullscreenAd();
    currentDiff = difficulty;
    showScreen('game-screen');
    if (!loadGameState()) createBoard();
}

// --- СОХРАНЕНИЕ ПРОГРЕССА ПОЛЯ (ОПТИМИЗИРОВАННОЕ) ---
let saveTimeout;
function saveGameState() {
    if (isGameOver) {
        localStorage.removeItem('magicalSave_' + currentDiff);
        localStorage.setItem('magicalLevels', JSON.stringify(savedLevels));
        return;
    }
    
    // ФИКС ЛАГОВ: Откладываем тяжелое сканирование 1600 клеток на 500мс
    // Клетка откроется мгновенно, а сохранение пройдет незаметно в фоне
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        let tinyGrid = cells.map(cell => {
            if (cell.classList.contains('open')) return 1;
            if (cell.classList.contains('flagged')) return 2;
            return 0;
        });
        const state = {
            bombs: bombs, cellsOpened: cellsOpened,
            isFirstClick: isFirstClick, flagsCount: flagsCount, grid: tinyGrid 
        };
        localStorage.setItem('magicalSave_' + currentDiff, JSON.stringify(state));
        localStorage.setItem('magicalLevels', JSON.stringify(savedLevels));
        syncToCloud();
    }, 500); 
}
function loadGameState() {
    let savedData = localStorage.getItem('magicalSave_' + currentDiff);
    if (!savedData) return false;
    const state = JSON.parse(savedData);
    if (!state.grid) {
        localStorage.removeItem('magicalSave_' + currentDiff);
        return false;
    }
    
    bombs = state.bombs; cellsOpened = state.cellsOpened;
    isFirstClick = state.isFirstClick; flagsCount = state.flagsCount;
    isGameOver = false;
    wasRevivedThisGame = false;

    let s = difficulties[currentDiff];
    if (gridElement) gridElement.innerHTML = '';
    cells = [];
    if (gridElement) gridElement.style.gridTemplateColumns = `repeat(${s.size}, 1fr)`;
   
  
    
    // Включаем облегченный дизайн, если клеток слишком много
    if (s.size >= 40) {
        gridElement.classList.add('hard-mode-grid');
    } else {
        gridElement.classList.remove('hard-mode-grid');
    } document.documentElement.style.setProperty('--cell-size', s.size >= 30 ? '25px' : '40px');
    if (levelTitle) levelTitle.innerText = `Ур. ${savedLevels[currentDiff]} (${s.name})`;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < s.size * s.size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        if (state.grid[i] === 1) {
            cell.classList.add('open');
            let bombsAround = countBombsAroundForLoad(i, s.size);
            if (bombsAround > 0) {
                cell.innerText = bombsAround;
                // НОВАЯ ПАЛИТРА: Мягкий синий, Мятный, Коралловый, Лавандовый, Карамельный, Бирюзовый, Пыльная роза, Теплый серый
                const colors = ['', '#6084A3', '#6BA374', '#D16D6D', '#9D7BCE', '#C68A47', '#5299A3', '#B56391', '#7A706A'];
                cell.style.color = colors[bombsAround] || 'var(--text-main)';
            }
} else if (state.grid[i] === 2) {
    cell.classList.add('flagged');
    let flagKey = playerEconomy.equipped.flag;
    if (!flagKey || !cosmeticsCatalog.flags[flagKey]) flagKey = 'flag_basic';
    
    let flagData = cosmeticsCatalog.flags[flagKey];
    if (flagData.image) {
        cell.innerHTML = `<img src="${flagData.image}" style="width: 75%; height: 75%; pointer-events: none;" alt="Флажок">`;
    } else {
        cell.innerHTML = `<span style="pointer-events: none;">${flagData.emoji || '🚩'}</span>`;
    }
}
        fragment.appendChild(cell);
        cells.push(cell);
    }
    if (gridElement) gridElement.appendChild(fragment);
    updateCounter();
    return true;
}

function countBombsAroundForLoad(index, size) {
    let count = 0;
    let row = Math.floor(index / size);
    let col = index % size;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue; 
            let nRow = row + i, nCol = col + j;
            if (nRow >= 0 && nRow < size && nCol >= 0 && nCol < size) {
                if (bombs.includes(nRow * size + nCol)) count++;
            }
        }
    }
    return count;
}

function createBoard() {
    if (!gridElement) return;
    let hintBtn = document.getElementById('hint-btn');
    if(hintBtn) hintBtn.style.display = ''; 
    gridElement.innerHTML = ''; 

    let diffSettings = difficulties[currentDiff];
    let levelNum = savedLevels[currentDiff];
    
    gridElement.style.gridTemplateColumns = `repeat(${diffSettings.size}, 1fr)`;
    
    // Включаем облегченный дизайн, если клеток слишком много
    if (diffSettings.size >= 40) {
        gridElement.classList.add('hard-mode-grid');
    } else {
        gridElement.classList.remove('hard-mode-grid');
    }
    if (levelTitle) levelTitle.innerText = `Ур. ${levelNum} (${diffSettings.name})`;
    document.documentElement.style.setProperty('--cell-size', diffSettings.size >= 30 ? '25px' : '40px');
    
    bombs = []; cells = []; isGameOver = false; cellsOpened = 0;
    isFirstClick = true; flagsCount = 0; wasRevivedThisGame = false;
    updateCounter();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < diffSettings.size * diffSettings.size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        fragment.appendChild(cell);
        cells.push(cell);
    }
    gridElement.appendChild(fragment);
    saveGameState();
}

function getCellIndex(target) {
    const cell = target.closest('.cell');
    // Теперь мы мгновенно читаем "бейджик" клетки, а не ищем её в списке из 1600 штук!
    return cell ? parseInt(cell.dataset.index) : -1;
}

// --- УПРАВЛЕНИЕ И КАСАНИЯ ---
if (gridElement) {
    gridElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            let index = getCellIndex(e.target);
            if (index !== -1) {
                e.target.style.filter = 'brightness(0.9)';
                startPress(index);
            }
        }
    }, { passive: true });

    gridElement.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            let index = getCellIndex(e.target);
            if (index !== -1) e.target.style.filter = '';
        }
        cancelPress(true);
    }, { passive: true });

    gridElement.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault(); 
        let index = getCellIndex(e.target);
        if (index !== -1) {
            e.target.style.filter = '';
            endPress(index);
        }
    });

    gridElement.addEventListener('mousedown', (e) => { 
        if(e.button === 0) {
            let index = getCellIndex(e.target);
            if (index !== -1) startPress(index);
        }
    });
    gridElement.addEventListener('mouseup', (e) => {
        let index = getCellIndex(e.target);
        if (index !== -1) endPress(index);
    });
    gridElement.addEventListener('mouseleave', () => cancelPress(true));
}

// --- МУЛЬТИТАЧ (ЗУМ) ---
let initialPinchDist = null;
let initialCellSize = 40;

if (scrollContainer) {
    scrollContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            cancelPress(true); 
            initialPinchDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            initialCellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
        }
    }, { passive: true });
    
    scrollContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist) {
            if (e.cancelable) e.preventDefault(); 
            let currentDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            let newSize = initialCellSize * (currentDist / initialPinchDist);
            if (newSize < 15) newSize = 15;
            if (newSize > 80) newSize = 80;
            document.documentElement.style.setProperty('--cell-size', newSize + 'px');
        }
    }, { passive: false });
    
    scrollContainer.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) initialPinchDist = null;
    });
}

// --- ЛОГИКА НАЖАТИЙ ---
function startPress(index) {
    if (isGameOver) return;
    isLongPress = false;
    isScrolling = false;
    
    pressTimer = setTimeout(() => {
        if (!isScrolling) {
            isLongPress = true;
            let cell = cells[index];
            if (!cell.classList.contains('open')) {
                if (settings.longFlag) toggleFlag(index);
                else handleCellAction(index);
                if (settings.vibro && navigator.vibrate) navigator.vibrate(40);
            }
        }
    }, LONG_PRESS_TIME);
}

function endPress(index) {
    if (isGameOver || isScrolling) return;
    clearTimeout(pressTimer); 
    
    if (!isLongPress) {
        let cell = cells[index];
        if (cell.classList.contains('open')) {
            handleCellAction(index);
        } else {
            if (settings.longFlag) handleCellAction(index);
            else toggleFlag(index);
        }
    }
}

function cancelPress(scrolling = false) {
    clearTimeout(pressTimer);
    isLongPress = false;
    if (scrolling) isScrolling = true;
}

function updateCounter() {
    let left = difficulties[currentDiff].bombs - flagsCount;
    if (counterText) counterText.innerText = left;
}

function placeBombs(firstClickIndex) {
    let s = difficulties[currentDiff].size;
    let totalBombs = difficulties[currentDiff].bombs;
    
    // 1. Создаем "Безопасную зону" (сама клетка + все её соседи)
    let safeZone = [firstClickIndex];
    let row = Math.floor(firstClickIndex / s);
    let col = firstClickIndex % s;
    
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            let nRow = row + i, nCol = col + j;
            if (nRow >= 0 && nRow < s && nCol >= 0 && nCol < s) {
                safeZone.push(nRow * s + nCol);
            }
        }
    }

    // Предохранитель (если вдруг бомб больше, чем свободных клеток вне безопасной зоны)
    if ((s * s) - safeZone.length < totalBombs) {
        safeZone = [firstClickIndex]; // Оставляем безопасной только 1 клетку, чтобы игра не зависла
    }

    // 2. Расставляем бомбы, избегая "Безопасной зоны"
    while (bombs.length < totalBombs) {
        let randomPos = Math.floor(Math.random() * (s * s));
        if (!safeZone.includes(randomPos) && !bombs.includes(randomPos)) {
            bombs.push(randomPos);
        }
    }
}

function toggleFlag(index) {
    let cell = cells[index];
    if (cell.classList.contains('open')) return;
    
    if (cell.classList.contains('flagged')) {
        cell.classList.remove('flagged');
        cell.innerHTML = '';
        flagsCount--;
        playSound('unflag'); 
   } else {
        cell.classList.add('flagged');
        let flagKey = playerEconomy.equipped.flag;
        if (!flagKey || !cosmeticsCatalog.flags[flagKey]) flagKey = 'flag_basic';
        
        let flagData = cosmeticsCatalog.flags[flagKey];
        if (flagData.image) {
            cell.innerHTML = `<img src="${flagData.image}" style="width: 75%; height: 75%; pointer-events: none;" alt="Флажок">`;
        } else {
            // Вставляем смайлик!
            cell.innerHTML = `<span style="pointer-events: none;">${flagData.emoji || '🚩'}</span>`;
        }
        
        flagsCount++;
        playSound('flag'); 
    }
    updateCounter();
    checkWinByFlags();
    saveGameState(); 
}

function checkWinByFlags() {
    if (isFirstClick || isGameOver) return; 
    let correctlyFlagged = 0;
    
    cells.forEach((cell, i) => {
        if (cell.classList.contains('flagged') && bombs.includes(i)) correctlyFlagged++;
    });

    if (correctlyFlagged === difficulties[currentDiff].bombs && flagsCount === correctlyFlagged) {
        cells.forEach((cell, i) => {
            if (!bombs.includes(i) && !cell.classList.contains('open')) openCell(i);
        });
        checkWin(); 
    }
}

function handleCellAction(index) {
    let cell = cells[index];
    
    if (cell.classList.contains('open')) {
        let num = parseInt(cell.innerText); 
        if (!isNaN(num) && num > 0) {
            let neighbors = getNeighbors(index);
            let localFlags = 0;
            neighbors.forEach(n => { if (cells[n].classList.contains('flagged')) localFlags++; });

            if (localFlags === num) {
                neighbors.forEach(n => {
                    // ДОБАВЛЯЕМ ПРОВЕРКУ СЮДА:
                    if (isGameOver) return; 

                    let neighborCell = cells[n];
                    if (!neighborCell.classList.contains('open') && !neighborCell.classList.contains('flagged')) {
                        if (bombs.includes(n)) hitBomb(n); 
                        else openCell(n);
                    }
                });
                playSound('open');
                checkWin();
                saveGameState();
            }
        }
        return; 
    }

    if (cell.classList.contains('flagged')) return;
    if (isFirstClick) {
        placeBombs(index);
        isFirstClick = false;
        
        // НОВОЕ: Засчитываем старт игры сразу после первого клика
        trackQuest('play_any', 1);
        if (currentDiff === 'hard') trackQuest('play_hard', 1);
    }
    if (bombs.includes(index)) {
        hitBomb(index);
        return;
    }

    playSound('open');
    openCell(index);
    checkWin();
    saveGameState(); 
}

function getNeighbors(index) {
    let s = difficulties[currentDiff].size;
    let neighbors = [];
    let row = Math.floor(index / s);
    let col = index % s;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue; 
            let nRow = row + i, nCol = col + j;
            if (nRow >= 0 && nRow < s && nCol >= 0 && nCol < s) {
                neighbors.push(nRow * s + nCol);
            }
        }
    }
    return neighbors;
}

function openCell(index) {
    let cell = cells[index];
    if (cell.classList.contains('open') || cell.classList.contains('flagged')) return;

    cell.classList.add('open');
    cellsOpened++;
    playerStats.totalCells++;
    
    let bombsAround = 0;
    getNeighbors(index).forEach(n => { if (bombs.includes(n)) bombsAround++; });
    if (bombsAround > 0) {
        cell.innerText = bombsAround;
        // ТА ЖЕ НОВАЯ ПАЛИТРА ДЛЯ НОВОЙ ИГРЫ
        const colors = ['', '#6084A3', '#6BA374', '#D16D6D', '#9D7BCE', '#C68A47', '#5299A3', '#B56391', '#7A706A'];
        cell.style.color = colors[bombsAround] || 'var(--text-main)';
    } else {
        cell.innerText = '';
        getNeighbors(index).forEach(n => {
            if (!cells[n].classList.contains('open') && !bombs.includes(n)) openCell(n);
        });
    };
}

// --- ПОБЕДА И ПОРАЖЕНИЕ ---
let wasRevivedThisGame = false; 

function checkWin() {
    let s = difficulties[currentDiff];
    
    // Вот тут убрана жесткая проверка флажков!
    if (cellsOpened === (s.size * s.size) - s.bombs && !isGameOver) {
        isGameOver = true;
        let reward = currentDiff === 'easy' ? 5 : (currentDiff === 'medium' ? 15 : 40);
        playerEconomy.diamonds += reward;
        playSound('win');
        
        
        trackQuest('open_cells', cellsOpened);
        trackQuest('flags', flagsCount);
        if (currentDiff === 'easy') trackQuest('win_easy', 1);
        if (currentDiff === 'medium') trackQuest('win_medium', 1);
        
        trackQuest('win_any', 1);
        if (!wasRevivedThisGame) trackQuest('flawless', 1);
        
        if (currentDiff === 'easy') playerStats.winsEasy = (playerStats.winsEasy || 0) + 1;
        if (currentDiff === 'medium') playerStats.winsMedium = (playerStats.winsMedium || 0) + 1;
        if (currentDiff === 'hard') playerStats.winsHard = (playerStats.winsHard || 0) + 1;
        
        let earnedFlags = 0;
        cells.forEach((cell, i) => {
            if (cell.classList.contains('flagged') && bombs.includes(i)) earnedFlags++;
        });
        playerStats.totalFlags = (playerStats.totalFlags || 0) + earnedFlags;
        
        saveEconomy(); 
        
        setTimeout(() => {
            showCustomAlert(`Победа! Ты получаешь +${reward} <img src="img/icons/diamond.png" class="inline-icon">`, 'Победа!');
            savedLevels[currentDiff]++; 
            saveGameState(); 
            createBoard();
            wasRevivedThisGame = false;
        }, 600);
    }
}

function hitBomb(index) {
    if (isGameOver) return; 
    isGameOver = true; 
    
    let cell = cells[index];
    cell.innerHTML = '<img src="img/icons/cauldron.png" style="width: 80%; height: 80%; object-fit: contain; pointer-events: none;" alt="Котел">';
    cell.classList.add('open', 'exploded');
    playSound('lose');
    
    setTimeout(() => {
        let modal = document.getElementById('revive-modal');
        if(modal) {
            let reviveCost = currentDiff === 'easy' ? 10 : (currentDiff === 'medium' ? 15 : 20);
            let diamondBtn = document.getElementById('btn-revive-diamonds');
            if (diamondBtn) {
                diamondBtn.innerHTML = `Продолжить (${reviveCost} <img src="img/icons/diamond.png" class="inline-icon">)`;
            }
            modal.style.display = 'flex';
            modal.dataset.bombIndex = index;
        }
    }, 500);
}

// --- ФУНКЦИИ ВСПЛЫВАЮЩИХ ОКОН (МОДАЛОК) ---
function closeModal(id) { 
    let m = document.getElementById(id);
    if(m) m.style.display = 'none'; 
}

function giveUp() {
    closeModal('revive-modal');
    isGameOver = true;
    saveGameState(); 
    
    
    trackQuest('open_cells', cellsOpened); 
    
    let earnedFlags = 0;
    cells.forEach((cell, i) => {
        if (cell.classList.contains('flagged') && bombs.includes(i)) {
            earnedFlags++;
        }
    });
    playerStats.totalFlags += earnedFlags;
    
    saveEconomy(); 
    revealAllBombs(); 
    
    // --- ПРЯЧЕМ ПОДСКАЗКУ, ПОКАЗЫВАЕМ РЕСТАРТ ---
    let hintBtn = document.getElementById('hint-btn');
    if(hintBtn) hintBtn.style.display = 'none';
    
   
    // --------------------------------------------
    
    showCustomAlert('Повезет в следующий раз!');
}



// --- ЛОГИКА ПОДСКАЗОК ---
function useHintLogic() {
    let s = difficulties[currentDiff];
    let availableCells = [];
    let wrongFlags = [];
    
    // Сканируем поле
    for (let i = 0; i < s.size * s.size; i++) {
        let cell = cells[i];
        if (!cell.classList.contains('open')) {
            if (cell.classList.contains('flagged')) {
                // Если флажок стоит, но мины там нет
                if (!bombs.includes(i)) wrongFlags.push(i);
            } else {
                // Если клетка чистая и без мины
                if (isFirstClick || !bombs.includes(i)) availableCells.push(i);
            }
        }
    }
    
   // ЭТАП 1: Открываем обычную безопасную клетку
    if (availableCells.length > 0) {
        let randomIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
        if (isFirstClick) {
            placeBombs(randomIndex);
            isFirstClick = false;
            
            // НОВОЕ: Засчитываем старт игры
            trackQuest('play_any', 1);
            if (currentDiff === 'hard') trackQuest('play_hard', 1);
        }
        // ... дальше идет старый код playSound('open'); и т.д.
        playSound('open');
        openCell(randomIndex);
        checkWin();
        saveGameState();
        
        cells[randomIndex].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        return true;
    } 
    // ЭТАП 2: Убираем ошибочный флажок, если свободных клеток не осталось
    else if (wrongFlags.length > 0) {
        let randomIndex = wrongFlags[Math.floor(Math.random() * wrongFlags.length)];
        let badCell = cells[randomIndex];
        
        // Снимаем неверный флажок
        badCell.classList.remove('flagged');
        badCell.innerHTML = '';
        flagsCount--;
        updateCounter(); // Исправляем минус на счетчике!
        playSound('unflag');
        
        // Подсвечиваем ячейку красным на 1.5 секунды
        badCell.style.transition = 'background-color 0.3s';
        badCell.style.backgroundColor = '#ff6b6b';
        setTimeout(() => {
            badCell.style.backgroundColor = '';
            badCell.style.transition = '';
        }, 1500);
        
        badCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        showCustomAlert("Упс! Мы нашли неверный флажок и сняли его.", "Подсказка");
        
        saveGameState();
        return true;
    } 
    // ЭТАП 3: Ошибок нет, пустых клеток тоже
    else {
        showCustomAlert("Свободных клеток больше нет, остались только ловушки!", 'Подсказка');
        return false;
    }
}

// --- ОБРАБОТЧИК НАЖАТИЯ НА КНОПКУ ПОДСКАЗКИ ---
if (hintBtn) {
    hintBtn.addEventListener('click', () => {
        if (isGameOver) return;
        
        if (playerEconomy.hints > 0) {
            // Проверяем, удалось ли открыть клетку
            let success = useHintLogic();
            if (success) {
                playerEconomy.hints -= 1;
                saveEconomy();
                trackQuest('use_hint', 1); 
            }
        } else {
            // Если подсказок нет, открываем окно покупки
            let m = document.getElementById('hint-modal');
            if(m) m.style.display = 'flex';
        }
    });
}




// ==========================================
// МЕТА-ИГРА: КАЛЕНДАРЬ, КОЛЕСО, РЕКЛАМА И ЗАДАНИЯ
// ==========================================

function openAdModal() { 
    let m = document.getElementById('ad-modal');
    if(m) m.style.display = 'flex'; 
}


 

// --- КАЛЕНДАРЬ ---
let dailyStreak = 0;
let lastLoginDate = null;
let storedDaily = localStorage.getItem('magicalDaily');

if (storedDaily) {
    let data = JSON.parse(storedDaily);
    dailyStreak = data.streak;
    lastLoginDate = data.lastDate;
    
    // Логика сброса: если пропустил день, стрик сгорает
    if (lastLoginDate) {
        let last = new Date(lastLoginDate);
        let current = new Date();
        last.setHours(0,0,0,0); current.setHours(0,0,0,0);
        if ((current - last) / (1000 * 60 * 60 * 24) > 1) {
            dailyStreak = 0; 
        }
    }
}

function openDailyModal() {
    let m = document.getElementById('daily-modal');
    if(m) { m.style.display = 'flex'; renderDailyGrid(); }
}



// --- ЕЖЕДНЕВНЫЕ НАГРАДЫ (ОБНОВЛЕННЫЙ ИНТЕРФЕЙС) ---
function renderDailyGrid() {
    let grid = document.getElementById('daily-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    let today = new Date().toDateString();
    let canClaim = (today !== lastLoginDate);
    let btn = document.getElementById('claim-daily-btn');
    
    // 1. Отрисовываем первые 7 дней
    for(let i = 0; i < 7; i++) {
        let div = document.createElement('div');
        div.className = 'daily-day';
        let reward = [2, 3, 5, 8, 10, 12, 15][i];
        
        div.innerHTML = `День ${i + 1}<br><img src="img/icons/diamond.png" class="inline-icon"> ${reward}`;
        
        if (dailyStreak > i) {
            div.classList.add('claimed'); 
            div.innerHTML += '<br>✔';
        } else if (dailyStreak === i && canClaim) {
            div.classList.add('today');
        }
        grid.appendChild(div);
    }
    
    // 2. Добавляем 8-й "бесконечный" день на всю ширину окна
    let infiniteDiv = document.createElement('div');
    infiniteDiv.className = 'daily-day';
    infiniteDiv.style.gridColumn = '1 / -1'; // Растягиваем на всю ширину сетки
    infiniteDiv.style.marginTop = '5px';
    infiniteDiv.style.padding = '8px';
    // Если стрик дошел до 8 дня, делаем кнопку ярче
    infiniteDiv.style.backgroundColor = (dailyStreak >= 7) ? 'var(--btn-bg)' : 'var(--cell-closed)';
    
    infiniteDiv.innerHTML = `День 8+ (Бесконечно)<br><img src="img/icons/diamond.png" class="inline-icon"> 20 каждый день!`;
    
    if (dailyStreak >= 7) {
        if (canClaim) {
            infiniteDiv.classList.add('today'); // Подсвечиваем, если можно забрать сегодня
        } else {
            infiniteDiv.classList.add('claimed'); 
            infiniteDiv.innerHTML += ' ✔'; // Уже забрали сегодня
        }
    }
    grid.appendChild(infiniteDiv);
    
    // 3. Логика главной кнопки "Забрать"
    if(btn) {
        if (canClaim) {
            btn.disabled = false; 
            btn.style.backgroundColor = 'var(--btn-action)'; 
            btn.style.color = 'var(--text-main)'; 
            btn.innerHTML = 'Забрать';
        } else {
            btn.disabled = true; 
            btn.style.backgroundColor = 'var(--btn-alt)'; 
            btn.innerHTML = 'Уже получено';
        }
    }
}

function claimDaily() {
    let today = new Date().toDateString();
    if (today === lastLoginDate) return;
    
    // Выдаем награду: если стрик меньше 7, берем из массива, иначе стабильно даем 20
    let reward = (dailyStreak < 7) ? [2, 3, 5, 8, 10, 12, 15][dailyStreak] : 20;
    
    playerEconomy.diamonds += reward;
    dailyStreak++; 
    
    lastLoginDate = today;
    localStorage.setItem('magicalDaily', JSON.stringify({streak: dailyStreak, lastDate: lastLoginDate}));
    
    saveEconomy();
    renderDailyGrid();
    playSound('reward');
    updateBadges(); 
}

// --- КОЛЕСО ФОРТУНЫ ---
let isSpinning = false;
let currentRotation = 0; 
let lastFreeSpinDate = localStorage.getItem('magicalFreeSpin') || null;

function openWheelModal() {
    let today = new Date().toDateString();
    let spinBtn = document.getElementById('spin-btn');
    if(spinBtn) {
        if (lastFreeSpinDate !== today) {
            spinBtn.innerHTML = 'Крутить (Бесплатно)'; spinBtn.style.backgroundColor = '#4CAF50'; spinBtn.style.color = 'white';
        } else {
            spinBtn.innerHTML = 'Крутить (30 <img src="img/icons/diamond.png" class="inline-icon">)'; spinBtn.style.backgroundColor = '#dcb879'; spinBtn.style.color = '#1a2b4c';
        }
    }
    let m = document.getElementById('wheel-modal');
    if(m) m.style.display = 'flex';
}

// --- КОЛЕСО ФОРТУНЫ (ЧЕСТНАЯ МАТЕМАТИКА) ---
function spinWheel() {
    if (isSpinning) return;
    let today = new Date().toDateString();
    let isFree = (lastFreeSpinDate !== today);
    
    if (!isFree && playerEconomy.diamonds < 30) { 
        showCustomAlert('Нужно 30 алмазов, чтобы крутить!', 'Внимание!'); 
        closeModal('wheel-modal'); 
        // openAdModal(); // раскомментируй, если окно рекламы готово
        return; 
    }
    
    if (!isFree) { 
        playerEconomy.diamonds -= 30; 
    } else { 
        lastFreeSpinDate = today; 
        localStorage.setItem('magicalFreeSpin', lastFreeSpinDate); 
    }
    
    saveEconomy();
    isSpinning = true;
    
    playSound('wheel');
    
    let spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.innerHTML = 'Крутится...';
    
    let wheel = document.getElementById('wheel');
    if (!wheel) { isSpinning = false; return; }
    
    let prizes = [
        { type: 'diamonds', amount: 15 }, // 0
        { type: 'diamonds', amount: 20 }, // 1
        { type: 'diamonds', amount: 30 }, // 2
        { type: 'diamonds', amount: 50 }, // 3
        { type: 'diamonds', amount: 75 }, // 4
        { type: 'diamonds', amount: 100 },// 5
        { type: 'diamonds', amount: 150 },// 6
        { type: 'sparks', amount: 5 },    // 7
        { type: 'sparks', amount: 10 },   // 8
        { type: 'sparks', amount: 50 }    // 9
    ];
    
    let winningIndex = Math.floor(Math.random() * prizes.length);
    let wonPrize = prizes[winningIndex];
    
    // --- МАТЕМАТИКА КОЛЕСА (ИСПРАВЛЕННАЯ) ---
    // 1. Узнаем, сколько полных оборотов уже сделано
    let fullSpins = Math.floor(currentRotation / 360);
    fullSpins += 5; // Добавляем 5 новых оборотов для красоты вращения
    
    // 2. Точный угол самого приза
    let targetAngle = winningIndex * 36;
    
    // 3. Небольшой рандомный сдвиг (от -10 до +10 градусов), чтобы стрелка не била ровно в центр сектора
    let randomOffset = Math.floor(Math.random() * 21) - 10;
    
    // 4. Считаем АБСОЛЮТНЫЙ угол поворота
    currentRotation = (fullSpins * 360) + targetAngle + randomOffset;
    
    // Крутим! Обязательно с МИНУСОМ, чтобы колесо ехало нужным сектором прямо под стрелку
    wheel.style.transform = `rotate(-${currentRotation}deg)`;
    
    wheel.addEventListener('transitionend', function onSpinEnd() {
        wheel.removeEventListener('transitionend', onSpinEnd);
        isSpinning = false;
        
        if (wonPrize.type === 'diamonds') {
            playerEconomy.diamonds += wonPrize.amount;
            showCustomAlert(`Поздравляем! Ты выиграла ${wonPrize.amount} 💎`, 'Награда');
        } else {
            playerEconomy.sparks += wonPrize.amount;
            showCustomAlert(`Поздравляем! Ты выиграла ${wonPrize.amount} ✨`, 'Награда');
        }
        
        saveEconomy();
        playSound('win');
        openWheelModal(); 
    });
}

// --- СИСТЕМА ЕЖЕДНЕВНЫХ ЗАДАНИЙ ---
let storedQuests = localStorage.getItem('magicalQuests');
let dailyQuests = [];



function initQuests() {


    let today = new Date().toDateString();
    let parsed = storedQuests ? JSON.parse(storedQuests) : null;
    if (parsed && parsed.date === today) {
        dailyQuests = parsed.list;
        trackQuest('login', 1); 
    } else {
        let shuffled = [...questPool].sort(() => 0.5 - Math.random());
        let selected = shuffled.slice(0, 3);
        
        dailyQuests = [
            { id: 'login', title: 'Ежедневная рутина', desc: 'Зайди в игру', goal: 1, progress: 1, claimed: false },
            ...selected.map(q => ({ ...q, progress: 0, claimed: false })),
            { id: 'watch_ads', title: 'Спонсор Академии', desc: 'Посмотри 2 рекламы', goal: 2, progress: 0, claimed: false },
            // Добавляем шестой квест
            { id: 'bonus_all', title: 'Магистр заданий', desc: 'Выполни 5 ежедневных заданий', goal: 5, progress: 0, claimed: false }
        ];
        saveQuests();
    }
    updateBadges();
}

function saveQuests() {
    localStorage.setItem('magicalQuests', JSON.stringify({ date: new Date().toDateString(), list: dailyQuests }));
    updateBadges();
    syncToCloud();
}

// --- НОВАЯ ФУНКЦИЯ: Проверка смены суток ---
function checkQuestRollover() {
    let today = new Date().toDateString();
    let stored = localStorage.getItem('magicalQuests');
    if (stored) {
        let parsed = JSON.parse(stored);
        if (parsed.date !== today) {
            initQuests(); // Если наступил новый день, генерируем новые задания
        }
    }
}

function trackQuest(id, amount = 1) {
    checkQuestRollover(); // Проверяем дату перед тем, как засчитать прогресс
    let quest = dailyQuests.find(q => q.id === id);
    if (quest && quest.progress < quest.goal) {
        quest.progress = Math.min(quest.goal, quest.progress + amount);
        saveQuests();
    }
}

function openQuestsModal() {
    checkQuestRollover(); // Проверяем дату перед тем, как показать окно
    renderQuests();
    let m = document.getElementById('quests-modal');
    if(m) m.style.display = 'flex';
}

function updateBadges() {
    let today = new Date().toDateString();
    
    // 1. Ежедневный вход
    let dotDaily = document.getElementById('dot-daily');
    if(dotDaily) {
        let canClaimDaily = (lastLoginDate !== today);
        dotDaily.style.display = canClaimDaily ? 'block' : 'none';
    }
    
    // 2. Колесо Фортуны
    let dotWheel = document.getElementById('dot-wheel');
    if(dotWheel) {
        let canFreeSpin = (lastFreeSpinDate !== today);
        dotWheel.style.display = canFreeSpin ? 'block' : 'none';
    }
    
    // 3. Ежедневные задания
    let dotQuests = document.getElementById('dot-quests');
    if(dotQuests) {
        let hasUnclaimedQuest = dailyQuests.some(q => q.progress >= q.goal && !q.claimed);
        dotQuests.style.display = hasUnclaimedQuest ? 'block' : 'none';
    }
    
    // 4. Дневник Ведьмы (Ачивки)
    let dotAch = document.getElementById('dot-achievements');
    if (dotAch) {
        if (!playerEconomy.achTiers) playerEconomy.achTiers = {};
        
        // Убеждаемся, что массив ачивок загружен, прежде чем его проверять
        if (typeof achievementsList !== 'undefined') {
            let hasAch = achievementsList.some(ach => {
                let currentVal = playerStats[ach.statKey] || 0;
                let currentTier = playerEconomy.achTiers[ach.id] || 0;
                
                // ВАЖНО: Если у ачивки есть предел и мы его достигли - награды больше нет, точку не зажигаем
                if (ach.maxTier && currentTier >= ach.maxTier) return false;
                
                let targetVal = (currentTier + 1) * ach.step;
                return currentVal >= targetVal;
            });
            dotAch.style.display = hasAch ? 'block' : 'none';
        }
   } 
    
// 5. Совиная почта (Непрочитанные письма или незабранные награды)
    let dotMail = document.getElementById('dot-mail');
    let dotLetters = document.getElementById('dot-letters'); // Точка внутри меню
    
    if (typeof mailDB !== 'undefined') {
        if (!playerEconomy.readMails) playerEconomy.readMails = [];
        if (!playerEconomy.claimedMails) playerEconomy.claimedMails = [];
        if (!playerEconomy.deletedMails) playerEconomy.deletedMails = []; // Создаем список удаленных
        
        let currentDay = dailyStreak + 1;
        
        // НОВЫЕ СТРОЧКИ: Теперь игра игнорирует письма, которые лежат в deletedMails
        let hasUnreadMail = mailDB.some(m => currentDay >= m.reqDay && !playerEconomy.deletedMails.includes(m.id) && !playerEconomy.readMails.includes(m.id));
        let hasUnclaimedMail = mailDB.some(m => currentDay >= m.reqDay && m.reward && !playerEconomy.deletedMails.includes(m.id) && !playerEconomy.claimedMails.includes(m.id));
        
        let showDot = (hasUnreadMail || hasUnclaimedMail) ? 'block' : 'none';
        
        if (dotMail) dotMail.style.display = showDot;
        if (dotLetters) dotLetters.style.display = showDot;
    }
}


function renderQuests() {
    let list = document.getElementById('quests-list');
    if(!list) return;
    list.innerHTML = '';
    
    dailyQuests.forEach((q, index) => {
        let item = document.createElement('div');
        item.className = 'quest-item' + (q.claimed ? ' completed' : '');
        let isDone = (q.progress >= q.goal);
        let btnHTML = '';
        
        let rewardText = (q.id === 'bonus_all') ? '5 <img src="img/icons/spark.png" class="inline-icon">' : '3 <img src="img/icons/diamond.png" class="inline-icon">';
        
        if (q.claimed) {
            btnHTML = `<button class="quest-btn" disabled>✔</button>`;
        } else if (isDone) {
            btnHTML = `<button class="quest-btn" style="background-color: #4CAF50;" onclick="claimQuest(${index})">Забрать ${rewardText}</button>`;
        } else {
            btnHTML = `<button class="quest-btn" disabled>${q.progress} / ${q.goal} (${rewardText})</button>`;
        }
        
        item.innerHTML = `
            <div class="quest-info">
                <div class="quest-title">${q.title}</div>
                <div class="quest-progress">${q.desc}</div>
            </div>
            ${btnHTML}
        `;
        list.appendChild(item);
    });
}

function claimQuest(index) {
    let q = dailyQuests[index];
    if (q.progress >= q.goal && !q.claimed) {
        q.claimed = true;
        
        if (q.id === 'bonus_all') {
            playerEconomy.sparks += 5; 
            showCustomAlert('Поздравляем! Бонус за все задания: +5 <img src="img/icons/spark.png" class="inline-icon">', 'Магистр заданий');
        } else {
            playerEconomy.diamonds += 3; 
            let bonusQuest = dailyQuests.find(quest => quest.id === 'bonus_all');
            if (bonusQuest && !bonusQuest.claimed) {
                bonusQuest.progress = Math.min(bonusQuest.goal, bonusQuest.progress + 1);
            }
        }
        
        saveEconomy();
        saveQuests();
        renderQuests();
        playSound('reward');
    }
}

// Запускаем систему заданий при старте игры
initQuests();





function closeMailMenu() {
    let modal = document.getElementById('mail-modal');
    if (modal) modal.style.display = 'none';
}

function openCreatorNews() {
    let modal = document.getElementById('letters-modal');
    if (modal) {
        modal.style.display = 'flex';
        backToMailList(); 
    }
    closeMailMenu(); // Прячем главное меню, пока читаем письма
}

function closeLettersModal() {
    let modal = document.getElementById('letters-modal');
    if (modal) modal.style.display = 'none';
    openMailMenu(); // Возвращаемся обратно к трем кнопкам
}



// --- ЛОГИКА СОВИНОЙ ПОЧТЫ ---
let currentOpenMailId = null;

function openMailMenu() {
    let modal = document.getElementById('mail-modal');
    if (modal) {
        modal.style.display = 'flex';
        backToMailList(); 
    }
    updateBadges(); 
}



function backToMailList() {
    document.getElementById('mail-list-container').style.display = 'block';
    document.getElementById('mail-read-container').style.display = 'none';
    document.getElementById('mail-close-main-btn').style.display = 'block';
    renderMailList();
    updateBadges();
}

function renderMailList() {
    let container = document.getElementById('mail-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!playerEconomy.readMails) playerEconomy.readMails = [];
    if (!playerEconomy.claimedMails) playerEconomy.claimedMails = [];
    
    // Считаем дни в игре (dailyStreak начинается с 0, поэтому +1)
    let currentDay = dailyStreak; 
    let hasMails = false;
    
   [...mailDB].reverse().forEach(mail => {
        // Проверяем: пришло ли время письма И нет ли его в списке удаленных
        if (currentDay >= mail.reqDay && (!playerEconomy.deletedMails || !playerEconomy.deletedMails.includes(mail.id))) {
            hasMails = true;
            let isRead = playerEconomy.readMails.includes(mail.id);
            let isClaimed = playerEconomy.claimedMails.includes(mail.id);
            let hasReward = mail.reward !== null;
            
            // Если письмо не прочитано ИЛИ есть незабранная награда
            let needsAttention = !isRead || (hasReward && !isClaimed);
            let dotHtml = needsAttention ? `<div class="badge-dot" style="display: block; position: relative; top: 0; right: 0; margin-left: 10px;"></div>` : '';
            
            container.innerHTML += `
                <button class="mail-menu-btn" onclick="readMail('${mail.id}')" style="justify-content: space-between;">
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 8px;">${isRead ? '📜' : '✉️'}</span> ${mail.title}
                    </div>
                    ${dotHtml}
                </button>
            `;
        }
    });
    
    if (!hasMails) {
        container.innerHTML = '<p style="opacity: 0.7;">Почтовый ящик пока пуст. Загляни завтра!</p>';
    }
}

function readMail(id) {
    let mail = mailDB.find(m => m.id === id);
    if (!mail) return;
    
    currentOpenMailId = id;
    
    // Отмечаем как прочитанное
    if (!playerEconomy.readMails.includes(id)) {
        playerEconomy.readMails.push(id);
        saveEconomy();
    }
    
    document.getElementById('mail-list-container').style.display = 'none';
    document.getElementById('mail-close-main-btn').style.display = 'none';
    let readContainer = document.getElementById('mail-read-container');
    readContainer.style.display = 'flex';
    
    document.getElementById('mail-read-title').innerText = mail.title;
    document.getElementById('mail-read-text').innerHTML = mail.text;
    
    let claimBtn = document.getElementById('mail-claim-btn');
    let isClaimed = playerEconomy.claimedMails.includes(id);
    
    if (mail.reward && !isClaimed) {
        claimBtn.style.display = 'block';
        claimBtn.innerHTML = `Забрать ${mail.reward.text}`;
        claimBtn.disabled = false;
        claimBtn.style.backgroundColor = '#4CAF50';
    } else if (mail.reward && isClaimed) {
        claimBtn.style.display = 'block';
        claimBtn.innerHTML = `✔ Уже получено`;
        claimBtn.disabled = true;
        claimBtn.style.backgroundColor = 'var(--btn-alt)';
    } else {
        // Если награды нет (просто текст или промокод)
        claimBtn.style.display = 'none';
    }
}

function claimCurrentMail() {
    if (!currentOpenMailId) return;
    let mail = mailDB.find(m => m.id === currentOpenMailId);
    
    if (mail && mail.reward && !playerEconomy.claimedMails.includes(mail.id)) {
        if (mail.reward.hints) playerEconomy.hints += mail.reward.hints;
        if (mail.reward.sparks) playerEconomy.sparks += mail.reward.sparks;
        if (mail.reward.diamonds) playerEconomy.diamonds += mail.reward.diamonds;
        
        playerEconomy.claimedMails.push(mail.id);
        saveEconomy();
        playSound('reward');
        
        // Обновляем кнопку
        let claimBtn = document.getElementById('mail-claim-btn');
        claimBtn.innerHTML = `✔ Получено`;
        claimBtn.disabled = true;
        claimBtn.style.backgroundColor = 'var(--btn-alt)';
    }
}


// --- ТЕМА (СВЕТЛАЯ / ТЕМНАЯ) ---
function toggleTheme() {
    let themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    if (themeToggle.checked) {
        document.body.classList.add('dark-theme');
        localStorage.setItem('magicalTheme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('magicalTheme', 'light');
    }
    
    applyCustomization(); // <-- Это заставит игру сразу обновить цвета
}

// Загрузка темы при старте игры
function initTheme() {
    let storedTheme = localStorage.getItem('magicalTheme');
    let themeToggle = document.getElementById('theme-toggle');
    
    if (storedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    }
}
initTheme();
saveEconomy();



// === ЭТАП 4: ЛОГИКА МЕТА-ИГРЫ (ЧАСТЬ 1) ===

// --- 1. ЛОГИКА ЖАБКИ ---
let frogClicks = 0;

// НОВОЕ: Вспоминаем, на какой стороне сидела жабка в прошлый раз
let isFrogRight = localStorage.getItem('magicalFrogSide') === 'true';

// Сразу при запуске скрипта ставим её на сохраненное место
let frogElement = document.getElementById('frog-container');
if (frogElement && isFrogRight) {
    frogElement.style.left = '75%';
}

function pokeFrog() {
    let frog = document.getElementById('frog-container');
    if (!frog) return;
    
    frogClicks++;
    playSound('click'); 
    
    // Сбрасываем и запускаем анимацию обычного прыжка вверх
    frog.classList.remove('frog-jump'); 
    void frog.offsetWidth; 
    frog.classList.add('frog-jump');
    
    // Каждый 5-й клик перебрасываем её на другую сторону
    if (frogClicks % 5 === 0) {
        isFrogRight = !isFrogRight; 
        
        if (isFrogRight) {
            frog.style.left = '75%'; // Прыжок на правую половину экрана
        } else {
            frog.style.left = '25%'; // Прыжок обратно на левую половину
        }
        
        // НОВОЕ: Записываем новую позицию в память телефона
        localStorage.setItem('magicalFrogSide', isFrogRight);
    }
    
    // Убираем класс прыжка, когда анимация закончится
    setTimeout(() => frog.classList.remove('frog-jump'), 300);
}

// Вызываем переодевание при запуске игры, чтобы жабка надела то, что сохранено
setTimeout(updateFrogCosmetics, 500); 

 // Функция переодевания жабки
function updateFrogCosmetics() {
    if (typeof playerEconomy.equipped === 'string') {
        playerEconomy.equipped = { hat: 'hat_none', staff: 'staff_none', flag: 'flag_basic' };
        saveEconomy();
    }
    
    let currentHatKey = playerEconomy.equipped.hat;
    let currentStaffKey = playerEconomy.equipped.staff;
    
    let hatData = cosmeticsCatalog.hats[currentHatKey];
    let staffData = cosmeticsCatalog.staffs[currentStaffKey];
    
    let hatImg = document.getElementById('frog-hat');
    let staffImg = document.getElementById('frog-staff');
    
    // --- Прячем или показываем шляпу ---
    if (hatImg && hatData) {
        if (hatData.image === '') {
            hatImg.style.display = 'none'; // Прячем картинку полностью
        } else {
            hatImg.style.display = 'block';
            hatImg.src = hatData.image;
        }
    }
    
    // --- Прячем или показываем посох ---
    if (staffImg && staffData) {
        if (staffData.image === '') {
            staffImg.style.display = 'none'; // Прячем картинку полностью
        } else {
            staffImg.style.display = 'block';
            staffImg.src = staffData.image;
        }
    }
}

// Вызываем переодевание при запуске игры, чтобы жабка надела то, что сохранено
setTimeout(updateFrogCosmetics, 500);
// --- ЛОГИКА НОВОГО ГАРДЕРОБА ---
let currentShopCategory = 'hats'; // По умолчанию открываем шляпы

function openShopModal() {
    let ss = document.getElementById('shop-sparks'); if (ss) ss.innerText = playerEconomy.sparks;
    renderShop('hats'); 
    let m = document.getElementById('shop-modal');
    if(m) m.style.display = 'flex';
}

function renderShop(category) {
    currentShopCategory = category;
    let container = document.getElementById('shop-items-container');
    if (!container) return;
    container.innerHTML = '';
    
    ['hats', 'staffs', 'flags'].forEach(cat => {
        let tab = document.getElementById('tab-' + cat);
        if (tab) {
            if (cat === category) tab.classList.add('active');
            else tab.classList.remove('active');
        }
    });
    
    let items = cosmeticsCatalog[category];
    if (typeof playerEconomy.equipped === 'string') {
        playerEconomy.equipped = { hat: 'hat_basic', staff: 'staff_basic', flag: 'flag_basic' };
    }
    let slot = category.slice(0, -1);
    
    for (let key in items) {
        let item = items[key];
        let isOwned = playerEconomy.inventory.includes(key) || item.price === 0;
        let isEquipped = (playerEconomy.equipped[slot] === key);
        
        let btnText = isEquipped ? 'Надето' : (isOwned ? 'Надеть' : `Купить (${item.price} <img src="img/icons/spark.png" class="inline-icon">)`);
        let disabledStr = isEquipped ? 'disabled' : '';
        
       let imageHTML = '';
        if (item.image) {
            // Если есть картинка — показываем картинку
            imageHTML = `<img src="${item.image}" style="width: 36px; height: 36px; flex-shrink: 0; object-fit: contain; border-radius: 8px; background: var(--cell-closed); padding: 2px;" alt="Иконка">`;
        } else if (item.emoji) {
            // Если картинки нет, но есть смайлик (наш флажок) — показываем смайлик
            imageHTML = `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--cell-closed); border-radius: 8px;">${item.emoji}</div>`;
        } else {
            // Если нет ни того, ни другого (Без шляпы / Без посоха) — показываем крестик
            imageHTML = `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--cell-closed); border-radius: 8px;">❌</div>`;
        }
        
        container.innerHTML += `
            <div class="meta-card" style="width: 100%; margin-bottom: 12px; display: flex; flex-direction: column; align-items: center; padding: 10px; box-sizing: border-box; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center;">
                    ${imageHTML}
                    <h3 style="margin: 0; font-size: 14px; line-height: 1.2;">${item.name}</h3>
                </div>
                <button ${disabledStr} style="margin: 0; padding: 8px; font-size: 12px; width: 100%;" onclick="buyOrEquipItem('${category}', '${key}')">${btnText}</button>
            </div>
        `;
    }
}

function buyOrEquipItem(category, key) {
    let item = cosmeticsCatalog[category][key];
    let isOwned = playerEconomy.inventory.includes(key);
    
    if (!isOwned) {
        if (playerEconomy.sparks < item.price) {
            showCustomAlert('Не хватает Искр! ✨ Выполняй ачивки!');
            return;
        }
        playerEconomy.sparks -= item.price; 
        playerEconomy.inventory.push(key);  
    }
    
    // ХИТРОСТЬ: отрезаем 's', чтобы положить вещь в нужный слот жабке
    let slot = category.slice(0, -1);
    playerEconomy.equipped[slot] = key;
    
    saveEconomy();
    updateFrogCosmetics(); 
    renderShop(category); 
}

// --- 3. ЛОГИКА АЧИВОК (ДНЕВНИК ВЕДЬМЫ) ---
function openAchievementsModal() {
    let ps = document.getElementById('player-sparks'); if (ps) ps.innerText = playerEconomy.sparks;
    renderAchievements();
    let m = document.getElementById('achievements-modal');
    if(m) m.style.display = 'flex';
}

function renderAchievements() {
    let container = document.getElementById('achievements-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!playerEconomy.achTiers) playerEconomy.achTiers = {};
    
    achievementsList.forEach(ach => {
        let currentVal = playerStats[ach.statKey] || 0;
        let currentTier = playerEconomy.achTiers[ach.id] || 0;
        let targetVal = (currentTier + 1) * ach.step; 
        
        let canClaim = currentVal >= targetVal;
        
        let btnHtml = canClaim 
            ? `<button style="background: #22c55e; color: white; margin: 0; padding: 6px 10px; font-size: 12px; flex-shrink: 0; white-space: nowrap;" onclick="claimAchievement('${ach.id}')">Забрать ${ach.reward} ✨</button>`
            : `<button disabled style="margin: 0; padding: 6px 10px; font-size: 12px; flex-shrink: 0; white-space: nowrap;">В процессе (${ach.reward} ✨)</button>`;
              
        container.innerHTML += `
            <div class="meta-card" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px; box-sizing: border-box; gap: 8px; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 0; text-align: left;">
                    <h3 style="margin: 0; color: #fbbf24; font-size: 13px; white-space: normal; line-height: 1.1;">${ach.title}</h3>
                    <p style="margin: 4px 0 0 0; font-size: 11px; line-height: 1.2;">${ach.desc}:<br>${currentVal} / ${targetVal}</p>
                </div>
                ${btnHtml}
            </div>
        `;
    });
}

function claimAchievement(achId) {
    let ach = achievementsList.find(a => a.id === achId);
    if (!ach) return;

    if (!playerEconomy.achTiers) playerEconomy.achTiers = {};
    let currentTier = playerEconomy.achTiers[achId] || 0;
    
    playerEconomy.sparks += ach.reward; // Выдаем искры
    playerEconomy.achTiers[achId] = currentTier + 1; // Переходим на следующую ступень
    
    playSound('reward'); // <--- ДОБАВИЛИ ЗВУК НАГРАДЫ ВОТ СЮДА
    
    saveEconomy();
    renderAchievements(); // Обновляем окно ачивок
    updateBadges();
}

// =========================================
// КАТАЛОГ ОФОРМЛЕНИЯ (ИДЕАЛЬНЫЕ ПАРЫ)
// =========================================
const customizationCatalog = {
    backgrounds: {
        'bg_default': { name: 'Грибной', price: 0, light: '#FAEDDF', dark: '#272A30', svg: `<text x='20' y='45' font-size='26' opacity='{op}'>🍄</text>` },
        'bg_stars': { name: 'Звездный', price: 100, light: '#F0F4F8', dark: '#1C2026', svg: `<text x='15' y='35' font-size='22' transform='rotate(-15 15 35)' opacity='{op}'>✨</text><text x='55' y='65' font-size='16' transform='rotate(20 55 65)' opacity='{op}'>⭐</text>` },
        'bg_forest': { name: 'Чаща', price: 100, light: '#EBF2EA', dark: '#1D241E', svg: `<text x='20' y='30' font-size='20' transform='rotate(-25 20 30)' opacity='{op}'>🍃</text><text x='50' y='60' font-size='24' transform='rotate(15 50 60)' opacity='{op}'>🌿</text>` },
        'bg_witch': { name: 'Ковен', price: 100, light: '#F4EDF5', dark: '#251E2B', svg: `<text x='10' y='30' font-size='22' transform='rotate(-20 10 30)' opacity='{op}'>🌙</text><text x='50' y='65' font-size='24' transform='rotate(10 50 65)' opacity='{op}'>🔮</text>` },
        'bg_candy': { name: 'Сладости', price: 100, light: '#F5EBEB', dark: '#2E2224', svg: `<text x='20' y='35' font-size='22' transform='rotate(-10 20 35)' opacity='{op}'>🍬</text><text x='55' y='70' font-size='18' transform='rotate(25 55 70)' opacity='{op}'>🌸</text>` },
        'bg_ocean': { name: 'Океан', price: 100, light: '#EBF4F5', dark: '#1A2529', svg: `<text x='15' y='35' font-size='20' transform='rotate(-15 15 35)' opacity='{op}'>🐚</text><text x='50' y='65' font-size='24' opacity='{op}'>🫧</text>` }
    },
    blocks: {
        'block_default': { 
            name: 'Базовые', price: 0, 
            light: { bg: '#EEDCC6', openBg: '#FAEDDF', shadow: 'inset -2px -2px 4px rgba(0,0,0,0.1)', radius: '15%', border: '1px solid #8B6B56' },
            dark: { bg: '#363A43', openBg: '#1F2227', shadow: 'inset -2px -2px 4px rgba(0,0,0,0.25)', radius: '15%', border: '1px solid #4D535E' }
        },
        'block_stars': { 
            name: 'Звездные', price: 100, 
            light: { bg: 'linear-gradient(135deg, #E1E8F0 0%, #C8D6E5 100%)', openBg: '#F0F4F8', shadow: 'inset 2px 2px 4px #FFF', radius: '20%', border: '1px solid #A8B8C8' },
            dark: { bg: 'linear-gradient(135deg, #2B313A 0%, #20252C 100%)', openBg: '#15181C', shadow: 'inset 2px 2px 4px #3C4450', radius: '20%', border: '1px solid #15181C' }
        },
        'block_forest': { 
            name: 'Лесные', price: 100, 
            light: { bg: 'linear-gradient(135deg, #DCE5D8 0%, #C5D1C0 100%)', openBg: '#EBF2EA', shadow: 'inset 2px 2px 4px #FFF', radius: '15%', border: '1px solid #A3B59D' },
            dark: { bg: 'linear-gradient(135deg, #2D382E 0%, #232B24 100%)', openBg: '#161C17', shadow: 'inset 2px 2px 4px #3D4A3E', radius: '15%', border: '1px solid #161C17' }
        },
        'block_magic': { 
            name: 'Гримуар', price: 100, 
            light: { bg: 'linear-gradient(180deg, #E6DBE8 0%, #D1C2D4 100%)', openBg: '#F4EDF5', shadow: 'inset 2px 2px 4px #FFF', radius: '10%', border: '1px solid #D4AF37' },
            dark: { bg: 'linear-gradient(180deg, #382E40 0%, #2C2433 100%)', openBg: '#1B1620', shadow: 'inset 1px 1px 2px rgba(255,255,255,0.1)', radius: '10%', border: '1px solid #8B6508' }
        },
        'block_candy': { 
            name: 'Сладости', price: 100, 
            light: { bg: 'radial-gradient(circle, #EADAE0 0%, #DDBFC5 100%)', openBg: '#F5EBEB', shadow: 'inset 2px 2px 4px #FFF', radius: '35%', border: 'none' },
            dark: { bg: 'radial-gradient(circle, #433235 0%, #36282A 100%)', openBg: '#21181A', shadow: 'inset 2px 2px 4px #5A4347', radius: '35%', border: 'none' }
        },
        'block_ocean': { 
            name: 'Жемчуг', price: 100, 
            light: { bg: 'linear-gradient(135deg, #D8EAEB 0%, #BCD8DB 100%)', openBg: '#EBF4F5', shadow: 'inset 2px 2px 4px #FFF', radius: '25%', border: '1px solid #9ABCC0' },
            dark: { bg: 'linear-gradient(135deg, #28373D 0%, #1F2A2F 100%)', openBg: '#121A1D', shadow: 'inset 2px 2px 4px #354952', radius: '25%', border: '1px solid #121A1D' }
        }
    }
};

let currentCustCategory = 'backgrounds';

function openGalleryModal() {
    let gs = document.getElementById('gallery-sparks'); if (gs) gs.innerText = playerEconomy.sparks;
    renderCustomization('backgrounds');
    let m = document.getElementById('gallery-modal');
    if(m) m.style.display = 'flex';
}

function renderCustomization(category) {
    currentCustCategory = category;
    let container = document.getElementById('customization-items-container');
    if (!container) return;
    container.innerHTML = '';
    
    ['backgrounds', 'blocks'].forEach(cat => {
        let tab = document.getElementById('tab-' + cat);
        if (tab) {
            if (cat === category) tab.classList.add('active');
            else tab.classList.remove('active');
        }
    });
    
    let items = customizationCatalog[category];
    let isDark = document.body.classList.contains('dark-theme');
    
    for (let key in items) {
        let item = items[key];
        let isUnlocked = playerEconomy.unlockedCust.includes(key);
        let isEquipped = (playerEconomy.equippedCust[category] === key);
        
        let btnText = isEquipped ? 'Надето' : (isUnlocked ? 'Применить' : `Купить (${item.price} ✨)`);
        let disabledStr = isEquipped ? 'disabled' : '';
        
        let previewHtml = '';
        if (category === 'backgrounds') {
            let bgColor = isDark ? item.dark : item.light;
            let svgContent = item.svg.replace(/{op}/g, '0.6'); 
            
            // ИДЕАЛЬНЫЙ ФИКС: Кодируем только спецсимволы и кавычки (в %22), смайлики оставляем живыми!
            let rawSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>${svgContent}</svg>`;
            let safeSvg = rawSvg.replace(/'/g, "%22").replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23");
            let bgPattern = `url("data:image/svg+xml,${safeSvg}")`;
            
            // ВАЖНО: Атрибут style теперь обернут в одинарные кавычки (style='...'), чтобы не конфликтовать с url("...")
            previewHtml = `<div style='width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; background-color: ${bgColor}; background-image: ${bgPattern}; border: 2px solid var(--text-main);'></div>`;
        } else {
            let bColors = (key === 'block_default') 
                ? { bg: 'var(--cell-closed)', shadow: 'inset -2px -3px 5px rgba(0,0,0,0.1)', radius: '8px', border: '1px solid var(--cell-border)' } 
                : (isDark ? item.dark : item.light);
            let bBorder = bColors.border || '1px solid var(--cell-border)';
                
            // То же самое: используем одинарные кавычки для style
            previewHtml = `<div style='width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; background-color: var(--bg-main); display: flex; align-items: center; justify-content: center; border: 2px solid var(--text-main);'>
                <div style='width: 24px; height: 24px; border: ${bBorder}; background: ${bColors.bg}; box-shadow: ${bColors.shadow}; border-radius: ${bColors.radius};'></div>
            </div>`;
        }
        
        container.innerHTML += `
            <div class="meta-card" style="width: 100%; margin-bottom: 12px; display: flex; flex-direction: column; align-items: center; padding: 10px; box-sizing: border-box; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center;">
                    ${previewHtml}
                    <h3 style="margin: 0; font-size: 14px; line-height: 1.2;">${item.name}</h3>
                </div>
                <button ${disabledStr} style="margin: 0; padding: 8px; font-size: 12px; width: 100%;" onclick="buyOrEquipCust('${category}', '${key}')">${btnText}</button>
            </div>
        `;
    }
}

// --- ПРИМЕНЕНИЕ ЦВЕТОВ К ИГРЕ ---
function applyCustomization() {
    if (!playerEconomy.equippedCust) playerEconomy.equippedCust = { backgrounds: 'bg_default', blocks: 'block_default' };
    
    let isDark = document.body.classList.contains('dark-theme');
    let bodyStyle = document.body.style;
    
    bodyStyle.setProperty('--panel-bg', isDark ? '#3E4861' : '#EEDCC6');
    bodyStyle.setProperty('--text-main', isDark ? '#FDE8B5' : '#8B6B56');
    bodyStyle.setProperty('--cell-border', isDark ? '#5C7C89' : '#8B6B56'); 
    bodyStyle.setProperty('--btn-action', isDark ? '#6FB9B9' : '#B4E1B4');
    bodyStyle.setProperty('--btn-alt', isDark ? '#5C7C89' : '#C5E3F6');
    bodyStyle.setProperty('--btn-bg', isDark ? '#9B7E9F' : '#FADCD9');
    
    let bgKey = playerEconomy.equippedCust.backgrounds || 'bg_default';
    let bgData = customizationCatalog.backgrounds[bgKey] || customizationCatalog.backgrounds['bg_default'];
    
    let bgColor = isDark ? bgData.dark : bgData.light;
 let opacity = isDark ? '0.25' : '0.35';
    let svgContent = bgData.svg.replace(/{op}/g, opacity);
    
    // Применяем тот же надежный метод для фона самой игры
    let rawSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>${svgContent}</svg>`;
    let safeSvg = rawSvg.replace(/'/g, "%22").replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23");
    let pattern = `url("data:image/svg+xml,${safeSvg}")`;
    
    bodyStyle.setProperty('--bg-main', bgColor);
    bodyStyle.setProperty('--bg-pattern', pattern);
    
    let blockKey = playerEconomy.equippedCust.blocks || 'block_default';
    let blockData = customizationCatalog.blocks[blockKey] || customizationCatalog.blocks['block_default'];
    
    if (blockKey === 'block_default') {
        // Четко разделяем цвета для открытых и закрытых!
        let closedBg = isDark ? '#3E4861' : '#EEDCC6';
        let openBg = isDark ? '#2A3143' : '#FAEDDF';
        
        bodyStyle.setProperty('--cust-cell-bg', closedBg);
        bodyStyle.setProperty('--cust-cell-shadow', 'inset -2px -2px 4px rgba(0,0,0,0.15)');
        bodyStyle.setProperty('--cust-cell-radius', '15%');
        bodyStyle.setProperty('--cust-cell-border', isDark ? '1px solid #5C7C89' : '1px solid #8B6B56');
        bodyStyle.setProperty('--cust-cell-open-bg', openBg);
    } else {
        let bColors = isDark ? blockData.dark : blockData.light;
        bodyStyle.setProperty('--cust-cell-bg', bColors.bg);
        bodyStyle.setProperty('--cust-cell-shadow', bColors.shadow);
        bodyStyle.setProperty('--cust-cell-radius', bColors.radius);
        bodyStyle.setProperty('--cust-cell-border', bColors.border || '1px solid var(--cell-border)');
        bodyStyle.setProperty('--cust-cell-open-bg', bColors.openBg);
    }
}

function buyOrEquipCust(category, key) {
    let item = customizationCatalog[category][key];
    let isUnlocked = playerEconomy.unlockedCust.includes(key);
    
    if (!isUnlocked) {
        if (playerEconomy.sparks < item.price) {
            showCustomAlert('Не хватает Искр! ✨');
            return;
        }
        playerEconomy.sparks -= item.price;
        playerEconomy.unlockedCust.push(key);
        playSound('reward');
    } else {
        playSound('click');
    }
    
    playerEconomy.equippedCust[category] = key;
    saveEconomy();
    applyCustomization();
    renderCustomization(category);
    
    let gs = document.getElementById('gallery-sparks'); if (gs) gs.innerText = playerEconomy.sparks;
}






applyCustomization();


function revealAllBombs() {
    cells.forEach((cell, index) => {
        if (bombs.includes(index)) {
            if (!cell.classList.contains('flagged') && !cell.classList.contains('open')) {
                cell.innerHTML = '<img src="img/icons/cauldron.png" style="width: 80%; height: 80%; object-fit: contain; pointer-events: none;" alt="Котел">';
                cell.classList.add('open');
            }
        } else {
            if (cell.classList.contains('flagged')) {
                cell.innerText = '❌'; 
            }
        }
    });
}


function restartGame() {
    // Просто запускаем создание нового поля
    createBoard();
}

// --- УНИВЕРСАЛЬНЫЕ КРАСИВЫЕ УВЕДОМЛЕНИЯ (БРОНЕБОЙНЫЕ) ---
function showCustomAlert(message, title) {
    if (!title) title = 'Жабка сообщает'; // Убрали смайл жабки
    let modal = document.getElementById('custom-alert-modal');
    let titleEl = document.getElementById('custom-alert-title');
    let msgEl = document.getElementById('custom-alert-message');

    if (modal && titleEl && msgEl) {
        titleEl.innerHTML = title; // ТЕПЕРЬ ПОНИМАЕТ КАРТИНКИ
        msgEl.innerHTML = message; // ТЕПЕРЬ ПОНИМАЕТ КАРТИНКИ
        modal.style.display = 'flex';
    } else {
        alert("Сообщение: " + message);
    }
}

// --- ЛОГИКА КАРУСЕЛИ ОБУЧЕНИЯ ---
let currentSlide = 0;

function showSlide(index) {
    let slides = document.querySelectorAll('.carousel-slide');
    let dots = document.querySelectorAll('.dot');
    
    if (slides.length === 0) return;
    
    // Блокируем круговую прокрутку (упираемся в края)
    if (index >= slides.length) currentSlide = slides.length - 1;
    else if (index < 0) currentSlide = 0;
    else currentSlide = index;
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    
    // 1. УПРАВЛЯЕМ ЛЕВОЙ КНОПКОЙ (Выход / Назад)
    let prevBtn = document.getElementById('btn-prev-slide');
    if (prevBtn) {
        if (currentSlide === 0) {
            prevBtn.innerHTML = 'Выйти ✖';
        } else {
            prevBtn.innerHTML = '⬅ Назад';
        }
    }

    // 2. УПРАВЛЯЕМ ПРАВОЙ КНОПКОЙ (Далее / Закрыть)
    let nextBtn = document.getElementById('btn-next-slide');
    if (nextBtn) {
        if (currentSlide === slides.length - 1) {
            nextBtn.innerHTML = 'Закрыть ✔';
            nextBtn.style.backgroundColor = '#4CAF50'; 
            nextBtn.style.color = 'white';
        } else {
            nextBtn.innerHTML = 'Далее ➡';
            nextBtn.style.backgroundColor = 'var(--btn-action)'; 
            nextBtn.style.color = 'var(--text-main)';
        }
    }
}

function moveSlide(step) {
    showSlide(currentSlide + step);
    playSound('click');
}

function setSlide(index) {
    showSlide(index);
    playSound('click');
}

// ОБРАБОТЧИК ДЛЯ ЛЕВОЙ КНОПКИ
function prevSlideOrExit() {
    if (currentSlide === 0) {
        // Если это первый слайд — возвращаемся в главное меню
        showScreen('main-menu');
        playSound('click');
    } else {
        // Иначе просто листаем на слайд назад
        moveSlide(-1);
    }
}

// ОБРАБОТЧИК ДЛЯ ПРАВОЙ КНОПКИ
function nextSlideOrClose() {
    let slides = document.querySelectorAll('.carousel-slide');
    if (currentSlide >= slides.length - 1) {
        // Если это последний слайд — возвращаемся в главное меню
        showScreen('main-menu');
        playSound('click');
    } else {
        // Иначе листаем вперед
        moveSlide(1);
    }
}






  
// --- СБРОС ПРОГРЕССА ---
function confirmReset() {
    let modal = document.getElementById('reset-confirm-modal');
    if (modal) {
        modal.style.display = 'flex';
        playSound('click');
    }
}

// --- ФУНКЦИЯ УДАЛЕНИЯ ПИСЬМА ---
function deleteCurrentMail() {
    if (!currentOpenMailId) return;
    
    // Создаем корзину, если её еще нет
    if (!playerEconomy.deletedMails) playerEconomy.deletedMails = [];
    
    // Добавляем письмо в удаленные
    if (!playerEconomy.deletedMails.includes(currentOpenMailId)) {
        playerEconomy.deletedMails.push(currentOpenMailId);
        saveEconomy();
    }
    
    showCustomAlert("Письмо сожжено в котле! 🔥", "Почта");
    backToMailList();
    updateBadges(); // Сразу гасим красную точку
}
// --- УМНЫЙ МОСТ ДЛЯ ОБЛАКА ВКОНТАКТЕ ---


function syncToCloud() {
    if (typeof vkBridge === 'undefined') return;

    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => {
        let dataToSave = {};
        // Собираем все сохранения жабки в один объект
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && key.startsWith('magical')) {
                dataToSave[key] = localStorage.getItem(key);
            }
        }
        
        // Отправляем всё одним ключом 'magical_vk_save' (требование ВК)
        vkBridge.send('VKWebAppStorageSet', {
            key: 'magical_vk_save',
            value: JSON.stringify(dataToSave)
        }).then(() => {
            console.log('Прогресс сохранен в облако ВК!');
        }).catch(console.error);
        
    }, 2000); 
}

// --- ПОЛНЫЙ СБРОС ИГРЫ ---
function executeReset() {
    // Очищаем облако ВК
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppStorageSet', { key: 'magical_vk_save', value: '' });
    }
    
    // Очищаем память телефона
    localStorage.clear();
    
    let modal = document.getElementById('reset-confirm-modal');
    if (modal) modal.style.display = 'none';
    
    // Перезагрузка
    window.location.reload();
}

// --- РЕКЛАМА ЗА ВОЗНАГРАЖДЕНИЕ ВКОНТАКТЕ ---
function showRewardedAd(onSuccess) {
    if (typeof vkBridge !== 'undefined') {
        // Ставим музыку на паузу перед видео (если она у нас есть)
        if (typeof bgMusic !== 'undefined' && bgMusic) bgMusic.pause();
        
        vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
            .then((data) => {
                if (data.result) {
                    // Игрок досмотрел видео до конца — выдаем награду!
                    if (onSuccess) onSuccess();
                } else {
                    console.log('Реклама закрыта до завершения');
                }
                // Возобновляем музыку после закрытия рекламы
                if (typeof bgMusic !== 'undefined' && musicOn) bgMusic.play();
            })
            .catch((error) => {
                console.error('Ошибка показа видео ВК', error);
                // Если реклама не загрузилась, возвращаем музыку
                if (typeof bgMusic !== 'undefined' && musicOn) bgMusic.play();
            });
    } else {
        // Для тестов в TrebEdit просто выдаем награду мгновенно
        if (onSuccess) onSuccess();
    }
}

// --- МЕЖСТРАНИЧНАЯ РЕКЛАМА ВКОНТАКТЕ ---
function showFullscreenAd() {
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
            .then((data) => {
                console.log('Межстраничная реклама ВК показана');
            })
            .catch((error) => {
                console.warn('Ошибка показа рекламы ВК или рекламы сейчас нет', error);
            });
    }
}
// --- ОБНОВЛЕННЫЕ ФУНКЦИИ КНОПОК ---

function watchAdForDiamonds() {
    showRewardedAd(() => {
        showCustomAlert('Спасибо за просмотр! +15 <img src="img/icons/diamond.png" class="inline-icon">', 'Награда');
        playerEconomy.diamonds += 15;
        playerStats.adsWatched = (playerStats.adsWatched || 0) + 1;
        saveEconomy();
        closeModal('ad-modal');
        playSound('reward');
        trackQuest('watch_ads', 1);
    });
}

function buyHint(method) {
    if (method === 'diamonds') {
        if (playerEconomy.diamonds < 5) { showCustomAlert('Не хватает алмазов!', 'Внимание!'); return; }
        playerEconomy.diamonds -= 5;
        playerEconomy.hints += 1;
        trackQuest('spend_diamonds', 5); 
        saveEconomy();
        closeModal('hint-modal');
    } else if (method === 'ad') {
        showRewardedAd(() => {
            showCustomAlert('Спасибо за просмотр! +3 <img src="img/icons/hint.png" class="inline-icon">', 'Награда');
            playerEconomy.hints += 3;
            trackQuest('watch_ads', 1); 
            playerStats.adsWatched = (playerStats.adsWatched || 0) + 1;
            saveEconomy();
            closeModal('hint-modal');
        });
    }
}

function executeRevival() {
    saveEconomy();
    closeModal('revive-modal');
    let modal = document.getElementById('revive-modal');
    let index = parseInt(modal ? modal.dataset.bombIndex : '0');
    
    if(cells[index]) {
        cells[index].classList.remove('exploded', 'open');
        cells[index].classList.add('flagged');
        cells[index].style.backgroundColor = '';
        
        let flagKey = playerEconomy.equipped.flag;
        if (!flagKey || !cosmeticsCatalog.flags[flagKey]) flagKey = 'flag_basic';
        
        let flagData = cosmeticsCatalog.flags[flagKey];
        if (flagData.image) {
            cells[index].innerHTML = `<img src="${flagData.image}" style="width: 75%; height: 75%; pointer-events: none;" alt="Флажок">`;
        } else {
            cells[index].innerHTML = `<span style="pointer-events: none;">${flagData.emoji || '🚩'}</span>`;
        }
    }
    
    flagsCount++;
    isGameOver = false; 
    wasRevivedThisGame = true; 
    trackQuest('revive', 1); 
    updateCounter();
    checkWinByFlags();
    saveGameState();
}

function revive(method) {
    if (method === 'diamonds') {
        let reviveCost = currentDiff === 'easy' ? 10 : (currentDiff === 'medium' ? 15 : 20);
        if (playerEconomy.diamonds < reviveCost) { showCustomAlert('Не хватает алмазов!'); return; }
        playerEconomy.diamonds -= reviveCost;
        trackQuest('spend_diamonds', reviveCost); 
        executeRevival();
    } else if (method === 'ad') {
        showRewardedAd(() => {
            trackQuest('watch_ads', 1);
            playerStats.adsWatched = (playerStats.adsWatched || 0) + 1;
            executeRevival();
        });
    }
}

// ==========================================
// ЛОГИКА ЗАГРУЗКИ И ПЕРВОГО СТАРТА
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Ждем 2.5 секунды, пока красиво заполняется полоска загрузки
    setTimeout(() => {
        let loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0'; // Запускаем плавное исчезновение
            setTimeout(() => loader.style.display = 'none', 500); // Прячем полностью
        }
       


// ---ПАУЗА ПРИ СВОРАЧИВАНИИ ---
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Игрок свернул вкладку — выключаем музыку
        if (audioSystem.bgm) audioSystem.bgm.pause();
    } else {
        // Игрок вернулся — включаем музыку, если она разрешена в настройках
        if (settings.music && audioSystem.bgm) audioSystem.bgm.play().catch(() => {});
    }
});
