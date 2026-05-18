/**
 * ──────────────────────────────────────────────────────────
 * useLocalStoragePersistence
 *
 * Сохраняет EditorState в localStorage при каждом изменении
 * и восстанавливает его при монтировании.
 *
 * Ключ: ranobe-editor-state:<storageKey>
 * ──────────────────────────────────────────────────────────
 */

import type { LexicalEditor } from "lexical";
import { onCleanup } from "solid-js";

const STORAGE_PREFIX = "ranobe-editor-state";

export function useLocalStoragePersistence(
  editor: LexicalEditor,
  storageKey: string,
): void {
  // Восстанавливаем сохранённое состояние при монтировании
  const saved = localStorage.getItem(`${STORAGE_PREFIX}:${storageKey}`);
  if (saved) {
    try {
      const editorState = editor.parseEditorState(saved);
      editor.setEditorState(editorState);
    } catch (e) {
      console.warn(
        "[useLocalStoragePersistence] Failed to restore editor state:",
        e,
      );
    }
  }

  // Сохраняем состояние при каждом изменении
  const unreg = editor.registerUpdateListener(
    ({ editorState, dirtyLeaves, dirtyElements }) => {
      // Не сохраняем, если изменений нет (начальная загрузка)
      if (dirtyLeaves.size === 0 && dirtyElements.size === 0) return;

      const json = JSON.stringify(editorState.toJSON());
      try {
        localStorage.setItem(`${STORAGE_PREFIX}:${storageKey}`, json);
      } catch (e) {
        console.warn(
          "[useLocalStoragePersistence] Failed to save editor state:",
          e,
        );
      }
    },
  );

  onCleanup(unreg);
}
