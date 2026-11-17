import { useFacilitySettings } from './useFacilitySettings';
import ScreenHeader from './ScreenHeader';
import SettingsFileCard from './SettingsFileCard';
import SettingsErrorList from './SettingsErrorList';
import SettingsSummary from './SettingsSummary';

/** Facility settings screen: file card, read errors, save failure, settings summary. `onBack` adds a way home. */
export default function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { settings, errors, saveFailed, loading, loadFile } = useFacilitySettings();

  return (
    <div className="min-h-screen bg-base">
      {/* No way back while reading: home would keep the settings from before the file is saved. */}
      <ScreenHeader subtitle="全部署を回るラウンドの施設設定（開発中）" onBack={onBack} backDisabled={loading} />

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
