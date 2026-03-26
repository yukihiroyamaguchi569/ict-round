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
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">チェックポイント追加</h2>

      {/* Location */}
      <div>
        <label htmlFor="location-input" className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
        <input
          id="location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="例: 3F ナースステーション"
          maxLength={100}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">写真</label>
        {photoDataUrl ? (
          <div className="relative">
            <img src={photoDataUrl} alt="撮影済み" className="w-full rounded-lg max-h-64 object-cover" />
            <button
              type="button"
              onClick={() => { setPhotoDataUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center"
            >
              &times;
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 text-gray-500 hover:border-blue-400 transition-colors"
          >
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            写真を撮影 / 選択
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
        <label htmlFor="comment-input" className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
        <div className="relative">
          <textarea
            id="comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="音声入力またはテキスト入力..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <button
            type="button"
            onClick={toggleListening}
            aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
            className={`absolute right-2 bottom-2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
        {isListening && <p className="text-sm text-red-500 mt-1">音声認識中...</p>}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-lg py-3 text-gray-700 font-medium hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!photoDataUrl || !location.trim()}
          className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          追加
        </button>
      </div>
    </form>
  );
}
