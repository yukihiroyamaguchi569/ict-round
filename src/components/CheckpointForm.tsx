import { useState, useRef } from 'react';
import type { Checkpoint } from '../types';

interface Props {
  onAdd: (cp: Checkpoint) => void;
  onCancel: () => void;
}

export default function CheckpointForm({ onAdd, onCancel }: Props) {
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

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました');
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream/80 backdrop-blur-xl border-b border-border px-5 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-muted text-sm font-medium hover:text-ink transition-colors duration-200 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <h2 className="text-sm font-semibold text-ink">チェックポイント追加</h2>
        <div className="w-12" />
      </div>

      <form onSubmit={handleSubmit} className="animate-page px-5 py-6 space-y-6">
        {/* Location */}
        <div>
          <label htmlFor="location-input" className="block text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">場所名</label>
          <input
            id="location-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例: 3F ナースステーション"
            maxLength={100}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-base text-ink placeholder:text-ink-faint transition-all duration-200"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">写真</label>
          {photoDataUrl ? (
            <div className="relative animate-scale">
              <img src={photoDataUrl} alt="撮影済み" className="w-full rounded-2xl max-h-64 object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoDataUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-3 right-3 bg-ink/60 backdrop-blur-sm text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-ink/80 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-surface border-2 border-dashed border-border rounded-2xl py-10 text-ink-muted hover:border-sage hover:text-sage transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-cream-dark group-hover:bg-sage-light flex items-center justify-center mx-auto mb-3 transition-colors duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium">写真を撮影 / 選択</span>
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

        {/* Comment with voice */}
        <div>
          <label htmlFor="comment-input" className="block text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">コメント</label>
          <div className="relative">
            <textarea
              id="comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="音声入力またはテキスト入力..."
              rows={4}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 pr-14 text-base text-ink placeholder:text-ink-faint transition-all duration-200 resize-none"
            />
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
              className={`absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isListening
                  ? 'bg-danger text-white animate-pulse-ring'
                  : 'bg-cream-dark text-ink-muted hover:bg-sage-light hover:text-sage'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 mt-2 animate-fade">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <p className="text-xs text-danger font-medium">音声認識中...</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!photoDataUrl || !location.trim()}
            className="w-full bg-sage text-white rounded-xl py-3.5 font-medium text-sm tracking-wide hover:bg-sage-dark disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
          >
            追加する
          </button>
        </div>
      </form>
    </div>
  );
}
