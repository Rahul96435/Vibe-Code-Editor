import type { FileSystemTree } from "@webcontainer/api";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";

export function transformToWebContainerFormat(template: TemplateFolder): FileSystemTree {
  return Object.fromEntries(template.items.map(item => {
    if ("folderName" in item) return [item.folderName, { directory: transformToWebContainerFormat(item) }];
    const name = item.fileExtension ? `${item.filename}.${item.fileExtension}` : item.filename;
    return [name, { file: { contents: item.content } }];
  }));
}
