import { useState } from 'react';

interface Props {
  onStart: (name: string) => void;
}

export default function RoundStart({ onStart }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onStart(name.trim());
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="animate-page w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex items-center justify-center mb-12">
          <div className="w-12 h-12 rounded-2xl bg-sage flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">感染対策ラウンド</h1>
          <p className="text-ink-muted text-sm mt-2 font-light">ラウンドを開始するには担当者名を入力してください</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="stagger-children">
          <div>
            <label className="block text-xs font-medium text-ink-muted uppercase tracking-widest mb-2">担当者名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 花子"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base text-ink placeholder:text-ink-faint transition-all duration-200"
              autoFocus
            />
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-sage text-white rounded-xl py-3.5 text-base font-medium tracking-wide hover:bg-sage-dark disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              ラウンド開始
            </button>
          </div>
        </form>

        {/* Subtle footer */}
        <p className="text-center text-ink-faint text-xs mt-12 font-light">ICN Infection Control Round</p>
      </div>
    </div>
  );
}
