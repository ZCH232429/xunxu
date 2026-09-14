export type SupplementLabel={name:string;servingText:string;ingredients:{name:string;amount:number;unit:string}[];source:string;note:string;sources?:{title:string;url:string}[]};
export type SupplementLog={id:string;name:string;category:'sport'|'health';amount:number;unit:'g'|'mg'|'μg'|'ml'|'粒'|'片'|'份'|'IU';date:string;time:string;note:string;label?:SupplementLabel;recordKind?:'library'|'intake';supplementId?:string;eventId?:string};
export function validateSupplement(x:SupplementLog):SupplementLog{
 if(!x.id||typeof x.name!=='string'||!x.name.trim()||x.name.length>120)throw Error('请输入补剂名称（最多120字）');
 if(!['sport','health'].includes(x.category))throw Error('请选择补剂类型');
 if(!Number.isFinite(x.amount)||x.amount<=0||x.amount>1000000)throw Error('请输入有效的实际服用量');
 if(!['g','mg','μg','ml','粒','片','份','IU'].includes(x.unit))throw Error('请选择用量单位');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!Number.isFinite(Date.parse(x.date))||new Date(x.date).toISOString().slice(0,10)!==x.date)throw Error('请输入有效日期 YYYY-MM-DD');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))throw Error('请输入有效时间 HH:mm');
 if(typeof x.note!=='string'||x.note.length>500)throw Error('备注最多500字');
 return {...x,name:x.name.trim(),note:x.note.trim()};
}
export function saveSupplement(state:any,entry:SupplementLog){
 const checked=validateSupplement(entry),logs:SupplementLog[]=state.supplementLogs||[];
 if(!Array.isArray(logs)||logs.length>=30000&&!logs.some(x=>x.id===entry.id))throw Error('补剂记录数量已达上限');
 return {...state,supplementLogs:logs.some(x=>x.id===checked.id)?logs.map(x=>x.id===checked.id?checked:x):[...logs,checked]};
}
