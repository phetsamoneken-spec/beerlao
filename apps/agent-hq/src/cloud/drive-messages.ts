const messages: Record<string, string> = {
  "DRIVE_NOT_CONFIGURED": "Google Drive is not configured yet.",
  "DRIVE_BACKEND_NOT_DEPLOYED":
    "Google Drive is not available yet. Contact your administrator.",
  "DRIVE_OPERATION_FAILED":
    "The Google Drive operation failed. Please try again.",
  "DRIVE_SCHEMA_NOT_READY":
    "Google Drive setup is incomplete. Contact your administrator.",
  "DRIVE_DATABASE_ERROR":
    "Google Drive setup is incomplete. Contact your administrator.",
  "DRIVE_TOKEN_INVALID":
    "Stored Google authorization could not be opened. Contact your administrator.",
  "DRIVE_UNAVAILABLE":
    "Google Drive could not be reached. Please try again later.",
  "DRIVE_RECONNECT_REQUIRED":
    "Google authorization expired or was revoked. Reconnect the account.",
  "DRIVE_DISCONNECTED": "This Google account has been disconnected.",
  "DRIVE_BUSY_RETRY":
    "Google authorization is being refreshed. Please try again shortly.",
  "DRIVE_SCOPE_MISMATCH":
    "Google returned permissions different from the requested read-only access.",
  "DRIVE_FILE_REFERENCE_INVALID":
    "Enter a file link or file ID, rather than the Drive home or a folder link.",
  "DRIVE_FILE_NOT_FOUND":
    "The file was not found or this Google account cannot access it.",
  "DRIVE_FILE_UNSUPPORTED":
    "This file format or download permission is not supported.",
  "DRIVE_FILE_TOO_LARGE": "The file exceeds the size limit.",
  "DRIVE_FILE_CHANGED":
    "The file format has changed. Review and approve it again.",
  "OAUTH_STATE_INVALID":
    "This connection link expired or was already used. Start again.",
  "OAUTH_FAILED": "Google authorization was not completed. Please start again.",
  "FORBIDDEN": "You do not have permission for this department or file.",
  "NOT_FOUND": "The requested connection or file could not be found.",
  "RATE_LIMITED": "Too many requests. Please try again later.",
  "UNAUTHENTICATED": "Sign in again to continue.",
  "EMAIL_NOT_VERIFIED": "Confirm your email before connecting Google Drive.",
  "INVALID_REQUEST": "Check the connection or file details and try again.",
};
export const driveMessage = (code: string) =>
  messages[code] || messages.DRIVE_OPERATION_FAILED;
