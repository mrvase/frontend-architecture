import React from "react";
import { useLocation, useNavigate } from "./Router";
import { type To } from "./types";
import { createPath, resolveTo } from "./utils";

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  active?: boolean;
  reload?: boolean;
  state?: any;
  replace?: boolean;
  scroll?: boolean;
}

export function useHref(to: To): string {
  let { pathname } = useLocation();
  return React.useMemo(() => createPath(resolveTo(to, pathname)), [to, pathname]);
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ onClick, reload, replace, target, to, state, scroll = true, active, ...rest }, ref) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const href = React.useMemo(() => {
      if (typeof to === "object") {
        return createPath(to);
      }
      return createPath(navigate(to, { navigate: false }));
    }, [navigate, to]);

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (onClick) onClick(event);
        if (!event.defaultPrevented && shouldHandleLinkClick(event, target)) {
          event.preventDefault();

          const options = {
            replace: replace ?? pathname === href,
            state,
          };

          navigate(to, options);
        }
      },
      [pathname, navigate, href, replace, target, to, onClick]
    );

    return (
      <a
        {...rest}
        data-active={(active ?? href === pathname) ? "" : undefined}
        href={href}
        onClick={reload ? onClick : handleClick}
        ref={ref}
        target={target}
      />
    );
  }
);

type LimitedMouseEvent = Pick<MouseEvent, "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey">;

function shouldHandleLinkClick(event: LimitedMouseEvent, target?: string) {
  return (
    // Ignore clicks with modifier keys
    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) &&
    // Ignore everything but left clicks
    event.button === 0 &&
    // Let browser handle other target types
    (!target || target === "_self")
  );
}
