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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">感染対策ラウンド</h1>
          <p className="text-gray-500 mt-2">ラウンドを開始するには担当者名を入力してください</p>
        </div>

        <label className="block mb-2 text-sm font-medium text-gray-700">担当者名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 山田 花子"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-6 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          ラウンド開始
        </button>
      </form>
    </div>
  );
}
