import {Surface} from '@webprodigies/flute';
import {Dashboard,DashboardProvider,Sidebar,Revenue,Customers,Projects,Heading} from './dashboard';
export function WholeScene(){return <DashboardProvider><Surface id="dashboard" style={{width:1400,height:900}}><Dashboard/></Surface></DashboardProvider>}
export function PlatingScene(){return <DashboardProvider><Surface id="dashboard" style={{width:1400,height:900}} content={<div className="orbit-dashboard" style={{position:"absolute",left:0,top:0,borderRadius:24}}/>}>
 <Surface id="sidebar" style={{position:'absolute',left:0,top:0,width:230,height:900}}><div style={{height:900,display:'flex'}}><Sidebar/></div></Surface>
 <Surface id="heading" style={{position:'absolute',left:270,top:40,width:1090,height:126}}><Heading/></Surface>
 <Surface id="revenue" style={{position:'absolute',left:270,top:210,width:628,height:505}}><Revenue/></Surface>
 <Surface id="customers" style={{position:'absolute',left:922,top:210,width:438,height:230}}><Customers/></Surface>
 <Surface id="projects" style={{position:'absolute',left:922,top:464,width:438,height:300}}><Projects/></Surface>
 </Surface></DashboardProvider>}
