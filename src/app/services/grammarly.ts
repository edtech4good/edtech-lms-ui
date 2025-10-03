import * as Grammarly from "@grammarly/editor-sdk";
import { environment } from "src/environments/environment";

Grammarly.init(environment.GRAMMARLY_CLIENT_ID);