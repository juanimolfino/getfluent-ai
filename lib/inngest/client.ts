import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "ai-saas-boilerplate",
  eventKey: process.env.INNGEST_EVENT_KEY
});
