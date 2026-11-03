import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Download,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cloud } from "./client";
import { useI18n } from "../i18n";
import { Builder, Field, Modal } from "../components/AgentBuilder";
import { type Agent, emptyAgent, type Status } from "../model";
const Office = lazy(() => import("../Office"));
type Membership = {
  organizations?: { name: string } | null;
  organization_id: string;
  user_id: string;
  role: "admin" | "manager" | "member";
  department: string;
  active: boolean;
};
type CloudAgent = {
  id: string;
  organization_id: string;
  department: string;
  kind: string;
  active: boolean;
  configuration: Agent;
  revision: number;
};
type CloudTask = {
  id: string;
  organization_id: string;
  title: string;
  status: Status;
  agent_id: string;
  requester_id: string;
  created_at: string;
  updated_at: string;
  inputs: Record<string, unknown>;
  current_draft_id: string | null;
};
type Draft = {
  id: string;
  task_id: string;
  content: string;
  content_hash: string;
  revision: number;
};
export default function CloudWorkspace() {
  const { t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [org, setOrg] = useState("");
  const [agents, setAgents] = useState<CloudAgent[]>([]);
  const [tasks, setTasks] = useState<CloudTask[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tab, setTab] = useState("Company office");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editor, setEditor] = useState<Agent | null>(null);
  const [kind, setKind] = useState("budget");
  const [editing, setEditing] = useState<CloudAgent | null>(null);
  const [newTask, setNewTask] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [salesJSON, setSalesJSON] = useState("");
  const [command, setCommand] = useState("");
  const [suggestion, setSuggestion] = useState<
    { decision: string; agent_id: string | null; message: string } | null
  >(null);
  const [selected, setSelected] = useState<CloudTask | null>(null);
  const [reason, setReason] = useState("");
  const [orgName, setOrgName] = useState("");
  const [department, setDepartment] = useState("sales");
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [memberDept, setMemberDept] = useState("sales");
  const [memberActive, setMemberActive] = useState(true);
  const [inputEditor, setInputEditor] = useState<string | null>(null);
  const generation = useRef({ key: "", version: 0 });
  const key = (session?.user.id || "") + ":" + org;
  if (generation.current.key !== key) {
    generation.current = { key, version: generation.current.version + 1 };
  }
  const selectedTask = tasks.find((row) => row.id === selected?.id) || selected;
  const expiredRun = selectedTask?.status === "In progress" &&
    Date.now() - new Date(selectedTask.updated_at).getTime() > 5 * 60 * 1000;
  const client = cloud.client;
  const membership = memberships.find((m) => m.organization_id === org);
  const admin = membership?.role === "admin";
  const manager = admin || membership?.role === "manager";
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setMemberships([]);
        setOrg("");
        setAgents([]);
        setTasks([]);
        setDrafts([]);
        setSelected(null);
        setEditor(null);
        setNewTask(false);
        setSuggestion(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  async function operation(fn: () => Promise<void>) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Cloud operation failed."));
    } finally {
      setBusy(false);
    }
  }
  async function api(body: Record<string, unknown>) {
    if (!client || !session) throw new Error(t("Sign in to continue."));
    const version = generation.current.version;
    const { data, error } = await client.functions.invoke("agent-api", {
      body,
    });
    if (version !== generation.current.version) {
      throw new Error(
        t("Workspace changed. Retry in the selected organization."),
      );
    }
    if (error) {
      let detail = "Cloud operation failed.";
      try {
        const payload = await error.context?.json();
        detail = payload?.error || detail;
        if (payload?.missing) detail += ": " + payload.missing.join(", ");
      } catch {}
      throw new Error(detail);
    }
    return data.data;
  }
  async function loadMemberships() {
    if (!client || !session) return;
    const uid = session.user.id;
    const { data, error } = await client.from("memberships").select(
      "*,organizations(name)",
    ).eq("user_id", session.user.id).eq("active", true);
    if (!generation.current.key.startsWith(uid + ":")) return;
    if (error) throw new Error(t("Cloud operation failed."));
    setMemberships(data);
    if (!data.some((m) => m.organization_id === org)) {
      setOrg(data[0]?.organization_id || "");
    }
  }
  async function refresh() {
    if (
      !client || !session || !org ||
      generation.current.key !== session.user.id + ":" + org
    ) return;
    const version = generation.current.version;
    const responses = await Promise.all([
      client.from("agents").select("*").eq("organization_id", org).order(
        "created_at",
      ),
      client.from("tasks").select("*").eq("organization_id", org).order(
        "created_at",
        { ascending: false },
      ).limit(100),
      client.from("drafts").select("*").eq("organization_id", org).order(
        "created_at",
        { ascending: false },
      ).limit(100),
    ]);
    if (version !== generation.current.version) return;
    if (responses.some((r) => r.error)) {
      throw new Error(t("Cloud operation failed."));
    }
    setAgents(responses[0].data as CloudAgent[]);
    setTasks(responses[1].data as CloudTask[]);
    setDrafts(responses[2].data as Draft[]);
  }
  useEffect(() => {
    if (session) void operation(loadMemberships);
  }, [session?.user.id]);
  useEffect(() => {
    setAgents([]);
    setTasks([]);
    setDrafts([]);
    setSelected(null);
    setSuggestion(null);
    setEditor(null);
    setNewTask(false);
    if (org && session) void operation(refresh);
  }, [org, session?.user.id]);
  useEffect(() => {
    if (!org || !session) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [org, session?.user.id]);
  const viewAgents = agents.map((a) => ({
    ...a.configuration,
    id: a.id,
    department: a.department,
    active: a.active,
  }));
  const activeAgent = agents.find((a) => a.id === agentId);
  const required = (activeAgent?.configuration.fields || "Task details").split(
    ",",
  ).map((s) => s.trim()).filter(Boolean);
  const openTask = (id = "") => {
    setAgentId(id || agents.find((a) => a.active)?.id || "");
    setTitle("");
    setValues({});
    setSalesJSON("");
    setNewTask(true);
  };
  if (!client) {
    return (
      <section className="panel cloud-setup">
        <ShieldCheck size={30} />
        <h2>{t("Cloud workspace · review preview")}</h2>
        <p>{t(cloud.error || "Cloud workspace is disabled pending review.")}</p>
        <p>
          {t(
            "Your local agents, uploaded files and tasks have not been migrated. Configure the reviewed Supabase project to enable sign-in.",
          )}
        </p>
      </section>
    );
  }
  return (
    <section className="cloud-workspace">
      <div className="file-storage-note">
        <ShieldCheck size={17} />
        {t(
          "Cloud mode uses real backend requests. Local demo data is separate and is never imported automatically.",
        )}
      </div>
      {error && <div role="alert" className="upload-error">{t(error)}</div>}
      {info && <div role="status" className="upload-results">{t(info)}</div>}
      {!session
        ? (
          <form
            className="panel cloud-login"
            onSubmit={(e) => {
              e.preventDefault();
              void operation(async () => {
                const { error } = await client.auth.signInWithPassword({
                  email,
                  password,
                });
                setPassword("");
                if (error) {
                  throw new Error(
                    t("Sign-in failed. Check credentials and email confirmation."),
                  );
                }
              });
            }}
          >
            <h2>{t("Sign in to company workspace")}</h2>
            <label className="field">
              <span>{t("Email")}</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("Password")}</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              <LogIn size={16} />
              {t("Sign in")}
            </button>
            <p className="muted">
              {t(
                "Sessions stay in memory. Refreshing this page requires signing in again. Ask your administrator to provision a confirmed account.",
              )}
            </p>
          </form>
        )
        : (
          <>
            <div className="cloud-toolbar">
              <span>{session.user.email}</span>
              <select
                aria-label={t("Organization")}
                value={org}
                disabled={busy}
                onChange={(e) => setOrg(e.target.value)}
              >
                <option value="">{t("Choose organization")}</option>
                {memberships.map((m) => (
                  <option key={m.organization_id} value={m.organization_id}>
                    {m.organizations?.name || m.organization_id} · {m.role} ·
                    {" "}
                    {m.department}
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void operation(async () => {
                    await loadMemberships();
                    await refresh();
                  });
                }}
              >
                <RefreshCcw size={15} />
                {t("Refresh")}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  void operation(async () => {
                    await client.auth.signOut();
                  });
                }}
              >
                <LogOut size={15} />
                {t("Sign out")}
              </button>
            </div>
            {!org && (
              <form
                className="panel form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void operation(async () => {
                    const id = await api({
                      action: "createOrganization",
                      name: orgName,
                      department,
                    });
                    await loadMemberships();
                    setOrg(id);
                  });
                }}
              >
                <h2 className="full">{t("Create your organization")}</h2>
                <Field
                  label="Organization name"
                  value={orgName}
                  onChange={setOrgName}
                  required
                />
                <Field
                  label="Department"
                  value={department}
                  onChange={setDepartment}
                  required
                />
                <button className="primary" disabled={busy}>
                  {t("Create organization")}
                </button>
                <p className="muted full">
                  {t(
                    "This creates a new cloud organization. It does not import or replace local data.",
                  )}
                </p>
              </form>
            )}
            {org && (
              <>
                <div className="tab-row">
                  {[
                    "Company office",
                    "AI employees",
                    "Task center",
                    "CEO Command Center",
                    ...(admin ? ["Manage access"] : []),
                  ].map((name) => (
                    <button
                      key={name}
                      className={tab === name ? "active" : ""}
                      onClick={() => setTab(name)}
                    >
                      {t(name)}
                    </button>
                  ))}
                </div>
                {tab === "Company office" && (
                  <div className="cloud-office">
                    <Suspense fallback={<p>{t("Loading office…")}</p>}>
                      <Office
                        agents={viewAgents}
                        tasks={tasks.map((row) => ({
                          id: row.id,
                          agentId: row.agent_id,
                          title: row.title,
                          status: row.status,
                          requester: row.requester_id,
                          created: row.created_at,
                          input: {},
                          draft: "",
                          log: [],
                        }))}
                        selectedId={null}
                        onCeo={() => setTab("CEO Command Center")}
                        onSelect={(a) => {
                          setAgentId(a.id);
                          setTab("AI employees");
                        }}
                      />
                    </Suspense>
                  </div>
                )}
                {tab === "AI employees" && (
                  <div className="panel">
                    <div className="section-heading">
                      <h2>{t("AI employees")}</h2>
                      {admin && (
                        <button
                          className="primary"
                          onClick={() => {
                            setEditing(null);
                            setKind("budget");
                            setEditor({
                              ...emptyAgent(),
                              name: "",
                              prompt:
                                "Use supplied authorized facts only. Ask for missing business information. Return a draft for human review.",
                            });
                          }}
                        >
                          <Plus size={15} />
                          {t("Create AI employee")}
                        </button>
                      )}
                    </div>
                    <div className="command-team">
                      {agents.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setEditing(a);
                            setKind(a.kind);
                            if (admin) {
                              setEditor({ ...a.configuration, id: a.id });
                            } else openTask(a.id);
                          }}
                        >
                          <span
                            className="mini-dot"
                            style={{ background: a.configuration.color }}
                          />
                          <div>
                            <b>{a.configuration.name}</b>
                            <small>
                              {a.kind} · {a.department} · v{a.revision}
                            </small>
                          </div>
                          <span className="tag">
                            {t(a.active ? "Available" : "Offline")}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!agents.length && (
                      <p className="empty">
                        {t(
                          "No cloud employees yet. Local employees remain unchanged.",
                        )}
                      </p>
                    )}
                  </div>
                )}
                {tab === "Task center" && (
                  <div className="panel">
                    <div className="section-heading">
                      <h2>{t("Task center")}</h2>
                      <button
                        className="primary"
                        disabled={busy || !agents.some((a) => a.active)}
                        onClick={() => openTask()}
                      >
                        <Plus size={15} />
                        {t("Create task")}
                      </button>
                    </div>
                    <div className="workspace-list">
                      {tasks.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => {
                            setSelected(row);
                            setReason("");
                            setInputEditor(null);
                          }}
                        >
                          <span className="badge">{t(row.status)}</span>
                          <div>
                            <b>{row.title}</b>
                            <small>
                              {agents.find((a) => a.id === row.agent_id)
                                ?.configuration.name}
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tab === "CEO Command Center" && (
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void operation(async () => {
                        setSuggestion(
                          await api({
                            action: "route",
                            organizationId: org,
                            text: command,
                          }),
                        );
                      });
                    }}
                  >
                    <h2>{t("CEO Command Center")}</h2>
                    <p className="muted">
                      {t(
                        "Real AI suggests an authorized employee or asks for clarification. It does not execute the task automatically.",
                      )}
                    </p>
                    <label className="field">
                      <span>{t("CEO command")}</span>
                      <textarea
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        required
                        maxLength={8000}
                      />
                    </label>
                    <button className="primary" disabled={busy || !manager}>
                      <Send size={15} />
                      {t("Send CEO command")}
                    </button>
                    {!manager && (
                      <p className="muted">
                        {t("Only Admin or Manager can use company routing.")}
                      </p>
                    )}
                    {suggestion && (
                      <div className="chat-bubble assistant">
                        <p>{suggestion.message}</p>
                        {suggestion.decision === "delegate" &&
                          suggestion.agent_id && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              openTask(suggestion.agent_id!);
                              setTitle(command.slice(0, 240));
                            }}
                          >
                            {t("Review delegation")}
                          </button>
                        )}
                      </div>
                    )}
                  </form>
                )}
                {tab === "Manage access" && admin && (
                  <form
                    className="panel form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void operation(async () => {
                        await api({
                          action: "setMembership",
                          organizationId: org,
                          userId: memberId,
                          role: memberRole,
                          department: memberDept,
                          active: memberActive,
                        });
                        setInfo("Membership updated.");
                        await loadMemberships();
                      });
                    }}
                  >
                    <h2 className="full">{t("Manage access")}</h2>
                    <p className="muted full">
                      {t(
                        "Add or update a confirmed Supabase user by their user ID. Account invitations and password recovery use your reviewed Supabase Auth configuration.",
                      )}
                    </p>
                    <Field
                      label="User ID"
                      value={memberId}
                      onChange={setMemberId}
                      required
                    />
                    <Field
                      label="Department"
                      value={memberDept}
                      onChange={setMemberDept}
                      required
                    />
                    <label className="field">
                      <span>{t("Role")}</span>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value)}
                      >
                        {["admin", "manager", "member"].map((r) => (
                          <option key={r} value={r}>{t(r)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={memberActive}
                        onChange={(e) => setMemberActive(e.target.checked)}
                      />
                      {t("Access is active")}
                    </label>
                    <button className="primary" disabled={busy}>
                      {t("Save membership")}
                    </button>
                    <p className="muted full">
                      {t("Your user ID")}: {session.user.id}
                    </p>
                  </form>
                )}
              </>
            )}
          </>
        )}
      {editor && (
        <Builder
          initial={editor}
          cloudCapability={
            <label className="field">
              <span>{t("Agent capability")}</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                disabled={!!editing}
              >
                {["ceo", "budget", "baf", "sales", "marketing", "custom"].map(
                  (k) => <option key={k} value={k}>{t(k)}</option>,
                )}
              </select>
            </label>
          }
          cloudMode
          errorMessage={t(error)}
          onClose={() => {
            setEditor(null);
            setEditing(null);
          }}
          onDelete={() =>
            setError(
              t("Deactivate cloud employees instead of deleting history."),
            )}
          onSave={(configuration) => {
            void operation(async () => {
              await api({
                action: "saveAgent",
                organizationId: org,
                agentId: editing?.id || null,
                expectedRevision: editing?.revision || null,
                kind,
                configuration,
              });
              setEditor(null);
              setEditing(null);
              await refresh();
            });
          }}
        />
      )}
      {newTask && (
        <Modal title="Create task" onClose={() => setNewTask(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operation(async () => {
                const inputs: Record<string, unknown> = { ...values };
                if (activeAgent?.kind === "sales") {
                  inputs.sales_rows = JSON.parse(salesJSON);
                }
                if (activeAgent?.kind === "budget") {
                  inputs.budget_amount = Number(values.budget_amount);
                  inputs.currency = values.currency;
                }
                await api({
                  action: "createTask",
                  organizationId: org,
                  agentId,
                  title,
                  inputs,
                });
                setNewTask(false);
                setTab("Task center");
                await refresh();
              });
            }}
          >
            <div className="modal-body form-grid">
              {error && (
                <div className="upload-error full" role="alert">{t(error)}</div>
              )}
              <label className="field full">
                <span>{t("Assign employee")}</span>
                <select
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setValues({});
                  }}
                >
                  {agents.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.configuration.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Task title"
                value={title}
                onChange={setTitle}
                required
                multiline
              />
              {[
                ...new Set([
                  ...required,
                  ...(activeAgent?.kind === "budget"
                    ? ["budget_amount", "currency"]
                    : []),
                  ...(activeAgent?.kind === "baf"
                    ? ["official_template_text"]
                    : []),
                ]),
              ].map((name) => (
                <Field
                  key={name}
                  label={name}
                  value={values[name] || ""}
                  onChange={(value) =>
                    setValues((s) => ({ ...s, [name]: value }))}
                  multiline
                />
              ))}
              {activeAgent?.kind === "sales" && (
                <Field
                  label="Authorized sales rows (JSON: shop_id, month, total)"
                  value={salesJSON}
                  onChange={setSalesJSON}
                  multiline
                  required
                />
              )}
              <p className="muted full">
                {t(
                  "Only supplied task inputs are sent to AI. Local uploaded files and Google Drive are not read automatically.",
                )}
              </p>
            </div>
            <footer className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setNewTask(false)}
              >
                {t("Cancel")}
              </button>
              <button className="primary" disabled={busy}>
                {t("Create task")}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="modal-body">
            {error && (
              <div className="upload-error" role="alert">{t(error)}</div>
            )}
            <span className="badge">
              {t(
                tasks.find((r) => r.id === selected.id)?.status ||
                  selected.status,
              )}
            </span>
            {drafts.filter((d) => d.task_id === selected.id).map((d) => (
              <article className="cloud-draft" key={d.id}>
                <p className="muted">
                  v{d.revision} · {d.content_hash.slice(0, 12)}
                </p>
                <pre>{d.content}</pre>
                {d.id === tasks.find((r) =>
                      r.id === selected.id
                    )?.current_draft_id && (
                  <>
                    <Field
                      label="Rejection reason"
                      value={reason}
                      onChange={setReason}
                    />
                    <div className="cloud-actions">
                      {manager &&
                        ["approved", "rejected"].map((decision) => (
                          <button
                            className="secondary"
                            key={decision}
                            disabled={busy || tasks.find((r) =>
                                  r.id === selected.id
                                )?.status !== "Awaiting approval" ||
                              (decision === "rejected" && !reason.trim())}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  t("Confirm review of this exact cloud draft?"),
                                )
                              ) return;
                              void operation(async () => {
                                await api({
                                  action: "review",
                                  organizationId: org,
                                  taskId: selected.id,
                                  draftId: d.id,
                                  contentHash: d.content_hash,
                                  decision,
                                  reason,
                                });
                                await refresh();
                              });
                            }}
                          >
                            {t(
                              decision === "approved"
                                ? "Approve reviewed draft"
                                : "Reject draft",
                            )}
                          </button>
                        ))}
                      <button
                        className="primary"
                        disabled={busy ||
                          !["Approved", "Completed"].includes(
                            tasks.find((r) =>
                              r.id === selected.id
                            )?.status ||
                              "",
                          )}
                        onClick={() => {
                          void operation(async () => {
                            const result = await api({
                              action: "export",
                              organizationId: org,
                              taskId: selected.id,
                              contentHash: d.content_hash,
                            });
                            const url = URL.createObjectURL(
                              new Blob([result.content], {
                                type: "text/plain;charset=utf-8",
                              }),
                            );
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "approved-report.txt";
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                            await refresh();
                          });
                        }}
                      >
                        <Download size={15} />
                        {t("Export approved .txt")}
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
            {!["In progress", "Approved", "Completed"].includes(
              tasks.find((r) => r.id === selected.id)?.status || "",
            ) && (
              <div className="cloud-input-editor">
                {inputEditor === null
                  ? (
                    <button
                      className="secondary"
                      onClick={() =>
                        setInputEditor(
                          JSON.stringify(
                            tasks.find((r) => r.id === selected.id)?.inputs ||
                              selected.inputs,
                            null,
                            2,
                          ),
                        )}
                    >
                      {t("Edit authorized task inputs")}
                    </button>
                  )
                  : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void operation(async () => {
                          const inputs = JSON.parse(inputEditor);
                          if (
                            !inputs || typeof inputs !== "object" ||
                            Array.isArray(inputs)
                          ) {
                            throw new Error(
                              t("Task inputs must be a JSON object."),
                            );
                          }
                          await api({
                            action: "updateInputs",
                            organizationId: org,
                            taskId: selected.id,
                            inputs,
                          });
                          setInputEditor(null);
                          await refresh();
                        });
                      }}
                    >
                      <Field
                        label="Authorized task inputs (JSON)"
                        value={inputEditor}
                        onChange={setInputEditor}
                        multiline
                      />
                      <p className="muted">
                        {t(
                          "Saving inputs invalidates the current draft and review. Earlier revisions remain in history.",
                        )}
                      </p>
                      <button className="secondary" disabled={busy}>
                        {t("Save task inputs")}
                      </button>
                    </form>
                  )}
              </div>
            )}
            <div className="cloud-actions">
              <button
                className="primary"
                disabled={busy ||
                  ["Awaiting approval", "Approved", "Completed"].includes(
                    selectedTask?.status || "",
                  ) ||
                  (selectedTask?.status === "In progress" && !expiredRun)}
                onClick={() => {
                  void operation(async () => {
                    try {
                      await api({
                        action: "execute",
                        organizationId: org,
                        taskId: selected.id,
                        requestKey: crypto.randomUUID(),
                      });
                    } finally {
                      await refresh();
                    }
                  });
                }}
              >
                <Play size={15} />
                {t(expiredRun ? "Retry expired execution" : "Execute with AI")}
              </button>
              <button
                className="secondary"
                disabled={busy ||
                  tasks.find((r) => r.id === selected.id)?.status !==
                    "Draft ready"}
                onClick={() => {
                  void operation(async () => {
                    await api({
                      action: "submitReview",
                      organizationId: org,
                      taskId: selected.id,
                    });
                    await refresh();
                  });
                }}
              >
                {t("Request review")}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void operation(refresh);
                }}
              >
                {t("Refresh")}
              </button>
            </div>
            <p className="muted">
              {t(
                "Production actions are authorized by the backend. Missing credentials and provider failures are errors, never demo results.",
              )}
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
