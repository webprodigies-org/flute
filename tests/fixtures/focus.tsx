import React from 'react';
import {createRoot} from 'react-dom/client';
import {Scene,Surface} from '../../src/react';
createRoot(document.getElementById('root')!).render(<Scene style={{width:800,height:400}} focus={{radius:35,falloff:170,maxBlur:12}}><Surface id="probe" style={{position:'absolute',left:100,top:50,width:600,height:300}}><div style={{height:300,background:'repeating-linear-gradient(90deg,#fff 0px,#fff 4px,#000 4px,#000 8px)'}}/></Surface></Scene>);
