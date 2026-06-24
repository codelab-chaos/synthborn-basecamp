import { basecampApps, type BasecampAppId } from "./basecamp-app-links";

type BasecampAppBadgeProps = {
  app: BasecampAppId;
  variant?: "fixed" | "header-rail";
};

function basecampHomeHref(): string {
  return window.location.pathname.includes("/apps/") ? "../../index.html" : "../index.html";
}

export function BasecampAppBadge({ app, variant = "fixed" }: BasecampAppBadgeProps) {
  const { iconSrc, navLabel } = basecampApps[app];
  const className = variant === "header-rail"
    ? "basecamp-app-badge basecamp-app-badge--header-rail"
    : "basecamp-app-badge";

  return (
    <a
      className={className}
      href={basecampHomeHref()}
      title={`Synthborn Basecamp — ${navLabel}`}
      aria-label={`Back to Basecamp home (${navLabel})`}
    >
      <img src={iconSrc} alt="" />
    </a>
  );
}
