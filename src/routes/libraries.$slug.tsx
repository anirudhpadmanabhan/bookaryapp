import { formatDMY } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Heart, MessageCircle, Image as ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/libraries/$slug")({
  ssr: false,
  component: LibraryProfile,
});

type Lib = { id: string; name: string; name_ml: string | null; location: string | null; slug: string };
type Post = { id: string; title: string | null; body: string | null; image_url: string | null; created_at: string; author_id: string; library_id: string };

function LibraryProfile() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useSession();

  const { data: lib } = useQuery({
    queryKey: ["library-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("libraries").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Lib | null;
    },
  });

  const { data: isStaff } = useQuery({
    queryKey: ["my-roles-basic", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return !!data?.some((r) => r.role === "admin" || r.role === "librarian");
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["library-posts", lib?.id],
    enabled: !!lib?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("library_posts").select("*").eq("library_id", lib!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  return (
    <AppLayout>
      <Link to="/" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="glass-card mb-6 rounded-3xl p-6">
        <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Library</div>
        <h1 className="text-3xl font-bold">{lib?.name ?? "Library"}</h1>
        {lib?.name_ml && <p className="font-mal mt-1 text-xl text-accent">{lib.name_ml}</p>}
        {lib?.location && <p className="mt-2 text-sm text-muted-foreground">{lib.location}</p>}
      </div>

      {isStaff && lib && <NewPostForm libraryId={lib.id} onCreated={() => qc.invalidateQueries({ queryKey: ["library-posts", lib.id] })} />}

      <div className="mt-6 space-y-4">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No activity posts yet.</p>}
        {posts.map((p) => (
          <PostCard key={p.id} post={p} userId={user?.id ?? null} />
        ))}
      </div>
    </AppLayout>
  );
}

function NewPostForm({ libraryId, onCreated }: { libraryId: string; onCreated: () => void }) {
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!body.trim() && !title.trim() && !photo) return;
    setBusy(true);
    let finalImageUrl = imageUrl.trim() || null;
    if (photo) {
      const safeName = photo.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
      const path = `${libraryId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("library-posts").upload(path, photo, { upsert: false, contentType: photo.type || "image/jpeg" });
      if (uploadError) { setBusy(false); toast.error(uploadError.message); return; }
      finalImageUrl = `library-posts/${path}`;
    }
    const { error } = await supabase.from("library_posts").insert({
      library_id: libraryId,
      author_id: user.id,
      title: title.trim() || null,
      body: body.trim() || null,
      image_url: finalImageUrl,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setBody(""); setImageUrl(""); setPhoto(null);
    toast.success("Posted");
    onCreated();
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold">Post an activity</p>
      <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="What happened at the library?" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 px-3 py-3 text-sm hover:bg-surface/50">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{photo ? photo.name : "Upload activity photo"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Or paste image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post"}</Button>
    </div>
  );
}

function PostCard({ post, userId }: { post: Post; userId: string | null }) {
  const qc = useQueryClient();
  const { data: likes = [] } = useQuery({
    queryKey: ["post-likes", post.id],
    queryFn: async () => {
      const { data } = await supabase.from("library_post_likes").select("user_id").eq("post_id", post.id);
      return data ?? [];
    },
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: async () => {
      const { data } = await supabase.from("library_post_comments").select("*").eq("post_id", post.id).order("created_at");
      return data ?? [];
    },
  });
  const { data: names = {} } = useQuery({
    queryKey: ["post-commenters", post.id, comments.map((c: any) => c.user_id).join(",")],
    enabled: comments.length > 0,
    queryFn: async () => {
      const ids = [...new Set(comments.map((c: any) => c.user_id))];
      const { data } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.id] = p.display_name ?? "Reader"; });
      return m;
    },
  });

  const liked = !!userId && likes.some((l: any) => l.user_id === userId);
  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to like");
      if (liked) await supabase.from("library_post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
      else await supabase.from("library_post_likes").insert({ post_id: post.id, user_id: userId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-likes", post.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [comment, setComment] = useState("");
  const addComment = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to comment");
      if (!comment.trim()) return;
      const { error } = await supabase.from("library_post_comments").insert({ post_id: post.id, user_id: userId, body: comment.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["post-comments", post.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="glass-card rounded-2xl p-5">
      {post.title && <h3 className="mb-2 text-lg font-semibold">{post.title}</h3>}
      {post.image_url && <PostImage src={post.image_url} alt={post.title ?? "Library activity"} />}
      {post.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{post.body}</p>}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button onClick={() => toggleLike.mutate()} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${liked ? "bg-rose-500/15 text-rose-400" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes.length}
        </button>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MessageCircle className="h-4 w-4" /> {comments.length}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{formatDMY(post.created_at)}</span>
      </div>

      <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
        {comments.map((c: any) => (
          <div key={c.id} className="rounded-lg bg-surface/50 px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">{(names as any)[c.user_id] ?? "Reader"} · {formatDMY(c.created_at)}</div>
            <div>{c.body}</div>
          </div>
        ))}
        {userId && (
          <div className="flex gap-2">
            <Input placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment.mutate(); }} />
            <Button size="sm" onClick={() => addComment.mutate()} disabled={!comment.trim()}>Send</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostImage({ src, alt }: { src: string; alt: string }) {
  const { data: resolved } = useQuery({
    queryKey: ["library-post-image", src],
    queryFn: async () => {
      if (!src.startsWith("library-posts/")) return src;
      const path = src.replace(/^library-posts\//, "");
      const { data, error } = await supabase.storage.from("library-posts").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className="mb-3 max-h-96 w-full rounded-xl object-cover" loading="lazy" />;
}
