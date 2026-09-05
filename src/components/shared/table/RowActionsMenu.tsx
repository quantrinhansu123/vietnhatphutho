import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

type RowActionsMenuProps = {
  children: React.ReactNode;
  label?: string;
};

type MenuPosition = {
  left: number;
  top: number;
  maxHeight?: number;
};

const MENU_WIDTH = 192;
const VIEWPORT_GAP = 8;

function getTextContent(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map(child => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (!React.isValidElement<Record<string, unknown>>(child)) return '';
      return getTextContent(child.props.children as React.ReactNode);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectActionVisuals(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return [];
    if (child.type === React.Fragment || typeof child.type === 'string') {
      return collectActionVisuals(child.props.children as React.ReactNode);
    }
    return [child];
  });
}

function getActionLabel(element: React.ReactElement<Record<string, unknown>>) {
  const title = element.props.title;
  if (typeof title === 'string' && title.trim()) return title;

  const ariaLabel = element.props['aria-label'];
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) return ariaLabel;

  const label = element.props.label;
  if (typeof label === 'string' && label.trim()) return label;

  const textContent = getTextContent(element.props.children as React.ReactNode);
  if (textContent) return textContent;

  return 'Thao tác';
}

function collectActions(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return [];
    if (child.type === 'button' || child.type === 'a' || typeof child.props.onClick === 'function') return [child];
    return collectActions(child.props.children as React.ReactNode);
  });
}

export function RowActionsMenu({ children, label = 'Thao tác' }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const actions = collectActions(children);

  const calculatePosition = (): MenuPosition => {
    const trigger = triggerRef.current;
    if (!trigger) return { left: VIEWPORT_GAP, top: VIEWPORT_GAP };

    const rect = trigger.getBoundingClientRect();
    const measuredHeight = menuRef.current?.offsetHeight || 0;
    const estimatedHeight = actions.length * 44 + 16;
    const menuHeight = measuredHeight > 0 ? measuredHeight : estimatedHeight;

    const left = Math.min(
      Math.max(VIEWPORT_GAP, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - VIEWPORT_GAP
    );

    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - VIEWPORT_GAP);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_GAP);

    // Nếu nút nằm ở nửa dưới màn hình HOẶC khoảng trống phía dưới không đủ (+20px dự phòng)
    // -> BẮT BUỘC MỞ HƯỚNG LÊN TRÊN (OPEN UPWARDS)
    const isLowerHalf = rect.top > window.innerHeight * 0.5;
    const preferUpwards = isLowerHalf || spaceBelow < menuHeight + 20;

    let top: number;
    let maxHeight: number | undefined;

    if (preferUpwards && spaceAbove >= 60) {
      top = Math.max(VIEWPORT_GAP, rect.top - menuHeight - 6);
      maxHeight = spaceAbove - 6;
    } else if (spaceBelow >= menuHeight) {
      top = rect.bottom + 6;
      maxHeight = spaceBelow - 6;
    } else {
      top = Math.max(VIEWPORT_GAP, rect.top - menuHeight - 6);
      maxHeight = Math.max(spaceAbove, spaceBelow) - 6;
    }

    return { left, top, maxHeight };
  };

  const updatePosition = () => {
    setPosition(calculatePosition());
  };

  const handleToggle = () => {
    if (!open) {
      setPosition(calculatePosition());
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const animId = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(animId);
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      <span className="flex w-full justify-center">
        <button
          ref={triggerRef}
          type="button"
          title={label}
          aria-label={label}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          aria-expanded={open}
          onClick={handleToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-[#ef1b2d] hover:bg-zinc-50 active:scale-95"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </span>

      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="fixed z-[120] w-48 max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            maxHeight: position.maxHeight ? `${position.maxHeight}px` : undefined
          }}
        >
          {actions.map((action, index) => {
            const actionLabel = getActionLabel(action);
            const originalOnClick = action.props.onClick as ((event: React.MouseEvent<HTMLElement>) => void) | undefined;
            const originalClassName = typeof action.props.className === 'string' ? action.props.className : '';
            const isNativeAction = action.type === 'button' || action.type === 'a';
            const isDanger = action.props.danger === true || /xóa|xoá/i.test(actionLabel);
            const actionVisuals = collectActionVisuals(action.props.children as React.ReactNode);

            if (!isNativeAction) {
              return (
                <button
                  key={action.key ?? `${actionLabel}-${index}`}
                  type="button"
                  role="menuitem"
                  disabled={action.props.disabled === true}
                  onClick={event => {
                    originalOnClick?.(event);
                    if (!event.defaultPrevented) setOpen(false);
                  }}
                  className={`flex min-h-10 w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 ${isDanger ? 'text-rose-700 hover:bg-rose-50' : 'text-zinc-700'}`}
                >
                  {actionVisuals}
                  <span className="min-w-0 flex-1 truncate">{actionLabel}</span>
                </button>
              );
            }

            return React.cloneElement(action, {
              key: action.key ?? `${actionLabel}-${index}`,
              role: 'menuitem',
              title: undefined,
              className: `${originalClassName} !flex !h-auto !min-h-10 !w-full !items-center !justify-start !gap-2 !rounded-xl !border-0 !bg-transparent !px-3 !py-2 !text-left !text-sm !font-semibold !shadow-none hover:!bg-zinc-50`,
              onClick: (event: React.MouseEvent<HTMLElement>) => {
                originalOnClick?.(event);
                if (!event.defaultPrevented) setOpen(false);
              },
              children: (
                <>
                  {actionVisuals}
                  <span className="min-w-0 flex-1 truncate">{actionLabel}</span>
                </>
              )
            });
          })}
        </div>,
        document.body
      )}
    </>
  );
}
