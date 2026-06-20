// Consistent page heading for the standalone list pages.
const PageHeader = ({ icon: Icon, title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-3 mb-5">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-base-content/60">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
