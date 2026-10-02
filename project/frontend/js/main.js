let currentVideoData = null;

const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const optionsContainer = document.getElementById('optionsContainer');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoTitle = document.getElementById('videoTitle');
const videoDuration = document.getElementById('videoDuration');
const titleInput = document.getElementById('titleInput');
const formatSelect = document.getElementById('formatSelect');
const qualityContainer = document.getElementById('qualityContainer');
const qualitySelect = document.getElementById('qualitySelect');
const downloadBtn = document.getElementById('downloadBtn');

const progressContainer = document.getElementById('progressContainer');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const progressSpeed = document.getElementById('progressSpeed');
const statDownloaded = document.getElementById('statDownloaded');
const statSpeed = document.getElementById('statSpeed');
const statEta = document.getElementById('statEta');

function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 МБ';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' ГБ';
    return mb.toFixed(1) + ' МБ';
}

function formatEta(seconds) {
    if (seconds === null || seconds === undefined || !isFinite(seconds)) return '—';
    seconds = Math.max(0, Math.round(seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function resetStats() {
    statDownloaded.textContent = '—';
    statSpeed.textContent = '—';
    statEta.textContent = '—';
}

function makeProgressId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p' + Date.now() + Math.random().toString(16).slice(2);
}

function applyServerProgress(p) {
    if (p.stage === 'processing') {
        progressBarFill.style.width = '100%';
        progressText.textContent = 'Обработка файла...';
        progressSpeed.textContent = 'Обработка';
        statSpeed.textContent = '—';
        statEta.textContent = '—';
        return;
    }

    const percent = Math.min(100, Math.round(p.percent || 0));
    const isAudio = p.kind === 'audio';
    progressBarFill.style.width = `${percent}%`;
    progressText.textContent = `Скачивание ${isAudio ? 'аудио' : 'видео'}... ${percent}%`;
    progressSpeed.textContent = isAudio ? 'Аудио' : 'Видео';

    const done = p.total ? Math.min(p.downloaded || 0, p.total) : (p.downloaded || 0);
    statDownloaded.textContent = p.total
        ? `${formatBytes(done)} / ${formatBytes(p.total)}`
        : formatBytes(done);
    statSpeed.textContent = p.speed ? `${formatBytes(p.speed)}/с` : '—';
    statEta.textContent = formatEta(p.eta);
}


formatSelect.addEventListener('change', () => {
    if (formatSelect.value === 'audio') {
        qualityContainer.classList.add('hidden');
    } else {
        qualityContainer.classList.remove('hidden');
    }
});

fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        alert('Введите ссылку на видео!');
        return;
    }

    fetchBtn.textContent = 'Ищем...';
    fetchBtn.disabled = true;

    try {
        const response = await fetch('/api/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка при получении данных');
        }

        currentVideoData = data;
        videoThumbnail.src = data.thumbnail;
        videoTitle.textContent = data.title;
        videoDuration.textContent = `Длительность: ${data.duration}`;
        titleInput.value = data.title;

        optionsContainer.classList.remove('hidden');
    } catch (err) {
        alert('Ошибка: ' + err.message);
    } finally {
        fetchBtn.textContent = 'Найти';
        fetchBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', async () => {
    if (!currentVideoData) return;

    const format = formatSelect.value;
    const quality = qualitySelect.value;
    const customTitle = titleInput.value.trim() || currentVideoData.title;

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Скачивание...';
    urlInput.disabled = true;
    fetchBtn.disabled = true;
    titleInput.disabled = true;
    formatSelect.disabled = true;
    qualitySelect.disabled = true;

    const progressId = makeProgressId();
    let pollingActive = true;

    progressContainer.classList.remove('hidden');
    progressBarFill.style.width = '0%';
    progressText.textContent = 'Подключение к YouTube... 0%';
    progressSpeed.textContent = 'Подготовка';
    resetStats();

    const progressInterval = setInterval(async () => {
        try {
            const r = await fetch(`/api/progress/${progressId}`, { cache: 'no-store' });
            if (!r.ok || !pollingActive) return;
            const p = await r.json();
            if (!pollingActive || !p.stage) return;
            applyServerProgress(p);
        } catch (e) {
        }
    }, 500);

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoData.url,
                format: format,
                quality: quality,
                title: customTitle,
                progress_id: progressId
            })
        });

        pollingActive = false;
        clearInterval(progressInterval);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Ошибка скачивания');
        }

        progressBarFill.style.width = '0%';
        progressText.textContent = 'Передача файла на ваш ПК... 0%';
        progressSpeed.textContent = 'Передача';
        resetStats();

        const contentLength = response.headers.get('Content-Length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let receivedBytes = 0;

        const reader = response.body.getReader();
        const chunks = [];
        let startTime = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedBytes += value.length;

            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const speed = elapsedSeconds > 0 ? receivedBytes / elapsedSeconds : 0;

            if (totalBytes > 0) {
                const totalPercent = Math.round((receivedBytes / totalBytes) * 100);
                progressBarFill.style.width = `${totalPercent}%`;
                progressText.textContent = `Передача файла на ваш ПК... ${totalPercent}%`;
                statDownloaded.textContent = `${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}`;
                statEta.textContent = speed > 0 ? formatEta((totalBytes - receivedBytes) / speed) : '—';
            } else {
                statDownloaded.textContent = formatBytes(receivedBytes);
            }
            statSpeed.textContent = speed > 0 ? `${formatBytes(speed)}/с` : '—';
        }

        progressBarFill.style.width = '100%';
        progressText.textContent = 'Готово! Загрузка завершена';
        progressSpeed.textContent = 'Готово';
        statEta.textContent = '0:00';

        const blob = new Blob(chunks);
        const fileExtension = format === 'audio' ? 'mp3' : 'mp4';
        const safeFilename = customTitle.replace(/[<>:"/\\|?*]/g, '') + '.' + fileExtension;

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

    } catch (err) {
        pollingActive = false;
        clearInterval(progressInterval);
        alert('Ошибка при скачивании: ' + err.message);
    } finally {
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Скачать файл';
            urlInput.disabled = false;
            fetchBtn.disabled = false;
            titleInput.disabled = false;
            formatSelect.disabled = false;
            qualitySelect.disabled = false;
            progressContainer.classList.add('hidden');
        }, 1500);
    }
});