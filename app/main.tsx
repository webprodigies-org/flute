import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScenePreview } from '../src/preview';
// Product entry: no pretend app or seeded scene. Installed host applications supply
// their real components through the same exported ScenePreview interface.
createRoot(document.getElementById('root')!).render(<StrictMode><ScenePreview hot={import.meta.hot}/></StrictMode>);
