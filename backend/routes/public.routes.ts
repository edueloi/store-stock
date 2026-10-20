import { Router } from "express";

import { checkout, getPublicCheckoutOptions, getPublicStore, lookupPublicCompany, lookupPublicCustomerRecognition, requestStoreOrder, reserveStoreCart } from "../controllers/public.controller";
import { approveQuoteByToken, getQuoteByApprovalToken } from "../controllers/quote-approval.controller";
import { completeStoreCheckout, storeCheckoutDetails, storeCheckoutReceipt, storePostalAddress, limitStoreCheckout } from "../controllers/store-checkout.controller";

const router = Router();

router.get("/store", getPublicStore);
router.get("/store/:slug", getPublicStore);
router.post("/checkout", checkout);
router.post("/store-checkout", limitStoreCheckout, completeStoreCheckout);
router.post("/store-checkout/details", limitStoreCheckout, storeCheckoutDetails);
router.post("/store-checkout/receipt", limitStoreCheckout, storeCheckoutReceipt);
router.get("/postal-address/:cep", limitStoreCheckout, storePostalAddress);
router.post("/checkout-options", getPublicCheckoutOptions);
router.post("/company", lookupPublicCompany);
router.post("/customer-recognition", lookupPublicCustomerRecognition);
router.post("/reservations", reserveStoreCart);
router.post("/order-request", requestStoreOrder);

router.get("/quotes/:token", getQuoteByApprovalToken);
router.post("/quotes/:token/approve", approveQuoteByToken);

export default router;
