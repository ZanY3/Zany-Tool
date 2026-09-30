import os
import shutil
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

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)

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