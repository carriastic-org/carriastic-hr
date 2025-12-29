type UploadLogoOptions = {
  organizationId?: string | null;
};

type UploadLogoResponse = {
  url?: string;
  key?: string;
  error?: string;
};

const buildError = (message?: string) =>
  new Error(message ?? "Unable to upload logo right now.");

export async function uploadOrganizationLogo(file: File, options?: UploadLogoOptions) {
  const formData = new FormData();
  formData.append("file", file);

  if (options?.organizationId) {
    formData.append("organizationId", options.organizationId);
  }

  const response = await fetch("/api/organization/logo", {
    method: "POST",
    body: formData,
  });

  let payload: UploadLogoResponse | null = null;
  try {
    payload = (await response.json()) as UploadLogoResponse;
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw buildError(payload?.error);
  }

  if (!payload?.url) {
    throw buildError();
  }

  return payload.url;
}
