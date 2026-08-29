import { MarketingShell } from "@/components/ui/MarketingShell";
import { QuizForm } from "./QuizForm";

export default function QuizPage() {
  return (
    <MarketingShell activePath="/quiz">
      <section className="max-w-lg mx-auto w-full flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-headline-lg text-on-surface">Are you ready to bid?</h1>
          <p className="text-body-md text-on-surface-variant">Four quick questions.</p>
        </div>
        <QuizForm />
      </section>
    </MarketingShell>
  );
}
