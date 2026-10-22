/** Honest placeholder for modules that are not built yet (no fake content, no dead buttons). */
export default function PlaceholderPage({ title, milestone }: { title: string; milestone?: number }) {
  return (
    <div className="p-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-prose text-sm text-slate-400">
        {milestone
          ? `This module is not built yet. It is scheduled for Milestone ${milestone} (see docs/PROGRESS.md).`
          : 'There is no page at this address.'}
      </p>
    </div>
  )
}
