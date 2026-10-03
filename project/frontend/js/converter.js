(function () {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('[id$="Tab"]');

    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
            tabPanels.forEach((panel) => {
                panel.classList.toggle('hidden', panel.id !== btn.dataset.tab);
            });
        });
    });

    const IMAGE_IN = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'ico'];
    const VIDEO_IN = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts'];
    const AUDIO_IN = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'amr'];

    const IMAGE_OUT = ['jpg', 'png', 'webp', 'bmp', 'gif', 'tiff'];
    const VIDEO_OUT = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'gif'];
    const AUDIO_OUT = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'];

    const NO_QUALITY = ['wav', 'flac', 'png', 'bmp', 'tiff', 'gif'];

    const dropzone = document.getElementById('convDropzone');
    const dropzoneTitle = document.getElementById('convDropzoneTitle');
    const fileInput = document.getElementById('convFileInput');
    const optionsBox = document.getElementById('convOptions');
    const fileTypeBadge = document.getElementById('convFileType');
    const fileNameEl = document.getElementById('convFileName');
    const fileSizeEl = document.getElementById('convFileSize');
    const formatSelect = document.getElementById('convFormat');
    const qualityContainer = document.getElementById('convQualityContainer');
    const qualitySelect = document.getElementById('convQuality');
    const convertBtn = document.getElementById('convertBtn');

    const progressBox = document.getElementById('convProgressContainer');
    const progressText = document.getElementById('convProgressText');
    const progressBadge = document.getElementById('convProgressBadge');
    const progressFill = document.getElementById('convProgressFill');
    const statLabel = document.getElementById('convStatLabel');
    const statDone = document.getElementById('convStatDone');
    const statSpeed = document.getElementById('convStatSpeed');
    const statEta = document.getElementById('convStatEta');

    let selectedFile = null;
    let selectedExt = '';
    let selectedCategory = null;

    function getExt(name) {
        const i = name.lastIndexOf('.');
        return i === -1 ? '' : name.slice(i + 1).toLowerCase();
    }

    function detectCategory(file) {
        const ext = getExt(file.name);
        if (IMAGE_IN.includes(ext)) return 'image';
        if (VIDEO_IN.includes(ext)) return 'video';
        if (AUDIO_IN.includes(ext)) return 'audio';
        return null;
    }

    function addOption(parent, value, label) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        parent.appendChild(opt);
    }

    function fillFormats(category, inputExt, keepValue) {
        formatSelect.innerHTML = '';

        if (category === 'video') {
            const videoGroup = document.createElement('optgroup');
            videoGroup.label = t('conv.groupVideo');
            VIDEO_OUT.forEach((f) => addOption(videoGroup, f, f.toUpperCase()));
            const audioGroup = document.createElement('optgroup');
            audioGroup.label = t('conv.groupAudio');
            AUDIO_OUT.forEach((f) => addOption(audioGroup, f, f.toUpperCase()));
            formatSelect.appendChild(videoGroup);
            formatSelect.appendChild(audioGroup);
        } else {
            const list = category === 'image' ? IMAGE_OUT : AUDIO_OUT;
            list.forEach((f) => addOption(formatSelect, f, f.toUpperCase()));
        }

        const normalizedInput = inputExt === 'jpeg' ? 'jpg' : inputExt === 'tif' ? 'tiff' : inputExt;
        const firstDifferent = Array.from(formatSelect.options).find((o) => o.value !== normalizedInput);
        if (firstDifferent) formatSelect.value = firstDifferent.value;
        if (keepValue) formatSelect.value = keepValue;
        updateQualityVisibility();
    }

    function updateQualityVisibility() {
        qualityContainer.classList.toggle('hidden', NO_QUALITY.includes(formatSelect.value));
    }

    function renderFileInfo() {
        if (!selectedFile) {
            dropzoneTitle.textContent = t('conv.dropTitle');
            return;
        }
        fileTypeBadge.textContent = t('cat.' + selectedCategory);
        fileSizeEl.textContent = `${selectedExt.toUpperCase()} • ${formatBytes(selectedFile.size)}`;
        dropzoneTitle.textContent = t('conv.dropChange');
    }

    function setFile(file) {
        const category = detectCategory(file);
        if (!category) {
            alert(t('conv.unsupported', { name: file.name }));
            return;
        }

        selectedFile = file;
        selectedExt = getExt(file.name);
        selectedCategory = category;

        fileNameEl.textContent = file.name;
        renderFileInfo();

        fillFormats(category, selectedExt);
        optionsBox.classList.remove('hidden');
    }

    formatSelect.addEventListener('change', updateQualityVisibility);

    renderFileInfo();
    window.addEventListener('langchange', () => {
        renderFileInfo();
        if (selectedFile) fillFormats(selectedCategory, selectedExt, formatSelect.value);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) setFile(fileInput.files[0]);
        fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });
    dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    });

    function resetStats(label) {
        statLabel.textContent = label;
        statDone.textContent = '—';
        statSpeed.textContent = '—';
        statEta.textContent = '—';
    }

    function setBar(percent, indeterminate) {
        progressFill.classList.toggle('indeterminate', !!indeterminate);
        if (!indeterminate) progressFill.style.width = `${percent}%`;
    }

    function applyConvertProgress(p) {
        statLabel.textContent = t('stat.processed');
        if (p.known) {
            const percent = Math.min(100, Math.round(p.percent || 0));
            setBar(percent, false);
            progressText.textContent = t('conv.convertingPct', { p: percent });
            statDone.textContent = `${formatEta(p.done_sec)} / ${formatEta(p.duration)}`;
            statSpeed.textContent = p.speed_x ? `${p.speed_x.toFixed(1)}x` : '—';
            statEta.textContent = formatEta(p.eta);
        } else {
            setBar(100, true);
            progressText.textContent = t('conv.converting');
            statDone.textContent = '—';
            statSpeed.textContent = '—';
            statEta.textContent = '—';
        }
    }

    function setControlsDisabled(disabled) {
        convertBtn.disabled = disabled;
        formatSelect.disabled = disabled;
        qualitySelect.disabled = disabled;
        dropzone.classList.toggle('disabled', disabled);
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    convertBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        const target = formatSelect.value;
        const quality = qualitySelect.value;
        const progressId = makeProgressId();

        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('target', target);
        fd.append('quality', quality);
        fd.append('progress_id', progressId);
        fd.append('lang', getLang());

        setControlsDisabled(true);
        convertBtn.dataset.busy = '1';
        convertBtn.textContent = t('conv.converting');
        progressBox.classList.remove('hidden');
        setBar(0, false);
        progressText.textContent = t('conv.uploading', { p: 0 });
        progressBadge.textContent = t('badge.upload');
        resetStats(t('stat.uploaded'));

        let phase = 'upload';
        let pollTimer = null;
        let pollingActive = false;
        let phaseStart = Date.now();

        function startPolling() {
            pollingActive = true;
            pollTimer = setInterval(async () => {
                try {
                    const r = await fetch(`/api/progress/${progressId}`, { cache: 'no-store' });
                    if (!r.ok || !pollingActive) return;
                    const p = await r.json();
                    if (!pollingActive || p.stage !== 'converting') return;
                    applyConvertProgress(p);
                } catch (e) {
                }
            }, 500);
        }

        function stopPolling() {
            pollingActive = false;
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
        }

        function finish() {
            stopPolling();
            setTimeout(() => {
                setControlsDisabled(false);
                delete convertBtn.dataset.busy;
                convertBtn.textContent = t('conv.convert');
                progressBox.classList.add('hidden');
                setBar(0, false);
            }, 1500);
        }

        function fail(message) {
            alert(t('conv.errPrefix') + message);
            finish();
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/convert');
        xhr.responseType = 'blob';

        xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const percent = Math.round((e.loaded / e.total) * 100);
            const elapsed = (Date.now() - phaseStart) / 1000;
            const speed = elapsed > 0 ? e.loaded / elapsed : 0;
            setBar(percent, false);
            progressText.textContent = t('conv.uploading', { p: percent });
            statDone.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
            statSpeed.textContent = speed > 0 ? `${formatBytes(speed)}${t('unit.perSec')}` : '—';
            statEta.textContent = speed > 0 ? formatEta((e.total - e.loaded) / speed) : '—';
        };

        xhr.upload.onload = () => {
            phase = 'convert';
            progressBadge.textContent = t('badge.converting');
            progressText.textContent = t('conv.convertingPct', { p: 0 });
            setBar(0, false);
            resetStats(t('stat.processed'));
            startPolling();
        };

        xhr.onreadystatechange = () => {
            if (xhr.readyState === xhr.HEADERS_RECEIVED && xhr.status === 200) {
                stopPolling();
                phase = 'receive';
                phaseStart = Date.now();
                progressBadge.textContent = t('badge.transfer');
                progressText.textContent = t('transfer.text', { p: 0 });
                setBar(0, false);
                resetStats(t('stat.received'));
            }
        };

        xhr.onprogress = (e) => {
            if (phase !== 'receive') return;
            const elapsed = (Date.now() - phaseStart) / 1000;
            const speed = elapsed > 0 ? e.loaded / elapsed : 0;
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                setBar(percent, false);
                progressText.textContent = t('transfer.text', { p: percent });
                statDone.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
                statEta.textContent = speed > 0 ? formatEta((e.total - e.loaded) / speed) : '—';
            } else {
                statDone.textContent = formatBytes(e.loaded);
            }
            statSpeed.textContent = speed > 0 ? `${formatBytes(speed)}${t('unit.perSec')}` : '—';
        };

        xhr.onload = async () => {
            if (xhr.status === 200) {
                setBar(100, false);
                progressText.textContent = t('conv.done');
                progressBadge.textContent = t('badge.done');
                statEta.textContent = '0:00';

                const baseName = selectedFile.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '') || 'converted';
                saveBlob(xhr.response, `${baseName}.${target}`);
                finish();
            } else {
                let message = t('conv.errUnknown');
                try {
                    const text = await xhr.response.text();
                    message = JSON.parse(text).error || message;
                } catch (e) {
                }
                fail(message);
            }
        };

        xhr.onerror = () => fail(t('conv.errNetwork'));

        phaseStart = Date.now();
        xhr.send(fd);
    });
})();