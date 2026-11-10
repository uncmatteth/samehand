import JSZip from "jszip";
import { restyleFilename } from "@/lib/image";

type ZipPage = {
  name: string;
  order: number;
  status: string;
  restyleBlob: Blob | null;
};

export async function zipFinals(pages: ZipPage[]): Promise<Blob> {
  const zip = new JSZip();
  const done = pages.filter((page) => page.status === "done" && page.restyleBlob);
  if (done.length === 0) throw new Error("No finals to zip");
  for (const page of done) {
    zip.file(restyleFilename(page.name, page.order), page.restyleBlob as Blob);
  }
  return zip.generateAsync({ type: "blob" });
}
