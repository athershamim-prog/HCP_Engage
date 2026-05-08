export function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-2">{heading}</h3>
      <p className="text-[14px] text-[hsl(215_16%_47%)] max-w-sm">{body}</p>
    </div>
  );
}
