import { createFileRoute } from "@tanstack/react-router";
import { GenresPage } from "./genres";

export const Route = createFileRoute("/genres/")({
  ssr: false,
  component: GenresPage,
});