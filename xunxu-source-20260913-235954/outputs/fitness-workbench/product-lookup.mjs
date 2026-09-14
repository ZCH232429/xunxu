export function normalizeBarcode(value,type=''){
 let code=String(value||'').replace(/[\s-]/g,'');
 if(type==='upc_e'){
  if(!/^[01]\d{7}$/.test(code))throw Error('UPC-E 条码不完整，请重新扫描或补拍产品正面');
  const n=code[0],d=code.slice(1,7),last=d[5],check=code[7];
  code=n+(last<='2'?d.slice(0,2)+last+'0000'+d.slice(2,5):last==='3'?d.slice(0,3)+'00000'+d.slice(3,5):last==='4'?d.slice(0,4)+'00000'+d[4]:d.slice(0,5)+'0000'+last)+check;
 }
 if(!/^(\d{8}|\d{12,14})$/.test(code))throw Error('请扫描 EAN、UPC 或 GTIN 商品条码；店内码可改拍产品正面');
 let sum=0;for(let i=code.length-2,weight=3;i>=0;i--,weight=4-weight)sum+=Number(code[i])*weight;
 if((10-sum%10)%10!==Number(code.at(-1)))throw Error('条码校验未通过，请重新扫描或拍摄产品正面');
 return {code,gtin:code.padStart(14,'0'),variants:[...new Set([code,code.padStart(14,'0'),...(code.length===12?['0'+code]:[]),...(code.length===13&&code.startsWith('0')?[code.slice(1)]:[])])]};
}
export function sameBarcode(a,b){try{return normalizeBarcode(a).gtin===normalizeBarcode(b).gtin}catch{return false}}
export const lookupPrompt=`
照片还需输出labelComplete布尔值：只有照片实际包含完整营养/成分及对应份量时为true。只有品牌正面或正面标注某成分剂量时为false，不推测完整成分表。
全球商品查询规则：不得限定国家或条码前缀。识别各语言包装的品牌、产品名、口味/型号、规格和销售版本，输出 identity:{brand,productName,variant,packageSize}，不清楚填空。照片无法读全营养/成分时仍应返回 identity 和 error，保留可见线索供下一次联网查询，不猜成分。
联网照片查询时，使用图片可见的品牌/产品名/规格进行多语言搜索，优先品牌官网、制造商和同款商品页。必须确认同一品牌、型号/口味、含量规格；无法区分版本不能借用相似商品数据。只有已确认同款时输出 productMatch:true，且 matchingSourceUrl 必须是实际检索引用中支持该商品的页面。查到品牌但缺营养时返回清楚错误，不以0补齐。
条码查询需同时支持 barcodeVariants 中的等价GTIN写法；输出 matchedBarcode 为来源实际出现的完整条码，barcodeMatch:true 仅用于精确对应，不把GTIN-14整箱误当单件。
联网取得的标签/成分不是照片直接读到的，source和note必须明确说明“联网匹配”，且按原任务要求保留Serving Size。照片中只有普通散装食物时允许通用成分表估算，标为estimate。
`;
export function verifyWebMatch(result,{barcode,photo=false,identity}={}){
 if(!result.searched||!result.sources.length)throw Error('未取得可追溯的联网产品资料，请补拍清晰标签');
 if(result.food.error)throw Error(String(result.food.error).slice(0,220));
 if(barcode&&!sameBarcode(barcode,result.food.matchedBarcode))throw Error('找到的商品条码与扫描结果不一致，请补拍包装核对');
 if(photo&&(identity?.brand||result.food.kind==='label')){
  if(result.food.productMatch!==true||!result.sources.some(s=>s.url===result.food.matchingSourceUrl))throw Error('已搜索品牌与产品，但尚不能确认同一规格，请补拍正面及完整标签');
 }
}
