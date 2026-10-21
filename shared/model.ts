import { z } from 'zod';
export interface Calendar { timezone:string; days:number[]; hours:number; startHour:number; exceptions:Record<string,number> }
export interface Task { id:string; title:string; description:string; parentId:string|null; order:number; duration:number; start:string; finish:string; manual:boolean; percent:number; actualStart:string|null; actualFinish:string|null; priority:'low'|'normal'|'high'; fixedCost:number; actualFixedCost:number; remainingWork:number|null }
export interface Dependency { id:string; from:string; to:string; type:'FS'|'SS'|'FF'|'SF'; lag:number }
export interface Resource { id:string; name:string; role:string; kind:'person'|'equipment'; capacity:number; rate:number; active:boolean; color:string }
export interface Assignment { id:string; taskId:string; resourceId:string; allocation:number; actualWork:number|null; actualRate:number|null }
export interface Baseline { id:string; name:string; createdAt:string; document:ProjectDocument }
export interface ProjectDocument { id:string; name:string; description:string; start:string; statusDate:string; currency:string; calendar:Calendar; tasks:Task[]; dependencies:Dependency[]; resources:Resource[]; assignments:Assignment[]; baselines:Baseline[] }
export interface ScheduledTask { start:string; finish:string; float:number; percent:number; summary:boolean }
export interface ScheduleResult { tasks:Record<string,ScheduledTask>; critical:string[]; violations:{taskId:string;message:string}[]; finish:string }
export type Role='owner'|'editor'|'viewer';
export const defaultCalendar:Calendar={timezone:'America/Los_Angeles',days:[1,2,3,4,5],hours:8,startHour:9,exceptions:{}};
export function blankProject(id='project',name='Untitled project',start='2026-10-26T09:00:00-07:00'):ProjectDocument { return {id,name,description:'',start,statusDate:start,currency:'USD',calendar:structuredClone(defaultCalendar),tasks:[],dependencies:[],resources:[],assignments:[],baselines:[]}; }
export function newTask(id:string,title:string,start:string,order=0):Task { return {id,title,description:'',parentId:null,order,duration:8,start,finish:start,manual:false,percent:0,actualStart:null,actualFinish:null,priority:'normal',fixedCost:0,actualFixedCost:0,remainingWork:null}; }
export const id=()=>globalThis.crypto.randomUUID();
export const roleSchema=z.enum(['owner','editor','viewer']);
const iso=z.string().refine(s=>Number.isFinite(Date.parse(s)),'Invalid date');
const key=z.string().min(1).max(100);
export const taskSchema=z.object({id:key,title:z.string().trim().min(1).max(300),description:z.string().max(20000),parentId:key.nullable(),order:z.number().finite(),duration:z.number().min(0).max(800000),start:iso,finish:iso,manual:z.boolean(),percent:z.number().min(0).max(100),actualStart:iso.nullable(),actualFinish:iso.nullable(),priority:z.enum(['low','normal','high']),fixedCost:z.number().min(0).max(1e12),actualFixedCost:z.number().min(0).max(1e12),remainingWork:z.number().min(0).max(8e6).nullable()}).strict();
export const resourceSchema=z.object({id:key,name:z.string().trim().min(1).max(200),role:z.string().max(200),kind:z.enum(['person','equipment']),capacity:z.number().min(1).max(1000),rate:z.number().min(0).max(1e7),active:z.boolean(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict();
export const assignmentSchema=z.object({id:key,taskId:key,resourceId:key,allocation:z.number().min(0).max(1000),actualWork:z.number().min(0).max(8e6).nullable(),actualRate:z.number().min(0).max(1e7).nullable()}).strict();
export const dependencySchema=z.object({id:key,from:key,to:key,type:z.enum(['FS','SS','FF','SF']),lag:z.number().min(-800000).max(800000)}).strict();
export const calendarSchema=z.object({timezone:z.string().max(100),days:z.array(z.number().int().min(1).max(7)).max(7),hours:z.number().min(0.25).max(24),startHour:z.number().min(0).max(23),exceptions:z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.number().min(0).max(24))}).strict();
export const projectPatchSchema=z.object({name:z.string().trim().min(1).max(200),description:z.string().max(20000),start:iso,statusDate:iso,currency:z.string().regex(/^[A-Z]{3}$/),calendar:calendarSchema}).partial().strict();
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('task.add'),task:taskSchema}).strict(),z.object({type:z.literal('task.update'),id:key,patch:taskSchema.omit({id:true}).partial()}).strict(),z.object({type:z.literal('task.delete'),id:key}).strict(),
 z.object({type:z.literal('resource.add'),resource:resourceSchema}).strict(),z.object({type:z.literal('resource.update'),id:key,patch:resourceSchema.omit({id:true}).partial()}).strict(),z.object({type:z.literal('resource.delete'),id:key}).strict(),
 z.object({type:z.literal('dependency.add'),dependency:dependencySchema}).strict(),z.object({type:z.literal('dependency.delete'),id:key}).strict(),
 z.object({type:z.literal('assignment.add'),assignment:assignmentSchema}).strict(),z.object({type:z.literal('assignment.update'),id:key,patch:assignmentSchema.omit({id:true,taskId:true,resourceId:true}).partial()}).strict(),z.object({type:z.literal('assignment.delete'),id:key}).strict(),
 z.object({type:z.literal('project.update'),patch:projectPatchSchema}).strict(),z.object({type:z.literal('baseline.add'),name:z.string().trim().min(1).max(100)}).strict()
]);
export type Command=z.infer<typeof commandSchema>;
export interface FieldChange {id:string;title:string;field:string;before:string;after:string}
export interface ChangePreview {document:ProjectDocument;schedule:ScheduleResult;changes:FieldChange[];finishBefore:string;finishAfter:string;deleted:{tasks:number;assignments:number;dependencies:number}}
