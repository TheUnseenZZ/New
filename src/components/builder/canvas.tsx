"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { EndingView, FormShell, QuestionView, WelcomeView } from "@/components/form/views";
import type { Answer, FormSchema } from "@/lib/types";
import type { Selection } from "./types";

export function Canvas({ schema, selection, device }: { schema: FormSchema; selection: Selection; device: "desktop" | "mobile" }) {
  const key = selection.kind === "welcome" ? "welcome" : `${selection.kind}:${selection.id}`;
  const qIndex = selection.kind === "question" ? schema.questions.findIndex((q) => q.id === selection.id) : -1;
  const progress = selection.kind === "ending" ? 1 : qIndex > 0 ? qIndex / schema.questions.length : 0;

  return (
    <div
      className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden p-6 lg:p-10"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
        className={`relative overflow-hidden border border-line-strong shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ${
          device === "mobile" ? "h-[min(760px,100%)] w-[390px] rounded-[2rem]" : "h-full w-full max-w-[1100px] rounded-2xl"
        }`}
      >
        <FormShell theme={schema.theme} className="h-full">
          {schema.settings.showProgress && (
            <div className="absolute inset-x-0 top-0 z-20 h-[3px]" style={{ background: "var(--f-accent-soft)" }}>
              <motion.div
                className="h-full origin-left"
                style={{ background: "var(--f-accent)" }}
                animate={{ scaleX: progress }}
                transition={{ type: "spring", stiffness: 120, damping: 24 }}
              />
            </div>
          )}
          <div className="absolute inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-8 py-16 sm:px-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -16, filter: "blur(4px)", transition: { duration: 0.18 } }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex w-full justify-center"
                >
                  <Block schema={schema} selection={selection} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </FormShell>
      </motion.div>
    </div>
  );
}

function Block({ schema, selection }: { schema: FormSchema; selection: Selection }) {
  const [answer, setAnswer] = useState<Answer | undefined>();

  if (selection.kind === "welcome") return <WelcomeView welcome={schema.welcome} />;

  if (selection.kind === "question") {
    const q = schema.questions.find((x) => x.id === selection.id);
    if (!q) return null;
    const visible = schema.questions.filter((x) => x.type !== "statement");
    const number = schema.settings.showQuestionNumbers && q.type !== "statement" ? visible.indexOf(q) + 1 : null;
    return (
      <QuestionView
        question={q}
        title={q.title}
        description={q.description}
        number={number}
        answer={answer}
        onChange={setAnswer}
        isLast={schema.questions[schema.questions.length - 1]?.id === q.id}
      />
    );
  }

  const ending = schema.endings.find((e) => e.id === selection.id);
  if (!ending) return null;
  return (
    <EndingView
      ending={ending}
      title={ending.title}
      description={ending.description}
      calendarUrl={schema.settings.calendarUrl}
      fields={{}}
      live={false}
    />
  );
}
