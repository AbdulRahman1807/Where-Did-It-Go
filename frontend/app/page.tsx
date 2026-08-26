import Link from "next/link";
import { Hero } from "@/components/hero/Hero";

const STAGES = [
  { n: "01", title: "Incident", body: "A pick task fails. The exception is reported with its task and order." },
  { n: "02", title: "Investigation", body: "Operational tools are queried: order, task, inventory, location, event history." },
  { n: "03", title: "Evidence", body: "Findings are checked against documented procedure, retrieved by meaning, not keyword." },
  { n: "04", title: "Finding", body: "A likely cause is inferred from the evidence -- and labeled as an inference, not a fact." },
  { n: "05", title: "Review", body: "Consequential or uncertain cases pause for a human decision, with the reasoning shown." },
  { n: "06", title: "Resolution", body: "Approve, reject, or escalate -- the human's decision closes the loop." },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />

      <section className="border-t border-border-subtle bg-primary px-6 py-24 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-text-tertiary">
              How an investigation runs
            </div>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-text-primary sm:text-4xl">
              One continuous investigation, not a chat window.
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <div key={s.n} className="border-l border-border-subtle pl-5">
                <div className="font-display text-sm text-cyan">{s.n}</div>
                <div className="mt-2 font-display text-lg font-medium text-text-primary">{s.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border-subtle bg-primary px-6 py-24 sm:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <h2 className="max-w-xl font-display text-3xl font-medium tracking-tight text-text-primary sm:text-4xl">
            The agent recommends. <span className="text-cyan">The human retains authority.</span>
          </h2>
          <div className="max-w-sm">
            <p className="text-sm text-text-secondary">
              Every recommendation is grounded in operational evidence and documented procedure --
              and every consequential decision is routed to a person before it becomes final.
            </p>
            <Link
              href="/investigations"
              className="focus-ring group mt-6 inline-flex items-center gap-3 border border-cyan bg-cyan px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-void transition-colors hover:bg-text-primary hover:border-text-primary"
            >
              Open the investigation console
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border-subtle px-6 py-8 text-center text-xs text-text-tertiary sm:px-12">
        Where Did It Go? — an agentic fulfillment exception investigator. Synthetic operational data, for demonstration only.
      </footer>
    </div>
  );
}
