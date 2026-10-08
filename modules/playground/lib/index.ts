import { TemplateFile, TemplateFolder } from "./path-to-json";

export function findFilePath(
  file: TemplateFile,
  folder: TemplateFolder,
  pathSoFar: string[] = []
): string | null {
  if (file.path) return file.path;
  for (const item of folder.items) {
    if ("folderName" in item) {
      const res = findFilePath(file, item, [...pathSoFar, item.folderName]);
      if (res) return res;
    } else {
      if (
        item.filename === file.filename &&
        item.fileExtension === file.fileExtension
      ) {
        return [
          ...pathSoFar,
          item.filename + (item.fileExtension ? "." + item.fileExtension : ""),
        ].join("/");
      }
    }
  }
  return null;
}



/**
 * Generates a unique file ID based on file location in folder structure
 * @param file The template file
 * @param rootFolder The root template folder containing all files
 * @returns A unique file identifier including full path
 */
export const generateFileId = (file: TemplateFile, rootFolder: TemplateFolder): string => {
  // Find the file's path in the folder structure
  const path = findFilePath(file, rootFolder)?.replace(/^\/+/, '') || '';
  
  // Handle empty/undefined file extension
  const extension = file.fileExtension?.trim();
  const extensionSuffix = extension ? `.${extension}` : '';

  // Combine path and filename
  return path
    ? path
    : `${file.filename}${extensionSuffix}`;
}

export function listProjectFiles(folder: TemplateFolder, prefix = ""): TemplateFile[] {
  return folder.items.flatMap(item => "folderName" in item
    ? listProjectFiles(item, `${prefix}${item.folderName}/`)
    : [{ ...item, path: `${prefix}${item.filename}${item.fileExtension ? `.${item.fileExtension}` : ""}` }]);
}

export function updateProjectFile(folder: TemplateFolder, path: string, content: string, prefix = ""): TemplateFolder {
  return { ...folder, items: folder.items.map(item => {
    if ("folderName" in item) return updateProjectFile(item, path, content, `${prefix}${item.folderName}/`);
    const itemPath = `${prefix}${item.filename}${item.fileExtension ? `.${item.fileExtension}` : ""}`;
    return itemPath === path ? { ...item, content } : item;
  }) };
}
