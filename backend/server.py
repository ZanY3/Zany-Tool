import os
import shutil
import subprocess
import tempfile
import threading
import webbrowser
from urllib.parse import quote

import yt_dlp
from flask import Flask, request, Response, jsonify, render_template
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path='',
    template_folder=FRONTEND_DIR
)
CORS(app)

# Свежие версии yt-dlp (2026.08.19+) по умолчанию убрали клиент web_safari,
# а именно он отдаёт HD (HLS, до 1080p) там, где остальные клиенты дают только 360p.
# 'default' оставляет стандартный набор клиентов, 'web_safari' добавляем сверху.
YOUTUBE_ARGS = {'youtube': {'player_client': ['default', 'web_safari']}}

# Прогресс скачивания: {progress_id: {...}}. Сайт опрашивает его через /api/progress/<id>
PROGRESS = {}
PROGRESS_LOCK = threading.Lock()


def make_progress_hooks(progress_id):
    def update(**kw):
        with PROGRESS_LOCK:
            PROGRESS.setdefault(progress_id, {}).update(kw)

    def on_progress(d):
        info = d.get('info_dict') or {}
        if info.get('vcodec') not in (None, 'none'):
            kind = 'video'
        elif info.get('acodec') not in (None, 'none'):
            kind = 'audio'
        else:
            kind = 'video'

        if d.get('status') == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            done = d.get('downloaded_bytes') or 0
            if total:
                percent = min(done / total * 100, 100)
            elif d.get('fragment_count'):
                percent = (d.get('fragment_index') or 0) / d['fragment_count'] * 100
            else:
                percent = 0
            update(stage='downloading', kind=kind, percent=round(percent, 1),
                   downloaded=done, total=total,
                   speed=d.get('speed') or 0, eta=d.get('eta'))
        elif d.get('status') == 'finished':
            total = d.get('total_bytes') or d.get('downloaded_bytes') or 0
            update(stage='downloading', kind=kind, percent=100,
                   downloaded=total, total=total, speed=0, eta=0)

    def on_postprocess(d):
        if d.get('status') == 'started':
            update(stage='processing')

    return on_progress, on_postprocess


def clear_progress(progress_id):
    if progress_id:
        with PROGRESS_LOCK:
            PROGRESS.pop(progress_id, None)


@app.route('/api/progress/<progress_id>')
def get_progress(progress_id):
    with PROGRESS_LOCK:
        return jsonify(PROGRESS.get(progress_id, {}))


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/fetch', methods=['POST'])
def fetch_video_info():
    data = request.json or {}
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL не указан'}), 400
    try:
        # Без extractor_args: свежий yt-dlp сам выбирает рабочие клиенты YouTube
        ydl_opts = {
            'noplaylist': True,
            'skip_download': True,
            'quiet': True,
            'extractor_args': YOUTUBE_ARGS,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return jsonify({
                'url': url,
                'title': info.get('title', 'Без названия'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': format_duration(info.get('duration', 0))
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download', methods=['POST'])
def download_video():
    data = request.json or {}
    url = data.get('url')
    format_type = data.get('format', 'video')
    quality = str(data.get('quality', '720'))
    title = data.get('title', 'video')
    progress_id = str(data.get('progress_id') or '')[:64]

    if not url:
        return jsonify({'error': 'URL не указан'}), 400

    if not quality.isdigit():
        quality = '720'

    safe_title = "".join(c for c in title if c.isalnum() or c.isspace()).strip() or "media"

    # Каждая загрузка идёт в свою временную папку, чтобы файлы не путались
    tmp_dir = tempfile.mkdtemp(prefix='zany_')
    outtmpl = os.path.join(tmp_dir, 'media.%(ext)s')

    if format_type == 'audio':
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': outtmpl,
            'noplaylist': True,
            'quiet': True,
            'extractor_args': YOUTUBE_ARGS,
        }
    else:
        # Порядок попыток:
        # 1) mp4-видео + m4a-аудио нужного качества (лучше всего совместимо)
        # 2) любое видео + любое аудио не выше выбранного качества
        # 3) готовый муксованный файл не выше выбранного качества
        # Финального "/best" нет специально: если выбранного качества нет,
        # получишь честную ошибку, а не тихий 360p.
        ydl_opts = {
            'format': (
                f'bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/'
                f'bestvideo[height<={quality}]+bestaudio/'
                f'best[height<={quality}]'
            ),
            'merge_output_format': 'mp4',
            'outtmpl': outtmpl,
            'noplaylist': True,
            'quiet': True,
            'extractor_args': YOUTUBE_ARGS,
        }

    if progress_id:
        on_progress, on_postprocess = make_progress_hooks(progress_id)
        ydl_opts['progress_hooks'] = [on_progress]
        ydl_opts['postprocessor_hooks'] = [on_postprocess]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
        clear_progress(progress_id)

        files = os.listdir(tmp_dir)
        if not files:
            raise Exception("Файл не был создан после скачивания")

        # Берём итоговый файл (для аудио это mp3, для видео mp4)
        preferred = [f for f in files if f.endswith(('.mp4', '.mp3'))]
        filename = os.path.join(tmp_dir, (preferred or files)[0])

        actual_ext = os.path.splitext(filename)[1].lstrip('.')
        download_filename = f"{safe_title}.{actual_ext}"
        file_size = os.path.getsize(filename)

        def file_stream():
            try:
                with open(filename, 'rb') as f:
                    while chunk := f.read(1024 * 64):
                        yield chunk
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)

        headers = {
            'Content-Disposition': f"attachment; filename*=UTF-8''{quote(download_filename)}",
            'Content-Length': str(file_size),
        }
        return Response(file_stream(), headers=headers, mimetype='application/octet-stream')

    except Exception as e:
        clear_progress(progress_id)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


# ======================= КОНВЕРТЕР (ffmpeg) =======================

IMAGE_IN = {'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'ico'}
VIDEO_IN = {'mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts'}
AUDIO_IN = {'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'amr'}

IMAGE_OUT = {'jpg', 'png', 'webp', 'bmp', 'gif', 'tiff'}
VIDEO_OUT = {'mp4', 'mkv', 'webm', 'avi', 'mov', 'gif'}
AUDIO_OUT = {'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'}

CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def set_progress(progress_id, **kw):
    if progress_id:
        with PROGRESS_LOCK:
            PROGRESS.setdefault(progress_id, {}).update(kw)


def detect_category(ext):
    if ext in IMAGE_IN:
        return 'image'
    if ext in VIDEO_IN:
        return 'video'
    if ext in AUDIO_IN:
        return 'audio'
    return None


def allowed_targets(category):
    if category == 'image':
        return IMAGE_OUT
    if category == 'audio':
        return AUDIO_OUT
    return VIDEO_OUT | AUDIO_OUT


def get_duration(src):
    ffprobe = shutil.which('ffprobe')
    if not ffprobe:
        return 0
    try:
        out = subprocess.run(
            [ffprobe, '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', src],
            capture_output=True, text=True, timeout=20,
            creationflags=CREATE_NO_WINDOW
        )
        return float(out.stdout.strip())
    except Exception:
        return 0


def codec_args(target, quality):
    q = quality if quality in ('high', 'medium', 'low') else 'medium'
    abr = {'high': '320k', 'medium': '192k', 'low': '128k'}[q]

    # ----- аудио -----
    if target in AUDIO_OUT:
        args = ['-map', '0:a:0', '-vn']
        if target == 'mp3':
            args += ['-c:a', 'libmp3lame', '-b:a', abr]
        elif target == 'wav':
            args += ['-c:a', 'pcm_s16le']
        elif target == 'flac':
            args += ['-c:a', 'flac']
        elif target == 'ogg':
            args += ['-c:a', 'libvorbis', '-q:a', {'high': '7', 'medium': '5', 'low': '3'}[q]]
        elif target in ('m4a', 'aac'):
            args += ['-c:a', 'aac', '-b:a', abr]
        elif target == 'opus':
            args += ['-c:a', 'libopus', '-b:a', {'high': '192k', 'medium': '128k', 'low': '96k'}[q]]
        return args

    # ----- изображения -----
    if target in IMAGE_OUT:
        if target == 'jpg':
            return ['-frames:v', '1', '-q:v', {'high': '2', 'medium': '5', 'low': '10'}[q]]
        if target == 'webp':
            return ['-quality', {'high': '95', 'medium': '80', 'low': '60'}[q]]
        if target == 'gif':
            return []
        return ['-frames:v', '1']  # png, bmp, tiff

    # ----- видео -----
    base = ['-map', '0:v:0', '-map', '0:a:0?']
    crf = {'high': '18', 'medium': '23', 'low': '28'}[q]
    if target in ('mp4', 'mov', 'mkv'):
        args = base + ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf,
                       '-pix_fmt', 'yuv420p',
                       '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                       '-c:a', 'aac', '-b:a', '192k']
        if target in ('mp4', 'mov'):
            args += ['-movflags', '+faststart']
        return args
    if target == 'webm':
        return base + ['-c:v', 'libvpx-vp9', '-crf', {'high': '28', 'medium': '33', 'low': '38'}[q],
                       '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
                       '-c:a', 'libopus', '-b:a', '128k']
    if target == 'avi':
        return base + ['-c:v', 'mpeg4', '-q:v', {'high': '2', 'medium': '4', 'low': '8'}[q],
                       '-c:a', 'libmp3lame', '-b:a', '192k']
    if target == 'gif':
        return ['-map', '0:v:0', '-an', '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0']
    return []


def run_ffmpeg(cmd, duration, progress_id):
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding='utf-8', errors='replace',
        creationflags=CREATE_NO_WINDOW
    )
    state = {}
    log = []
    set_progress(progress_id, stage='converting', percent=0, known=bool(duration),
                 done_sec=0, duration=duration, speed_x=0, eta=None)

    for raw in proc.stdout:
        line = raw.strip()
        if not line:
            continue
        if '=' in line and ' ' not in line.split('=', 1)[0]:
            key, value = line.split('=', 1)
            state[key] = value
            if key == 'progress':
                us = state.get('out_time_us') or state.get('out_time_ms') or ''
                try:
                    done_sec = max(int(us) / 1_000_000, 0)
                except ValueError:
                    done_sec = 0
                try:
                    speed_x = float(state.get('speed', '').replace('x', '').strip() or 0)
                except ValueError:
                    speed_x = 0
                if duration:
                    percent = min(done_sec / duration * 100, 100)
                    eta = (duration - done_sec) / speed_x if speed_x > 0 else None
                else:
                    percent, eta = 0, None
                set_progress(progress_id, stage='converting', percent=round(percent, 1),
                             known=bool(duration), done_sec=done_sec, duration=duration,
                             speed_x=speed_x, eta=eta)
        else:
            log.append(line)

    proc.wait()
    if proc.returncode != 0:
        tail = '\n'.join(log[-6:]) or 'неизвестная ошибка'
        raise Exception(f'ffmpeg не смог конвертировать файл:\n{tail}')


@app.route('/api/convert', methods=['POST'])
def convert_file():
    f = request.files.get('file')
    target = (request.form.get('target') or '').lower().strip()
    quality = (request.form.get('quality') or 'medium').lower()
    progress_id = str(request.form.get('progress_id') or '')[:64]

    if not f or not f.filename:
        return jsonify({'error': 'Файл не передан'}), 400
    if not shutil.which('ffmpeg'):
        return jsonify({'error': 'ffmpeg не найден. Установи его: winget install Gyan.FFmpeg'}), 500

    stem, ext = os.path.splitext(f.filename)
    ext = ''.join(c for c in ext.lstrip('.').lower() if c.isalnum())
    category = detect_category(ext)
    if not category:
        return jsonify({'error': f'Неподдерживаемый формат файла: .{ext or "?"}'}), 400
    if target not in allowed_targets(category):
        return jsonify({'error': f'Нельзя конвертировать {category} в {target}'}), 400

    safe_stem = ''.join(c for c in stem if c.isalnum() or c.isspace()).strip() or 'converted'

    tmp_dir = tempfile.mkdtemp(prefix='zany_conv_')
    try:
        src = os.path.join(tmp_dir, f'input.{ext}')
        dst = os.path.join(tmp_dir, f'output.{target}')
        f.save(src)

        duration = get_duration(src) if category != 'image' else 0
        cmd = [shutil.which('ffmpeg'), '-y', '-hide_banner', '-loglevel', 'error',
               '-nostats', '-progress', 'pipe:1', '-i', src] + codec_args(target, quality) + [dst]
        run_ffmpeg(cmd, duration, progress_id)

        if not os.path.exists(dst):
            raise Exception('Файл не был создан после конвертации')

        file_size = os.path.getsize(dst)
        download_filename = f'{safe_stem}.{target}'

        def file_stream():
            try:
                with open(dst, 'rb') as out:
                    while chunk := out.read(1024 * 64):
                        yield chunk
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)

        clear_progress(progress_id)
        headers = {
            'Content-Disposition': f"attachment; filename*=UTF-8''{quote(download_filename)}",
            'Content-Length': str(file_size),
        }
        return Response(file_stream(), headers=headers, mimetype='application/octet-stream')

    except Exception as e:
        clear_progress(progress_id)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


def format_duration(seconds):
    if not seconds:
        return "0:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"


if __name__ == '__main__':
    threading.Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:5001')).start()
    app.run(host='127.0.0.1', port=5001, debug=False)