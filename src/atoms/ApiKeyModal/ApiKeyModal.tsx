import { createSignal, onCleanup, onMount } from "solid-js";
import {
  setModalCallback,
  submitApiKey,
  cancelApiKey,
} from "~/services/api-key";
import "./ApiKeyModal.scss";

export function ApiKeyModal() {
  const [open, setOpen] = createSignal(false);
  const [key, setKey] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    setModalCallback((isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        setKey("");
        // Focus the input after the modal renders
        setTimeout(() => inputRef?.focus(), 50);
      }
    });
  });

  onCleanup(() => {
    setModalCallback(() => {});
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const value = key().trim();
    if (value.length > 0) {
      submitApiKey(value);
    }
  };

  const handleCancel = () => {
    cancelApiKey();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div
      class={`ApiKeyModal-overlay${open() ? " ApiKeyModal-overlay--open" : ""}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Enter API Key"
    >
      <div class="ApiKeyModal">
        <h2 class="ApiKeyModal__title">API Key Required</h2>
        <p class="ApiKeyModal__desc">
          Please enter your API key to continue. It will be stored locally and
          used for all subsequent requests.
        </p>
        <form class="ApiKeyModal__form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            class="ApiKeyModal__input"
            type="password"
            placeholder="Enter your API key…"
            value={key()}
            onInput={(e) => setKey(e.currentTarget.value)}
            autocomplete="off"
          />
          <div class="ApiKeyModal__actions">
            <button
              type="button"
              class="ApiKeyModal__btn ApiKeyModal__btn--cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="ApiKeyModal__btn ApiKeyModal__btn--submit"
              disabled={key().trim().length === 0}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
