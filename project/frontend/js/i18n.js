// Переводы и переключатель языка (RU / EN)
const I18N = {
    ru: {
        'page.title': 'ZanyTool — мультитул',
        'header.sub': 'Мультитул задач, которые Zany собрал для себя на одном сайте',
        'footer': 'ZanyTool • Вайбкодинг проект',

        // Downloader
        'dl.urlPlaceholder': 'Вставь ссылку на YouTube или Twitch (видео, клип или стрим)',
        'dl.find': 'Найти',
        'dl.searching': 'Ищем...',
        'dl.videoTitlePlaceholder': 'Название видео подгрузится здесь',
        'dl.duration': 'Длительность: {d}',
        'dl.fileName': 'Название файла',
        'dl.fileNamePlaceholder': 'Введите название файла',
        'dl.format': 'Формат',
        'dl.formatVideo': 'Видео (MP4)',
        'dl.formatAudio': 'Аудио (MP3)',
        'dl.quality': 'Качество',
        'dl.download': 'Скачать файл',
        'dl.downloading': 'Скачивание...',
        'dl.connecting': 'Подключение... 0%',
        'dl.progressVideo': 'Скачивание видео... {p}%',
        'dl.progressAudio': 'Скачивание аудио... {p}%',
        'dl.recording': 'Запись стрима... {p}%',
        'dl.live': '🔴 В эфире сейчас',
        'dl.liveLength': 'Сколько записывать',
        'dl.live1': '1 минута',
        'dl.live5': '5 минут',
        'dl.live10': '10 минут',
        'dl.live30': '30 минут',
        'dl.live60': '1 час',
        'dl.liveHint': 'Запись начнётся с текущего момента эфира и остановится по таймеру. Рекламные вставки могут попасть в запись.',
        'dl.processing': 'Обработка файла...',
        'dl.done': 'Готово! Загрузка завершена',
        'dl.alertEnterUrl': 'Введите ссылку на видео!',
        'dl.errFetch': 'Ошибка при получении данных',
        'dl.errFetchPrefix': 'Ошибка: ',
        'dl.errDownload': 'Ошибка скачивания',
        'dl.errDownloadPrefix': 'Ошибка при скачивании: ',

        // Общие подписи прогресса
        'stat.downloaded': 'Скачано',
        'stat.speed': 'Скорость',
        'stat.eta': 'Осталось',
        'stat.uploaded': 'Загружено',
        'stat.processed': 'Обработано',
        'stat.received': 'Получено',
        'badge.preparing': 'Подготовка',
        'badge.video': 'Видео',
        'badge.audio': 'Аудио',
        'badge.recording': 'Запись',
        'badge.processing': 'Обработка',
        'badge.transfer': 'Передача',
        'badge.upload': 'Загрузка',
        'badge.converting': 'Конвертация',
        'badge.done': 'Готово',
        'transfer.text': 'Передача файла на ваш ПК... {p}%',

        // Единицы
        'unit.mb': 'МБ',
        'unit.gb': 'ГБ',
        'unit.perSec': '/с',

        // Converter
        'conv.dropTitle': 'Перетащи файл сюда или нажми для выбора',
        'conv.dropChange': 'Выбрать другой файл',
        'conv.dropSub': 'Изображения, видео и аудио',
        'conv.convertTo': 'Конвертировать в',
        'conv.quality': 'Качество',
        'conv.qHigh': 'Высокое',
        'conv.qMedium': 'Среднее',
        'conv.qLow': 'Низкое (меньше размер)',
        'conv.convert': 'Конвертировать',
        'conv.converting': 'Конвертация...',
        'conv.convertingPct': 'Конвертация... {p}%',
        'conv.uploading': 'Загрузка файла... {p}%',
        'conv.done': 'Готово! Конвертация завершена',
        'conv.groupVideo': 'Видео',
        'conv.groupAudio': 'Только звук (извлечь аудио)',
        'conv.unsupported': 'Этот тип файла не поддерживается: {name}',
        'conv.errUnknown': 'Неизвестная ошибка',
        'conv.errPrefix': 'Ошибка при конвертации: ',
        'conv.errNetwork': 'Не удалось связаться с сервером',
        'cat.image': 'ФОТО',
        'cat.video': 'ВИДЕО',
        'cat.audio': 'АУДИО'
    },
    en: {
        'page.title': 'ZanyTool — multitool',
        'header.sub': 'A multitool of tasks Zany built for himself, all on one site',
        'footer': 'ZanyTool • Vibe-coded project',

        // Downloader
        'dl.urlPlaceholder': 'Paste a YouTube or Twitch link (video, clip or stream)',
        'dl.find': 'Find',
        'dl.searching': 'Searching...',
        'dl.videoTitlePlaceholder': 'The video title will appear here',
        'dl.duration': 'Duration: {d}',
        'dl.fileName': 'File name',
        'dl.fileNamePlaceholder': 'Enter a file name',
        'dl.format': 'Format',
        'dl.formatVideo': 'Video (MP4)',
        'dl.formatAudio': 'Audio (MP3)',
        'dl.quality': 'Quality',
        'dl.download': 'Download file',
        'dl.downloading': 'Downloading...',
        'dl.connecting': 'Connecting... 0%',
        'dl.progressVideo': 'Downloading video... {p}%',
        'dl.progressAudio': 'Downloading audio... {p}%',
        'dl.recording': 'Recording stream... {p}%',
        'dl.live': '🔴 Live now',
        'dl.liveLength': 'Record for',
        'dl.live1': '1 minute',
        'dl.live5': '5 minutes',
        'dl.live10': '10 minutes',
        'dl.live30': '30 minutes',
        'dl.live60': '1 hour',
        'dl.liveHint': 'Recording starts from the current moment of the stream and stops on the timer. Ads may end up in the recording.',
        'dl.processing': 'Processing file...',
        'dl.done': 'Done! Download complete',
        'dl.alertEnterUrl': 'Enter a video link!',
        'dl.errFetch': 'Failed to get video data',
        'dl.errFetchPrefix': 'Error: ',
        'dl.errDownload': 'Download failed',
        'dl.errDownloadPrefix': 'Download error: ',

        // Общие подписи прогресса
        'stat.downloaded': 'Downloaded',
        'stat.speed': 'Speed',
        'stat.eta': 'Remaining',
        'stat.uploaded': 'Uploaded',
        'stat.processed': 'Processed',
        'stat.received': 'Received',
        'badge.preparing': 'Preparing',
        'badge.video': 'Video',
        'badge.audio': 'Audio',
        'badge.recording': 'Recording',
        'badge.processing': 'Processing',
        'badge.transfer': 'Transfer',
        'badge.upload': 'Upload',
        'badge.converting': 'Converting',
        'badge.done': 'Done',
        'transfer.text': 'Sending file to your PC... {p}%',

        // Единицы
        'unit.mb': 'MB',
        'unit.gb': 'GB',
        'unit.perSec': '/s',

        // Converter
        'conv.dropTitle': 'Drop a file here or click to choose',
        'conv.dropChange': 'Choose another file',
        'conv.dropSub': 'Images, video and audio',
        'conv.convertTo': 'Convert to',
        'conv.quality': 'Quality',
        'conv.qHigh': 'High',
        'conv.qMedium': 'Medium',
        'conv.qLow': 'Low (smaller size)',
        'conv.convert': 'Convert',
        'conv.converting': 'Converting...',
        'conv.convertingPct': 'Converting... {p}%',
        'conv.uploading': 'Uploading file... {p}%',
        'conv.done': 'Done! Conversion complete',
        'conv.groupVideo': 'Video',
        'conv.groupAudio': 'Audio only (extract sound)',
        'conv.unsupported': 'This file type is not supported: {name}',
        'conv.errUnknown': 'Unknown error',
        'conv.errPrefix': 'Conversion error: ',
        'conv.errNetwork': 'Could not reach the server',
        'cat.image': 'IMAGE',
        'cat.video': 'VIDEO',
        'cat.audio': 'AUDIO'
    }
};

let currentLang = 'ru';
try {
    const saved = localStorage.getItem('zanytool_lang');
    if (saved === 'ru' || saved === 'en') currentLang = saved;
} catch (e) {
    // localStorage может быть недоступен, тогда просто остаётся русский
}

function getLang() {
    return currentLang;
}

function t(key, vars) {
    let text = (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key;
    if (vars) {
        Object.keys(vars).forEach((name) => {
            text = text.split(`{${name}}`).join(vars[name]);
        });
    }
    return text;
}

function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.title = t('page.title');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        // Пока элемент занят (например, кнопка во время скачивания), текст не трогаем
        if (el.dataset.busy) return;
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

function setLang(lang) {
    if (lang !== 'ru' && lang !== 'en') return;
    currentLang = lang;
    try {
        localStorage.setItem('zanytool_lang', lang);
    } catch (e) {
        // не страшно, если не сохранилось
    }
    applyTranslations();
    window.dispatchEvent(new Event('langchange'));
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

applyTranslations();