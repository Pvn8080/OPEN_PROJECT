import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function backupDatabase(source:string,target:string){if(existsSync(target))throw new Error('Backup destination already exists; choose a new path');if(resolve(source)===resolve(target))throw new Error('Backup must use a different destination');const db=new DatabaseSync(source,{readOnly:true});try{db.prepare('VACUUM INTO ?').run(resolve(target));}finally{db.close();}const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw new Error('Backup integrity check failed');}finally{check.close();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(!process.argv[2])throw new Error('Usage: npm run db:backup -- /absolute/path/backup.sqlite');backupDatabase(process.env.DATABASE_PATH??'data/open-project.sqlite',process.argv[2]);console.log('Consistent database backup created and integrity verified.');}catch(e){console.error((e as Error).message);process.exitCode=1;}}
