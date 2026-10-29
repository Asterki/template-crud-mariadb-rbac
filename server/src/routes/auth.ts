import express from "express";

// Controllers
import accountsFetch from "../controllers/auth/fetch.js";
import accountsLogin from "../controllers/auth/login.js";
import accountsLogout from "../controllers/auth/logout.js";

// Middlewares
import { validateBody } from "../http/validation.js";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";

// Schemas
import { authSchemas } from "@template/shared";

const { loginAccountSchema } = authSchemas;

const router = express.Router();

// Account access
router.post("/login", [validateBody(loginAccountSchema)], accountsLogin);
router.post("/logout", [ensureAuthenticated], accountsLogout);
router.get("/fetch", [ensureAuthenticated], accountsFetch);

export default router;
