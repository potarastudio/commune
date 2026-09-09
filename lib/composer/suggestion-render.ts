import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { SuggestionListRef } from "@/components/message/suggestion-list";

/**
 * Tiptap suggestion `render()` that mounts a React list above the caret. The
 * composer sits at the bottom of the screen, so the popup always opens upward.
 */
export function suggestionRender<Item>(
  Component: React.ComponentType<SuggestionProps<Item> & { ref?: React.Ref<SuggestionListRef> }>,
): NonNullable<SuggestionOptions<Item>["render"]> {
  return () => {
    let renderer: ReactRenderer<SuggestionListRef, SuggestionProps<Item>> | undefined;

    // The composer's Enter-to-send runs before plugins see the key, so it checks
    // this flag and stands aside while a list with matches is open.
    const flag = (props: SuggestionProps<Item>, open: boolean) => {
      const dom = props.editor.view.dom as HTMLElement;
      if (open && props.items.length > 0) dom.dataset.suggestionOpen = "true";
      else delete dom.dataset.suggestionOpen;
    };

    /** Widest popover the composer mounts (the mention list); the emoji list is 332px. */
    const FALLBACK_WIDTH = 340;
    /** Breathing room kept between the popover and the viewport edge. */
    const GUTTER = 8;

    const position = (props: SuggestionProps<Item>) => {
      const rect = props.clientRect?.();
      if (!rect || !renderer) return;
      const el = renderer.element as HTMLElement;
      el.style.position = "fixed";
      el.style.zIndex = "60";
      // Clamp against the popover's *real* width. A fixed 300px constant cut the
      // last 40px off the 340px mention list whenever the caret sat near the
      // right edge (routine in the 380px thread panel).
      const width = el.offsetWidth || FALLBACK_WIDTH;
      const maxLeft = Math.max(GUTTER, window.innerWidth - width - GUTTER);
      el.style.left = `${Math.max(GUTTER, Math.min(rect.left, maxLeft))}px`;
      el.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    };

    return {
      onStart(props) {
        renderer = new ReactRenderer(Component, { props, editor: props.editor });
        document.body.appendChild(renderer.element);
        position(props);
        flag(props, true);
      },
      onUpdate(props) {
        renderer?.updateProps(props);
        position(props);
        flag(props, true);
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === "Escape") {
          renderer?.destroy();
          renderer?.element.remove();
          renderer = undefined;
          delete (props.view.dom as HTMLElement).dataset.suggestionOpen;
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit(props) {
        renderer?.destroy();
        renderer?.element.remove();
        renderer = undefined;
        flag(props, false);
      },
    };
  };
}
