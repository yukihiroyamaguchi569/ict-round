import { useFacilitySettings } from './useFacilitySettings';
import SettingsFileCard from './SettingsFileCard';
import SettingsErrorList from './SettingsErrorList';
import SettingsSummary from './SettingsSummary';

export default function FacilityApp() {
  const { settings, errors, saveFailed, loading, loadFile } = useFacilitySettings();

  return (
    <div className="min-h-screen bg-base">
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5">
        <h1 className="text-base font-extrabold text-text">施設ラウンド</h1>
        <p className="text-xs text-text-muted mt-0.5">全部署を回るラウンドの施設設定（開発中）</p>
      </div>

      <div className="animate-page px-4 py-5 pb-16 max-w-3xl mx-auto space-y-5">
        <SettingsFileCard loading={loading} onFile={(file) => void loadFile(file)} />

        {errors.length > 0 && <SettingsErrorList errors={errors} hasSaved={settings !== null} />}

        {saveFailed && (
          <div role="alert" className="card p-4 border border-danger">
            <p className="text-xs font-extrabold text-danger">読み込んだ設定をこの端末に保存できませんでした</p>
            <p className="text-xs text-text mt-1 leading-relaxed">
              ブラウザの保存領域がいっぱいか、このブラウザでは保存が許可されていない可能性があります。{settings ? '保存している設定は変わっていません。' : ''}
            </p>
          </div>
        )}

        {settings ? (
          <SettingsSummary settings={settings} />
        ) : (
          <p className="text-xs text-text-muted text-center py-4">まだ施設設定が保存されていません。</p>
        )}
      </div>
    </div>
  );
}
