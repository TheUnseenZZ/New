"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, CircleAlert, Loader2, Monitor, Play, Share2, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormRunner } from "@/components/form/runner";
import { Segmented } from "@/components/ui/controls";
import { useToast } from "@/components/ui/toast";
import type { SerializedForm } from "@/lib/forms";
import { uid } from "@/lib/id";
import { newEnding, newQuestion } from "@/lib/templates";
import type { EndingKind, FormSchema, Question, QuestionType } from "@/lib/types";
import { BlockList } from "./block-list";
import { Canvas } from "./canvas";
import { FormSettingsPanel } from "./form-settings";
import { FormNav, MobileTabs } from "./form-nav";
import { EndingInspector, QuestionInspector, WelcomeInspector } from "./inspector";
import { ShareDialog } from "./share-dialog";
import type { Selection } from "./types";

type SaveState = "saved" | "saving" | "dirty" | "error";

export function Builder({ initial }: { initial: SerializedForm }) {
  const toast = useToast();
  const [schema, setSchemaState] = useState<FormSchema>(initial.draft);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [hasChanges, setHasChanges] = useState(initial.hasUnpublishedChanges);
  const [selection, setSelection] = useState<Selection>(
    initial.draft.questions[0] ? { kind: "question", id: initial.draft.questions[0].id } : { kind: "welcome" },
  );
  const [panel, setPanel] = useState<"block" | "form">("block");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [save, setSave] = useState<SaveState>("saved");
  const [previewing, setPreviewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  /* ---------------- autosave ---------------- */
  const pending = useRef<{ draft?: FormSchema; title?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!body.draft && body.title === undefined) return inflight.current;
    pending.current = {};
    setSave("saving");
    inflight.current = inflight.current.then(async () => {
      try {
        const res = await fetch(`/api/forms/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        const form = (await res.json()) as SerializedForm;
        setHasChanges(form.hasUnpublishedChanges);
        setIsPublished(form.isPublished);
        setSave(pending.current.draft || pending.current.title !== undefined ? "dirty" : "saved");
      } catch {
        setSave("error");
      }
    });
    return inflight.current;
  }, [initial.id]);

  const queueSave = useCallback(
    (patch: { draft?: FormSchema; title?: string }) => {
      pending.current = { ...pending.current, ...patch };
      setSave("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current.draft || pending.current.title !== undefined) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [flush]);

  const setSchema = (next: FormSchema) => {
    setSchemaState(next);
    queueSave({ draft: next });
  };

  /* ---------------- block operations ---------------- */
  const updateQuestion = (q: Question) => setSchema({ ...schema, questions: schema.questions.map((x) => (x.id === q.id ? q : x)) });

  const addQuestion = (type: QuestionType) => {
    const q = newQuestion(type);
    const idx = selection.kind === "question" ? schema.questions.findIndex((x) => x.id === selection.id) + 1 : schema.questions.length;
    const questions = [...schema.questions];
    questions.splice(idx, 0, q);
    setSchema({ ...schema, questions });
    setSelection({ kind: "question", id: q.id });
    setPanel("block");
  };

  const removeQuestion = (id: string) => {
    const idx = schema.questions.findIndex((q) => q.id === id);
    const questions = schema.questions
      .filter((q) => q.id !== id)
      .map((q) => ({ ...q, logic: q.logic.filter((r) => r.target !== id) }));
    setSchema({ ...schema, questions });
    const next = questions[Math.min(idx, questions.length - 1)];
    setSelection(next ? { kind: "question", id: next.id } : { kind: "welcome" });
  };

  const duplicateQuestion = (id: string) => {
    const idx = schema.questions.findIndex((q) => q.id === id);
    const src = schema.questions[idx];
    const choiceMap = new Map<string, string>();
    const copy: Question = {
      ...structuredClone(src),
      id: uid(),
      choices: src.choices?.map((c) => {
        const nid = uid();
        choiceMap.set(c.id, nid);
        return { ...c, id: nid };
      }),
    };
    copy.logic = copy.logic.map((r) => ({ ...r, id: uid(), value: choiceMap.get(r.value) ?? r.value }));
    const questions = [...schema.questions];
    questions.splice(idx + 1, 0, copy);
    setSchema({ ...schema, questions });
    setSelection({ kind: "question", id: copy.id });
  };

  const addEnding = (kind: EndingKind) => {
    const e = newEnding(kind);
    setSchema({ ...schema, endings: [...schema.endings, e] });
    setSelection({ kind: "ending", id: e.id });
    setPanel("block");
  };

  const removeEnding = (id: string) => {
    const endings = schema.endings.filter((e) => e.id !== id);
    const questions = schema.questions.map((q) => ({ ...q, logic: q.logic.filter((r) => r.target !== id) }));
    setSchema({ ...schema, endings, questions });
    setSelection({ kind: "ending", id: endings[0].id });
  };

  /* ---------------- publish ---------------- */
  const publish = async () => {
    setPublishing(true);
    await flush();
    await inflight.current;
    const res = await fetch(`/api/forms/${initial.id}/publish`, { method: "POST" });
    setPublishing(false);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      return toast(error ?? "Couldn't publish", "error");
    }
    const firstTime = !isPublished;
    setIsPublished(true);
    setHasChanges(false);
    toast(firstTime ? "Your form is live" : "Changes published");
    if (firstTime) setSharing(true);
  };

  const unpublish = async () => {
    const res = await fetch(`/api/forms/${initial.id}/publish`, { method: "DELETE" });
    if (res.ok) {
      setIsPublished(false);
      setHasChanges(false);
      setSharing(false);
      toast("Form unpublished");
    }
  };

  const changeSlug = async (value: string) => {
    const res = await fetch(`/api/forms/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: value }),
    });
    const data = (await res.json()) as SerializedForm & { error?: string };
    if (!res.ok) return data.error ?? "Couldn't update link";
    setSlug(data.slug);
    return null;
  };

  /* ---------------- render ---------------- */
  const selectedQuestion = selection.kind === "question" ? schema.questions.find((q) => q.id === selection.id) : undefined;
  const selectedEnding = selection.kind === "ending" ? schema.endings.find((e) => e.id === selection.id) : undefined;
  const publishLabel = !isPublished ? "Publish" : hasChanges || save !== "saved" ? "Publish changes" : "Published";
  const upToDate = isPublished && !hasChanges && save === "saved";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <FormNav
        formId={initial.id}
        active="edit"
        title={
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              queueSave({ title: e.target.value });
            }}
            className="w-full truncate rounded-md bg-transparent px-2 py-1 text-[14px] font-medium outline-none transition-colors hover:bg-raised focus:bg-raised"
            aria-label="Form name"
          />
        }
        right={
          <>
            <SaveIndicator state={save} />
            <button className="btn-ghost hidden sm:inline-flex" onClick={() => setPreviewing(true)}>
              <Play className="size-3.5" /> Preview
            </button>
            <button className="btn-secondary" onClick={() => setSharing(true)} title="Share">
              <Share2 className="size-3.5" />
              <span className="hidden lg:inline">Share</span>
            </button>
            <button className={upToDate ? "btn-secondary" : "btn-primary"} onClick={publish} disabled={publishing || upToDate}>
              {publishing ? <Loader2 className="size-3.5 animate-spin" /> : upToDate ? <Check className="size-3.5" /> : null}
              {publishLabel}
            </button>
          </>
        }
      />
      <MobileTabs formId={initial.id} active="edit" />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 border-r border-line bg-panel md:block">
          <BlockList
            schema={schema}
            selection={selection}
            onSelect={(s) => {
              setSelection(s);
              setPanel("block");
            }}
            onReorder={(questions) => setSchema({ ...schema, questions })}
            onAddQuestion={addQuestion}
            onAddEnding={addEnding}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="text-[12px] text-faint">
              {schema.questions.length} question{schema.questions.length === 1 ? "" : "s"} · {schema.endings.length} ending
              {schema.endings.length === 1 ? "" : "s"}
            </span>
            <div className="w-40">
              <Segmented
                size="sm"
                value={device}
                options={[
                  { value: "desktop", label: <Monitor className="size-3.5" /> },
                  { value: "mobile", label: <Smartphone className="size-3.5" /> },
                ]}
                onChange={setDevice}
              />
            </div>
          </div>
          <Canvas schema={schema} selection={selection} device={device} />
        </div>

        <aside className="hidden w-[340px] shrink-0 flex-col border-l border-line bg-panel lg:flex">
          <div className="border-b border-line p-3">
            <Segmented
              value={panel}
              options={[
                { value: "block", label: "Block" },
                { value: "form", label: "Form" },
              ]}
              onChange={setPanel}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={panel === "form" ? "form" : selection.kind === "welcome" ? "welcome" : `${selection.kind}:${selection.id}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {panel === "form" ? (
                  <FormSettingsPanel schema={schema} onChange={setSchema} slug={slug} onSlugChange={changeSlug} />
                ) : selection.kind === "welcome" ? (
                  <WelcomeInspector welcome={schema.welcome} onChange={(welcome) => setSchema({ ...schema, welcome })} />
                ) : selectedQuestion ? (
                  <QuestionInspector
                    q={selectedQuestion}
                    schema={schema}
                    onChange={updateQuestion}
                    onDelete={() => removeQuestion(selectedQuestion.id)}
                    onDuplicate={() => duplicateQuestion(selectedQuestion.id)}
                  />
                ) : selectedEnding ? (
                  <EndingInspector
                    ending={selectedEnding}
                    schema={schema}
                    onChange={(e) => setSchema({ ...schema, endings: schema.endings.map((x) => (x.id === e.id ? e : x)) })}
                    onDelete={schema.endings.length > 1 ? () => removeEnding(selectedEnding.id) : undefined}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <p className="border-t border-line bg-panel px-4 py-2 text-center text-[12px] text-faint lg:hidden">
        The builder works best on a larger screen.
      </p>

      <AnimatePresence>
        {previewing && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <FormRunner schema={schema} mode="preview" className="h-dvh" onClose={() => setPreviewing(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <ShareDialog open={sharing} onClose={() => setSharing(false)} slug={slug} isPublished={isPublished} onUnpublish={unpublish} />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    saved: { icon: <Check className="size-3" />, text: "Saved", cls: "text-faint" },
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: "Saving", cls: "text-faint" },
    dirty: { icon: <span className="size-1.5 rounded-full bg-faint" />, text: "Editing", cls: "text-faint" },
    error: { icon: <CircleAlert className="size-3" />, text: "Not saved", cls: "text-bad" },
  }[state];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.15 }}
        className={`mr-1 hidden items-center gap-1.5 text-[12px] xl:inline-flex ${content.cls}`}
      >
        {content.icon}
        {content.text}
      </motion.span>
    </AnimatePresence>
  );
}
