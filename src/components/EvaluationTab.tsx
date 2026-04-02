import { useRef, useState } from 'react';
import { useTheme } from '../ThemeContext';

interface Props {
  value: string;
  onChange: (text: string) => void;
}

export default function EvaluationTab({ value, onChange }: Props) {
  const { theme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  function createRecognition(): SpeechRecognition | null {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    return recognition;
  }

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
    let finalTranscript = value;

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
      onChange(finalTranscript + interim);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      setIsListening(false);
      onChange(finalTranscript);
    };

    recognition.start();
    setIsListening(true);
  };

  const insertBullet = () => {
    const bullet = value ? '\n・' : '・';
    onChange(value + bullet);
  };

  return (
    <div className="px-4 py-4 pb-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-text-muted">総評</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={insertBullet}
              className="h-8 px-3 rounded-t bg-base-deep text-text-muted text-sm font-bold hover:bg-primary-light hover:text-primary transition-colors duration-150"
              aria-label="箇条書きを挿入"
            >
              ・ 箇条書き
            </button>
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isListening
                  ? 'bg-danger text-white animate-breathe'
                  : 'bg-base-deep text-text-muted hover:bg-primary-light hover:text-primary'
              }`}
              style={isListening ? { boxShadow: '0 0 0 4px var(--t-danger-light)' } : {}}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'・全体的な感染対策の遵守状況は良好でした。\n・手指衛生の実施率が向上しており、改善が見られます。\n・PPEの適切な使用について再教育が必要です。\n・次回ラウンドまでに○○の改善を依頼します。\n・継続的な取り組みへの感謝を伝えました。'}
          rows={10}
          className="w-full bg-base border-2 border-line rounded-t px-4 py-3 text-base text-text placeholder:text-text-faint transition-all duration-200 resize-none leading-relaxed"
        />

        {isListening && (
          <div className="flex items-center gap-2 mt-2.5 animate-fade">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <p className="text-xs text-danger font-bold">{theme.listeningLabel}</p>
          </div>
        )}

        <div className="flex justify-end mt-2">
          <span className="text-xs text-text-faint">{value.length} 文字</span>
        </div>
      </div>

      {!value && (
        <p className="text-xs text-text-faint text-center mt-4 leading-relaxed">
          ラウンド終了後、全体の総評を入力してください。<br />箇条書きで5文程度が目安です。
        </p>
      )}
    </div>
  );
}
