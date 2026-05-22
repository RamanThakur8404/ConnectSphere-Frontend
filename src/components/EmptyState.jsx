export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-white p-8 sm:p-12 rounded-2xl border border-border shadow-sm text-center flex flex-col items-center gap-4">
      <div className="p-4 bg-muted rounded-full w-16 h-16 flex justify-center items-center">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-1 text-base sm:text-lg">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-4 px-4 py-2 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition">
          {action.label}
        </button>
      )}
    </div>
  );
}
