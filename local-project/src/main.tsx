import { FluteProjectPreview } from "./flute/ProjectPreview";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<FluteProjectPreview projectId="ebd92c02-5baa-4458-8a55-21a681c197b9" enabled={import.meta.env.DEV}>{<StrictMode><App/></StrictMode>}</FluteProjectPreview>);
