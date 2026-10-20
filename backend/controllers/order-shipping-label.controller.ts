import type {Request,Response} from "express";
import type {AuthenticatedRequest} from "../types/auth";
import {loadShippingLabel,shippingLabelInput,createShippingLabelPdf,ShippingLabelError} from "../services/order-shipping-label.service";
function errorResponse(error:unknown,res:Response){
  if(error instanceof ShippingLabelError){res.status(error.status).json({error:error.message});return;}
  console.error("Falha ao gerar etiqueta do pedido",{code:(error as any)?.code});
  res.status(500).json({error:"Não foi possível gerar a etiqueta. Tente novamente."});
}
export async function getOrderShippingLabel(req:Request,res:Response){
  res.setHeader("Cache-Control","no-store");
  try{res.json(await loadShippingLabel((req as AuthenticatedRequest).user.tenantId,Number(req.params.id)));}catch(error){errorResponse(error,res);}
}
export async function downloadOrderShippingLabel(req:Request,res:Response){
  res.setHeader("Cache-Control","no-store");
  try{
    const source=await loadShippingLabel((req as AuthenticatedRequest).user.tenantId,Number(req.params.id));
    const data=shippingLabelInput(source,req.body);
    const pdf=await createShippingLabelPdf(data);
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",`inline; filename="etiqueta-pedido-${data.orderId}.pdf"`);
    res.send(pdf);
  }catch(error){errorResponse(error,res);}
}
