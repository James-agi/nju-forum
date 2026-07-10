import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";

export async function requireKnowledgePageUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.banned) {
    redirect("/");
  }

  return user;
}
