/**
 * Three pulsing dots — a visual "digitando..." affordance.
 * Purely decorative: no backend wiring, safe to drop in anywhere a
 * live-typing state might eventually be simulated or streamed in.
 */
export function TypingIndicator({ label = 'IA está digitando' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 w-fit bg-blue-50 border border-blue-100 rounded-2xl rounded-bl-sm">
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span
          className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  );
}
