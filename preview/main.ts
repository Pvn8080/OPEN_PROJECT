import { exportWorkspace } from "./api";
import "../client/main";
document.getElementById("backup")!.addEventListener("click", () => {
  const blob = new Blob([exportWorkspace()], { type: "application/json" });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "open-project-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
