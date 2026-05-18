// ──────────────────────────────────────────────────────────
// SettingsPanel — панель настроек (слайд справа)
//
// Сохраняет: maxWidth, цвета текста/фона/ссылок/цитат/комментариев.
// ──────────────────────────────────────────────────────────

import { Portal } from "solid-js/web";
import { settings } from "../store/settings";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  function onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) props.onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") props.onClose();
  }

  return (
    <Portal mount={document.body}>
      <div
        class="settings-overlay"
        onClick={onOverlayClick}
        onKeyDown={onKeyDown}
      >
        <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
          {/* Заголовок */}
          <div class="settings-header">
            <h2 class="settings-title">⚙ Settings</h2>
            <button class="settings-close" onClick={props.onClose}>
              ✕
            </button>
          </div>

          {/* Максимальная ширина */}
          <div class="settings-group">
            <span class="settings-label">Max Width</span>
            <div class="settings-row">
              <input
                type="range"
                class="settings-input"
                min="320"
                max="1440"
                step="10"
                value={settings.maxWidth()}
                onInput={(e) =>
                  settings.setMaxWidth(Number(e.currentTarget.value))
                }
              />
              <input
                type="number"
                class="settings-input"
                style={{ width: "70px", flex: "none" }}
                min="320"
                max="1440"
                value={settings.maxWidth()}
                onInput={(e) =>
                  settings.setMaxWidth(Number(e.currentTarget.value))
                }
              />
            </div>
          </div>

          <hr class="settings-divider" />

          {/* Цвет текста */}
          <ColorSetting
            label="Text Color"
            value={settings.textColor()}
            onChange={settings.setTextColor}
          />

          {/* Фон контента */}
          <ColorSetting
            label="Content Background"
            value={settings.bgColor()}
            onChange={settings.setBgColor}
          />

          {/* Фон страницы */}
          <ColorSetting
            label="Page Background"
            value={settings.pageBgColor()}
            onChange={settings.setPageBgColor}
          />

          {/* Цвет ссылок */}
          <ColorSetting
            label="Link Color"
            value={settings.linkColor()}
            onChange={settings.setLinkColor}
          />

          {/* Цвет комментариев */}
          <ColorSetting
            label="Comment Color"
            value={settings.commentColor()}
            onChange={settings.setCommentColor}
          />

          {/* Цвет цитат */}
          <ColorSetting
            label="Quote Border"
            value={settings.quoteColor()}
            onChange={settings.setQuoteColor}
          />

          <hr class="settings-divider" />

          {/* Сброс */}
          <button class="settings-reset" onClick={settings.resetAll}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </Portal>
  );
}

// ── Подкомпонент: цвет ─────────────────────────────────

function ColorSetting(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div class="settings-group">
      <span class="settings-label">{props.label}</span>
      <div class="settings-row">
        <input
          type="color"
          class="settings-color"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
        <input
          type="text"
          class="settings-input"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
