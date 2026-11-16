import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';
export class TestDB {
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(fs.readFileSync(new URL('../../drizzle/0000_game_state.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const statement=this.sqlite.prepare(sql);return {bind(...args){return {async first(){return statement.get(...args)||null},async run(){const r=statement.run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}}}}
}
