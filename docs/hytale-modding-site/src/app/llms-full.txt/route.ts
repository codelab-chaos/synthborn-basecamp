import { baseUrl } from "@/lib/config";
import { getLLMFullText } from "@/lib/source";

export const revalidate = false;

export async function GET() {
  const entries = await getLLMFullText(baseUrl);

  const header = [
    "# Hytale Modding Documentation",
    "> The number one community resource for modding Hytale, featuring comprehensive guides, detailed documentation, and essential tools to kickstart your modding journey.",
    "\n\n",
  ].join("\n");

  return new Response(header + entries.join("\n\n"));
}
