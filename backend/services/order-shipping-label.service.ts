import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { prisma } from "../config/prisma";

export class ShippingLabelError extends Error { constructor(message:string,public status=422){super(message);} }
export type ShippingLabelData={orderId:number;tenantId:number;method:"delivery"|"pickup";recipient:string;phone:string;address:string;cep:string;sender:string;senderAddress:string;senderPhone:string;units:number;format:"100x150"|"a4";volumes:number};
const clean=(value:unknown,max:number,label:string)=>{
  if(value!=null && typeof value!=="string")throw new ShippingLabelError(`Confira o campo ${label}.`);
  const text=String(value??"").replace(/\r/g,"").trim();
  if(text.length>max)throw new ShippingLabelError(`${label}: use até ${max} caracteres.`);
  return text;
};
export async function loadShippingLabel(tenantId:number,orderId:number,database=prisma):Promise<ShippingLabelData>{
  if(!Number.isInteger(tenantId)||tenantId<1||!Number.isInteger(orderId)||orderId<1||orderId>2147483647)throw new ShippingLabelError("Pedido não encontrado.",404);
  const order=await database.order.findFirst({where:{id:orderId,tenant_id:tenantId,sales_channel:"storefront"},include:{tenant:true,items:{select:{quantity:true}}}});
  if(!order)throw new ShippingLabelError("Pedido da loja online não encontrado.",404);
  if(["cancelled","canceled"].includes(order.status))throw new ShippingLabelError("Este pedido está cancelado. A etiqueta de entrega não está disponível.",409);
  const tenant=order.tenant;
  const raw=order.customer_address||"";
  const cep=raw.match(/\bCEP\s*:?\s*(\d{5})-?(\d{3})/i);
  const structured=[tenant.address_street,tenant.address_number,tenant.address_complement,tenant.address_district,[tenant.address_city,tenant.address_state].filter(Boolean).join("/"),tenant.address_zip?`CEP ${tenant.address_zip}`:null].filter(Boolean).join(" - ");
  return{orderId,tenantId,method:order.delivery_method==="pickup"?"pickup":"delivery",recipient:order.customer_name||"",phone:order.customer_phone||"",address:raw.replace(/\s*[·-]?\s*CEP\s*:?\s*\d{5}-?\d{3}\s*$/i,"").trim(),cep:cep?cep[1]+cep[2]:"",sender:tenant.name,senderAddress:tenant.address||structured,senderPhone:tenant.whatsapp||"",units:order.items.reduce((sum,item)=>sum+item.quantity,0),format:"100x150",volumes:1};
}
export function shippingLabelInput(source:ShippingLabelData,input:any):ShippingLabelData{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new ShippingLabelError("Confira os dados da etiqueta.");
  const result={...source};
  for(const [key,max,label] of [["recipient",120,"Destinatário"],["phone",30,"Telefone"],["address",450,"Endereço"],["sender",120,"Remetente"],["senderAddress",450,"Endereço do remetente"],["senderPhone",30,"Telefone do remetente"]] as const){result[key]=clean(input[key]??source[key],max,label);}
  if(!result.recipient || !result.sender)throw new ShippingLabelError("Informe o nome do destinatário e do remetente.");
  result.cep=clean(input.cep??source.cep,12,"CEP").replace(/\D/g,"");
  result.method=input.method??source.method;
  if(!["pickup","delivery"].includes(result.method))throw new ShippingLabelError("Escolha entrega ou retirada.");
  if(result.method==="delivery" && (!result.address || result.address==="Retirada na loja"))throw new ShippingLabelError("Complete o endereço de entrega antes de gerar a etiqueta.");
  if(result.cep && result.cep.length!==8)throw new ShippingLabelError("Confira o CEP: ele deve ter 8 números.");
  result.format=input.format??source.format;
  if(!["100x150","a4"].includes(result.format))throw new ShippingLabelError("Escolha o formato 100 × 150 mm ou A4.");
  result.volumes=Number(input.volumes??source.volumes);
  if(!Number.isInteger(result.volumes)||result.volumes<1||result.volumes>20)throw new ShippingLabelError("Informe de 1 a 20 volumes.");
  return result;
}

const mm=(value:number)=>value*72/25.4;
export async function createShippingLabelPdf(data:ShippingLabelData):Promise<Buffer>{
  const barcode=await bwipjs.toBuffer({bcid:"code128",text:`BX-${data.tenantId}-${data.orderId}`,scale:3,height:11,includetext:false,paddingwidth:12,paddingheight:2,backgroundcolor:"FFFFFF"});
  const doc=new PDFDocument({autoFirstPage:false,margin:0,info:{Title:`Etiqueta do pedido #${data.orderId}`,Author:data.sender}});
  const chunks:Buffer[]=[];
  const complete=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>chunks.push(chunk));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  try{
    for(let volume=1;volume<=data.volumes;volume++){
      const w=mm(100),h=mm(150),a4=data.format==="a4";
      doc.addPage({size:a4?"A4":[w,h],margin:0});
      doc.save();doc.translate(a4?(doc.page.width-w)/2:0,a4?mm(12):0);
      if(a4)doc.rect(0,0,w,h).dash(2,{space:3}).strokeColor("#999999").lineWidth(.5).stroke().undash();
      const x=mm(4),width=w-2*x;
      const text=(value:string,y:number,maxHeight:number,size:number,min=8,bold=false)=>{
        doc.font(bold?"Helvetica-Bold":"Helvetica");
        let actual=size;
        while(actual>min && doc.fontSize(actual).heightOfString(value,{width,lineGap:1})>maxHeight)actual-=.25;
        doc.fontSize(actual);
        if(doc.heightOfString(value,{width,lineGap:1})>maxHeight+.1)throw new ShippingLabelError("Um texto não cabe na etiqueta. Reduza o endereço, o nome ou as observações sem remover informações necessárias à entrega.");
        doc.fillColor("#111111").text(value,x,y,{width,lineGap:1});
      };
      text(data.sender,mm(4),mm(8),10,8,true);
      doc.font("Helvetica-Bold").fontSize(18).text(`PEDIDO #${String(data.orderId).padStart(6,"0")}`,x,mm(14),{width});
      doc.fontSize(8).text(`${data.method==="pickup"?"RETIRADA NA LOJA":"ENTREGA AO DESTINATÁRIO"}  |  VOLUME ${volume}/${data.volumes}`,x,mm(23),{width});
      doc.image(barcode,x,mm(29),{fit:[width,mm(16)],align:"center"});
      doc.font("Helvetica").fontSize(7).text(`BX-${data.tenantId}-${data.orderId}  -  IDENTIFICAÇÃO INTERNA DO PEDIDO`,x,mm(46),{width,align:"center"});
      doc.moveTo(x,mm(53)).lineTo(w-x,mm(53)).lineWidth(1).strokeColor("#111111").stroke();
      doc.font("Helvetica-Bold").fontSize(8).text("DESTINATÁRIO",x,mm(57));
      text(data.recipient,mm(63),mm(13),13,9,true);
      text(data.method==="pickup"?"Retirada na loja - separar para o cliente.":data.address,mm(79),mm(30),11,8.5);
      doc.font("Helvetica-Bold").fontSize(13).text(data.method==="pickup"?"RETIRADA NA LOJA":data.cep?`CEP ${data.cep.slice(0,5)}-${data.cep.slice(5)}`:"ENTREGA LOCAL",x,mm(111),{width});
      doc.font("Helvetica").fontSize(8).text([data.phone?`Contato: ${data.phone}`:"",`${data.units} ${data.units===1?"item no pedido":"itens no pedido"}`].filter(Boolean).join("  |  "),x,mm(119),{width});
      doc.moveTo(x,mm(125)).lineTo(w-x,mm(125)).lineWidth(.5).stroke();
      text(`REMETENTE: ${data.sender}${data.senderPhone?` - ${data.senderPhone}`:""}`,mm(128),mm(7),7.5,6.5,true);
      text(data.senderAddress||"Endereço do remetente não informado.",mm(136),mm(8),7.5,6.5);
      doc.font("Helvetica").fontSize(6).text("Etiqueta de identificação. Não substitui postagem ou documento fiscal.",x,mm(146),{width,align:"center"});
      doc.restore();
    }
    doc.end();
  }catch(error){doc.end();await complete.catch(()=>undefined);throw error;}
  return complete;
}
