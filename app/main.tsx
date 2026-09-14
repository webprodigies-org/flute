import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FLUTE_BRAND } from '../src/core';
import { SceneLibrary } from '../src/preview';
// Product entry: no pretend app or seeded scene. Installed host applications supply
// their real components through the same exported SceneLibrary interface.
document.title = FLUTE_BRAND.title;
createRoot(document.getElementById('root')!).render(<StrictMode><SceneLibrary hot={import.meta.hot}/></StrictMode>);
