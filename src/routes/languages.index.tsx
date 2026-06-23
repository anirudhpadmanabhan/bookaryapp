import { createFileRoute } from "@tanstack/react-router";
import { LanguagesPage } from "./languages";

export const Route = createFileRoute("/languages/")({
  ssr: false,
  component: LanguagesPage,
});
