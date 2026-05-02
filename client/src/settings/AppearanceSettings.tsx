import { useMemo, useState } from "react";
import type { SettingsSectionProps } from "./SettingsLayout";

const FIELD_CLASS =
  "w-full rounded-lg border border-cyan-400/25 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300/70";

type Theme = "light" | "dark" | "system";
type Density = "compact" | "comfortable" | "spacious";

export default function AppearanceSettings({ showToast }: SettingsSectionProps) {
  const [theme, setTheme] = useState<Theme>("system");
  const [fontSize, setFontSize] = useState(15);
  const [density, setDensity] = useState<Density>("comfortable");
  const [wallpaper, setWallpaper] = useState("Aurora");

  const previewStyle = useMemo(() => {
    const isLight = theme === "light";
    const bubblePad = density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2";

    return {
      frame: isLight ? "bg-white text-zinc-900" : "bg-zinc-950 text-zinc-100",
      bubbleLeft: `${bubblePad} bg-zinc-700/70`,
      bubbleRight: `${bubblePad} bg-primary-gradient`,
    };
  }, [density, theme]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Appearance Controls</h3>
        <p className="mt-1 text-xs text-text-muted">Preview updates live as you change settings.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-text-muted">Theme</span>
            <select
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value as Theme);
                showToast("Theme applied");
              }}
              className={FIELD_CLASS}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Message density</span>
            <select
              value={density}
              onChange={(e) => {
                setDensity(e.target.value as Density);
                showToast("Density updated");
              }}
              className={FIELD_CLASS}
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Chat wallpaper</span>
            <select
              value={wallpaper}
              onChange={(e) => {
                setWallpaper(e.target.value);
                showToast("Wallpaper changed");
              }}
              className={FIELD_CLASS}
            >
              <option value="Aurora">Aurora</option>
              <option value="Grid">Grid</option>
              <option value="Cloud">Cloud</option>
              <option value="Minimal">Minimal</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-muted">Font size ({fontSize}px)</span>
            <input
              type="range"
              min={12}
              max={20}
              value={fontSize}
              onChange={(e) => {
                setFontSize(Number(e.target.value));
                showToast("Font size updated");
              }}
              className="w-full accent-primary-blue"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/45 p-4 shadow-[0_24px_70px_-52px_rgba(34,211,238,0.8)] md:p-5">
        <h3 className="text-base font-semibold text-text-primary">Live Preview</h3>
        <p className="mt-1 text-xs text-text-muted">No save button required. What you see is what you get.</p>

        <div
          className={`mt-4 rounded-2xl border border-cyan-400/20 p-4 ${previewStyle.frame}`}
          style={{
            fontSize: `${fontSize}px`,
            backgroundImage:
              wallpaper === "Aurora"
                ? "radial-gradient(circle at 0% 0%, rgba(79,70,229,0.35), transparent 45%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.25), transparent 55%)"
                : wallpaper === "Grid"
                  ? "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)"
                  : wallpaper === "Cloud"
                    ? "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.12), transparent 50%)"
                    : "none",
            backgroundSize: wallpaper === "Grid" ? "18px 18px" : "auto",
          }}
        >
          <div className="max-w-xs space-y-2">
            <div className={`w-fit rounded-xl px-3 ${previewStyle.bubbleLeft}`}>
              Incoming message preview
            </div>
            <div className={`ml-auto w-fit rounded-xl px-3 text-white ${previewStyle.bubbleRight}`}>
              Outgoing message preview
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
