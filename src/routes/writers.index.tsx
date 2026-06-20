import { createFileRoute } from "@tanstack/react-router";
import { WritersPage } from "./writers";

export const Route = createFileRoute("/writers")({
  ssr: false,
  component: WritersPage,
});