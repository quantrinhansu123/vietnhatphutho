import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {buildOrderProductionName,replaceCutLengthMeters} from '../../src/utils/productProductionName';

const server=readFileSync('server.ts','utf8');
const start=server.indexOf('function resolveStoredOrderProductionName(');
const end=server.indexOf('const PRODUCTION_ORDER_TYPE_SERVER',start);
const context=vm.createContext({buildOrderProductionName,replaceCutLengthMeters});
vm.runInContext(ts.transpileModule(server.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const selected='NHỰA SÓNG TRẮNG- Sóng phẳng - (đm 6.5kg/6m)-20M-NP';

test('API giữ tên sản xuất đã chọn, tên legacy không được ghi đè',()=>{
 assert.equal(context.resolveStoredOrderProductionName(selected,'Tên bán hàng',20),selected);
});
test('API không ghép lại tên canonical hoặc đổi định dạng khi lưu nhiều lần',()=>{
 const once=context.resolveStoredOrderProductionName(selected,'Tên bán hàng',20);
 assert.equal(once,selected);
 assert.equal(context.resolveStoredOrderProductionName(once,'Tên bán hàng',20),selected);
});
test('thiếu tên sản xuất không đọc tên legacy, chỉ dùng tên bán hàng dự phòng',()=>{
 assert.equal(context.resolveStoredOrderProductionName('','Hàng mẫu',null),'Hàng mẫu');
});

const ast=ts.createSourceFile('server.ts',server,ts.ScriptTarget.Latest,true);
const functions=new Set(['parseOrderQuantity','pickRowField','normalizeOrderProductStt','parseOrderProductsInput']);
const parser=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name&&functions.has(node.name.text)).map(node=>node.getText(ast)).join('\n');
Object.assign(context,{
 isRegionQuantityOrderTypeServer:()=>false,
 isCutLikeOrderTypeServer:(type:string)=>/cắt|miền nam/iu.test(type),
 stripSouthTemSuffixServer:(name:string)=>name,
 collapseDuplicateTrailingCutMetersServer:(name:string)=>name,
 replaceMangInName:()=>{throw Error('Canonical name must not be rewritten for film');},
 replaceDoLiDmInProductionName:()=>{throw Error('Canonical name must not be rewritten for thickness');},
 replaceDoLiTokenInProductionName:()=>{throw Error('Canonical name must not be rewritten for label');},
 appendSouthTemToProductionNameServer:(name:string)=>name,
 buildSouthTemSuffixServer:()=>'',
 detectOrderLineWidthMismatchServer:()=>null
});
vm.runInContext(ts.transpileModule(parser,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);

test('parse lưu đơn thường và cắt lẻ giữ đúng một tên, số lượng và KG nhập tay',()=>{
 for(const orderType of ['Đơn bán','Đơn cắt lẻ miền Bắc','Đơn miền nam']){
  const input={ma_sp:'STS06-8ZEM',ten_sp:'Tên bán hàng',ten_san_xuat:selected,ten_ghep:'Tên sai - 30m',don_vi:'Cuộn',so_luong:2,dai_m:20,tong_kg:123.4567,nguon_quy_doi:'khach_hang_nhap_kg',mang:'STD',do_li_dm:'(đm 1.2 li)',tem:'1li'};
  const result=context.parseOrderProductsInput({orderType,products:[input]});
  assert.equal(result.error,undefined);
  const row=result.products[0];assert.equal(row.ten_san_xuat,selected);assert.equal(row.so_luong,2);assert.equal(row.tong_kg,123.4567);assert.equal(row.nguon_quy_doi,'khach_hang_nhap_kg');assert.equal(Object.hasOwn(row,'ten_ghep'),false);
  const again=context.parseOrderProductsInput({orderType,products:result.products});assert.equal(again.products[0].ten_san_xuat,selected);
 }
});
