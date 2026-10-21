import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {id,type ProjectDocument,type Role} from '../shared/model';
export class Store {
 db:DatabaseSync;
 constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT,guest INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,document TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS memberships(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(project_id,user_id));
 CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,email TEXT NOT NULL,role TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,before_doc TEXT NOT NULL,after_doc TEXT NOT NULL,label TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(project_id,request_id));
 CREATE TABLE IF NOT EXISTS templates(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),document TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,status TEXT NOT NULL,document TEXT,request TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS entities(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,kind TEXT NOT NULL,id TEXT NOT NULL,document TEXT NOT NULL,PRIMARY KEY(project_id,kind,id));
 CREATE INDEX IF NOT EXISTS membership_user ON memberships(user_id);
 CREATE INDEX IF NOT EXISTS history_project ON history(project_id,revision);
 PRAGMA user_version=1;`); }
 close(){this.db.close();}
 transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 row(sql:string,...args:any[]):any{return this.db.prepare(sql).get(...args);}
 rows(sql:string,...args:any[]):any[]{return this.db.prepare(sql).all(...args);}
 run(sql:string,...args:any[]){return this.db.prepare(sql).run(...args);}
 role(user:string,project:string):Role {const r=this.row('SELECT role FROM memberships WHERE user_id=? AND project_id=?',user,project);if(!r)throw new HttpError(403,'You do not have access to this project');return r.role;}
 authorize(user:string,project:string,action:'view'|'edit'|'manage'='view'){const r=this.role(user,project);if(action==='manage'&&r!=='owner'||action==='edit'&&r==='viewer')throw new HttpError(403,'Your role does not allow this action');return r;}
 getProject(key:string):{document:ProjectDocument;revision:number;updatedAt:string}{const r=this.row('SELECT * FROM projects WHERE id=?',key);if(!r)throw new HttpError(404,'Project not found');return {document:JSON.parse(r.document),revision:r.revision,updatedAt:r.updated_at};}
 saveDocument(p:ProjectDocument,revision:number){this.run('UPDATE projects SET document=?,revision=?,updated_at=? WHERE id=?',JSON.stringify(p),revision,new Date().toISOString(),p.id);this.run('DELETE FROM entities WHERE project_id=?',p.id);const insert=this.db.prepare('INSERT INTO entities VALUES(?,?,?,?)');for(const kind of ['tasks','dependencies','resources','assignments','baselines'] as const)for(const row of p[kind])insert.run(p.id,kind,row.id,JSON.stringify(row));}
 createProject(user:string,p:ProjectDocument){return this.transaction(()=>{this.run('INSERT INTO projects VALUES(?,?,0,?)',p.id,JSON.stringify(p),new Date().toISOString());this.run('INSERT INTO memberships VALUES(?,?,?)',p.id,user,'owner');this.saveDocument(p,0);return this.getProject(p.id);});}
}
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
