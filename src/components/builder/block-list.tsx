"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import { GitBranch, GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QUESTION_TYPES } from "@/lib/engine";
import type { Ending, EndingKind, FormSchema, Question, QuestionType } from "@/lib/types";
import { ENDING_ICONS, ENDING_LABELS, TYPE_ICONS, TypeBadge, WelcomeIcon } from "./icons";
import type { Selection } from "./types";

export function BlockList({
  schema,
  selection,
  onSelect,
  onReorder,
  onAddQuestion,
  onAddEnding,
}: {
  schema: FormSchema;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onReorder: (questions: Question[]) => void;
  onAddQuestion: (type: QuestionType) => void;
  onAddEnding: (kind: EndingKind) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = schema.questions.findIndex((q) => q.id === e.active.id);
    const to = schema.questions.findIndex((q) => q.id === e.over!.id);
    onReorder(arrayMove(schema.questions, from, to));
  };

  let n = 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <GroupLabel>Start</GroupLabel>
        <Row
          active={selection.kind === "welcome"}
          onClick={() => onSelect({ kind: "welcome" })}
          badge={<TypeBadge icon={WelcomeIcon} />}
          title={schema.welcome.title || "Welcome screen"}
          muted={!schema.welcome.enabled}
          meta={!schema.welcome.enabled ? "Off" : undefined}
        />

        <div className="mt-5 flex items-center justify-between pr-1">
          <GroupLabel>Questions</GroupLabel>
          <AddQuestionMenu onAdd={onAddQuestion} compact />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={schema.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {schema.questions.map((q) => {
                  const num = q.type === "statement" ? null : ++n;
                  return (
                    <SortableRow
                      key={q.id}
                      q={q}
                      num={num}
                      active={selection.kind === "question" && selection.id === q.id}
                      onClick={() => onSelect({ kind: "question", id: q.id })}
                    />
                  );
                })}
            </div>
          </SortableContext>
        </DndContext>
        {schema.questions.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-faint">No questions yet. Add your first one.</p>
        )}
        <div className="mt-2">
          <AddQuestionMenu onAdd={onAddQuestion} />
        </div>

        <div className="mt-6 flex items-center justify-between pr-1">
          <GroupLabel>Endings</GroupLabel>
          <AddEndingMenu onAdd={onAddEnding} />
        </div>
        <div className="space-y-0.5">
          {schema.endings.map((e) => (
            <EndingRow
              key={e.id}
              ending={e}
              active={selection.kind === "ending" && selection.id === e.id}
              onClick={() => onSelect({ kind: "ending", id: e.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">{children}</p>;
}

function Row({
  active,
  onClick,
  badge,
  title,
  meta,
  muted,
  handle,
  num,
}: {
  active: boolean;
  onClick: () => void;
  badge: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  muted?: boolean;
  handle?: React.ReactNode;
  num?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
        active ? "bg-hover text-fg" : "text-dim hover:bg-raised hover:text-fg"
      }`}
    >
      {active && (
        <motion.span
          layoutId="block-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-lg border border-line-strong"
        />
      )}
      {handle}
      {badge}
      {num !== undefined && (
        <span className="w-4 shrink-0 text-right text-[11px] text-faint tabular-nums">{num ?? ""}</span>
      )}
      <span className={`relative min-w-0 flex-1 truncate text-[13px] ${muted ? "opacity-50" : ""}`}>{title}</span>
      {meta ? <span className="relative shrink-0 text-[11px] text-faint">{meta}</span> : null}
    </button>
  );
}

function SortableRow({ q, num, active, onClick }: { q: Question; num: number | null; active: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`relative ${isDragging ? "rounded-lg bg-raised shadow-2xl shadow-black/70" : ""}`}
    >
      <Row
        active={active || isDragging}
        onClick={onClick}
        num={num}
        badge={<TypeBadge icon={TYPE_ICONS[q.type]} />}
        title={q.title || "Untitled question"}
        meta={q.logic.length ? <GitBranch className="size-3" /> : undefined}
        handle={
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="relative -mr-1 flex h-6 w-3 shrink-0 cursor-grab items-center justify-center text-faint opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </span>
        }
      />
    </div>
  );
}

function EndingRow({ ending, active, onClick }: { ending: Ending; active: boolean; onClick: () => void }) {
  return (
    <Row
      active={active}
      onClick={onClick}
      badge={
        <TypeBadge
          icon={ENDING_ICONS[ending.kind]}
          tone={ending.kind === "qualified" ? "good" : ending.kind === "disqualified" ? "bad" : "default"}
        />
      }
      title={ending.title || ENDING_LABELS[ending.kind]}
      meta={ENDING_LABELS[ending.kind]}
    />
  );
}

function Popover({
  trigger,
  children,
  width = "w-72",
}: {
  trigger: (toggle: () => void, open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen((o) => !o), open)}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute top-full left-0 z-50 mt-1.5 ${width} origin-top-left rounded-xl border border-line-strong bg-raised p-1.5 shadow-2xl shadow-black/70`}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddQuestionMenu({ onAdd, compact }: { onAdd: (t: QuestionType) => void; compact?: boolean }) {
  return (
    <Popover
      trigger={(toggle) =>
        compact ? (
          <button type="button" onClick={toggle} className="btn-icon size-6" title="Add question">
            <Plus className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[13px] text-dim transition-colors hover:border-neutral-500 hover:text-fg"
          >
            <Plus className="size-3.5" /> Add question
          </button>
        )
      }
    >
      {(close) => (
        <div className="grid grid-cols-1 gap-0.5">
          {QUESTION_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t.type];
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => {
                  onAdd(t.type);
                  close();
                }}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
              >
                <TypeBadge icon={Icon} />
                <span className="min-w-0">
                  <span className="block text-[13px] text-fg">{t.label}</span>
                  <span className="block truncate text-[11.5px] text-faint">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

function AddEndingMenu({ onAdd }: { onAdd: (k: EndingKind) => void }) {
  const kinds: { kind: EndingKind; hint: string }[] = [
    { kind: "qualified", hint: "Shows your booking calendar" },
    { kind: "disqualified", hint: "Polite decline or resources" },
    { kind: "default", hint: "Neutral thank-you screen" },
  ];
  return (
    <Popover
      width="w-64"
      trigger={(toggle) => (
        <button type="button" onClick={toggle} className="btn-icon size-6" title="Add ending">
          <Plus className="size-3.5" />
        </button>
      )}
    >
      {(close) =>
        kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => {
              onAdd(k.kind);
              close();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
          >
            <TypeBadge
              icon={ENDING_ICONS[k.kind]}
              tone={k.kind === "qualified" ? "good" : k.kind === "disqualified" ? "bad" : "default"}
            />
            <span>
              <span className="block text-[13px] text-fg">{ENDING_LABELS[k.kind]}</span>
              <span className="block text-[11.5px] text-faint">{k.hint}</span>
            </span>
          </button>
        ))
      }
    </Popover>
  );
}
