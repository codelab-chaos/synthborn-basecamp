import { basecampApps, type BasecampAppId } from "./basecamp-app-links";
import "./basecamp-shell.css";
import "./basecamp-app-nav.css";

type BasecampAppNavProps = {
  current: BasecampAppId;
};

export function BasecampAppNav({ current }: BasecampAppNavProps) {
  const links = (Object.keys(basecampApps) as BasecampAppId[]).filter((id) => id !== current);

  return (
    <nav className="basecamp-app-nav" aria-label="Basecamp apps">
      {links.map((id) => (
        <a
          key={id}
          className="basecamp-app-nav__link"
          href={basecampApps[id].href}
          title={basecampApps[id].pageTitle}
        >
          {basecampApps[id].navLabel}
        </a>
      ))}
    </nav>
  );
}
