type PageHeaderProps = {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-normal text-ink">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
