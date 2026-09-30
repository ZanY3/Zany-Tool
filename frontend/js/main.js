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

    progressContainer.classList.remove('hidden');
    progressBarFill.style.width = '0%';
    progressText.textContent = 'Скачивание с YouTube... 10%';
    progressSpeed.textContent = 'Обработка';

    let fakePercent = 10;
    const progressInterval = setInterval(() => {
        if (fakePercent < 80) {
            fakePercent += Math.floor(Math.random() * 8) + 3;
            if (fakePercent > 80) fakePercent = 80;
            progressBarFill.style.width = `${fakePercent}%`;
            progressText.textContent = `Скачивание с YouTube... ${fakePercent}%`;
        }
    }, 300);

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoData.url,
                format: format,
                quality: quality,
                title: customTitle
            })
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Ошибка скачивания');
        }

        progressBarFill.style.width = '85%';
        progressText.textContent = 'Передача файла на ваш ПК... 85%';
        progressSpeed.textContent = '';

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

            if (totalBytes > 0) {
                const downloadPercent = Math.round((receivedBytes / totalBytes) * 15);
                const totalPercent = 85 + downloadPercent;
                progressBarFill.style.width = `${totalPercent}%`;
                progressText.textContent = `Сохранение файла... ${totalPercent}%`;
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000;
            if (elapsedSeconds > 0) {
                const speedMbps = ((receivedBytes / (1024 * 1024)) / elapsedSeconds).toFixed(1);
                progressSpeed.textContent = `${speedMbps} МБ/с`;
            }
        }

        progressBarFill.style.width = '100%';
        progressText.textContent = 'Готово! Загрузка завершена';

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