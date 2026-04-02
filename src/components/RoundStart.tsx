import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import ThemeSelector from './ThemeSelector';

interface Props {
  onStart: (name: string, wardName: string) => void;
}

export default function RoundStart({ onStart }: Props) {
  const [name, setName] = useState('');
  const [wardName, setWardName] = useState('');
  const { theme } = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onStart(name.trim(), wardName.trim());
  };

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6">
      <div className="fixed top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <div className="animate-page w-full max-w-sm">
        {/* Icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-20 h-20 rounded-t-lg bg-primary-light flex items-center justify-center" style={{ boxShadow: 'var(--t-btn-glow)' }}>
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-text">{theme.startTitle}</h1>
          <p className="text-text-muted text-sm mt-2 leading-relaxed whitespace-pre-line">{theme.startSubtitle}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">担当者名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 花子"
              className="w-full bg-base border-2 border-line rounded-t px-4 py-3.5 text-base text-text placeholder:text-text-faint transition-all duration-200"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">
              病棟名
              <span className="text-text-faint font-normal ml-1">（任意）</span>
            </label>
            <input
              type="text"
              value={wardName}
              onChange={(e) => setWardName(e.target.value)}
              placeholder="例: 3階東病棟"
              className="w-full bg-base border-2 border-line rounded-t px-4 py-3.5 text-base text-text placeholder:text-text-faint transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="btn-primary w-full py-4 text-base font-bold"
          >
            ラウンド開始
          </button>
        </form>

        <p className="text-center text-text-faint text-xs mt-10">ICN 感染対策ラウンドシステム</p>
      </div>
    </div>
  );
}
