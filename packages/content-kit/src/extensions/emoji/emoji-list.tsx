import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
  useCallback,
} from 'react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import type { EmojiItem } from '@tiptap/extension-emoji';

export type EmojiListRef = {
  onKeyDown: (x: SuggestionKeyDownProps) => boolean;
};

type Props = SuggestionProps<EmojiItem, { name: string }>;

export const EmojiList = forwardRef<EmojiListRef, Props>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        // The Emoji suggestion command expects a { name } payload
        props.command({ name: item.name });
      }
    },
    [props],
  );

  const upHandler = useCallback(() => {
    const len = props.items.length;
    setSelectedIndex((prev) => (prev + len - 1) % len);
  }, [props.items.length]);

  const downHandler = useCallback(() => {
    const len = props.items.length;
    setSelectedIndex((prev) => (prev + 1) % len);
  }, [props.items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  useEffect(() => setSelectedIndex(0), [props.items]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      // rAF avoids jank when the list just re-rendered
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (x: SuggestionKeyDownProps) => {
        if (x.event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        if (x.event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        if (x.event.key === 'Enter' || x.event.key === 'Tab') {
          enterHandler();
          return true;
        }
        return false;
      },
    }),
    [upHandler, downHandler, enterHandler],
  );

  return (
    <div className="dropdown-menu" role="listbox" aria-label="Emoji suggestions" ref={containerRef}>
      {props.items.map((item, index) => (
        <button
          // Avoid returning a value from the ref callback
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          className={index === selectedIndex ? 'is-selected' : ''}
          role="option"
          aria-selected={index === selectedIndex}
          key={item.name ?? index}
          onClick={() => selectItem(index)}
          type="button"
        >
          {item.fallbackImage ? (
            <img src={item.fallbackImage} style={{ verticalAlign: 'middle' }} alt="" />
          ) : (
            item.emoji
          )}
          :{item.name}:
        </button>
      ))}
    </div>
  );
});
