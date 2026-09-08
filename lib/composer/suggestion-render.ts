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

    const position = (props: SuggestionProps<Item>) => {
      const rect = props.clientRect?.();
      if (!rect || !renderer) return;
      const el = renderer.element as HTMLElement;
      el.style.position = "fixed";
      el.style.zIndex = "60";
      el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
      el.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    };

    return {
      onStart(props) {
        renderer = new ReactRenderer(Component, { props, editor: props.editor });
        document.body.appendChild(renderer.element);
        position(props);
      },
      onUpdate(props) {
        renderer?.updateProps(props);
        position(props);
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === "Escape") {
          renderer?.destroy();
          renderer?.element.remove();
          renderer = undefined;
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        renderer?.destroy();
        renderer?.element.remove();
        renderer = undefined;
      },
    };
  };
}
