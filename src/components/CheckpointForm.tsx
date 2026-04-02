import { useState, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import type { Checkpoint } from '../types';

interface Props {
  onAdd: (cp: Checkpoint) => void;
  onCancel: () => void;
}

export default function CheckpointForm({ onAdd, onCancel }: Props) {
  const { theme } = useTheme();
  const [location, setLocation] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [comment, setComment] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function createRecognition(): SpeechRecognition | null {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    return recognition;
  }

  function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像の読み込みに失敗')); };
      img.src = url;
    });
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      alert('ファイルの読み込みに失敗しました');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = createRecognition();
    if (!recognition) {
      alert('この端末は音声入力に対応していません');
      return;
    }

    recognitionRef.current = recognition;
    let finalTranscript = comment;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setComment(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setComment(finalTranscript);
    };

    recognition.start();
    setIsListening(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl || !location.trim()) return;
    onAdd({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      location: location.trim(),
      photoDataUrl,
      comment: comment.trim(),
      timestamp: new Date().toLocaleString('ja-JP'),
    });
  };

  const isValid = photoDataUrl && location.trim();

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-text-muted text-sm font-bold hover:text-text transition-colors duration-200 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {theme.backLabel}
        </button>
        <h2 className="text-sm font-bold text-text">チェックポイント追加</h2>
        <div className="w-14" />
      </div>

      <form onSubmit={handleSubmit} className="animate-page px-5 py-5 space-y-4">
        {/* Location */}
        <div className="card p-4">
          <label htmlFor="location-input" className="block text-sm font-bold text-text-muted mb-2">場所名</label>
          <input
            id="location-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例: 3F ナースステーション"
            maxLength={100}
            className="w-full bg-base border-2 border-line rounded-t px-4 py-3 text-base text-text placeholder:text-text-faint transition-all duration-200"
          />
        </div>

        {/* Photo */}
        <div className="card p-4">
          <label className="block text-sm font-bold text-text-muted mb-2">写真</label>
          {photoDataUrl ? (
            <div className="relative animate-pop">
              <img src={photoDataUrl} alt="撮影済み" className="w-full rounded-t max-h-60 object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoDataUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2.5 right-2.5 bg-text/50 backdrop-blur-sm text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-text/70 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-2.5 left-2.5 bg-ok text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {theme.photoOkLabel}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-primary-light/50 border-2 border-dashed border-primary/30 rounded-t py-10 text-primary hover:bg-primary-light hover:border-primary/50 transition-all duration-200 group"
            >
              <div className="w-14 h-14 rounded-t bg-surface flex items-center justify-center mx-auto mb-3 transition-shadow duration-200" style={{ boxShadow: 'var(--t-card-shadow)' }}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-bold">タップして撮影 / 選択</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="hidden"
          />
        </div>

        {/* Comment */}
        <div className="card p-4">
          <label htmlFor="comment-input" className="block text-sm font-bold text-text-muted mb-2">コメント</label>
          <div className="relative">
            <textarea
              id="comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={theme.commentPlaceholder}
              rows={4}
              className="w-full bg-base border-2 border-line rounded-t px-4 py-3 pr-14 text-base text-text placeholder:text-text-faint transition-all duration-200 resize-none"
            />
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
              className={`absolute right-2.5 bottom-2.5 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isListening
                  ? 'bg-danger text-white animate-breathe'
                  : 'bg-base-deep text-text-muted hover:bg-primary-light hover:text-primary'
              }`}
              style={isListening ? { boxShadow: '0 0 0 4px var(--t-danger-light)' } : {}}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 mt-2.5 animate-fade">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <p className="text-xs text-danger font-bold">{theme.listeningLabel}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid}
          className="btn-primary w-full py-4 text-base font-bold"
        >
          追加する
        </button>
      </form>
    </div>
  );
}
