import { redirect } from "next/navigation";

type Props = {
  params: { email: string; token: string };
};

export default function RegistrationTokenPage({ params }: Props) {
  const searchParams = new URLSearchParams({ token: params.token });
  redirect(`/auth/signup?${searchParams.toString()}`);
}
