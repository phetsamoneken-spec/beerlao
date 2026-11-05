import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useI18n } from "../i18n";
import { driveMessage } from "./drive-messages";
import { DriveRequest } from "../../supabase/functions/_shared/drive-contracts";
type Connection = { id: string; department: string; account_label: string };
type Source = {
  id: string;
  connection_id: string;
  agent_id: string;
  display_name: string;
  source_reference: string;
};
type Employee = {
  id: string;
  department: string;
  active: boolean;
  configuration: { name: string; permissions: string[] };
};
export async function driveRequest(
  client: SupabaseClient,
  body: Record<string, unknown>,
) {
  const parsed = DriveRequest.safeParse(body);
  if (!parsed.success) throw new Error("INVALID_REQUEST");
  const { data, error } = await client.functions.invoke("drive-api", {
    body: parsed.data,
  });
  if (error) {
    let code = "DRIVE_OPERATION_FAILED";
    if (error.context instanceof Response) {
      if (error.context.status === 404) code = "DRIVE_BACKEND_NOT_DEPLOYED";
      else {
        const payload = await error.context.clone().json().catch(() => null);
        if (
          typeof payload?.error === "string" &&
          /^[A-Z_]{1,80}$/.test(payload.error)
        ) code = payload.error;
      }
    }
    throw new Error(code);
  }
  if (!data || !("data" in data)) throw new Error("DRIVE_OPERATION_FAILED");
  return data.data;
}
export default function DrivePanel(
  {
    client,
    organizationId,
    department,
    admin,
    manager,
    agents,
    enabled = import.meta.env.VITE_GOOGLE_DRIVE_ENABLED === "true",
  }: {
    client: SupabaseClient;
    organizationId: string;
    department: string;
    admin: boolean;
    manager: boolean;
    agents: Employee[];
    enabled?: boolean;
  },
) {
  const { t } = useI18n();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [dept, setDept] = useState(department);
  const [consent, setConsent] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const [pending, setPending] = useState<
    { status: string; account_label?: string } | null
  >(null);
  const [connectionId, setConnectionId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [file, setFile] = useState("");
  const [approve, setApprove] = useState(false);
  const [preview, setPreview] = useState<
    {
      text: string;
      provenance: { name: string; readAt: string; sha256: string };
    } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await action();
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : "DRIVE_OPERATION_FAILED");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function refresh() {
    const [c, s] = await Promise.all([
      client.from("connections").select("id,department,account_label").eq(
        "organization_id",
        organizationId,
      ).eq("provider", "google").is("revoked_at", null),
      client.from("data_sources").select(
        "id,connection_id,agent_id,display_name,source_reference",
      ).eq("organization_id", organizationId).eq("source_type", "drive_file"),
    ]);
    if (c.error || s.error) throw new Error("DRIVE_SCHEMA_NOT_READY");
    if (!alive.current) return;
    setConnections(c.data);
    setSources(s.data);
  }
  useEffect(() => {
    if (enabled && manager) void run(refresh);
  }, [enabled, manager, organizationId]);
  const request = (body: Record<string, unknown>) =>
    driveRequest(client, { ...body, organizationId });
  if (!enabled) {
    return (
      <section className="panel">
        <h2>Google Drive</h2>
        <p>
          {t("Google Drive setup is required before connecting an account.")}
        </p>
        <p className="muted">
          {t(
            "Your Drive home link does not grant this app access to any files.",
          )}
        </p>
      </section>
    );
  }
  if (!manager) {
    return (
      <section className="panel">
        <h2>Google Drive</h2>
        <p>
          {t(
            "Only an Admin or departmental Manager can connect and approve Drive files.",
          )}
        </p>
      </section>
    );
  }
  const selectedConnection = connections.find((c) => c.id === connectionId);
  const eligible = agents.filter((a) =>
    a.active && a.department === selectedConnection?.department &&
    a.configuration.permissions.includes("Read data")
  );
  return (
    <section className="drive-panel">
      <div className="panel">
        <h2>{t("Connect Google Drive")}</h2>
        <p>
          {t(
            "Google consent allows read-only Drive access. This app reads only exact files you approve below. It cannot write, delete or share Google files.",
          )}
        </p>
        {error && (
          <p role="alert" className="error-banner">{t(driveMessage(error))}</p>
        )}
        {info && <p role="status">{t(info)}</p>}
        <label>
          {t("Department")}
          <input
            value={dept}
            disabled={!admin || busy || !!attempt}
            maxLength={100}
            onChange={(e) => setDept(e.target.value)}
          />
        </label>
        <label className="drive-check">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy || !!attempt}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {t(
            "I agree to request read-only Google Drive access for this department.",
          )}
        </label>
        <button
          className="primary"
          disabled={busy || !consent || !dept.trim() || !!attempt}
          onClick={() =>
            void run(async () => {
              const data = await request({
                action: "start",
                department: dept,
                consentReadOnly: true,
              });
              if (!alive.current) return;
              const url = new URL(data.authorizationUrl);
              if (
                url.origin !== "https://accounts.google.com" ||
                url.pathname !== "/o/oauth2/v2/auth"
              ) throw new Error("DRIVE_OPERATION_FAILED");
              setAttempt(data.attemptId);
              setAuthorizationUrl(url.href);
              setPending(null);
            })}
        >
          {t("Prepare Google connection")}
        </button>
        {authorizationUrl && (
          <p>
            <a
              className="text-link"
              href={authorizationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Continue to Google in a new tab")}
            </a>
          </p>
        )}
        {attempt && (
          <div className="drive-confirm">
            <p>
              {t(
                "After Google consent, return here and check the account. Keep this tab open; reloading requires starting again.",
              )}
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const status = await request({
                    action: "status",
                    attemptId: attempt,
                  });
                  if (alive.current) setPending(status);
                })}
            >
              {t("Check Google connection")}
            </button>
            {pending && (
              <p role="status">
                {t("Connection status")}: {t(pending.status)}{" "}
                {pending.account_label || ""}
              </p>
            )}
            {pending?.status === "ready" && (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request({ action: "confirm", attemptId: attempt });
                    if (!alive.current) return;
                    setAttempt("");
                    setAuthorizationUrl("");
                    setPending(null);
                    setConsent(false);
                    await refresh();
                    setInfo("Google Drive account connected.");
                  })}
              >
                {t("Confirm this Google account")}
              </button>
            )}
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setAttempt("");
                setAuthorizationUrl("");
                setPending(null);
              }}
            >
              {t("Start again")}
            </button>
          </div>
        )}
      </div>
      <div className="panel">
        <h3>{t("Connected Google accounts")}</h3>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          {t("Refresh")}
        </button>
        {!connections.length && <p>{t("No Google account connected.")}</p>}
        {connections.map((c) => (
          <div className="drive-account" key={c.id}>
            <span>{c.account_label} · {c.department}</span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    t("Disconnect this Google account and remove stored tokens? This may also revoke other connections using this Google account in this app."),
                  )
                ) return;
                void run(async () => {
                  const result = await request({
                    action: "disconnect",
                    connectionId: c.id,
                  });
                  if (!alive.current) return;
                  setPreview(null);
                  await refresh();
                  setInfo(
                    result.revocationPending
                      ? "Disconnected locally. Review Google account permissions to revoke remaining access."
                      : "Google Drive disconnected.",
                  );
                });
              }}
            >
              {t("Disconnect")}
            </button>
          </div>
        ))}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Review Google account permissions")}
        </a>
      </div>
      <form
        className="panel form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await request({
              action: "approveFile",
              connectionId,
              agentId,
              fileReference: file,
              confirmRead: true,
            });
            if (!alive.current) return;
            setFile("");
            setApprove(false);
            await refresh();
            setInfo("File approved for the selected employee.");
          });
        }}
      >
        <h3 className="full">{t("Approve a Drive file")}</h3>
        <label>
          {t("Google account")}
          <select
            aria-label={t("Google account")}
            required
            value={connectionId}
            disabled={busy}
            onChange={(e) => {
              setConnectionId(e.target.value);
              setAgentId("");
            }}
          >
            <option value="">{t("Choose Google account")}</option>
            {connections.map((c) => (
              <option value={c.id} key={c.id}>
                {c.account_label} · {c.department}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("AI employee")}
          <select
            aria-label={t("AI employee")}
            required
            value={agentId}
            disabled={busy}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">{t("Choose employee")}</option>
            {eligible.map((a) => (
              <option value={a.id} key={a.id}>{a.configuration.name}</option>
            ))}
          </select>
        </label>
        <label className="full">
          {t("Google file link or file ID")}
          <input
            required
            maxLength={1000}
            value={file}
            disabled={busy}
            onChange={(e) => setFile(e.target.value)}
          />
        </label>
        <p className="muted full">
          {t(
            "Supports UTF-8 text, CSV and Google Docs up to 1 MiB. Choose an active employee in the same department with Read data permission. Drive home/folder links are not files.",
          )}
        </p>
        <label className="drive-check full">
          <input
            type="checkbox"
            checked={approve}
            disabled={busy}
            onChange={(e) => setApprove(e.target.checked)}
          />
          {t("I approve reading this exact file for the selected employee.")}
        </label>
        <button
          className="primary"
          disabled={busy || !approve || !agentId || !connectionId}
        >
          {t("Approve file")}
        </button>
      </form>
      <div className="panel">
        <h3>{t("Approved Drive files")}</h3>
        {sources.filter((s) =>
          connections.some((c) => c.id === s.connection_id)
        ).map((s) => (
          <div className="drive-account" key={s.id}>
            <span>{s.display_name || s.source_reference}</span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setPreview(null);
                  const data = await request({
                    action: "read",
                    sourceId: s.id,
                  });
                  if (alive.current) setPreview(data);
                })}
            >
              {t("Read approved file")}
            </button>
          </div>
        ))}
        <p className="muted">
          {t(
            "File contents are untrusted source material. Review them before copying into a task; they are never sent to AI automatically.",
          )}
        </p>
        {preview && (
          <article>
            <h4>{preview.provenance.name}</h4>
            <pre className="drive-preview">{preview.text}</pre>
            <small>{t("Read at")}: {preview.provenance.readAt}</small>
          </article>
        )}
      </div>
    </section>
  );
}
