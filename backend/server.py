import os
import sys
from urllib.parse import quote
from flask import Flask, request, Response, jsonify, render_template
from flask_cors import CORS
import yt_dlp
import webbrowser
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))

app = Flask(
    __name__, 
    static_folder=FRONTEND_DIR, 
    static_url_path='', 
    template_folder=FRONTEND_DIR
)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/fetch', methods=['POST'])
def fetch_video_info():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL не указан'}), 400
    try:
        ydl_opts = {
            'noplaylist': True,
            'skip_download': True,
            # Используем tv, web и android — они не крашатся на проверках токенов
            'extractor_args': {'youtube': {'player_client': ['tv', 'web', 'android']}}
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
    data = request.json
    url = data.get('url')
    format_type = data.get('format', 'video')
    quality = data.get('quality', '720')  
    title = data.get('title', 'video')

    if not url:
        return jsonify({'error': 'URL не указан'}), 400

    safe_title = "".join([c for c in title if c.isalnum() or c.isspace()]).rstrip() or "media"

    if format_type == 'audio':
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
            'outtmpl': os.path.join(BASE_DIR, f'{safe_title}.%(ext)s'),
            'noplaylist': True,
            'extractor_args': {'youtube': {'player_client': ['tv', 'web', 'android']}}
        }
    else:
        # НЕУБИВАЕМЫЙ СЕЛЕКТОР:
        # Пробует найти раздельные видео+аудио нужного качества. 
        # Если их нет (YouTube заблокировал HD), скачивает просто лучшее доступное видео (best).
        fallback_format = f'bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best'
        
        ydl_opts = {
            'format': fallback_format,
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(BASE_DIR, f'{safe_title}.%(ext)s'),
            'noplaylist': True,
            'extractor_args': {'youtube': {'player_client': ['tv', 'web', 'android']}}
        }

    def generate():
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)

            base_name, _ = os.path.splitext(filename)
            mp4_filename = f"{base_name}.mp4"

            if os.path.exists(mp4_filename):
                filename = mp4_filename
            elif not os.path.exists(filename):
                found = False
                for f in os.listdir(BASE_DIR):
                    if f.startswith(safe_title):
                        filename = os.path.join(BASE_DIR, f)
                        found = True
                        break
                if not found:
                    raise Exception("Файл не был создан после скачивания")

            actual_ext = os.path.splitext(filename)[1].lstrip('.')
            download_filename = f"{safe_title}.{actual_ext}"

            file_size = os.path.getsize(filename)
            def file_stream():
                try:
                    with open(filename, 'rb') as f:
                        while chunk := f.read(1024 * 64):
                            yield chunk
                finally:
                    if os.path.exists(filename):
                        try: os.remove(filename)
                        except: pass

            encoded_filename = quote(download_filename)
            headers = {
                'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}",
                'Content-Length': str(file_size)
            }
            return Response(file_stream(), headers=headers, mimetype='application/octet-stream')
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return generate()

def format_duration(seconds):
    if not seconds: return "0:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"

if __name__ == '__main__':
    threading.Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:5001')).start()
    app.run(host='127.0.0.1', port=5001, debug=False)