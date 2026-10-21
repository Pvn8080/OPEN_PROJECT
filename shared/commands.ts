import {z} from 'zod';
import {commandSchema,taskSchema,resourceSchema,assignmentSchema,dependencySchema,projectPatchSchema,id,type ProjectDocument,type Command,type ChangePreview} from './model';
import {schedule} from './schedule';
export function validateProject(p:ProjectDocument){
 projectPatchSchema.parse({name:p.name,description:p.description,start:p.start,statusDate:p.statusDate,currency:p.currency,calendar:p.calendar});
 p.tasks.forEach(t=>{taskSchema.parse(t);if(t.percent===100&&!t.actualFinish)throw new Error('Completed tasks require an actual finish date');if(t.actualStart&&t.actualFinish&&Date.parse(t.actualStart)>Date.parse(t.actualFinish))throw new Error('Actual finish precedes actual start');});
 p.resources.forEach(r=>resourceSchema.parse(r));p.dependencies.forEach(d=>dependencySchema.parse(d));
 for(const a of p.assignments){assignmentSchema.parse(a);if(!p.tasks.some(t=>t.id===a.taskId)||!p.resources.some(r=>r.id===a.resourceId))throw new Error('Assignment references a missing task or resource');if(p.tasks.some(t=>t.parentId===a.taskId))throw new Error('Assign resources to leaf tasks, not summaries');}
 for(const arr of [p.tasks,p.resources,p.assignments,p.dependencies])if(new Set(arr.map(x=>x.id)).size!==arr.length)throw new Error('Duplicate identifiers');
 if(new Set(p.assignments.map(a=>a.taskId+':'+a.resourceId)).size!==p.assignments.length)throw new Error('Resource is already assigned to this task');
 return schedule(p);
}
export function previewCommands(input:ProjectDocument,raw:Command[]|unknown):ChangePreview {
 const commands=z.array(commandSchema).min(1).max(2000).parse(raw),p=structuredClone(input);const before=schedule(input);const deleted={tasks:0,assignments:0,dependencies:0};
 const find=<T extends {id:string}>(arr:T[],key:string)=>{const v=arr.find(t=>t.id===key);if(!v)throw new Error('Item not found: '+key);return v;};
 for(const c of commands){switch(c.type){
 case 'task.add':p.tasks.push(c.task);break;
 case 'task.update':{const t=find(p.tasks,c.id);if(p.tasks.some(x=>x.parentId===t.id)&&Object.keys(c.patch).some(k=>['duration','start','finish','percent','actualStart','actualFinish','remainingWork'].includes(k)))throw new Error('Summary schedule and progress roll up from children');Object.assign(t,c.patch);break;}
 case 'task.delete':{find(p.tasks,c.id);const ids=new Set([c.id]);let changed=true;while(changed){changed=false;for(const t of p.tasks)if(t.parentId&&ids.has(t.parentId)&&!ids.has(t.id)){ids.add(t.id);changed=true;}}deleted.tasks+=ids.size;deleted.assignments+=p.assignments.filter(a=>ids.has(a.taskId)).length;deleted.dependencies+=p.dependencies.filter(d=>ids.has(d.from)||ids.has(d.to)).length;p.tasks=p.tasks.filter(t=>!ids.has(t.id));p.assignments=p.assignments.filter(a=>!ids.has(a.taskId));p.dependencies=p.dependencies.filter(d=>!ids.has(d.from)&&!ids.has(d.to));break;}
 case 'resource.add':p.resources.push(c.resource);break;
 case 'resource.update':Object.assign(find(p.resources,c.id),c.patch);break;
 case 'resource.delete':find(p.resources,c.id);p.resources=p.resources.filter(r=>r.id!==c.id);p.assignments=p.assignments.filter(a=>a.resourceId!==c.id);break;
 case 'dependency.add':p.dependencies.push(c.dependency);break;
 case 'dependency.delete':find(p.dependencies,c.id);p.dependencies=p.dependencies.filter(d=>d.id!==c.id);break;
 case 'assignment.add':p.assignments.push(c.assignment);break;
 case 'assignment.update':Object.assign(find(p.assignments,c.id),c.patch);break;
 case 'assignment.delete':find(p.assignments,c.id);p.assignments=p.assignments.filter(a=>a.id!==c.id);break;
 case 'project.update':Object.assign(p,c.patch);break;
 case 'baseline.add':p.baselines.push({id:id(),name:c.name,createdAt:new Date().toISOString(),document:{...structuredClone(p),baselines:[]}});break;
 }}
 const result=validateProject(p);const changes:ChangePreview['changes']=[];
 for(const t of p.tasks){const old=input.tasks.find(x=>x.id===t.id);if(!old){changes.push({id:t.id,title:t.title,field:'Task',before:'Not present',after:'Added'});continue;}for(const key of Object.keys(t) as (keyof typeof t)[]){if(JSON.stringify(old[key])!==JSON.stringify(t[key])&&key!=='finish')changes.push({id:t.id,title:t.title,field:key,before:String(old[key]??'—'),after:String(t[key]??'—')});}if(before.tasks[t.id]?.finish!==result.tasks[t.id].finish)changes.push({id:t.id,title:t.title,field:'Scheduled finish',before:before.tasks[t.id].finish,after:result.tasks[t.id].finish});}
 for(const t of input.tasks)if(!p.tasks.some(x=>x.id===t.id))changes.push({id:t.id,title:t.title,field:'Task',before:'Present',after:'Deleted'});
 return {document:p,schedule:result,changes,finishBefore:before.finish,finishAfter:result.finish,deleted};
}
