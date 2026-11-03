import { useEffect, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { ChibiFace } from "../chibi";
import { useI18n } from "../i18n";
import { type Agent, formats, permissions } from "../model";
export function Face(
  { agent, large = false }: { agent: Agent; large?: boolean },
) {
  return <ChibiFace agent={agent} large={large} />;
}
export function Modal(
  { title, subtitle, onClose, children, wide = false }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    wide?: boolean;
  },
) {
  const { t: tr, language } = useI18n();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("button,input,select,textarea")
      ?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || [],
        ).filter((el) => el.offsetParent !== null);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", f);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", f);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={tr(title)}
        className={"modal " + (wide ? "wide" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2>{tr(title)}</h2>
            {subtitle && <p>{tr(subtitle)}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label={tr("Close dialog")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  type?: string;
  required?: boolean;
}) {
  const { t: tr, language } = useI18n();
  return (
    <label className={multiline ? "field full" : "field"}>
      <span>{tr(label)}{required && " *"}</span>
      {multiline
        ? (
          <textarea
            aria-label={tr(label)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            required={required}
          />
        )
        : (
          <input
            aria-label={tr(label)}
            value={value}
            type={type}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        )}
    </label>
  );
}

export function Builder({
  initial,
  onClose,
  onSave,
  onDelete,
  errorMessage = "",
  cloudMode = false,
  cloudCapability,
}: {
  initial: Agent;
  onClose: () => void;
  onSave: (a: Agent) => void;
  onDelete: () => void;
  errorMessage?: string;
  cloudMode?: boolean;
  cloudCapability?: React.ReactNode;
}) {
  const { t: tr, language } = useI18n();
  const [a, setA] = useState({ ...initial });
  const [tab, setTab] = useState("Basics");
  const tabs = [
    "Basics",
    "Role & instructions",
    "Data sources",
    "Outputs & permissions",
  ];
  const set = (key: keyof Agent, value: unknown) =>
    setA((x) => ({ ...x, [key]: value }));
  const field = (
    key: keyof Agent,
    label: string,
    multi = false,
    required = false,
  ) => (
    <Field
      key={key}
      label={label}
      value={String(a[key])}
      onChange={(v) => set(key, v)}
      multiline={multi}
      required={required}
    />
  );
  const toggle = (key: "formats" | "permissions", value: string) =>
    set(
      key,
      a[key].includes(value)
        ? a[key].filter((x) => x !== value)
        : [...a[key], value],
    );
  return (
    <Modal
      title="AI Agent Builder"
      subtitle="A unique teammate. Defined by you."
      onClose={onClose}
      wide
    >
      <div className="builder-layout">
        <nav className="builder-tabs">
          {tabs.map((t, i) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              <span aria-hidden="true">0{i + 1}</span>
              {tr(t)}
            </button>
          ))}
        </nav>
        <form
          className="builder-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!a.name.trim() || !a.title.trim()) {
              setTab("Basics");
              return;
            }
            onSave({ ...a, name: a.name.trim(), title: a.title.trim() });
          }}
        >
          <div className="form-section">
            {errorMessage && (
              <div className="upload-error" role="alert">{errorMessage}</div>
            )}
            {cloudCapability}
            <h3>{tr(tab)}</h3>
            <p className="form-description">
              {tab === "Basics"
                ? tr("Give your employee an identity and a place on the team.")
                : tab === "Role & instructions"
                ? tr(
                  cloudMode
                    ? "These versioned instructions guide real backend AI drafts."
                    : "These editable instructions define the role. Demo execution does not call an AI.",
                )
                : tab === "Data sources"
                ? tr(
                  "Save source references for future integration. These fields do not grant access.",
                )
                : tr(
                  cloudMode
                    ? "Cloud permissions are enforced by the backend. All exports require human approval."
                    : "Select future formats and local workflow capabilities.",
                )}
            </p>
            <div className="form-grid">
              {tab === "Basics" && (
                <>
                  {field("name", "Employee name", false, true)}
                  {field("title", "Job title", false, true)}
                  {field("department", "Department")}
                  {field("description", "Description", true)}
                  <label className="field">
                    <span>{tr("Avatar style")}</span>
                    <select
                      aria-label={tr("Avatar style")}
                      value={a.avatar}
                      onChange={(e) => set("avatar", e.target.value)}
                    >
                      {[
                        "robot",
                        "chibi-mint",
                        "chibi-violet",
                        "chibi-amber",
                        ...(["orb", "capsule"].includes(a.avatar)
                          ? [a.avatar]
                          : []),
                      ].map((s) => (
                        <option key={s} value={s}>
                          {tr(
                            s === "robot"
                              ? "Default chibi portrait"
                              : s === "chibi-mint"
                              ? "Mint portrait"
                              : s === "chibi-violet"
                              ? "Violet portrait"
                              : s === "chibi-amber"
                              ? "Headphones portrait"
                              : s,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Avatar color"
                    type="color"
                    value={a.color}
                    onChange={(v) => set("color", v)}
                  />
                  <div className="full toggle-row">
                    <Face agent={a} />
                    <label>
                      <input
                        type="checkbox"
                        checked={a.active}
                        onChange={(e) => set("active", e.target.checked)}
                      />{" "}
                      {tr("Employee is active")}
                    </label>
                  </div>
                  <small className="full muted">{tr("Agent ID:")} {a.id}</small>
                </>
              )}
              {tab === "Role & instructions" && (
                <>
                  {field("prompt", "System prompt", true)}
                  {field("responsibilities", "Main responsibilities", true)}
                  {field("allowedTasks", "Allowed tasks", true)}
                  {field("restrictedTasks", "Restricted tasks", true)}
                  {field("workflow", "Workflow instructions", true)}
                  {field("requirements", "Output requirements", true)}
                  {field(
                    "fields",
                    "Required input fields (comma separated)",
                    true,
                  )}
                  <label className="field">
                    <span>{tr("Language")}</span>
                    <select
                      aria-label={tr("Language")}
                      value={a.language}
                      onChange={(e) => set("language", e.target.value)}
                    >
                      {["Lao", "Thai", "English"].map((s) => (
                        <option key={s} value={s}>{tr(s)}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {tab === "Data sources" && (
                <>
                  {field("folder", "Google Drive folder ID")}
                  {field("files", "Specific Drive file IDs")}
                  {field("spreadsheet", "Spreadsheet ID")}
                  {field("tabs", "Sheet tabs")}
                  {field("ranges", "Data ranges")}
                  {field("templates", "Document template references", true)}
                  {field("additionalSources", "Additional data sources", true)}
                  <div className="info-banner full">
                    {tr(
                      "No Google files are accessed in this prototype. Do not paste access tokens.",
                    )}
                  </div>
                </>
              )}
              {tab === "Outputs & permissions" && (
                <>
                  <div className="full">
                    <h4>{tr("Preferred output formats")}</h4>
                    <p className="muted">
                      {tr(
                        "Preferences for Phase 4. The prototype exports plain text only.",
                      )}
                    </p>
                    <div className="check-grid">
                      {formats.map((f) => (
                        <label key={f}>
                          <input
                            type="checkbox"
                            checked={a.formats.includes(f)}
                            onChange={() => toggle("formats", f)}
                          />
                          {tr(f)}
                        </label>
                      ))}
                    </div>
                    <h4>{tr("Workflow permissions")}</h4>
                    <div className="check-grid">
                      {permissions.map((p) => (
                        <label key={p}>
                          <input
                            type="checkbox"
                            checked={a.permissions.includes(p)}
                            onChange={() => toggle("permissions", p)}
                          />
                          {tr(p)}
                        </label>
                      ))}
                    </div>
                  </div>
                  {field(
                    "access",
                    "Allowed users / departments (future server enforcement)",
                    true,
                  )}
                  <div className="info-banner full">
                    {tr(
                      cloudMode
                        ? "Organization and department access is enforced using memberships and RLS. This free-text field is descriptive only."
                        : "Local demo toggles are not a security boundary. Human approval is always required before exporting.",
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <footer className="modal-actions">
            {!cloudMode && (
              <button
                type="button"
                className="danger-link"
                onClick={() => {
                  if (
                    window.confirm(
                      tr("Remove this employee from the local prototype?"),
                    )
                  ) onDelete();
                }}
              >
                <Trash2 size={15} />
                {tr("Remove")}
              </button>
            )}
            <div>
              <button type="button" className="secondary" onClick={onClose}>
                {tr("Cancel")}
              </button>
              <button className="primary" type="submit">
                <Check size={16} />
                {tr("Save employee")}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
