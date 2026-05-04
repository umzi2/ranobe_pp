import { createSignal, JSXElement, onMount, ParentProps, Show } from "solid-js";
import { isServer } from "solid-js/web";

/**
 * Wraps children so they are never SSR'ed.
 * On the server renders nothing (or the provided fallback).
 * On the client mounts after the first paint — children are only rendered then.
 */
export function NoSSR(props: ParentProps<{ fallback?: JSXElement }>) {
  if (isServer) {
    return props.fallback ?? null;
  }

  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));

  return <Show when={mounted()}>{props.children}</Show>;
}
