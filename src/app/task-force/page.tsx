import type { Metadata } from "next";
import { CHAIR, MEMBERS } from "@/data/context";
import { Eyebrow, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "The Task Force | National A.I. Policy Explorer",
  description:
    "The multidisciplinary members of Jamaica's National Artificial Intelligence Task Force, drawn from the private sector, public institutions and academia.",
};

function initials(name: string) {
  return name
    .replace(/,.*$/, "")
    .split(" ")
    .filter((w) => !/^(Dr\.?|PhD|CD)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export default function TaskForcePage() {
  return (
    <>
      <PageHeader
        eyebrow="The Task Force"
        title="A multidisciplinary team"
        lede="Experts from the private sector, public institutions and academia — bringing experience in cybersecurity, artificial intelligence, digital policy and regulation, data analytics, business process outsourcing, data management, skills development, youth engagement and IT services."
      />

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <section className="rounded-xl border border-jm-gold/30 bg-jm-gold/5 p-6 sm:p-8">
          <Eyebrow>{CHAIR.title}</Eyebrow>
          <div className="mt-4 flex items-center gap-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-jm-gold font-display text-xl font-semibold text-jm-black">
              {initials(CHAIR.name)}
            </span>
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight">{CHAIR.name}</p>
              <p className="mt-1 text-sm text-jm-muted">{CHAIR.role}</p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <Eyebrow>Members</Eyebrow>
          <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2 lg:grid-cols-3">
            {MEMBERS.map((m) => (
              <div key={m.name} className="flex gap-4 bg-jm-ink p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-jm-line bg-jm-black font-display text-sm font-semibold text-jm-gold">
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold leading-tight">{m.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-jm-muted">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8">
          <Eyebrow>Mandate</Eyebrow>
          <p className="mt-4 max-w-4xl leading-relaxed text-jm-muted">
            To conduct rigorous research, engage strategic stakeholders across the public and
            private sectors, and draw upon international best practices to forge a path tailored to
            Jamaica&apos;s unique economic, cultural and social context — analysing the impacts of
            A.I. adoption, identifying the skills needed for a future-ready citizenry and workforce,
            and proposing frameworks that prioritise digital literacy, safety, security, privacy and
            inclusivity.
          </p>
        </section>
      </div>
    </>
  );
}
