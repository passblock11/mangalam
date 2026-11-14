import { supabase } from "./supabase";

export async function uploadPhoto(file: File, bucket: "profile-photos" | "verification-docs" | "report-screenshots", folder = ""): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not signed in");
  const stamp = Date.now();
  const path = `${user.id}/${folder}${stamp}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  if (bucket === "profile-photos" || bucket === "report-screenshots") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return `${data.publicUrl}?v=${stamp}`;
  }
  return path;
}

export async function uploadChatFile(file: File, conversationId: string): Promise<{ url: string; type: string; name: string; mime: string; size: number }> {
  if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB.");
  if (file.type.startsWith("video/")) throw new Error("Video uploads are not available.");
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not signed in");
  const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file";
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const path = `${user.id}/chat/${conversationId}/${Date.now()}${ext.replace(/[^a-zA-Z0-9.]+/g, "")}`;
  const { error } = await supabase.storage.from("profile-photos").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
  return { url: data.publicUrl, type, name: file.name, mime: file.type || "application/octet-stream", size: file.size };
}
