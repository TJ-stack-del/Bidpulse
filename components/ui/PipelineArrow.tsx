// Landing page "before/after" portal circle. Used to pulse indefinitely
// (an infinite scale + glow loop) to match a "live system processing"
// feel -- deliberately removed: a perpetually-animating status indicator
// reads as live software automation, which overstates what actually
// happens (a person on the team prepares each document; see the "our
// team prepares..." copy this section now echoes). A plain, calm circle
// fits a before/after comparison better than a pulsing one.
export function PipelineArrow() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-md">
      {/* Below lg the pipeline's grid stacks to one column (left card,
          arrow, right card top-to-bottom), so the arrow needs to point
          down instead of right to still read as "flows into the next
          card." */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="rotate-90 lg:rotate-0 transition-transform duration-300"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </div>
  );
}
