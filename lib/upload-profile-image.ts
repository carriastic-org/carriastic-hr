type UploadOptions = {
  employeeId?: string;
};

type UploadResponse = {
  url?: string;
  key?: string;
  error?: string;
};

const buildError = (message?: string) =>
  new Error(message ?? "Unable to upload profile photo right now.");

export async function uploadProfileImage(file: File, options?: UploadOptions) {
  const formData = new FormData();
  formData.append("file", file);

  if (options?.employeeId) {
    formData.append("employeeId", options.employeeId);
  }

  const response = await fetch("/api/profile/photo", {
    method: "POST",
    body: formData,
  });

  let payload: UploadResponse | null = null;
  try {
    payload = (await response.json()) as UploadResponse;
  } catch {
    // ignore JSON errors and let the shared handler throw
  }

  if (!response.ok) {
    throw buildError(payload?.error);
  }

  if (!payload?.url) {
    throw buildError();
  }

  return payload.url;
}
