import { Dashboard } from "@/components/dashboard";
import { SceneGallery } from "@/scenes/gallery";
export default function App() {
  if (new URLSearchParams(location.search).has("scene"))
    return <SceneGallery />;
  return (
    <>
      <a className="block px-6 py-3 text-sm underline" href="?scene=pullback">
        Explore three animated mockups →
      </a>
      <Dashboard />
    </>
  );
}
