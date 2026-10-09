import focusLake from "@/assets/focus-calm-lake.jpg";
import blueprintPath from "@/assets/blueprint-calm-path.jpg";

export function CalmStudyBackground({ mode }: { mode: "focus" | "blueprint" }) {
  return (
    <div className="calm-study-background" aria-hidden="true" data-study-background={mode}>
      <img
        src={mode === "focus" ? focusLake : blueprintPath}
        alt=""
        width={1920}
        height={1088}
        decoding="async"
        className="calm-study-image"
      />
      <div className="calm-study-scrim" />
    </div>
  );
}